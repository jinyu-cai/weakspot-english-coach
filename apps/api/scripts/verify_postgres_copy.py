"""Compare an inactive source PostgreSQL database with its restored target.

The verifier prints only schema revisions, row counts, and SHA-256 digests. It
never prints database URLs or learner content. Stop application writes before
running it so both database snapshots remain comparable.
"""

from __future__ import annotations

import argparse
import base64
from datetime import date, datetime, time, timezone
from decimal import Decimal
import hashlib
import json
import os
from pathlib import Path
from typing import Any

from sqlalchemy import create_engine, inspect, select, text
from sqlalchemy.engine import Connection, Engine, make_url
from sqlalchemy.pool import NullPool

from app.db.schema import metadata


def _json_value(value: Any) -> Any:
    if isinstance(value, datetime):
        if value.tzinfo is not None:
            value = value.astimezone(timezone.utc)
        return value.isoformat()
    if isinstance(value, (date, time)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, bytes):
        return {"base64": base64.b64encode(value).decode("ascii")}
    if isinstance(value, dict):
        return {str(key): _json_value(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_value(item) for item in value]
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    return str(value)


def _database_snapshot(connection: Connection) -> dict[str, Any]:
    existing_tables = set(inspect(connection).get_table_names())
    expected_tables = {table.name for table in metadata.sorted_tables}
    missing_tables = sorted(expected_tables - existing_tables)
    if missing_tables:
        raise RuntimeError(f"Missing application tables: {', '.join(missing_tables)}")
    if "alembic_version" not in existing_tables:
        raise RuntimeError("Missing alembic_version table.")
    unexpected_tables = sorted(existing_tables - expected_tables - {"alembic_version"})
    if unexpected_tables:
        raise RuntimeError(
            f"Unexpected public tables require an explicit migration decision: "
            f"{', '.join(unexpected_tables)}"
        )

    version_number = int(connection.execute(text("SHOW server_version_num")).scalar_one())
    revisions = tuple(
        connection.execute(
            text("SELECT version_num FROM alembic_version ORDER BY version_num")
        ).scalars()
    )
    tables: dict[str, dict[str, Any]] = {}
    for table in metadata.sorted_tables:
        digest = hashlib.sha256()
        primary_key = list(table.primary_key.columns)
        statement = select(table)
        if primary_key:
            statement = statement.order_by(*primary_key)
        rows = (
            connection.execution_options(stream_results=True)
            .execute(statement)
            .mappings()
        )
        count = 0
        for row in rows:
            canonical = json.dumps(
                {key: _json_value(value) for key, value in row.items()},
                ensure_ascii=False,
                sort_keys=True,
                separators=(",", ":"),
                allow_nan=False,
            )
            digest.update(canonical.encode("utf-8"))
            digest.update(b"\n")
            count += 1
        tables[table.name] = {"count": count, "sha256": digest.hexdigest()}
    return {
        "postgres_major": version_number // 10000,
        "alembic_revisions": revisions,
        "tables": tables,
    }


def _snapshot(engine: Engine) -> dict[str, Any]:
    with engine.connect().execution_options(
        isolation_level="REPEATABLE READ"
    ) as connection:
        return _database_snapshot(connection)


def _read_url(env_name: str, *, password_file_env: str | None = None) -> str:
    value = os.getenv(env_name, "").strip()
    if not value:
        raise SystemExit(f"{env_name} is required.")
    url = make_url(value)
    if url.drivername != "postgresql+psycopg":
        raise SystemExit(f"{env_name} must use postgresql+psycopg.")
    if password_file_env:
        password_file = os.getenv(password_file_env, "").strip()
        if password_file:
            if url.password is not None:
                raise SystemExit(
                    f"{env_name} must omit its password when {password_file_env} is set."
                )
            password = Path(password_file).read_text(encoding="utf-8")
            if not password:
                raise SystemExit(f"{password_file_env} points to an empty file.")
            url = url.set(password=password)
    return url.render_as_string(hide_password=False)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-url-env", default="SOURCE_DATABASE_URL")
    parser.add_argument(
        "--source-password-file-env",
        default="SOURCE_DATABASE_PASSWORD_FILE",
    )
    parser.add_argument("--target-url-env", default="DATABASE_URL")
    args = parser.parse_args()

    source_url = _read_url(
        args.source_url_env,
        password_file_env=args.source_password_file_env,
    )
    target_url = _read_url(args.target_url_env)
    if make_url(source_url) == make_url(target_url):
        raise SystemExit("Source and target database URLs must be different.")

    source_engine = create_engine(source_url, poolclass=NullPool)
    target_engine = create_engine(target_url, poolclass=NullPool)
    try:
        source = _snapshot(source_engine)
        target = _snapshot(target_engine)
    except Exception as exc:
        raise SystemExit(f"Database comparison failed: {type(exc).__name__}") from exc
    finally:
        source_engine.dispose()
        target_engine.dispose()

    if source["postgres_major"] != 16 or target["postgres_major"] != 16:
        raise SystemExit(
            "Source and target must both run PostgreSQL major version 16."
        )
    errors: list[str] = []
    if source["alembic_revisions"] != target["alembic_revisions"]:
        errors.append("Alembic revisions differ.")
    for table_name in sorted(source["tables"]):
        source_table = source["tables"][table_name]
        target_table = target["tables"].get(table_name)
        if source_table != target_table:
            errors.append(f"{table_name} differs.")
        target_count = target_table["count"] if target_table else "missing"
        print(
            f"{table_name}: source={source_table['count']} target={target_count} "
            f"sha256={source_table['sha256']}"
        )
    if errors:
        for error in errors:
            print(f"ERROR: {error}")
        raise SystemExit("PostgreSQL copy verification failed.")
    print("PostgreSQL 16, Alembic revisions, row counts, and row digests match.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
