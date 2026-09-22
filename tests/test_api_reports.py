from datetime import date

from app.models.bookings import Booking, BookingKind, BookingSource, BookingStatus


class TestUtilizationReport:
    def test_is_public(self, client):
        resp = client.get("/api/reports/utilization", params={"year_from": 2020, "year_to": 2020})
        assert resp.status_code == 200

    def test_year_to_before_year_from_is_422(self, client):
        resp = client.get("/api/reports/utilization", params={"year_from": 2020, "year_to": 2019})
        assert resp.status_code == 422

    def test_counts_confirmed_days_and_splits_out_tentative(self, client, db_session, make_berth):
        berth = make_berth(length_ft=100)
        db_session.add(
            Booking(
                berth_id=berth.id,
                kind=BookingKind.event,
                title="Confirmed event",
                start_date=date(2021, 1, 1),
                end_date=date(2021, 1, 10),
                status=BookingStatus.confirmed,
                source=BookingSource.app,
            )
        )
        db_session.add(
            Booking(
                berth_id=berth.id,
                kind=BookingKind.event,
                title="Tentative hold",
                start_date=date(2021, 2, 1),
                end_date=date(2021, 2, 5),
                status=BookingStatus.tentative,
                source=BookingSource.app,
            )
        )
        db_session.flush()

        resp = client.get("/api/reports/utilization", params={"year_from": 2021, "year_to": 2021})
        assert resp.status_code == 200
        row = next(r for r in resp.json() if r["berth_id"] == berth.id and r["year"] == 2021)
        assert row["days_booked"] == 10
        assert row["tentative_days"] == 5
        assert row["total_days_in_year"] == 365

    def test_booking_spanning_a_year_boundary_splits_across_years(
        self, client, db_session, make_berth
    ):
        berth = make_berth(length_ft=100)
        db_session.add(
            Booking(
                berth_id=berth.id,
                kind=BookingKind.closure,
                title="Spans new year",
                start_date=date(2021, 12, 30),
                end_date=date(2022, 1, 2),
                status=BookingStatus.confirmed,
                source=BookingSource.app,
            )
        )
        db_session.flush()

        resp = client.get("/api/reports/utilization", params={"year_from": 2021, "year_to": 2022})
        rows = {r["year"]: r for r in resp.json() if r["berth_id"] == berth.id}
        assert rows[2021]["days_booked"] == 2  # Dec 30, 31
        assert rows[2022]["days_booked"] == 2  # Jan 1, 2

    def test_cancelled_bookings_are_excluded(self, client, db_session, make_berth):
        berth = make_berth(length_ft=100)
        db_session.add(
            Booking(
                berth_id=berth.id,
                kind=BookingKind.event,
                title="Cancelled",
                start_date=date(2023, 5, 1),
                end_date=date(2023, 5, 10),
                status=BookingStatus.cancelled,
                source=BookingSource.app,
            )
        )
        db_session.flush()

        resp = client.get("/api/reports/utilization", params={"year_from": 2023, "year_to": 2023})
        row = next(r for r in resp.json() if r["berth_id"] == berth.id and r["year"] == 2023)
        assert row["days_booked"] == 0
