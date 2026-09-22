from datetime import date, timedelta

from app.models.bookings import Booking, BookingKind, BookingSource, BookingStatus
from app.models.users import UserRole


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


class TestVesselRecencyFilter:
    def test_used_since_only_returns_vessels_with_a_recent_booking(
        self, client, db_session, make_berth, make_vessel
    ):
        berth = make_berth()
        recent_vessel = make_vessel(name="Recent Boat")
        old_vessel = make_vessel(name="Old Boat")
        today = date.today()

        db_session.add(
            Booking(
                berth_id=berth.id,
                kind=BookingKind.vessel,
                vessel_id=recent_vessel.id,
                start_date=today - timedelta(days=5),
                end_date=today - timedelta(days=1),
                status=BookingStatus.confirmed,
                source=BookingSource.app,
            )
        )
        db_session.add(
            Booking(
                berth_id=berth.id,
                kind=BookingKind.vessel,
                vessel_id=old_vessel.id,
                start_date=today - timedelta(days=3000),
                end_date=today - timedelta(days=2995),
                status=BookingStatus.confirmed,
                source=BookingSource.import_,
            )
        )
        db_session.flush()

        cutoff = (today - timedelta(days=365 * 5)).isoformat()

        recent_resp = client.get("/api/vessels", params={"used_since": cutoff})
        recent_names = [v["name"] for v in recent_resp.json()]
        assert "Recent Boat" in recent_names
        assert "Old Boat" not in recent_names

        historical_resp = client.get("/api/vessels", params={"used_before": cutoff})
        historical_names = [v["name"] for v in historical_resp.json()]
        assert "Old Boat" in historical_names
        assert "Recent Boat" not in historical_names
