"""Test fixtures. Runs against TEST_DATABASE_URL (a Neon branch), never SQLite
— the no-double-booking guarantee is a Postgres exclusion constraint and
can't be exercised on any other database. See SPEC.md section 2 and 10.
"""

import os
from pathlib import Path
from uuid import uuid4

import pytest
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from alembic import command
from app.auth.session import create_session_token
from app.config import get_settings
from app.db import get_db
from app.main import app
from app.models.berths import Berth
from app.models.users import User, UserRole
from app.models.vessels import Vessel

ROOT = Path(__file__).resolve().parent.parent


def _guard_test_database_url(test_url: str, direct_url: str) -> None:
    if test_url == direct_url:
        pytest.exit("Refusing to run: TEST_DATABASE_URL equals DATABASE_URL_DIRECT.")
    if "production" in test_url:
        pytest.exit("Refusing to run: TEST_DATABASE_URL appears to point at the production branch.")


@pytest.fixture(scope="session")
def test_database_url() -> str:
    settings = get_settings()
    if not settings.test_database_url:
        pytest.exit("TEST_DATABASE_URL is not set.")
    _guard_test_database_url(settings.test_database_url, settings.database_url_direct)
    return settings.test_database_url


@pytest.fixture(scope="session")
def test_engine(test_database_url):
    os.environ["ALEMBIC_DATABASE_URL"] = test_database_url
    alembic_cfg = Config(str(ROOT / "alembic.ini"))
    command.upgrade(alembic_cfg, "head")

    engine = create_engine(test_database_url)
    yield engine
    engine.dispose()


@pytest.fixture()
def db_session(test_engine) -> Session:
    """Each test runs inside a transaction that's rolled back afterward, so
    tests never see each other's data and never need manual cleanup.

    Service-layer code uses SAVEPOINTs (`session.begin_nested()`) to recover
    from constraint races; those nest fine inside this outer transaction.
    """
    connection = test_engine.connect()
    transaction = connection.begin()
    session_factory = sessionmaker(bind=connection)
    session = session_factory()

    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture()
def make_berth(db_session):
    def _make(**overrides) -> Berth:
        defaults = dict(
            name=f"Test Berth {uuid4().hex[:8]}",
            length_ft=100,
            max_draft_ft=None,
            is_active=True,
            sort_order=0,
        )
        defaults.update(overrides)
        berth = Berth(**defaults)
        db_session.add(berth)
        db_session.flush()
        return berth

    return _make


@pytest.fixture()
def make_vessel(db_session):
    def _make(**overrides) -> Vessel:
        key = uuid4().hex[:8].upper()
        defaults = dict(
            name=f"Test Vessel {key}",
            type_prefix="R/V",
            normalized_key=f"RV|TEST VESSEL {key}",
            loa_ft=50,
            draft_ft=None,
            is_active=True,
        )
        defaults.update(overrides)
        vessel = Vessel(**defaults)
        db_session.add(vessel)
        db_session.flush()
        return vessel

    return _make


@pytest.fixture()
def make_user(db_session):
    def _make(**overrides) -> User:
        defaults = dict(
            email=f"user-{uuid4().hex[:8]}@example.com",
            name="Test User",
            password_hash="unused-in-tests",
            role=UserRole.staff,
            is_active=True,
        )
        defaults.update(overrides)
        user = User(**defaults)
        db_session.add(user)
        db_session.flush()
        return user

    return _make


@pytest.fixture()
def client(db_session):
    """A TestClient wired to the same rolled-back transaction as db_session,
    so requests made through the API see fixtures created directly via
    db_session, and vice versa."""

    def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.pop(get_db, None)


@pytest.fixture()
def auth_headers():
    """Builds a Cookie header for a given user, bypassing the password
    check, since these are ORM-created test users, not ones that logged in
    through the real /api/auth/login flow (that flow is tested separately)."""

    def _make(user: User) -> dict:
        token = create_session_token(user_id=user.id, role=user.role.value)
        return {"Cookie": f"session={token}"}

    return _make
