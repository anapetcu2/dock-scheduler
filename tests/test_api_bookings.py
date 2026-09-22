from datetime import date, timedelta

from app.models.users import UserRole

TODAY = date.today()


def _dates(offset_start: int, offset_end: int) -> dict:
    return {
        "start_date": (TODAY + timedelta(days=offset_start)).isoformat(),
        "end_date": (TODAY + timedelta(days=offset_end)).isoformat(),
    }


class TestCreateBooking:
    def test_create_valid_booking_succeeds(
        self, client, make_berth, make_vessel, make_user, auth_headers
    ):
        berth = make_berth(length_ft=100)
        vessel = make_vessel(loa_ft=50)
        user = make_user(role=UserRole.staff)

        resp = client.post(
            "/api/bookings",
            json={
                "berth_id": berth.id,
                "kind": "vessel",
                "vessel_id": vessel.id,
                "status": "confirmed",
                **_dates(10, 15),
            },
            headers=auth_headers(user),
        )

        assert resp.status_code == 201
        body = resp.json()
        assert body["berth_id"] == berth.id
        assert body["vessel_id"] == vessel.id

    def test_create_without_login_is_401(self, client, make_berth, make_vessel):
        berth = make_berth(length_ft=100)
        vessel = make_vessel(loa_ft=50)
        resp = client.post(
            "/api/bookings",
            json={
                "berth_id": berth.id,
                "kind": "vessel",
                "vessel_id": vessel.id,
                "status": "confirmed",
                **_dates(10, 15),
            },
        )
        assert resp.status_code == 401

    def test_too_long_vessel_returns_422_with_validation_result(
        self, client, make_berth, make_vessel, make_user, auth_headers
    ):
        berth = make_berth(length_ft=50)
        vessel = make_vessel(loa_ft=200)
        user = make_user(role=UserRole.staff)

        resp = client.post(
            "/api/bookings",
            json={
                "berth_id": berth.id,
                "kind": "vessel",
                "vessel_id": vessel.id,
                "status": "confirmed",
                **_dates(10, 15),
            },
            headers=auth_headers(user),
        )

        assert resp.status_code == 422
        body = resp.json()
        assert body["ok"] is False
        assert any(e["code"] == "VESSEL_TOO_LONG" for e in body["errors"])

    def test_overlapping_booking_returns_422(
        self, client, make_berth, make_vessel, make_user, auth_headers
    ):
        berth = make_berth(length_ft=100)
        vessel_a = make_vessel(loa_ft=50)
        vessel_b = make_vessel(loa_ft=50)
        user = make_user(role=UserRole.staff)

        first = client.post(
            "/api/bookings",
            json={
                "berth_id": berth.id,
                "kind": "vessel",
                "vessel_id": vessel_a.id,
                "status": "confirmed",
                **_dates(10, 15),
            },
            headers=auth_headers(user),
        )
        assert first.status_code == 201

        second = client.post(
            "/api/bookings",
            json={
                "berth_id": berth.id,
                "kind": "vessel",
                "vessel_id": vessel_b.id,
                "status": "confirmed",
                **_dates(12, 18),
            },
            headers=auth_headers(user),
        )

        assert second.status_code == 422
        body = second.json()
        assert any(e["code"] == "OVERLAP" for e in body["errors"])


