from app.auth.security import hash_password
from app.models.users import User, UserRole


class TestLogin:
    def test_login_with_correct_password_sets_cookie(self, client, db_session):
        user = User(
            email="pilot@example.com",
            name="Pilot",
            password_hash=hash_password("correct horse"),
            role=UserRole.staff,
            is_active=True,
        )
        db_session.add(user)
        db_session.flush()

        resp = client.post(
            "/api/auth/login", json={"email": "pilot@example.com", "password": "correct horse"}
        )

        assert resp.status_code == 200
        assert resp.json()["email"] == "pilot@example.com"
        assert "session" in resp.cookies

    def test_login_with_wrong_password_rejected(self, client, db_session):
        user = User(
            email="pilot2@example.com",
            name="Pilot",
            password_hash=hash_password("correct horse"),
            role=UserRole.staff,
            is_active=True,
        )
        db_session.add(user)
        db_session.flush()

        resp = client.post(
            "/api/auth/login", json={"email": "pilot2@example.com", "password": "wrong"}
        )
        assert resp.status_code == 401

    def test_login_with_unknown_email_rejected(self, client):
        resp = client.post("/api/auth/login", json={"email": "nobody@example.com", "password": "x"})
        assert resp.status_code == 401


class TestMe:
    def test_me_without_cookie_is_401(self, client):
        resp = client.get("/api/auth/me")
        assert resp.status_code == 401

    def test_me_with_valid_cookie_returns_user(self, client, make_user, auth_headers):
        user = make_user(email="me@example.com")
        resp = client.get("/api/auth/me", headers=auth_headers(user))
        assert resp.status_code == 200
        assert resp.json()["email"] == "me@example.com"


class TestRoleGuards:
    def test_staff_cannot_create_berth(self, client, make_user, auth_headers):
        staff = make_user(role=UserRole.staff)
        resp = client.post(
            "/api/berths",
            json={"name": "New Berth", "length_ft": 100},
            headers=auth_headers(staff),
        )
        assert resp.status_code == 403

    def test_admin_can_create_berth(self, client, make_user, auth_headers):
        admin = make_user(role=UserRole.admin)
        resp = client.post(
            "/api/berths",
            json={"name": "Admin Berth", "length_ft": 100},
            headers=auth_headers(admin),
        )
        assert resp.status_code == 201

    def test_anonymous_cannot_create_berth(self, client):
        resp = client.post("/api/berths", json={"name": "Anon Berth", "length_ft": 100})
        assert resp.status_code == 401
