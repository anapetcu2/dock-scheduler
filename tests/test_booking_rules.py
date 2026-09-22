from datetime import date, timedelta

from app.models.bookings import Booking, BookingKind, BookingSource, BookingStatus
from app.services.booking_rules import BookingProposal, validate_booking

_ANCHOR = date.today() + timedelta(days=30)


def d(day_of_month: int) -> date:
    """A date safely in the future, `day_of_month` days into a fixed
    30-day-out anchor window — keeps the tests' relative day math (adjacent
    dates, overlaps, etc.) readable while never landing in the past."""
    return _ANCHOR + timedelta(days=day_of_month - 1)


def _add_booking(
    session,
    *,
    berth,
    vessel=None,
    kind=BookingKind.vessel,
    title=None,
    start,
    end,
    status=BookingStatus.confirmed,
) -> Booking:
    booking = Booking(
        berth_id=berth.id,
        kind=kind,
        vessel_id=vessel.id if vessel else None,
        title=title,
        start_date=start,
        end_date=end,
        status=status,
        source=BookingSource.app,
    )
    session.add(booking)
    session.flush()
    return booking


def _proposal(**overrides) -> BookingProposal:
    defaults = dict(
        berth_id=None,
        kind=BookingKind.vessel,
        start_date=d(1),
        end_date=d(5),
        status=BookingStatus.confirmed,
        vessel_id=None,
        title=None,
    )
    defaults.update(overrides)
    return BookingProposal(**defaults)


class TestOverlap:
    def test_overlapping_dates_rejected(self, db_session, make_berth, make_vessel):
        berth = make_berth()
        vessel = make_vessel()
        _add_booking(db_session, berth=berth, vessel=vessel, start=d(1), end=d(10))

        other_vessel = make_vessel()
        result = validate_booking(
            db_session,
            _proposal(
                berth_id=berth.id,
                vessel_id=other_vessel.id,
                start_date=d(5),
                end_date=d(15),
            ),
        )

        assert not result.ok
        assert any(issue.code == "OVERLAP" for issue in result.errors)

    def test_same_day_turnover_rejected(self, db_session, make_berth, make_vessel):
        berth = make_berth()
        vessel = make_vessel()
        _add_booking(db_session, berth=berth, vessel=vessel, start=d(1), end=d(10))

        other_vessel = make_vessel()
        result = validate_booking(
            db_session,
            _proposal(
                berth_id=berth.id,
                vessel_id=other_vessel.id,
                start_date=d(10),
                end_date=d(15),
            ),
        )

        assert not result.ok
        assert any(issue.code == "OVERLAP" for issue in result.errors)

    def test_adjacent_dates_accepted(self, db_session, make_berth, make_vessel):
        berth = make_berth()
        vessel = make_vessel()
        _add_booking(db_session, berth=berth, vessel=vessel, start=d(1), end=d(4))

        other_vessel = make_vessel()
        result = validate_booking(
            db_session,
            _proposal(
                berth_id=berth.id,
                vessel_id=other_vessel.id,
                start_date=d(5),
                end_date=d(10),
            ),
        )

        assert result.ok
        assert not any(issue.code == "OVERLAP" for issue in result.errors)

    def test_cancelled_booking_does_not_block(self, db_session, make_berth, make_vessel):
        berth = make_berth()
        vessel = make_vessel()
        _add_booking(
            db_session,
            berth=berth,
            vessel=vessel,
            start=d(1),
            end=d(10),
            status=BookingStatus.cancelled,
        )

        other_vessel = make_vessel()
        result = validate_booking(
            db_session,
            _proposal(
                berth_id=berth.id,
                vessel_id=other_vessel.id,
                start_date=d(3),
                end_date=d(7),
            ),
        )

        assert result.ok

    def test_legacy_conflict_booking_does_not_block(self, db_session, make_berth, make_vessel):
        berth = make_berth()
        vessel = make_vessel()
        _add_booking(
            db_session,
            berth=berth,
            vessel=vessel,
            start=d(1),
            end=d(10),
            status=BookingStatus.legacy_conflict,
        )

        other_vessel = make_vessel()
        result = validate_booking(
            db_session,
            _proposal(
                berth_id=berth.id,
                vessel_id=other_vessel.id,
                start_date=d(3),
                end_date=d(7),
            ),
        )

        assert result.ok

    def test_editing_a_booking_does_not_conflict_with_itself(
        self, db_session, make_berth, make_vessel
    ):
        berth = make_berth()
        vessel = make_vessel()
        booking = _add_booking(db_session, berth=berth, vessel=vessel, start=d(1), end=d(10))

        result = validate_booking(
            db_session,
            _proposal(
                berth_id=berth.id,
                vessel_id=vessel.id,
                start_date=d(2),
                end_date=d(9),
            ),
            exclude_booking_id=booking.id,
        )

        assert result.ok

    def test_saving_as_cancelled_skips_overlap_check(self, db_session, make_berth, make_vessel):
        """A booking being saved as cancelled/legacy_conflict never needs to
        clear OVERLAP, since it doesn't hold the berth either way."""
        berth = make_berth()
        vessel = make_vessel()
        _add_booking(db_session, berth=berth, vessel=vessel, start=d(1), end=d(10))

        other_vessel = make_vessel()
        result = validate_booking(
            db_session,
            _proposal(
                berth_id=berth.id,
                vessel_id=other_vessel.id,
                start_date=d(3),
                end_date=d(7),
                status=BookingStatus.cancelled,
            ),
        )

        assert not any(issue.code == "OVERLAP" for issue in result.errors)


