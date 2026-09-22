import threading
from datetime import date
from uuid import uuid4

import pytest
from sqlalchemy.orm import sessionmaker

from app.models.audit import AuditAction, AuditEvent
from app.models.berths import Berth
from app.models.bookings import Booking, BookingKind, BookingStatus
from app.models.vessels import Vessel
from app.services.bookings import (
    BookingInput,
    cancel_booking,
    create_booking,
    delete_booking,
    update_booking,
)
from app.services.exceptions import BookingConflictError, BookingValidationError


def _input(**overrides) -> BookingInput:
    defaults = dict(
        berth_id=None,
        kind=BookingKind.vessel,
        start_date=date(2026, 9, 1),
        end_date=date(2026, 9, 5),
        status=BookingStatus.confirmed,
        vessel_id=None,
        title=None,
        notes=None,
    )
    defaults.update(overrides)
    return BookingInput(**defaults)


class TestCreateBooking:
    def test_success_persists_and_records_audit(
        self, db_session, make_berth, make_vessel, make_user
    ):
        berth = make_berth()
        vessel = make_vessel()
        user = make_user()

        booking = create_booking(
            db_session, _input(berth_id=berth.id, vessel_id=vessel.id), created_by=user.id
        )

        assert booking.id is not None
        event = (
            db_session.query(AuditEvent)
            .filter_by(entity_type="booking", entity_id=booking.id, action=AuditAction.create)
            .one()
        )
        assert event.user_id == user.id
        assert event.before is None
        assert event.after["berth_id"] == berth.id

    def test_invalid_proposal_raises_and_does_not_persist(self, db_session, make_berth):
        berth = make_berth(length_ft=50)

        with pytest.raises(BookingValidationError) as exc_info:
            create_booking(db_session, _input(berth_id=berth.id, vessel_id=None), created_by=None)

        assert not exc_info.value.result.ok
        assert db_session.query(Booking).count() == 0


class TestUpdateBooking:
    def test_editing_dates_does_not_conflict_with_itself(
        self, db_session, make_berth, make_vessel, make_user
    ):
        berth = make_berth()
        vessel = make_vessel()
        user = make_user()
        booking = create_booking(
            db_session, _input(berth_id=berth.id, vessel_id=vessel.id), created_by=user.id
        )

        updated = update_booking(
            db_session,
            booking,
            _input(
                berth_id=berth.id,
                vessel_id=vessel.id,
                start_date=date(2026, 9, 2),
                end_date=date(2026, 9, 6),
            ),
            user_id=user.id,
        )

        assert updated.start_date == date(2026, 9, 2)
        event = (
            db_session.query(AuditEvent)
            .filter_by(entity_type="booking", entity_id=booking.id, action=AuditAction.update)
            .one()
        )
        assert event.before["start_date"] == "2026-09-01"
        assert event.after["start_date"] == "2026-09-02"

    def test_editing_into_a_real_conflict_is_rejected(
        self, db_session, make_berth, make_vessel, make_user
    ):
        berth = make_berth()
        vessel = make_vessel()
        user = make_user()
        blocker = create_booking(
            db_session,
            _input(
                berth_id=berth.id,
                vessel_id=make_vessel().id,
                start_date=date(2026, 10, 1),
                end_date=date(2026, 10, 10),
            ),
            created_by=user.id,
        )
        movable = create_booking(
            db_session,
            _input(
                berth_id=berth.id,
                vessel_id=vessel.id,
                start_date=date(2026, 11, 1),
                end_date=date(2026, 11, 10),
            ),
            created_by=user.id,
        )

        with pytest.raises(BookingValidationError) as exc_info:
            update_booking(
                db_session,
                movable,
                _input(
                    berth_id=berth.id,
                    vessel_id=vessel.id,
                    start_date=date(2026, 10, 5),
                    end_date=date(2026, 10, 8),
                ),
                user_id=user.id,
            )

        assert any(issue.related_booking_id == blocker.id for issue in exc_info.value.result.errors)


