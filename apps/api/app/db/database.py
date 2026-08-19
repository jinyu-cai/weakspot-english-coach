"""PostgreSQL engine and transaction helpers.

The engine is created lazily enough for import-only smoke tests: importing the
application does not open a network connection. Repository calls own short
transactions and never hold a connection while an AI provider is running.
"""

from contextlib import contextmanager
from typing import Iterator

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.config import settings


engine: Engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    pool_recycle=300,
    pool_size=settings.database_pool_size,
    max_overflow=settings.database_max_overflow,
    pool_timeout=settings.database_connect_timeout_seconds,
    connect_args={"connect_timeout": settings.database_connect_timeout_seconds},
)

SessionLocal = sessionmaker(bind=engine, expire_on_commit=False, class_=Session)


@contextmanager
def session_scope() -> Iterator[Session]:
    """Commit a repository transaction or roll it back on failure."""

    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def database_ready() -> bool:
    """Return whether PostgreSQL accepts a trivial query."""

    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return True
    except Exception:
        return False
