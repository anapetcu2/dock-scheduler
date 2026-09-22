"""Tests that the database itself — not just booking_rules.py — refuses bad
data. These insert directly with SQLAlchemy, bypassing validate_booking, to
prove the constraints hold even if application code has a bug.
"""

import threading
from datetime import date
from uuid import uuid4

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker

from app.models.berths import Berth
from app.models.bookings import Booking, BookingKind, BookingSource, BookingStatus
from app.models.vessels import Vessel


def _booking(**overrides) -> Booking:
    defaults = dict(
        kind=BookingKind.vessel,
        start_date=date(2026, 7, 1),
        end_date=date(2026, 7, 10),
        status=BookingStatus.confirmed,
        source=BookingSource.app,
    )
    defaults.update(overrides)
    return Booking(**defaults)


class TestExclusionConstraint:
    def test_overlapping_active_bookings_rejected_at_db_level(
        self, db_session, make_berth, make_vessel
    ):
        berth = make_berth()
        db_session.add(
            _booking(
                berth_id=berth.id,
                vessel_id=make_vessel().id,
                start_date=date(2026, 7, 1),
                end_date=date(2026, 7, 10),
            )
        )
        db_session.flush()

        db_session.add(
            _booking(
                berth_id=berth.id,
                vessel_id=make_vessel().id,
                start_date=date(2026, 7, 5),
                end_date=date(2026, 7, 15),
            )
        )
        with pytest.raises(IntegrityError) as exc_info:
            db_session.flush()

        assert "bookings_no_overlap" in str(exc_info.value)

    def test_cancelled_bookings_do_not_trigger_exclusion(self, db_session, make_berth, make_vessel):
        berth = make_berth()
        db_session.add(
            _booking(
                berth_id=berth.id,
                vessel_id=make_vessel().id,
                start_date=date(2026, 7, 1),
                end_date=date(2026, 7, 10),
                status=BookingStatus.cancelled,
            )
        )
        db_session.flush()

        db_session.add(
            _booking(
                berth_id=berth.id,
                vessel_id=make_vessel().id,
                start_date=date(2026, 7, 1),
                end_date=date(2026, 7, 10),
                status=BookingStatus.confirmed,
            )
        )
        db_session.flush()  # must not raise

    def test_legacy_conflict_bookings_do_not_trigger_exclusion(
        self, db_session, make_berth, make_vessel
    ):
        berth = make_berth()
        db_session.add(
            _booking(
                berth_id=berth.id,
                vessel_id=make_vessel().id,
                start_date=date(2026, 7, 1),
                end_date=date(2026, 7, 10),
                status=BookingStatus.legacy_conflict,
            )
        )
        db_session.flush()

        db_session.add(
            _booking(
                berth_id=berth.id,
                vessel_id=make_vessel().id,
                start_date=date(2026, 7, 1),
                end_date=date(2026, 7, 10),
                status=BookingStatus.legacy_conflict,
            )
        )
        db_session.flush()  # must not raise


class TestVesselExclusionConstraint:
    """A vessel can't be in two places at once — bookings_vessel_no_overlap
    mirrors bookings_no_overlap but keyed on vessel_id across berths."""

    def test_same_vessel_overlapping_dates_on_different_berths_rejected_at_db_level(
        self, db_session, make_berth, make_vessel
    ):
        vessel = make_vessel()
        db_session.add(
            _booking(
                berth_id=make_berth().id,
                vessel_id=vessel.id,
                start_date=date(2026, 7, 1),
                end_date=date(2026, 7, 10),
            )
        )
        db_session.flush()

        db_session.add(
            _booking(
                berth_id=make_berth().id,
                vessel_id=vessel.id,
                start_date=date(2026, 7, 5),
                end_date=date(2026, 7, 15),
            )
        )
        with pytest.raises(IntegrityError) as exc_info:
            db_session.flush()

        assert "bookings_vessel_no_overlap" in str(exc_info.value)

    def test_same_vessel_non_overlapping_dates_on_different_berths_allowed(
        self, db_session, make_berth, make_vessel
    ):
        vessel = make_vessel()
        db_session.add(
            _booking(
                berth_id=make_berth().id,
                vessel_id=vessel.id,
                start_date=date(2026, 7, 1),
                end_date=date(2026, 7, 10),
            )
        )
        db_session.flush()

        db_session.add(
            _booking(
                berth_id=make_berth().id,
                vessel_id=vessel.id,
                start_date=date(2026, 7, 11),
                end_date=date(2026, 7, 20),
            )
        )
        db_session.flush()  # adjacent, not overlapping — must not raise

    def test_different_vessels_same_dates_on_different_berths_allowed(
        self, db_session, make_berth, make_vessel
    ):
        db_session.add(
            _booking(
                berth_id=make_berth().id,
                vessel_id=make_vessel().id,
                start_date=date(2026, 7, 1),
                end_date=date(2026, 7, 10),
            )
        )
        db_session.flush()

        db_session.add(
            _booking(
                berth_id=make_berth().id,
                vessel_id=make_vessel().id,
                start_date=date(2026, 7, 1),
                end_date=date(2026, 7, 10),
            )
        )
        db_session.flush()  # different vessels — must not raise

    def test_cancelled_vessel_booking_does_not_trigger_exclusion(
        self, db_session, make_berth, make_vessel
    ):
        vessel = make_vessel()
        db_session.add(
            _booking(
                berth_id=make_berth().id,
                vessel_id=vessel.id,
                start_date=date(2026, 7, 1),
                end_date=date(2026, 7, 10),
                status=BookingStatus.cancelled,
            )
        )
        db_session.flush()

        db_session.add(
            _booking(
                berth_id=make_berth().id,
                vessel_id=vessel.id,
                start_date=date(2026, 7, 1),
                end_date=date(2026, 7, 10),
                status=BookingStatus.confirmed,
            )
        )
        db_session.flush()  # must not raise


