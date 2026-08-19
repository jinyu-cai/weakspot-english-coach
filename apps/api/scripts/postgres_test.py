"""Shared PostgreSQL test-database lifecycle.

The integration scripts intentionally refuse to clear any database that is not
local and suffixed with ``_test``. Start it with ``docker compose -f
docker-compose.local.yml up -d postgres`` before running these scripts.
"""

from __future__ import annotations

import os
from contextlib import ContextDecorator
from pathlib import Path
from urllib.parse import unquote, urlparse


DEFAULT_TEST_DATABASE_URL = (
    "postgresql+psycopg://weakspot:weakspot@127.0.0.1:5432/weakspot_test"
)
os.environ.setdefault("DATABASE_URL", DEFAULT_TEST_DATABASE_URL)


def _assert_safe_test_database() -> None:
    parsed = urlparse(os.environ["DATABASE_URL"])
    database_name = parsed.path.removeprefix("/")
    if parsed.hostname not in {"127.0.0.1", "localhost", "::1"}:
        raise RuntimeError("Tests may only reset a PostgreSQL database on localhost.")
    if not database_name.endswith("_test"):
        raise RuntimeError("The PostgreSQL test database name must end with '_test'.")


def reset_test_database() -> None:
    """Apply migrations and empty every application table."""

    _assert_safe_test_database()

    from alembic import command
    from alembic.config import Config
    import psycopg
    from psycopg import sql
    from sqlalchemy import text

    parsed = urlparse(os.environ["DATABASE_URL"])
    database_name = parsed.path.removeprefix("/")
    with psycopg.connect(
        host=parsed.hostname,
        port=parsed.port or 5432,
        dbname="postgres",
        user=unquote(parsed.username or ""),
        password=unquote(parsed.password or ""),
        autocommit=True,
    ) as admin_connection:
        with admin_connection.cursor() as cursor:
            cursor.execute(
                "SELECT 1 FROM pg_database WHERE datname = %s", (database_name,)
            )
            if not cursor.fetchone():
                cursor.execute(
                    sql.SQL("CREATE DATABASE {}").format(
                        sql.Identifier(database_name)
                    )
                )

    from app.db.database import engine
    from app.db.schema import metadata

    api_root = Path(__file__).resolve().parents[1]
    config = Config(str(api_root / "alembic.ini"))
    config.set_main_option("script_location", str(api_root / "alembic"))
    config.set_main_option("sqlalchemy.url", os.environ["DATABASE_URL"])
    command.upgrade(config, "head")

    table_names = ", ".join(f'"{table.name}"' for table in metadata.sorted_tables)
    if table_names:
        with engine.begin() as connection:
            connection.execute(text(f"TRUNCATE TABLE {table_names} RESTART IDENTITY CASCADE"))


class mock_postgres(ContextDecorator):
    """Context/decorator that prepares the isolated PostgreSQL test database."""

    def start(self) -> "mock_postgres":
        reset_test_database()
        return self

    def stop(self) -> None:
        return None

    def __enter__(self) -> "mock_postgres":
        return self.start()

    def __exit__(self, *exc_info: object) -> None:
        self.stop()
