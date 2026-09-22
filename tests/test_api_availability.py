from datetime import date, timedelta

from app.models.users import UserRole

TODAY = date.today()


def _dates(offset_start: int, offset_end: int) -> dict:
    return {
        "start": (TODAY + timedelta(days=offset_start)).isoformat(),
        "end": (TODAY + timedelta(days=offset_end)).isoformat(),
    }


def _booking_dates(offset_start: int, offset_end: int) -> dict:
    return {
        "start_date": (TODAY + timedelta(days=offset_start)).isoformat(),
        "end_date": (TODAY + timedelta(days=offset_end)).isoformat(),
    }


class TestAvailabilityOrdering:
    def test_fits_and_free_before_fits_but_busy_before_too_small(
        self, client, make_berth, make_vessel, make_user, auth_headers
    ):
        too_small = make_berth(length_ft=40, sort_order=1)
        busy = make_berth(length_ft=100, sort_order=2)
        free_and_fits = make_berth(length_ft=100, sort_order=3)

        vessel = make_vessel(loa_ft=60)
        other_vessel = make_vessel(loa_ft=60)
        user = make_user(role=UserRole.staff)

        client.post(
            "/api/bookings",
            json={
                "berth_id": busy.id,
                "kind": "vessel",
                "vessel_id": other_vessel.id,
                "status": "confirmed",
                **_booking_dates(10, 15),
            },
            headers=auth_headers(user),
        )

        resp = client.get(
            "/api/availability",
            params={"vessel_id": vessel.id, **_dates(10, 15)},
        )
        assert resp.status_code == 200
        body = resp.json()

        ids_in_order = [row["berth_id"] for row in body]
        assert ids_in_order.index(free_and_fits.id) < ids_in_order.index(busy.id)
        assert ids_in_order.index(busy.id) < ids_in_order.index(too_small.id)

        too_small_row = next(r for r in body if r["berth_id"] == too_small.id)
        assert too_small_row["fits"] is False

        busy_row = next(r for r in body if r["berth_id"] == busy.id)
        assert busy_row["fits"] is True
        assert busy_row["free"] is False
        assert len(busy_row["conflicts"]) == 1

    def test_tightest_fit_first_among_free_berths(self, client, make_berth, make_vessel):
        make_berth(length_ft=200, sort_order=1)
        make_berth(length_ft=70, sort_order=2)
        vessel = make_vessel(loa_ft=60)

        resp = client.get(
            "/api/availability",
            params={"vessel_id": vessel.id, **_dates(10, 15)},
        )
        body = resp.json()
        fits_and_free = [r for r in body if r["fits"] and r["free"]]
        assert fits_and_free[0]["length_ft"] == 70

    def test_loa_ft_query_without_vessel(self, client, make_berth):
        make_berth(length_ft=100)
        resp = client.get("/api/availability", params={"loa_ft": 50, **_dates(10, 15)})
        assert resp.status_code == 200
        assert len(resp.json()) >= 1

    def test_neither_vessel_nor_loa_is_422(self, client):
        resp = client.get("/api/availability", params=_dates(10, 15))
        assert resp.status_code == 422