class TestUpdateAndCancelBooking:
    def test_update_booking_dates(self, client, make_berth, make_vessel, make_user, auth_headers):
        berth = make_berth(length_ft=100)
        vessel = make_vessel(loa_ft=50)
        user = make_user(role=UserRole.staff)

        create_resp = client.post(
            "/api/bookings",
            json={
                "berth_id": berth.id,
                "kind": "vessel",
                "vessel_id": vessel.id,
                "status": "confirmed",
                **_dates(10, 15),
            },
            headers=auth_headers(user),
        )
        booking_id = create_resp.json()["id"]

        update_resp = client.patch(
            f"/api/bookings/{booking_id}",
            json=_dates(11, 16),
            headers=auth_headers(user),
        )
        assert update_resp.status_code == 200
        assert update_resp.json()["start_date"] == (TODAY + timedelta(days=11)).isoformat()

    def test_editing_own_dates_does_not_conflict_with_self(
        self, client, make_berth, make_vessel, make_user, auth_headers
    ):
        berth = make_berth(length_ft=100)
        vessel = make_vessel(loa_ft=50)
        user = make_user(role=UserRole.staff)

        create_resp = client.post(
            "/api/bookings",
            json={
                "berth_id": berth.id,
                "kind": "vessel",
                "vessel_id": vessel.id,
                "status": "confirmed",
                **_dates(10, 15),
            },
            headers=auth_headers(user),
        )
        booking_id = create_resp.json()["id"]

        update_resp = client.patch(
            f"/api/bookings/{booking_id}",
            json={"notes": "just a note update"},
            headers=auth_headers(user),
        )
        assert update_resp.status_code == 200

    def test_cancel_booking_frees_the_berth(
        self, client, make_berth, make_vessel, make_user, auth_headers
    ):
        berth = make_berth(length_ft=100)
        vessel_a = make_vessel(loa_ft=50)
        vessel_b = make_vessel(loa_ft=50)
        user = make_user(role=UserRole.staff)

        create_resp = client.post(
            "/api/bookings",
            json={
                "berth_id": berth.id,
                "kind": "vessel",
                "vessel_id": vessel_a.id,
                "status": "confirmed",
                **_dates(10, 15),
            },
            headers=auth_headers(user),
        )
        booking_id = create_resp.json()["id"]

        cancel_resp = client.post(f"/api/bookings/{booking_id}/cancel", headers=auth_headers(user))
        assert cancel_resp.status_code == 200
        assert cancel_resp.json()["status"] == "cancelled"

        second = client.post(
            "/api/bookings",
            json={
                "berth_id": berth.id,
                "kind": "vessel",
                "vessel_id": vessel_b.id,
                "status": "confirmed",
                **_dates(10, 15),
            },
            headers=auth_headers(user),
        )
        assert second.status_code == 201

    def test_staff_cannot_edit_cancelled_booking(
        self, client, make_berth, make_vessel, make_user, auth_headers
    ):
        berth = make_berth(length_ft=100)
        vessel = make_vessel(loa_ft=50)
        staff = make_user(role=UserRole.staff)

        create_resp = client.post(
            "/api/bookings",
            json={
                "berth_id": berth.id,
                "kind": "vessel",
                "vessel_id": vessel.id,
                "status": "confirmed",
                **_dates(10, 15),
            },
            headers=auth_headers(staff),
        )
        booking_id = create_resp.json()["id"]
        client.post(f"/api/bookings/{booking_id}/cancel", headers=auth_headers(staff))

        resp = client.patch(
            f"/api/bookings/{booking_id}",
            json={"notes": "trying to edit"},
            headers=auth_headers(staff),
        )
        assert resp.status_code == 403

    def test_admin_can_edit_cancelled_booking(
        self, client, make_berth, make_vessel, make_user, auth_headers
    ):
        berth = make_berth(length_ft=100)
        vessel = make_vessel(loa_ft=50)
        staff = make_user(role=UserRole.staff)
        admin = make_user(role=UserRole.admin)

        create_resp = client.post(
            "/api/bookings",
            json={
                "berth_id": berth.id,
                "kind": "vessel",
                "vessel_id": vessel.id,
                "status": "confirmed",
                **_dates(10, 15),
            },
            headers=auth_headers(staff),
        )
        booking_id = create_resp.json()["id"]
        client.post(f"/api/bookings/{booking_id}/cancel", headers=auth_headers(staff))

        resp = client.patch(
            f"/api/bookings/{booking_id}",
            json={"notes": "admin edit"},
            headers=auth_headers(admin),
        )
        assert resp.status_code == 200


