from datetime import date, timedelta

from app.models.bookings import Booking, BookingKind, BookingSource, BookingStatus
from app.models.users import UserRole

TODAY = date.today()


class TestVesselDuplicateDetection:
    def test_creating_duplicate_normalized_key_returns_409_with_existing_id(
        self, client, make_user, auth_headers
    ):
        user = make_user(role=UserRole.staff)

        first = client.post(
            "/api/vessels",
            json={"name": "Salt Dory", "type_prefix": "R/V", "loa_ft": 60},
            headers=auth_headers(user),
        )
        assert first.status_code == 201
        first_id = first.json()["id"]

        second = client.post(
            "/api/vessels",
            json={"name": "SALT   DORY", "type_prefix": "R/V", "loa_ft": 60},
            headers=auth_headers(user),
        )
        assert second.status_code == 409
        assert second.json()["detail"]["vessel_id"] == first_id

    def test_different_prefix_is_not_a_duplicate(self, client, make_user, auth_headers):
        user = make_user(role=UserRole.staff)

        first = client.post(
            "/api/vessels",
            json={"name": "Osprey", "type_prefix": "R/V", "loa_ft": 40},
            headers=auth_headers(user),
        )
        assert first.status_code == 201

        second = client.post(
            "/api/vessels",
            json={"name": "Osprey", "type_prefix": "S/V", "loa_ft": 40},
            headers=auth_headers(user),
        )
        assert second.status_code == 201

    def test_create_vessel_requires_login(self, client):
        resp = client.post("/api/vessels", json={"name": "Anon Boat"})
        assert resp.status_code == 401


class TestVesselSearch:
    def test_search_matches_case_insensitively(self, client, make_vessel):
        make_vessel(name="Coastal Runner")

        resp = client.get("/api/vessels?q=coastal")
        assert resp.status_code == 200
        names = [v["name"] for v in resp.json()]
        assert "Coastal Runner" in names

    def test_vessel_detail_includes_bookings_and_contacts(self, client, make_vessel):
        vessel = make_vessel()
        resp = client.get(f"/api/vessels/{vessel.id}")
        assert resp.status_code == 200
        body = resp.json()
        assert body["contacts"] == []
        assert body["upcoming_bookings"] == []
        assert body["past_bookings"] == []


class TestLastBookedDate:
    def test_never_booked_vessel_has_null_last_booked_date(self, client, make_vessel):
        vessel = make_vessel(name="Never Booked")
        resp = client.get("/api/vessels?q=Never Booked")
        row = next(v for v in resp.json() if v["id"] == vessel.id)
        assert row["last_booked_date"] is None

    def test_last_booked_date_is_the_latest_non_cancelled_booking_end_date(
        self, client, db_session, make_berth, make_vessel
    ):
        berth = make_berth()
        vessel = make_vessel(name="Booked Boat")
        db_session.add_all(
            [
                Booking(
                    berth_id=berth.id,
                    kind=BookingKind.vessel,
                    vessel_id=vessel.id,
                    start_date=TODAY - timedelta(days=100),
                    end_date=TODAY - timedelta(days=95),
                    status=BookingStatus.confirmed,
                    source=BookingSource.app,
                ),
                Booking(
                    berth_id=berth.id,
                    kind=BookingKind.vessel,
                    vessel_id=vessel.id,
                    start_date=TODAY - timedelta(days=10),
                    end_date=TODAY - timedelta(days=5),
                    status=BookingStatus.confirmed,
                    source=BookingSource.app,
                ),
                # More recent, but cancelled — shouldn't count.
                Booking(
                    berth_id=berth.id,
                    kind=BookingKind.vessel,
                    vessel_id=vessel.id,
                    start_date=TODAY,
                    end_date=TODAY,
                    status=BookingStatus.cancelled,
                    source=BookingSource.app,
                ),
            ]
        )
        db_session.flush()

        list_resp = client.get("/api/vessels?q=Booked Boat")
        row = next(v for v in list_resp.json() if v["id"] == vessel.id)
        assert row["last_booked_date"] == (TODAY - timedelta(days=5)).isoformat()

        detail_resp = client.get(f"/api/vessels/{vessel.id}")
        assert detail_resp.json()["last_booked_date"] == (TODAY - timedelta(days=5)).isoformat()

    def test_list_is_ordered_by_last_booked_date_most_recent_first(
        self, client, db_session, make_berth, make_vessel
    ):
        berth = make_berth()
        older = make_vessel(name="Older Use")
        newer = make_vessel(name="Newer Use")
        db_session.add_all(
            [
                Booking(
                    berth_id=berth.id,
                    kind=BookingKind.vessel,
                    vessel_id=older.id,
                    start_date=TODAY - timedelta(days=200),
                    end_date=TODAY - timedelta(days=195),
                    status=BookingStatus.confirmed,
                    source=BookingSource.app,
                ),
                Booking(
                    berth_id=berth.id,
                    kind=BookingKind.vessel,
                    vessel_id=newer.id,
                    start_date=TODAY - timedelta(days=2),
                    end_date=TODAY - timedelta(days=1),
                    status=BookingStatus.confirmed,
                    source=BookingSource.app,
                ),
            ]
        )
        db_session.flush()

        resp = client.get("/api/vessels")
        ids = [v["id"] for v in resp.json()]
        # Never-booked vessels sort after both (nulls last); relative
        # order between the two booked ones is what matters here.
        assert ids.index(newer.id) < ids.index(older.id)
