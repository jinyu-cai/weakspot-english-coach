"""Offline tests for canonical PostgreSQL migration fingerprints."""

from datetime import datetime, timedelta, timezone
from decimal import Decimal
import os
from pathlib import Path
import tempfile
from unittest.mock import patch

from scripts.verify_postgres_copy import _json_value, _read_url


def main() -> None:
    local_time = datetime(
        2026,
        9,
        3,
        8,
        30,
        tzinfo=timezone(timedelta(hours=8)),
    )
    assert _json_value(local_time) == "2026-09-03T00:30:00+00:00"
    assert _json_value(Decimal("12.340000")) == "12.340000"
    assert _json_value(b"weakspot") == {"base64": "d2Vha3Nwb3Q="}
    assert _json_value({"nested": [Decimal("1.50")]}) == {
        "nested": ["1.50"]
    }
    with tempfile.TemporaryDirectory() as directory:
        password_file = Path(directory) / "password"
        password_file.write_text("colon:and\\slash", encoding="utf-8")
        with patch.dict(
            os.environ,
            {
                "SOURCE_DATABASE_URL": "postgresql+psycopg://app@db.example/weakspot",
                "SOURCE_DATABASE_PASSWORD_FILE": str(password_file),
            },
        ):
            secure_url = _read_url(
                "SOURCE_DATABASE_URL",
                password_file_env="SOURCE_DATABASE_PASSWORD_FILE",
            )
        assert "colon%3Aand%5Cslash" in secure_url
    print("PostgreSQL copy fingerprint tests passed.")


if __name__ == "__main__":
    main()
