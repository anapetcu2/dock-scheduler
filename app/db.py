from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import NullPool

from app.config import get_settings


def normalize_database_url(url: str) -> str:
    """Force the psycopg (v3) driver, regardless of what scheme we're given.

    Neon hands out connection strings as `postgresql://...` (sometimes
    `postgres://...`). SQLAlchemy treats a bare `postgresql://` scheme as
    "use psycopg2", which isn't installed here — only `psycopg[binary]`
    (v3) is — so that URL needs `+psycopg` spliced in before it reaches
    `create_engine`. This is the one place that happens, so every caller
    (app engine, Alembic, the importer/CLI, tests) gets it automatically
    without editing .env or the Vercel env vars.
    """
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://") :]
    if url.startswith("postgresql://"):
        url = "postgresql+psycopg://" + url[len("postgresql://") :]
    return url


def make_engine(database_url: str, *, pooled: bool):
    """Build an engine.

    Pooled (app runtime, Neon's `-pooler` host, transaction-mode pooler):
    use NullPool and disable psycopg prepared statements, since Neon's
    pooler cannot support them and each serverless invocation may get a
    fresh connection anyway.

    Direct (migrations, importer, tests): a normal engine is fine.
    """
    connect_args = {"prepare_threshold": None} if pooled else {}
    return create_engine(
        normalize_database_url(database_url),
        poolclass=NullPool if pooled else None,
        connect_args=connect_args,
    )


_settings = get_settings()
engine = make_engine(_settings.database_url, pooled=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
