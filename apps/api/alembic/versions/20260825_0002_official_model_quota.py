"""Add durable official OpenAI daily token quota counters.

Revision ID: 20260825_0002
Revises: 20260817_0001
"""

from alembic import op

from app.db import schema


revision = "20260825_0002"
down_revision = "20260817_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # The initial migration imports current metadata, so fresh databases may
    # already contain this table before this revision is reached.
    schema.official_model_quota_usage.create(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    schema.official_model_quota_usage.drop(bind=op.get_bind(), checkfirst=True)
