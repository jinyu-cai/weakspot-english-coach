"""SQLAlchemy Core schema for the PostgreSQL persistence layer.

Stable identifiers, relationships, timestamps, statuses, and versions are
normal columns. Flexible AI-produced structures remain in ``payload`` JSONB so
model evolution does not require a migration for every nested response field.
"""

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Column,
    Date,
    DateTime,
    ForeignKeyConstraint,
    Index,
    Integer,
    MetaData,
    Numeric,
    String,
    Table,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB


metadata = MetaData()


def _payload() -> Column:
    return Column("payload", JSONB, nullable=False, server_default="{}")


def _timestamps(*, updated: bool = True) -> list[Column]:
    columns = [
        Column("created_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
    ]
    if updated:
        columns.append(
            Column("updated_at", DateTime(timezone=True), nullable=False, server_default=func.now())
        )
    return columns


users = Table(
    "users",
    metadata,
    Column("user_id", String(255), primary_key=True),
    Column("provider", String(32)),
    Column("provider_subject", String(255)),
    Column("login", String(320)),
    Column("email", String(320)),
    Column("name", String(500)),
    Column("avatar_url", Text),
    *_timestamps(),
    Column("last_login_at", DateTime(timezone=True)),
    _payload(),
    UniqueConstraint("provider", "provider_subject", name="uq_users_provider_subject"),
)

profiles = Table(
    "profiles",
    metadata,
    Column("user_id", String(255), primary_key=True),
    Column("estimated_level", String(16), nullable=False, server_default="B1"),
    Column("total_submissions", Integer, nullable=False, server_default="0"),
    Column("total_practice_attempts", Integer, nullable=False, server_default="0"),
    *_timestamps(),
    _payload(),
    ForeignKeyConstraint(["user_id"], ["users.user_id"], ondelete="CASCADE"),
)

skills = Table(
    "skills",
    metadata,
    Column("user_id", String(255), primary_key=True),
    Column("skill_code", String(200), primary_key=True),
    Column("mastery", Numeric(12, 6), nullable=False, server_default="0"),
    Column("error_count", Integer, nullable=False, server_default="0"),
    Column("correct_count", Integer, nullable=False, server_default="0"),
    Column("updated_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
    _payload(),
    ForeignKeyConstraint(["user_id"], ["users.user_id"], ondelete="CASCADE"),
)

learning_states = Table(
    "learning_states",
    metadata,
    Column("user_id", String(255), primary_key=True),
    Column("skill_code", String(200), primary_key=True),
    Column("version", Integer, nullable=False, server_default="0"),
    Column("updated_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
    _payload(),
    ForeignKeyConstraint(["user_id"], ["users.user_id"], ondelete="CASCADE"),
)

activity_runs = Table(
    "activity_runs",
    metadata,
    Column("user_id", String(255), primary_key=True),
    Column("run_id", String(160), primary_key=True),
    Column("activity_type", String(64)),
    Column("status", String(32), nullable=False),
    Column("version", Integer, nullable=False, server_default="0"),
    *_timestamps(),
    Column("completed_at", DateTime(timezone=True)),
    _payload(),
    ForeignKeyConstraint(["user_id"], ["users.user_id"], ondelete="CASCADE"),
)
Index("ix_activity_runs_user_created", activity_runs.c.user_id, activity_runs.c.created_at.desc(), activity_runs.c.run_id.desc())
Index("ix_activity_runs_user_completed", activity_runs.c.user_id, activity_runs.c.completed_at.desc())

evidence_events = Table(
    "evidence_events",
    metadata,
    Column("user_id", String(255), primary_key=True),
    Column("event_id", String(160), primary_key=True),
    Column("skill_code", String(200), nullable=False),
    Column("outcome", String(32), nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False),
    _payload(),
    ForeignKeyConstraint(["user_id"], ["users.user_id"], ondelete="CASCADE"),
)
Index("ix_evidence_user_created", evidence_events.c.user_id, evidence_events.c.created_at.desc(), evidence_events.c.event_id.desc())

submissions = Table(
    "submissions",
    metadata,
    Column("user_id", String(255), primary_key=True),
    Column("submission_id", String(160), primary_key=True),
    Column("mode", String(64)),
    Column("created_at", DateTime(timezone=True), nullable=False),
    _payload(),
    ForeignKeyConstraint(["user_id"], ["users.user_id"], ondelete="CASCADE"),
)
Index("ix_submissions_user_created", submissions.c.user_id, submissions.c.created_at.desc(), submissions.c.submission_id.desc())

errors = Table(
    "errors",
    metadata,
    Column("user_id", String(255), primary_key=True),
    Column("error_id", String(160), primary_key=True),
    Column("submission_id", String(160), nullable=False),
    Column("code", String(200)),
    Column("created_at", DateTime(timezone=True), nullable=False),
    _payload(),
    ForeignKeyConstraint(["user_id"], ["users.user_id"], ondelete="CASCADE"),
)
Index("ix_errors_user_created", errors.c.user_id, errors.c.created_at.desc(), errors.c.error_id.desc())
Index("ix_errors_submission", errors.c.user_id, errors.c.submission_id)

notes = Table(
    "notes",
    metadata,
    Column("user_id", String(255), primary_key=True),
    Column("note_id", String(160), primary_key=True),
    Column("submission_id", String(160)),
    Column("category", String(100)),
    Column("created_at", DateTime(timezone=True), nullable=False),
    _payload(),
    ForeignKeyConstraint(["user_id"], ["users.user_id"], ondelete="CASCADE"),
)
Index("ix_notes_user_created", notes.c.user_id, notes.c.created_at.desc(), notes.c.note_id.desc())
Index("ix_notes_submission", notes.c.user_id, notes.c.submission_id)

diagnosis_requests = Table(
    "diagnosis_requests",
    metadata,
    Column("user_id", String(255), primary_key=True),
    Column("text_hash", String(128), primary_key=True),
    Column("status", String(32), nullable=False),
    Column("claim_id", String(160)),
    Column("claimed_at", DateTime(timezone=True)),
    Column("claimed_at_epoch", BigInteger),
    Column("submission_id", String(160)),
    Column("submission_created_at", DateTime(timezone=True)),
    *_timestamps(),
    _payload(),
    ForeignKeyConstraint(["user_id"], ["users.user_id"], ondelete="CASCADE"),
)

plans = Table(
    "plans",
    metadata,
    Column("user_id", String(255), primary_key=True),
    Column("version", Integer, nullable=False, server_default="0"),
    Column("updated_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
    _payload(),
    ForeignKeyConstraint(["user_id"], ["users.user_id"], ondelete="CASCADE"),
)

exercises = Table(
    "exercises",
    metadata,
    Column("user_id", String(255), primary_key=True),
    Column("exercise_id", String(160), primary_key=True),
    Column("skill_code", String(200)),
    Column("created_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
    _payload(),
    ForeignKeyConstraint(["user_id"], ["users.user_id"], ondelete="CASCADE"),
)

practice_requests = Table(
    "practice_requests",
    metadata,
    Column("user_id", String(255), primary_key=True),
    Column("client_attempt_id", String(160), primary_key=True),
    Column("request_hash", String(128), nullable=False),
    Column("attempt_id", String(160), nullable=False),
    Column("status", String(32), nullable=False),
    Column("claim_id", String(160)),
    Column("claimed_at", DateTime(timezone=True)),
    Column("claimed_at_epoch", BigInteger),
    *_timestamps(),
    Column("completed_at", DateTime(timezone=True)),
    _payload(),
    ForeignKeyConstraint(["user_id"], ["users.user_id"], ondelete="CASCADE"),
)

practice_attempts = Table(
    "practice_attempts",
    metadata,
    Column("user_id", String(255), primary_key=True),
    Column("attempt_id", String(160), primary_key=True),
    Column("exercise_id", String(160)),
    Column("created_at", DateTime(timezone=True), nullable=False),
    _payload(),
    ForeignKeyConstraint(["user_id"], ["users.user_id"], ondelete="CASCADE"),
)
Index("ix_attempts_user_created", practice_attempts.c.user_id, practice_attempts.c.created_at.desc(), practice_attempts.c.attempt_id.desc())

memory_leases = Table(
    "memory_leases",
    metadata,
    Column("user_id", String(255), primary_key=True),
    Column("claim_id", String(160), nullable=False),
    Column("claimed_at", DateTime(timezone=True), nullable=False),
    Column("claimed_at_epoch", BigInteger, nullable=False),
    ForeignKeyConstraint(["user_id"], ["users.user_id"], ondelete="CASCADE"),
)

memories = Table(
    "memories",
    metadata,
    Column("user_id", String(255), primary_key=True),
    Column("memory_id", String(160), primary_key=True),
    Column("kind", String(32), nullable=False),
    Column("canonical_key", String(200)),
    Column("status", String(32), nullable=False, server_default="active"),
    Column("pinned", Boolean, nullable=False, server_default="false"),
    Column("access_count", Integer, nullable=False, server_default="0"),
    *_timestamps(),
    Column("last_accessed_at", DateTime(timezone=True)),
    Column("expires_at", DateTime(timezone=True)),
    Column("delete_after", DateTime(timezone=True)),
    Column("embedding", JSONB),
    _payload(),
    ForeignKeyConstraint(["user_id"], ["users.user_id"], ondelete="CASCADE"),
)
Index("ix_memories_user_updated", memories.c.user_id, memories.c.updated_at.desc(), memories.c.memory_id.desc())
Index("ix_memories_expiry", memories.c.expires_at)

memory_traces = Table(
    "memory_traces",
    metadata,
    Column("user_id", String(255), primary_key=True),
    Column("trace_id", String(160), primary_key=True),
    Column("created_at", DateTime(timezone=True), nullable=False),
    Column("expires_at", DateTime(timezone=True)),
    _payload(),
    ForeignKeyConstraint(["user_id"], ["users.user_id"], ondelete="CASCADE"),
)
Index("ix_memory_traces_user_created", memory_traces.c.user_id, memory_traces.c.created_at.desc())

input_sources = Table(
    "input_sources",
    metadata,
    Column("user_id", String(255), primary_key=True),
    Column("source_id", String(160), primary_key=True),
    Column("status", String(32), nullable=False),
    Column("claim_id", String(160)),
    Column("claimed_at", DateTime(timezone=True)),
    Column("claimed_at_epoch", BigInteger),
    *_timestamps(),
    _payload(),
    ForeignKeyConstraint(["user_id"], ["users.user_id"], ondelete="CASCADE"),
)
Index("ix_input_sources_user_created", input_sources.c.user_id, input_sources.c.created_at.desc(), input_sources.c.source_id.desc())

input_items = Table(
    "input_items",
    metadata,
    Column("user_id", String(255), primary_key=True),
    Column("source_id", String(160), primary_key=True),
    Column("item_id", String(160), primary_key=True),
    Column("position", Integer, nullable=False, server_default="0"),
    Column("created_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
    _payload(),
    ForeignKeyConstraint(
        ["user_id", "source_id"],
        ["input_sources.user_id", "input_sources.source_id"],
        ondelete="CASCADE",
    ),
)

ebooks = Table(
    "ebooks",
    metadata,
    Column("user_id", String(255), primary_key=True),
    Column("book_id", String(160), primary_key=True),
    Column("status", String(32), nullable=False),
    Column("title", Text, nullable=False),
    Column("last_study_pack_id", String(160)),
    Column("last_studied_page", Integer),
    *_timestamps(),
    _payload(),
    ForeignKeyConstraint(["user_id"], ["users.user_id"], ondelete="CASCADE"),
)
Index("ix_ebooks_user_updated", ebooks.c.user_id, ebooks.c.updated_at.desc(), ebooks.c.book_id.desc())

ebook_pages = Table(
    "ebook_pages",
    metadata,
    Column("user_id", String(255), primary_key=True),
    Column("book_id", String(160), primary_key=True),
    Column("page_number", Integer, primary_key=True),
    Column("created_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
    _payload(),
    ForeignKeyConstraint(["user_id", "book_id"], ["ebooks.user_id", "ebooks.book_id"], ondelete="CASCADE"),
)

ebook_analysis_pages = Table(
    "ebook_analysis_pages",
    metadata,
    Column("user_id", String(255), primary_key=True),
    Column("cache_id", String(200), primary_key=True),
    Column("book_id", String(160)),
    Column("page_number", Integer),
    Column("created_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
    _payload(),
    ForeignKeyConstraint(["user_id"], ["users.user_id"], ondelete="CASCADE"),
)

ebook_study_packs = Table(
    "ebook_study_packs",
    metadata,
    Column("user_id", String(255), primary_key=True),
    Column("pack_id", String(160), primary_key=True),
    Column("book_id", String(160), nullable=False),
    Column("status", String(32), nullable=False),
    Column("claim_id", String(160)),
    Column("deleted_at", DateTime(timezone=True)),
    *_timestamps(),
    _payload(),
    ForeignKeyConstraint(["user_id", "book_id"], ["ebooks.user_id", "ebooks.book_id"], ondelete="CASCADE"),
)
Index("ix_ebook_packs_book_created", ebook_study_packs.c.user_id, ebook_study_packs.c.book_id, ebook_study_packs.c.created_at.desc())

ebook_annotations = Table(
    "ebook_annotations",
    metadata,
    Column("user_id", String(255), primary_key=True),
    Column("annotation_id", String(160), primary_key=True),
    Column("book_id", String(160), nullable=False),
    Column("page_number", Integer),
    Column("created_at", DateTime(timezone=True), nullable=False),
    _payload(),
    ForeignKeyConstraint(["user_id", "book_id"], ["ebooks.user_id", "ebooks.book_id"], ondelete="CASCADE"),
)

ebook_targets = Table(
    "ebook_targets",
    metadata,
    Column("user_id", String(255), primary_key=True),
    Column("target_id", String(160), primary_key=True),
    Column("book_id", String(160), nullable=False),
    Column("status", String(32), nullable=False),
    Column("due_at", DateTime(timezone=True)),
    *_timestamps(),
    _payload(),
    ForeignKeyConstraint(["user_id", "book_id"], ["ebooks.user_id", "ebooks.book_id"], ondelete="CASCADE"),
)

ebook_practice_sessions = Table(
    "ebook_practice_sessions",
    metadata,
    Column("user_id", String(255), primary_key=True),
    Column("session_id", String(160), primary_key=True),
    Column("book_id", String(160), nullable=False),
    Column("target_id", String(160), nullable=False),
    Column("status", String(32), nullable=False),
    *_timestamps(),
    _payload(),
    ForeignKeyConstraint(["user_id", "book_id"], ["ebooks.user_id", "ebooks.book_id"], ondelete="CASCADE"),
)

chat_sessions = Table(
    "chat_sessions",
    metadata,
    Column("user_id", String(255), primary_key=True),
    Column("session_id", String(160), primary_key=True),
    Column("status", String(32)),
    Column("message_count", Integer, nullable=False, server_default="0"),
    Column("turn_claim_id", String(160)),
    Column("turn_claimed_at_epoch", BigInteger),
    Column("analysis_claim_id", String(160)),
    Column("analysis_claimed_at_epoch", BigInteger),
    Column("deleting_at", DateTime(timezone=True)),
    *_timestamps(),
    _payload(),
    ForeignKeyConstraint(["user_id"], ["users.user_id"], ondelete="CASCADE"),
)
Index("ix_chat_sessions_user_created", chat_sessions.c.user_id, chat_sessions.c.created_at.desc(), chat_sessions.c.session_id.desc())

chat_messages = Table(
    "chat_messages",
    metadata,
    Column("user_id", String(255), primary_key=True),
    Column("session_id", String(160), primary_key=True),
    Column("message_id", String(160), primary_key=True),
    Column("role", String(32)),
    Column("created_at", DateTime(timezone=True), nullable=False),
    _payload(),
    ForeignKeyConstraint(["user_id", "session_id"], ["chat_sessions.user_id", "chat_sessions.session_id"], ondelete="CASCADE"),
)
Index("ix_chat_messages_session_created", chat_messages.c.user_id, chat_messages.c.session_id, chat_messages.c.created_at, chat_messages.c.message_id)

chat_transcript_batches = Table(
    "chat_transcript_batches",
    metadata,
    Column("user_id", String(255), primary_key=True),
    Column("session_id", String(160), primary_key=True),
    Column("batch_id", String(160), primary_key=True),
    Column("message_count", Integer, nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False, server_default=func.now()),
    _payload(),
    ForeignKeyConstraint(["user_id", "session_id"], ["chat_sessions.user_id", "chat_sessions.session_id"], ondelete="CASCADE"),
)

access_roles = Table(
    "access_roles",
    metadata,
    Column("identifier", String(320), primary_key=True),
    Column("role", String(32), nullable=False),
    Column("updated_by", String(320), nullable=False),
    *_timestamps(),
    _payload(),
    CheckConstraint("role IN ('owner', 'member')", name="ck_access_roles_role"),
)

rate_limit_counters = Table(
    "rate_limit_counters",
    metadata,
    Column("rate_key", String(320), primary_key=True),
    Column("feature", String(100), primary_key=True),
    Column("day", Date, primary_key=True),
    Column("count", Integer, nullable=False, server_default="0"),
    Column("expires_at", DateTime(timezone=True), nullable=False),
)
Index("ix_rate_limit_expiry", rate_limit_counters.c.expires_at)

migration_runs = Table(
    "migration_runs",
    metadata,
    Column("migration_id", String(160), primary_key=True),
    Column("status", String(32), nullable=False),
    Column("source_table", String(255), nullable=False),
    Column("counts", JSONB, nullable=False, server_default="{}"),
    Column("checksums", JSONB, nullable=False, server_default="{}"),
    *_timestamps(),
)


ALL_TABLES = {
    table.name: table
    for table in metadata.sorted_tables
}
