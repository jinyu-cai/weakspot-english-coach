"""Fail deployment unless production uses the private Compose PostgreSQL."""

from __future__ import annotations

import os
import re

from sqlalchemy.engine import make_url

from app.config import settings


def validate_local_production_database(
    database_url: str,
    *,
    postgres_db: str,
    postgres_user: str,
    postgres_password: str,
) -> None:
    """Validate that the API and PostgreSQL container share one safe config."""

    missing = [
        name
        for name, value in (
            ("POSTGRES_DB", postgres_db),
            ("POSTGRES_USER", postgres_user),
            ("POSTGRES_PASSWORD", postgres_password),
        )
        if not value
    ]
    if missing:
        raise ValueError(f"Missing production database settings: {', '.join(missing)}.")
    if postgres_user == "postgres":
        raise ValueError("POSTGRES_USER must be a dedicated database owner, not postgres.")
    if postgres_db == "postgres":
        raise ValueError("POSTGRES_DB must be a dedicated application database.")
    if not re.fullmatch(r"[0-9a-fA-F]{64}", postgres_password):
        raise ValueError(
            "POSTGRES_PASSWORD must be a 64-character hexadecimal secret; "
            "generate it with `openssl rand -hex 32`."
        )

    url = make_url(database_url)
    if url.drivername != "postgresql+psycopg":
        raise ValueError("DATABASE_URL must use postgresql+psycopg.")
    if url.host != "postgres":
        raise ValueError(
            "Production DATABASE_URL must use the private Compose host `postgres`."
        )
    if url.port not in {None, 5432}:
        raise ValueError("Production PostgreSQL must use port 5432 inside Compose.")
    if url.database != postgres_db:
        raise ValueError("DATABASE_URL database does not match POSTGRES_DB.")
    if url.username != postgres_user:
        raise ValueError("DATABASE_URL username does not match POSTGRES_USER.")
    if url.password != postgres_password:
        raise ValueError("DATABASE_URL password does not match POSTGRES_PASSWORD.")
    if "sslmode" in url.query:
        raise ValueError("Local PostgreSQL DATABASE_URL must not include an RDS sslmode.")
    if "sslrootcert" in url.query:
        raise ValueError("Local PostgreSQL must not reference an RDS CA certificate.")


def main() -> int:
    if settings.app_env.lower() != "production":
        raise SystemExit("APP_ENV must be production when using the production launcher.")
    try:
        validate_local_production_database(
            settings.database_url,
            postgres_db=os.getenv("POSTGRES_DB", ""),
            postgres_user=os.getenv("POSTGRES_USER", ""),
            postgres_password=os.getenv("POSTGRES_PASSWORD", ""),
        )
    except ValueError as exc:
        raise SystemExit(str(exc)) from exc
    print("Production PostgreSQL uses the private Compose service with matching credentials.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
