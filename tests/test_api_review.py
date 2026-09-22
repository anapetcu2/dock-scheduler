from datetime import date, timedelta

from app.models.bookings import Booking, BookingKind, BookingSource, BookingStatus
from app.models.import_issues import ImportIssue, ImportIssueSeverity, ImportIssueType
from app.models.users import UserRole

TODAY = date.today()


class TestIntegrityEndpoint:
    def test_requires_login(self, client):
        resp = client.get("/api/review/integrity")
        assert resp.status_code == 401

    def test_flags_vessel_too_long_for_its_berth(
        self, client, db_session, make_berth, make_vessel, make_user, auth_headers
    ):
        berth = make_berth(length_ft=50)
        vessel = make_vessel(loa_ft=80)
        booking = Booking(
            berth_id=berth.id,
            kind=BookingKind.vessel,
            vessel_id=vessel.id,
            start_date=TODAY,
            end_date=TODAY + timedelta(days=1),
            status=BookingStatus.confirmed,
            source=BookingSource.app,
        )
        db_session.add(booking)
        db_session.flush()

        user = make_user(role=UserRole.staff)
        resp = client.get("/api/review/integrity", headers=auth_headers(user))

        assert resp.status_code == 200
        codes = [i["code"] for i in resp.json()]
        assert "VESSEL_TOO_LONG" in codes

    def test_fixing_vessel_length_clears_the_issue_immediately(
        self, client, db_session, make_berth, make_vessel, make_user, auth_headers
    ):
        berth = make_berth(length_ft=50)
        vessel = make_vessel(loa_ft=None)
        booking = Booking(
            berth_id=berth.id,
            kind=BookingKind.vessel,
            vessel_id=vessel.id,
            start_date=TODAY,
            end_date=TODAY + timedelta(days=1),
            status=BookingStatus.confirmed,
            source=BookingSource.app,
        )
        db_session.add(booking)
        db_session.flush()
        user = make_user(role=UserRole.staff)

        before = client.get("/api/review/integrity", headers=auth_headers(user))
        assert any(i["code"] == "VESSEL_LENGTH_UNKNOWN" for i in before.json())

        vessel.loa_ft = 40
        db_session.flush()

        after = client.get("/api/review/integrity", headers=auth_headers(user))
        assert not any(i["code"] == "VESSEL_LENGTH_UNKNOWN" for i in after.json())

    def test_legacy_conflict_pairs_with_its_overlapping_booking(
        self, client, db_session, make_berth, make_vessel, make_user, auth_headers
    ):
        berth = make_berth(length_ft=100)
        vessel_a = make_vessel(loa_ft=50)
        vessel_b = make_vessel(loa_ft=50)
        confirmed = Booking(
            berth_id=berth.id,
            kind=BookingKind.vessel,
            vessel_id=vessel_a.id,
            start_date=TODAY,
            end_date=TODAY + timedelta(days=5),
            status=BookingStatus.confirmed,
            source=BookingSource.import_,
        )
        db_session.add(confirmed)
        db_session.flush()
        legacy = Booking(
            berth_id=berth.id,
            kind=BookingKind.vessel,
            vessel_id=vessel_b.id,
            start_date=TODAY + timedelta(days=2),
            end_date=TODAY + timedelta(days=7),
            status=BookingStatus.legacy_conflict,
            source=BookingSource.import_,
        )
        db_session.add(legacy)
        db_session.flush()

        user = make_user(role=UserRole.staff)
        resp = client.get("/api/review/integrity", headers=auth_headers(user))
        overlap_issues = [i for i in resp.json() if i["code"] == "HISTORICAL_OVERLAP"]
        assert len(overlap_issues) == 1
        assert overlap_issues[0]["booking_id"] == legacy.id
        assert overlap_issues[0]["related_booking_id"] == confirmed.id

    def test_legacy_conflict_pairs_with_its_vessel_double_booking_on_another_berth(
        self, client, db_session, make_berth, make_vessel, make_user, auth_headers
    ):
        vessel = make_vessel(loa_ft=50)
        confirmed = Booking(
            berth_id=make_berth(length_ft=100).id,
            kind=BookingKind.vessel,
            vessel_id=vessel.id,
            start_date=TODAY,
            end_date=TODAY + timedelta(days=5),
            status=BookingStatus.confirmed,
            source=BookingSource.import_,
        )
        db_session.add(confirmed)
        db_session.flush()
        legacy = Booking(
            berth_id=make_berth(length_ft=100).id,
            kind=BookingKind.vessel,
            vessel_id=vessel.id,
            start_date=TODAY + timedelta(days=2),
            end_date=TODAY + timedelta(days=7),
            status=BookingStatus.legacy_conflict,
            source=BookingSource.import_,
        )
        db_session.add(legacy)
        db_session.flush()

        user = make_user(role=UserRole.staff)
        resp = client.get("/api/review/integrity", headers=auth_headers(user))
        double_booked = [i for i in resp.json() if i["code"] == "VESSEL_DOUBLE_BOOKED"]
        assert len(double_booked) == 1
        assert double_booked[0]["booking_id"] == legacy.id
        assert double_booked[0]["vessel_id"] == vessel.id
        assert double_booked[0]["related_booking_id"] == confirmed.id