class TestCheckConstraints:
    def test_vessel_kind_requires_vessel_id(self, db_session, make_berth):
        berth = make_berth()
        db_session.add(_booking(berth_id=berth.id, kind=BookingKind.vessel, vessel_id=None))
        with pytest.raises(IntegrityError) as exc_info:
            db_session.flush()
        assert "ck_bookings_vessel_id_matches_kind" in str(exc_info.value)

    def test_non_vessel_kind_forbids_vessel_id(self, db_session, make_berth, make_vessel):
        berth = make_berth()
        db_session.add(
            _booking(
                berth_id=berth.id,
                kind=BookingKind.event,
                vessel_id=make_vessel().id,
                title="Reception",
            )
        )
        with pytest.raises(IntegrityError) as exc_info:
            db_session.flush()
        assert "ck_bookings_vessel_id_matches_kind" in str(exc_info.value)

    def test_non_vessel_kind_requires_title(self, db_session, make_berth):
        berth = make_berth()
        db_session.add(_booking(berth_id=berth.id, kind=BookingKind.closure, title=None))
        with pytest.raises(IntegrityError) as exc_info:
            db_session.flush()
        assert "ck_bookings_title_required_unless_vessel" in str(exc_info.value)

    def test_end_date_before_start_date_rejected(self, db_session, make_berth, make_vessel):
        berth = make_berth()
        db_session.add(
            _booking(
                berth_id=berth.id,
                vessel_id=make_vessel().id,
                start_date=date(2026, 7, 10),
                end_date=date(2026, 7, 1),
            )
        )
        with pytest.raises(IntegrityError) as exc_info:
            db_session.flush()
        assert "ck_bookings_dates" in str(exc_info.value)


def test_concurrent_inserts_for_same_berth_and_dates_exactly_one_succeeds(test_engine):
    """Two independent, committed sessions race to book the same berth for
    the same dates. This uses its own transactions (not the rolled-back
    `db_session` fixture) and cleans up its own rows afterward."""
    session_factory = sessionmaker(bind=test_engine)
    suffix = uuid4().hex[:8]

    setup = session_factory()
    berth = Berth(name=f"Race Berth {suffix}", length_ft=100, is_active=True, sort_order=0)
    vessel_a = Vessel(
        name=f"Racer A {suffix}", normalized_key=f"RV|RACER A {suffix}", loa_ft=50, is_active=True
    )
    vessel_b = Vessel(
        name=f"Racer B {suffix}", normalized_key=f"RV|RACER B {suffix}", loa_ft=50, is_active=True
    )
    setup.add_all([berth, vessel_a, vessel_b])
    setup.commit()
    berth_id, vessel_a_id, vessel_b_id = berth.id, vessel_a.id, vessel_b.id
    setup.close()

    outcomes: dict[str, str] = {}

    def attempt(label: str, vessel_id: int) -> None:
        session = session_factory()
        try:
            session.add(
                _booking(
                    berth_id=berth_id,
                    vessel_id=vessel_id,
                    start_date=date(2026, 8, 1),
                    end_date=date(2026, 8, 10),
                )
            )
            session.commit()
            outcomes[label] = "success"
        except IntegrityError:
            session.rollback()
            outcomes[label] = "conflict"
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
        assert sorted(outcomes.values()) == ["conflict", "success"]
    finally:
        cleanup = session_factory()
        cleanup.query(Booking).filter(Booking.berth_id == berth_id).delete()
        cleanup.query(Vessel).filter(Vessel.id.in_([vessel_a_id, vessel_b_id])).delete(
            synchronize_session=False
        )
        cleanup.query(Berth).filter(Berth.id == berth_id).delete()
        cleanup.commit()
        cleanup.close()
