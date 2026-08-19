"""Compatibility wrapper for creating/upgrading the PostgreSQL schema.

New commands should use ``uv run alembic upgrade head`` directly.
"""

from pathlib import Path

from alembic import command
from alembic.config import Config


def create_table() -> None:
    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    command.upgrade(config, "head")
    print("PostgreSQL schema is at the latest Alembic revision.")


if __name__ == "__main__":
    create_table()
