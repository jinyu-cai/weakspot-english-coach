"""Atomically switch a production .env from RDS to local Compose PostgreSQL.

The generated database password is never printed. The original environment is
preserved beside it as a permission-restricted rollback file.
"""

from __future__ import annotations

import argparse
from datetime import datetime, timezone
import os
from pathlib import Path
import re
import secrets
import shutil
import tempfile
from urllib.parse import urlsplit


DATABASE_KEYS = {
    "POSTGRES_DB",
    "POSTGRES_USER",
    "POSTGRES_PASSWORD",
    "DATABASE_URL",
}
ENV_KEY = re.compile(r"^([A-Za-z_][A-Za-z0-9_]*)=")


def _value(lines: list[str], key: str) -> str:
    prefix = f"{key}="
    values = [line[len(prefix) :].strip() for line in lines if line.startswith(prefix)]
    if len(values) != 1:
        raise ValueError(f"Expected exactly one {key} setting in the production environment.")
    value = values[0]
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
        value = value[1:-1]
    return value


def configure(
    env_path: Path,
    *,
    password: str | None = None,
    timestamp: str | None = None,
) -> Path:
    if not env_path.is_file():
        raise ValueError(f"Environment file does not exist: {env_path}")
    lines = env_path.read_text(encoding="utf-8").splitlines()
    if _value(lines, "APP_ENV").lower() != "production":
        raise ValueError("APP_ENV must already be production.")

    current_url = _value(lines, "DATABASE_URL")
    current_host = urlsplit(current_url).hostname
    if not current_host:
        raise ValueError("Current DATABASE_URL has no hostname.")
    if current_host == "postgres":
        raise ValueError(
            "DATABASE_URL already targets local PostgreSQL; refusing to rotate its password."
        )

    password = password or secrets.token_hex(32)
    if not re.fullmatch(r"[0-9a-fA-F]{64}", password):
        raise ValueError("Generated PostgreSQL password is not 64 hexadecimal characters.")
    timestamp = timestamp or datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    backup_path = env_path.with_name(f"{env_path.name}.rds-rollback-{timestamp}")
    if backup_path.exists():
        raise ValueError(f"Rollback environment already exists: {backup_path}")

    shutil.copy2(env_path, backup_path)
    os.chmod(backup_path, 0o600)

    retained = []
    for line in lines:
        match = ENV_KEY.match(line)
        if match and match.group(1) in DATABASE_KEYS:
            continue
        retained.append(line)
    while retained and not retained[-1].strip():
        retained.pop()
    retained.extend(
        [
            "",
            "# Server-local PostgreSQL. Keep both password values identical.",
            "POSTGRES_DB=weakspot",
            "POSTGRES_USER=weakspot_app",
            f"POSTGRES_PASSWORD={password}",
            "DATABASE_URL="
            f"postgresql+psycopg://weakspot_app:{password}@postgres:5432/weakspot",
            "",
        ]
    )

    temp_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            dir=env_path.parent,
            prefix=f".{env_path.name}.",
            delete=False,
        ) as handle:
            temp_path = Path(handle.name)
            handle.write("\n".join(retained))
            handle.flush()
            os.fsync(handle.fileno())
        os.chmod(temp_path, 0o600)
        os.replace(temp_path, env_path)
    except Exception:
        if temp_path is not None:
            temp_path.unlink(missing_ok=True)
        raise
    return backup_path


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("env_file", nargs="?", default=".env")
    args = parser.parse_args()
    try:
        backup_path = configure(Path(args.env_file).resolve())
    except ValueError as exc:
        raise SystemExit(str(exc)) from exc
    print(f"Configured private Compose PostgreSQL. RDS rollback env: {backup_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