class TestVesselDoubleBooking:
    """A vessel can't be in two places at once, even if the two berths
    involved are each individually free for those dates."""

    def test_same_vessel_overlapping_dates_on_different_berth_rejected(
        self, db_session, make_berth, make_vessel
    ):
        vessel = make_vessel()
        _add_booking(db_session, berth=make_berth(), vessel=vessel, start=d(1), end=d(10))

        result = validate_booking(
            db_session,
            _proposal(
                berth_id=make_berth().id,
                vessel_id=vessel.id,
                start_date=d(5),
                end_date=d(15),
            ),
        )

        assert not result.ok
        assert any(issue.code == "VESSEL_DOUBLE_BOOKED" for issue in result.errors)

    def test_same_vessel_same_berth_overlap_is_reported_as_overlap_not_double_booked(
        self, db_session, make_berth, make_vessel
    ):
        """A same-berth clash is already OVERLAP; VESSEL_DOUBLE_BOOKED is
        specifically for the cross-berth case, so it shouldn't also fire
        here and duplicate the message."""
        berth = make_berth()
        vessel = make_vessel()
        _add_booking(db_session, berth=berth, vessel=vessel, start=d(1), end=d(10))

        result = validate_booking(
            db_session,
            _proposal(berth_id=berth.id, vessel_id=vessel.id, start_date=d(5), end_date=d(15)),
        )

        assert any(issue.code == "OVERLAP" for issue in result.errors)
        assert not any(issue.code == "VESSEL_DOUBLE_BOOKED" for issue in result.errors)

    def test_same_vessel_non_overlapping_dates_on_different_berths_accepted(
        self, db_session, make_berth, make_vessel
    ):
        vessel = make_vessel()
        _add_booking(db_session, berth=make_berth(), vessel=vessel, start=d(1), end=d(10))

        result = validate_booking(
            db_session,
            _proposal(
                berth_id=make_berth().id,
                vessel_id=vessel.id,
                start_date=d(11),
                end_date=d(20),
            ),
        )

        assert not any(issue.code == "VESSEL_DOUBLE_BOOKED" for issue in result.errors)

    def test_editing_a_booking_does_not_conflict_with_itself_across_berths(
        self, db_session, make_berth, make_vessel
    ):
        vessel = make_vessel()
        booking = _add_booking(db_session, berth=make_berth(), vessel=vessel, start=d(1), end=d(10))

        result = validate_booking(
            db_session,
            _proposal(
                berth_id=booking.berth_id, vessel_id=vessel.id, start_date=d(2), end_date=d(9)
            ),
            exclude_booking_id=booking.id,
        )

        assert not any(issue.code == "VESSEL_DOUBLE_BOOKED" for issue in result.errors)

    def test_cancelled_vessel_booking_does_not_block(self, db_session, make_berth, make_vessel):
        vessel = make_vessel()
        _add_booking(
            db_session,
            berth=make_berth(),
            vessel=vessel,
            start=d(1),
            end=d(10),
            status=BookingStatus.cancelled,
        )

        result = validate_booking(
            db_session,
            _proposal(
                berth_id=make_berth().id, vessel_id=vessel.id, start_date=d(3), end_date=d(7)
            ),
        )

        assert not any(issue.code == "VESSEL_DOUBLE_BOOKED" for issue in result.errors)


