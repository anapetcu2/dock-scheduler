from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import NullPool

from app.config import get_settings


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
        database_url,
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