class TestImportIssuesEndpoint:
    def test_requires_login(self, client):
        resp = client.get("/api/review/import-issues")
        assert resp.status_code == 401

    def test_filters_by_type_and_resolved(self, client, db_session, make_user, auth_headers):
        db_session.add_all(
            [
                ImportIssue(
                    issue_type=ImportIssueType.ORPHAN_FILL,
                    severity=ImportIssueSeverity.warning,
                    message="a",
                ),
                ImportIssue(
                    issue_type=ImportIssueType.UNKNOWN_BERTH,
                    severity=ImportIssueSeverity.info,
                    message="b",
                ),
            ]
        )
        db_session.flush()
        user = make_user(role=UserRole.staff)

        resp = client.get(
            "/api/review/import-issues", params={"type": "ORPHAN_FILL"}, headers=auth_headers(user)
        )
        assert resp.status_code == 200
        assert all(i["issue_type"] == "ORPHAN_FILL" for i in resp.json())

        resp2 = client.get(
            "/api/review/import-issues", params={"resolved": "false"}, headers=auth_headers(user)
        )
        assert len(resp2.json()) == 2

    def test_only_admin_can_resolve(self, client, db_session, make_user, auth_headers):
        issue = ImportIssue(
            issue_type=ImportIssueType.ORPHAN_FILL,
            severity=ImportIssueSeverity.warning,
            message="a",
        )
        db_session.add(issue)
        db_session.flush()

        staff = make_user(role=UserRole.staff)
        resp = client.post(
            f"/api/review/import-issues/{issue.id}/resolve",
            json={"note": "checked"},
            headers=auth_headers(staff),
        )
        assert resp.status_code == 403

        admin = make_user(role=UserRole.admin)
        resp2 = client.post(
            f"/api/review/import-issues/{issue.id}/resolve",
            json={"note": "checked"},
            headers=auth_headers(admin),
        )
        assert resp2.status_code == 200
        assert resp2.json()["resolved_at"] is not None
        assert resp2.json()["resolution_note"] == "checked"


class TestReviewSummary:
    def test_counts_match_integrity_and_import_issues(
        self, client, db_session, make_berth, make_vessel, make_user, auth_headers
    ):
        berth = make_berth(length_ft=50)
        vessel = make_vessel(loa_ft=80)
        db_session.add(
            Booking(
                berth_id=berth.id,
                kind=BookingKind.vessel,
                vessel_id=vessel.id,
                start_date=TODAY,
                end_date=TODAY,
                status=BookingStatus.confirmed,
                source=BookingSource.app,
            )
        )
        db_session.add(
            ImportIssue(
                issue_type=ImportIssueType.ORPHAN_FILL,
                severity=ImportIssueSeverity.warning,
                message="a",
            )
        )
        db_session.flush()
        user = make_user(role=UserRole.staff)

        resp = client.get("/api/review/summary", headers=auth_headers(user))
        assert resp.status_code == 200
        body = resp.json()
        assert body["vessels_too_long"] == 1
        assert body["unresolved_import_issues"] == 1
