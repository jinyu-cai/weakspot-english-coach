"""Create the initial PostgreSQL schema.

Revision ID: 20260817_0001
Revises:
"""

from alembic import op

from app.db.schema import metadata


revision = "20260817_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    metadata.create_all(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    metadata.drop_all(bind=op.get_bind(), checkfirst=True)