class TestDeleteBooking:
    def test_staff_cannot_delete(self, client, make_berth, make_vessel, make_user, auth_headers):
        berth = make_berth(length_ft=100)
        vessel = make_vessel(loa_ft=50)
        staff = make_user(role=UserRole.staff)

        create_resp = client.post(
            "/api/bookings",
            json={
                "berth_id": berth.id,
                "kind": "vessel",
                "vessel_id": vessel.id,
                "status": "confirmed",
                **_dates(10, 15),
            },
            headers=auth_headers(staff),
        )
        booking_id = create_resp.json()["id"]

        resp = client.delete(f"/api/bookings/{booking_id}", headers=auth_headers(staff))
        assert resp.status_code == 403

    def test_admin_can_delete(self, client, make_berth, make_vessel, make_user, auth_headers):
        berth = make_berth(length_ft=100)
        vessel = make_vessel(loa_ft=50)
        admin = make_user(role=UserRole.admin)

        create_resp = client.post(
            "/api/bookings",
            json={
                "berth_id": berth.id,
                "kind": "vessel",
                "vessel_id": vessel.id,
                "status": "confirmed",
                **_dates(10, 15),
            },
            headers=auth_headers(admin),
        )
        booking_id = create_resp.json()["id"]

        resp = client.delete(f"/api/bookings/{booking_id}", headers=auth_headers(admin))
        assert resp.status_code == 204


class TestListAndGetBooking:
    def test_list_bookings_filters_by_berth(
        self, client, make_berth, make_vessel, make_user, auth_headers
    ):
        berth = make_berth(length_ft=100)
        other_berth = make_berth(length_ft=100)
        vessel = make_vessel(loa_ft=50)
        user = make_user(role=UserRole.staff)

        client.post(
            "/api/bookings",
            json={
                "berth_id": berth.id,
                "kind": "vessel",
                "vessel_id": vessel.id,
                "status": "confirmed",
                **_dates(10, 15),
            },
            headers=auth_headers(user),
        )

        resp = client.get(f"/api/bookings?berth_id={other_berth.id}")
        assert resp.status_code == 200
        assert resp.json() == []

        resp2 = client.get(f"/api/bookings?berth_id={berth.id}")
        assert resp2.status_code == 200
        assert len(resp2.json()) == 1

    def test_get_booking_includes_audit_history_only_when_logged_in(
        self, client, make_berth, make_vessel, make_user, auth_headers
    ):
        berth = make_berth(length_ft=100)
        vessel = make_vessel(loa_ft=50)
        user = make_user(role=UserRole.staff)

        create_resp = client.post(
            "/api/bookings",
            json={
                "berth_id": berth.id,
                "kind": "vessel",
                "vessel_id": vessel.id,
                "status": "confirmed",
                **_dates(10, 15),
            },
            headers=auth_headers(user),
        )
        booking_id = create_resp.json()["id"]

        anon_resp = client.get(f"/api/bookings/{booking_id}")
        assert anon_resp.json()["audit_history"] == []

        auth_resp = client.get(f"/api/bookings/{booking_id}", headers=auth_headers(user))
        assert len(auth_resp.json()["audit_history"]) == 1
        assert auth_resp.json()["audit_history"][0]["action"] == "create"


class TestValidateEndpoint:
    def test_validate_has_no_side_effects(self, client, make_berth, make_vessel):
        berth = make_berth(length_ft=100)
        vessel = make_vessel(loa_ft=50)

        resp = client.post(
            "/api/bookings/validate",
            json={
                "berth_id": berth.id,
                "kind": "vessel",
                "vessel_id": vessel.id,
                "status": "confirmed",
                **_dates(10, 15),
            },
        )
        assert resp.status_code == 200
        assert resp.json()["ok"] is True

        listing = client.get(f"/api/bookings?berth_id={berth.id}")
        assert listing.json() == []