class TestCancelAndDelete:
    def test_cancel_sets_status_without_running_fit_or_overlap_checks(
        self, db_session, make_berth, make_vessel, make_user
    ):
        berth = make_berth()
        vessel = make_vessel()
        user = make_user()
        booking = create_booking(
            db_session, _input(berth_id=berth.id, vessel_id=vessel.id), created_by=user.id
        )

        cancel_booking(db_session, booking, user_id=user.id)

        assert booking.status == BookingStatus.cancelled
        event = (
            db_session.query(AuditEvent)
            .filter_by(entity_type="booking", entity_id=booking.id, action=AuditAction.cancel)
            .one()
        )
        assert event.after["status"] == "cancelled"

    def test_delete_removes_row_and_records_audit(
        self, db_session, make_berth, make_vessel, make_user
    ):
        berth = make_berth()
        vessel = make_vessel()
        user = make_user()
        booking = create_booking(
            db_session, _input(berth_id=berth.id, vessel_id=vessel.id), created_by=user.id
        )
        booking_id = booking.id

        delete_booking(db_session, booking, user_id=user.id)

        assert db_session.query(Booking).filter_by(id=booking_id).first() is None
        event = (
            db_session.query(AuditEvent)
            .filter_by(entity_type="booking", entity_id=booking_id, action=AuditAction.delete)
            .one()
        )
        assert event.after is None


def test_concurrent_create_booking_one_wins_one_gets_conflict_error(test_engine):
    """Both sessions pass validate_booking (neither sees the other's
    uncommitted row), so the loser must be caught via the exclusion
    constraint and surfaced as BookingConflictError, not a bare crash."""
    session_factory = sessionmaker(bind=test_engine)
    suffix = uuid4().hex[:8]

    setup = session_factory()
    berth = Berth(name=f"Race Berth {suffix}", length_ft=100, is_active=True, sort_order=0)
    vessel_a = Vessel(
        name=f"Racer A {suffix}",
        normalized_key=f"RV|SVC RACER A {suffix}",
        loa_ft=50,
        is_active=True,
    )
    vessel_b = Vessel(
        name=f"Racer B {suffix}",
        normalized_key=f"RV|SVC RACER B {suffix}",
        loa_ft=50,
        is_active=True,
    )
    setup.add_all([berth, vessel_a, vessel_b])
    setup.commit()
    berth_id, vessel_a_id, vessel_b_id = berth.id, vessel_a.id, vessel_b.id
    setup.close()

    barrier = threading.Barrier(2)
    outcomes: dict[str, tuple[str, int | None]] = {}

    def attempt(label: str, vessel_id: int) -> None:
        session = session_factory()
        try:
            barrier.wait(timeout=5)
            booking = create_booking(
                session,
                _input(
                    berth_id=berth_id,
                    vessel_id=vessel_id,
                    start_date=date(2026, 12, 1),
                    end_date=date(2026, 12, 10),
                ),
                created_by=None,
            )
            session.commit()
            outcomes[label] = ("success", booking.id)
        except BookingConflictError:
            session.rollback()
            outcomes[label] = ("conflict", None)
        finally:
            session.close()

    threads = [
        threading.Thread(target=attempt, args=("first", vessel_a_id)),
        threading.Thread(target=attempt, args=("second", vessel_b_id)),
    ]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    try:
        statuses = sorted(status for status, _ in outcomes.values())
        assert statuses == ["conflict", "success"]
    finally:
        winning_booking_id = next(bid for status, bid in outcomes.values() if status == "success")
        cleanup = session_factory()
        cleanup.query(AuditEvent).filter(
            AuditEvent.entity_type == "booking", AuditEvent.entity_id == winning_booking_id
        ).delete(synchronize_session=False)
        cleanup.query(Booking).filter(Booking.berth_id == berth_id).delete()
        cleanup.query(Vessel).filter(Vessel.id.in_([vessel_a_id, vessel_b_id])).delete(
            synchronize_session=False
        )
        cleanup.query(Berth).filter(Berth.id == berth_id).delete()
        cleanup.commit()
        cleanup.close()
