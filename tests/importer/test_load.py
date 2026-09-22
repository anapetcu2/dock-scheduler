import tempfile

import pytest
from sqlalchemy import select

from app.models.berths import Berth
from app.models.bookings import Booking, BookingStatus
from app.models.vessels import Vessel
from importer.load import run_import, scan_workbook
from importer.ruleset import load_config

from .builders import fill_cell, new_sheet, write_early_layout_month


@pytest.fixture()
def config():
    return load_config()


def _save(wb) -> str:
    tmp = tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False)
    wb.save(tmp.name)
    return tmp.name


class TestCrossMonthJoin:
    def test_same_name_at_month_boundary_merges_into_one_booking(self, config):
        wb, ws = new_sheet("2020")
        write_early_layout_month(
            ws, label_row=1, month_label="JANUARY 2020", first_weekday_index=2, num_days=31
        )
        ws.cell(row=4, column=1, value="Test Berth - 100'")
        fill_cell(ws, 4, 32, "R/V Joined Boat")  # day 31 of January = column 32

        write_early_layout_month(
            ws, label_row=8, month_label="FEBRUARY 2020", first_weekday_index=5, num_days=29
        )
        ws.cell(row=11, column=1, value="Test Berth - 100'")
        fill_cell(ws, 11, 2, "R/V Joined Boat")  # day 1 of February

        path = _save(wb)
        stats = scan_workbook(path, config)

        joined = [
            b for b in stats.bookings if b.vessel_mention and b.vessel_mention.name == "Joined Boat"
        ]
        assert len(joined) == 1
        assert joined[0].start_date.isoformat() == "2020-01-31"
        assert joined[0].end_date.isoformat() == "2020-02-01"

    def test_unnamed_continuation_with_no_preceding_span_is_orphan_fill(self, config):
        wb, ws = new_sheet("2020")
        write_early_layout_month(
            ws, label_row=1, month_label="JANUARY 2020", first_weekday_index=2, num_days=31
        )
        ws.cell(row=4, column=1, value="Test Berth - 100'")
        # No booking at all in January.

        write_early_layout_month(
            ws, label_row=8, month_label="FEBRUARY 2020", first_weekday_index=5, num_days=29
        )
        ws.cell(row=11, column=1, value="Test Berth - 100'")
        fill_cell(ws, 11, 2)  # unnamed colored cell on day 1, nothing to join to

        path = _save(wb)
        stats = scan_workbook(path, config)

        assert any(i.issue_type.value == "ORPHAN_FILL" for i in stats.issues)
        assert stats.bookings == []


class TestEndToEndImport:
    def test_import_creates_berth_vessel_and_booking(self, db_session, config):
        wb, ws = new_sheet("2020")
        write_early_layout_month(
            ws, label_row=1, month_label="JANUARY 2020", first_weekday_index=2, num_days=31
        )
        ws.cell(row=4, column=1, value="Test Berth - 100'")
        fill_cell(ws, 4, 3, "R/V Solo Boat")
        fill_cell(ws, 4, 4)  # unnamed continuation, same booking
        path = _save(wb)

        stats, summary = run_import(db_session, path, reset=False, config=config)
        db_session.flush()

        berth = db_session.scalar(select(Berth).where(Berth.name == "Test Berth"))
        assert berth is not None
        assert berth.length_ft == 100

        vessel = db_session.scalar(select(Vessel).where(Vessel.normalized_key == "RV|SOLO BOAT"))
        assert vessel is not None

        booking = db_session.scalar(select(Booking).where(Booking.vessel_id == vessel.id))
        assert booking is not None
        assert booking.start_date.isoformat() == "2020-01-02"
        assert booking.end_date.isoformat() == "2020-01-03"
        assert booking.status == BookingStatus.confirmed
        assert booking.source.value == "import"

    def test_reset_is_idempotent(self, db_session, config):
        wb, ws = new_sheet("2020")
        write_early_layout_month(
            ws, label_row=1, month_label="JANUARY 2020", first_weekday_index=2, num_days=31
        )
        ws.cell(row=4, column=1, value="Idempotent Berth - 50'")
        fill_cell(ws, 4, 3, "R/V Idempotent Boat")
        path = _save(wb)

        run_import(db_session, path, reset=False, config=config)
        db_session.flush()
        first_berth_count = (
            db_session.scalar(select(Berth).where(Berth.name == "Idempotent Berth")) is not None
        )
        assert first_berth_count

        # Re-running with --reset must not violate the berths.name or
        # vessels.normalized_key unique constraints.
        run_import(db_session, path, reset=True, config=config)
        db_session.flush()

        berths = db_session.scalars(select(Berth).where(Berth.name == "Idempotent Berth")).all()
        assert len(berths) == 1

        bookings = db_session.scalars(select(Booking).where(Booking.berth_id == berths[0].id)).all()
        assert len(bookings) == 1  # the reset run's booking, not a duplicate of the first run's