class TestFit:
    def test_too_long_vessel_rejected(self, db_session, make_berth, make_vessel):
        berth = make_berth(length_ft=75)
        vessel = make_vessel(loa_ft=145)

        result = validate_booking(db_session, _proposal(berth_id=berth.id, vessel_id=vessel.id))

        assert not result.ok
        assert any(issue.code == "VESSEL_TOO_LONG" for issue in result.errors)

    def test_unknown_vessel_length_rejected(self, db_session, make_berth, make_vessel):
        berth = make_berth(length_ft=100)
        vessel = make_vessel(loa_ft=None)

        result = validate_booking(db_session, _proposal(berth_id=berth.id, vessel_id=vessel.id))

        assert not result.ok
        assert any(issue.code == "VESSEL_LENGTH_UNKNOWN" for issue in result.errors)

    def test_unknown_berth_length_rejected(self, db_session, make_berth, make_vessel):
        berth = make_berth(length_ft=None)
        vessel = make_vessel(loa_ft=50)

        result = validate_booking(db_session, _proposal(berth_id=berth.id, vessel_id=vessel.id))

        assert not result.ok
        assert any(issue.code == "BERTH_LENGTH_UNKNOWN" for issue in result.errors)

    def test_events_skip_fit_checks(self, db_session, make_berth):
        berth = make_berth(length_ft=None)  # would fail every vessel fit check

        result = validate_booking(
            db_session,
            _proposal(berth_id=berth.id, kind=BookingKind.event, title="Community sail day"),
        )

        assert result.ok

    def test_closures_skip_fit_checks(self, db_session, make_berth):
        berth = make_berth(length_ft=None)

        result = validate_booking(
            db_session,
            _proposal(berth_id=berth.id, kind=BookingKind.closure, title="Pier repair"),
        )

        assert result.ok

    def test_tight_fit_warns_but_does_not_block(self, db_session, make_berth, make_vessel):
        berth = make_berth(length_ft=100)
        vessel = make_vessel(loa_ft=96)  # 4' to spare, under the 5' default

        result = validate_booking(db_session, _proposal(berth_id=berth.id, vessel_id=vessel.id))

        assert result.ok
        assert any(issue.code == "TIGHT_FIT" for issue in result.warnings)

    def test_comfortable_fit_has_no_warning(self, db_session, make_berth, make_vessel):
        berth = make_berth(length_ft=100)
        vessel = make_vessel(loa_ft=50)

        result = validate_booking(db_session, _proposal(berth_id=berth.id, vessel_id=vessel.id))

        assert result.ok
        assert not result.warnings

    def test_draft_exceeds_depth_warns(self, db_session, make_berth, make_vessel):
        berth = make_berth(length_ft=100, max_draft_ft=6)
        vessel = make_vessel(loa_ft=50, draft_ft=8)

        result = validate_booking(db_session, _proposal(berth_id=berth.id, vessel_id=vessel.id))

        assert result.ok
        assert any(issue.code == "DRAFT_EXCEEDS_DEPTH" for issue in result.warnings)


class TestStructuralRules:
    def test_invalid_dates_rejected(self, db_session, make_berth, make_vessel):
        berth = make_berth()
        vessel = make_vessel()

        result = validate_booking(
            db_session,
            _proposal(
                berth_id=berth.id,
                vessel_id=vessel.id,
                start_date=d(10),
                end_date=d(1),
            ),
        )

        assert not result.ok
        assert any(issue.code == "INVALID_DATES" for issue in result.errors)

    def test_missing_vessel_rejected(self, db_session, make_berth):
        berth = make_berth()

        result = validate_booking(db_session, _proposal(berth_id=berth.id, vessel_id=None))

        assert not result.ok
        assert any(issue.code == "MISSING_VESSEL" for issue in result.errors)

    def test_missing_title_rejected(self, db_session, make_berth):
        berth = make_berth()

        result = validate_booking(
            db_session, _proposal(berth_id=berth.id, kind=BookingKind.event, title=None)
        )

        assert not result.ok
        assert any(issue.code == "MISSING_TITLE" for issue in result.errors)

    def test_inactive_berth_rejected(self, db_session, make_berth, make_vessel):
        berth = make_berth(is_active=False)
        vessel = make_vessel()

        result = validate_booking(db_session, _proposal(berth_id=berth.id, vessel_id=vessel.id))

        assert not result.ok
        assert any(issue.code == "BERTH_INACTIVE" for issue in result.errors)

    def test_start_date_in_past_warns_but_does_not_block(self, db_session, make_berth, make_vessel):
        berth = make_berth()
        vessel = make_vessel()

        result = validate_booking(
            db_session,
            _proposal(
                berth_id=berth.id,
                vessel_id=vessel.id,
                start_date=date.today() - timedelta(days=5),
                end_date=date.today() - timedelta(days=1),
            ),
        )

        assert result.ok
        assert any(issue.code == "IN_PAST" for issue in result.warnings)
