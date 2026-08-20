"""PostgreSQL repository implementation.

The service layer continues to exchange ordinary dictionaries. SQL-only
metadata stays in typed columns, while ``payload`` preserves the established
domain shape and therefore the public API contracts.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
import hashlib
import json
from typing import Any, Optional

from sqlalchemy import and_, delete, func, or_, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.db.database import session_scope
from app.db import schema


DATABASE_SAFE_PAYLOAD_BYTES = 400_000
CHAT_TRANSCRIPT_MAX_MESSAGES = 490


class ItemTooLargeError(RuntimeError):
    """An application payload exceeded its bounded storage contract."""

    def __init__(self, entity_type: str, size_bytes: int):
        self.entity_type = entity_type
        self.size_bytes = size_bytes
        super().__init__(
            f"{entity_type} requires {size_bytes} bytes; "
            f"the safe application payload limit is {DATABASE_SAFE_PAYLOAD_BYTES} bytes."
        )


class TranscriptCapacityError(RuntimeError):
    pass


class ChatSessionBusyError(RuntimeError):
    pass


class PlanProgressConflictError(RuntimeError):
    pass


class LearningStateConflictError(RuntimeError):
    pass


class MemoryWriteClaimLostError(RuntimeError):
    pass


class InputLearningClaimLostError(RuntimeError):
    pass


class PracticeAttemptConflictError(RuntimeError):
    pass


class PracticeAttemptClaimLostError(RuntimeError):
    pass


def _jsonable(value: Any) -> Any:
    if isinstance(value, Decimal):
        return int(value) if value % 1 == 0 else float(value)
    if isinstance(value, datetime):
        return _datetime_text(value)
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, list):
        return [_jsonable(item) for item in value]
    if isinstance(value, tuple):
        return [_jsonable(item) for item in value]
    if isinstance(value, dict):
        return {str(key): _jsonable(item) for key, item in value.items()}
    return value


def _payload(item: dict) -> dict:
    return _jsonable({
        key: value
        for key, value in item.items()
        if key not in {"PK", "SK", "entityType", "ttl"}
    })


def _serialized_payload_size(item: dict) -> int:
    return len(
        json.dumps(_payload(item), ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    )


def ensure_payload_fits(item: dict, *, entity_type: Optional[str] = None) -> int:
    """Enforce the application's bounded JSON payload contract."""

    size = _serialized_payload_size(item)
    if size >= DATABASE_SAFE_PAYLOAD_BYTES:
        raise ItemTooLargeError(entity_type or str(item.get("entityType") or "payload"), size)
    return size


def _parse_datetime(value: Any, *, default: Optional[datetime] = None) -> Optional[datetime]:
    if value is None or value == "":
        return default
    if isinstance(value, datetime):
        parsed = value
    elif isinstance(value, (int, float)):
        parsed = datetime.fromtimestamp(value, tz=timezone.utc)
    else:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _datetime_text(value: datetime) -> str:
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def now_iso() -> str:
    return _datetime_text(datetime.now(timezone.utc))


def _row_payload(row: Any) -> Optional[dict]:
    if row is None:
        return None
    mapping = row._mapping if hasattr(row, "_mapping") else row
    value = mapping.get("payload")
    return dict(value or {})


def _ensure_user(session: Session, user_id: str) -> None:
    session.execute(
        pg_insert(schema.users)
        .values(user_id=user_id, payload={"userId": user_id})
        .on_conflict_do_nothing(index_elements=[schema.users.c.user_id])
    )


def _upsert(
    session: Session,
    table,
    values: dict,
    *,
    key_columns: list,
) -> None:
    statement = pg_insert(table).values(**values)
    key_names = {column.name for column in key_columns}
    updates = {
        column.name: getattr(statement.excluded, column.name)
        for column in table.columns
        if column.name not in key_names
    }
    session.execute(
        statement.on_conflict_do_update(index_elements=key_columns, set_=updates)
    )


def _get(session: Session, table, *conditions) -> Optional[dict]:
    return _row_payload(session.execute(select(table).where(*conditions)).first())


def _list_payloads(session: Session, statement) -> list[dict]:
    return [dict(row.payload or {}) for row in session.execute(statement).mappings()]


def _created(item: dict) -> datetime:
    return _parse_datetime(item.get("createdAt"), default=datetime.now(timezone.utc))  # type: ignore[return-value]


def _updated(item: dict) -> datetime:
    return _parse_datetime(item.get("updatedAt"), default=_created(item))  # type: ignore[return-value]


# ----- Profile and skills -----


def get_profile(user_id: str) -> Optional[dict]:
    with session_scope() as session:
        return _get(session, schema.profiles, schema.profiles.c.user_id == user_id)


def get_or_create_profile(user_id: str) -> dict:
    existing = get_profile(user_id)
    if existing:
        return existing
    now = now_iso()
    item = {
        "userId": user_id,
        "nativeLanguage": "Chinese",
        "targetLanguage": "English",
        "estimatedLevel": "B1",
        "totalSubmissions": 0,
        "totalPracticeAttempts": 0,
        "createdAt": now,
        "updatedAt": now,
    }
    with session_scope() as session:
        _ensure_user(session, user_id)
        session.execute(
            pg_insert(schema.profiles)
            .values(
                user_id=user_id,
                estimated_level="B1",
                total_submissions=0,
                total_practice_attempts=0,
                created_at=_created(item),
                updated_at=_updated(item),
                payload=item,
            )
            .on_conflict_do_nothing(index_elements=[schema.profiles.c.user_id])
        )
        stored = _get(session, schema.profiles, schema.profiles.c.user_id == user_id)
        return stored or item


def save_profile(profile: dict) -> None:
    user_id = profile["userId"]
    with session_scope() as session:
        _ensure_user(session, user_id)
        _upsert(
            session,
            schema.profiles,
            {
                "user_id": user_id,
                "estimated_level": str(profile.get("estimatedLevel") or "B1"),
                "total_submissions": int(profile.get("totalSubmissions", 0)),
                "total_practice_attempts": int(profile.get("totalPracticeAttempts", 0)),
                "created_at": _created(profile),
                "updated_at": _updated(profile),
                "payload": _payload(profile),
            },
            key_columns=[schema.profiles.c.user_id],
        )


def list_skills(user_id: str) -> list:
    with session_scope() as session:
        return _list_payloads(
            session,
            select(schema.skills).where(schema.skills.c.user_id == user_id).order_by(schema.skills.c.skill_code),
        )


def get_skill(user_id: str, skill_code: str) -> Optional[dict]:
    with session_scope() as session:
        return _get(
            session,
            schema.skills,
            schema.skills.c.user_id == user_id,
            schema.skills.c.skill_code == skill_code,
        )


def _put_skill(session: Session, skill: dict) -> None:
    _ensure_user(session, skill["userId"])
    _upsert(
        session,
        schema.skills,
        {
            "user_id": skill["userId"],
            "skill_code": skill["skillCode"],
            "mastery": Decimal(str(skill.get("mastery", 0))),
            "error_count": int(skill.get("errorCount", 0)),
            "correct_count": int(skill.get("correctCount", 0)),
            "updated_at": _updated(skill),
            "payload": _payload(skill),
        },
        key_columns=[schema.skills.c.user_id, schema.skills.c.skill_code],
    )


def put_skill(skill: dict) -> None:
    with session_scope() as session:
        _put_skill(session, skill)


# ----- Unified learning runs, evidence, and state -----


def _run_values(run: dict) -> dict:
    return {
        "user_id": run["userId"],
        "run_id": run["id"],
        "activity_type": run.get("activityType"),
        "status": run.get("status") or "assigned",
        "version": int(run.get("version", 0)),
        "created_at": _created(run),
        "updated_at": _updated(run),
        "completed_at": _parse_datetime(run.get("completedAt")),
        "payload": _payload(run),
    }


def _save_activity_run_tx(
    session: Session,
    run: dict,
    *,
    create_only: bool = False,
    expected_version: Optional[int] = None,
) -> None:
    _ensure_user(session, run["userId"])
    values = _run_values(run)
    if create_only:
        result = session.execute(
            pg_insert(schema.activity_runs)
            .values(**values)
            .on_conflict_do_nothing(
                index_elements=[schema.activity_runs.c.user_id, schema.activity_runs.c.run_id]
            )
            .returning(schema.activity_runs.c.run_id)
        )
        if result.scalar_one_or_none() is None:
            raise PlanProgressConflictError("ActivityRun already exists.")
        return
    if expected_version is not None:
        result = session.execute(
            update(schema.activity_runs)
            .where(
                schema.activity_runs.c.user_id == run["userId"],
                schema.activity_runs.c.run_id == run["id"],
                schema.activity_runs.c.version == expected_version,
            )
            .values(**{key: value for key, value in values.items() if key not in {"user_id", "run_id"}})
        )
        if result.rowcount != 1:
            raise PlanProgressConflictError("ActivityRun changed; reload and try again.")
        return
    _upsert(
        session,
        schema.activity_runs,
        values,
        key_columns=[schema.activity_runs.c.user_id, schema.activity_runs.c.run_id],
    )


def save_activity_run(
    run: dict,
    *,
    create_only: bool = False,
    expected_version: Optional[int] = None,
) -> None:
    with session_scope() as session:
        _save_activity_run_tx(
            session,
            run,
            create_only=create_only,
            expected_version=expected_version,
        )


def get_activity_run(user_id: str, run_id: str) -> Optional[dict]:
    with session_scope() as session:
        return _get(
            session,
            schema.activity_runs,
            schema.activity_runs.c.user_id == user_id,
            schema.activity_runs.c.run_id == run_id,
        )


def list_activity_runs(user_id: str, limit: int = 50) -> list[dict]:
    if limit <= 0:
        return []
    with session_scope() as session:
        return _list_payloads(
            session,
            select(schema.activity_runs)
            .where(schema.activity_runs.c.user_id == user_id)
            .order_by(schema.activity_runs.c.created_at.desc(), schema.activity_runs.c.run_id.desc())
            .limit(limit),
        )


def list_activity_runs_since(user_id: str, since: str) -> list[dict]:
    with session_scope() as session:
        return _list_payloads(
            session,
            select(schema.activity_runs)
            .where(
                schema.activity_runs.c.user_id == user_id,
                schema.activity_runs.c.created_at >= _parse_datetime(since),
            )
            .order_by(schema.activity_runs.c.created_at),
        )


def list_completed_activity_runs_since(user_id: str, since: str) -> list[dict]:
    with session_scope() as session:
        return _list_payloads(
            session,
            select(schema.activity_runs)
            .where(
                schema.activity_runs.c.user_id == user_id,
                schema.activity_runs.c.status == "completed",
                schema.activity_runs.c.completed_at >= _parse_datetime(since),
            )
            .order_by(schema.activity_runs.c.completed_at),
        )


def get_learning_state(user_id: str, skill_code: str) -> Optional[dict]:
    with session_scope() as session:
        return _get(
            session,
            schema.learning_states,
            schema.learning_states.c.user_id == user_id,
            schema.learning_states.c.skill_code == skill_code,
        )


def list_learning_states(user_id: str) -> list[dict]:
    with session_scope() as session:
        return _list_payloads(
            session,
            select(schema.learning_states)
            .where(schema.learning_states.c.user_id == user_id)
            .order_by(schema.learning_states.c.skill_code),
        )


def get_evidence_event(user_id: str, event_id: str) -> Optional[dict]:
    with session_scope() as session:
        return _get(
            session,
            schema.evidence_events,
            schema.evidence_events.c.user_id == user_id,
            schema.evidence_events.c.event_id == event_id,
        )


def list_evidence_events(user_id: str, limit: Optional[int] = 500) -> list[dict]:
    if limit is not None and limit <= 0:
        return []
    statement = (
        select(schema.evidence_events)
        .where(schema.evidence_events.c.user_id == user_id)
        .order_by(schema.evidence_events.c.created_at.desc(), schema.evidence_events.c.event_id.desc())
    )
    if limit is not None:
        statement = statement.limit(limit)
    with session_scope() as session:
        return _list_payloads(session, statement)


def list_evidence_events_since(user_id: str, since: str) -> list[dict]:
    with session_scope() as session:
        return _list_payloads(
            session,
            select(schema.evidence_events)
            .where(
                schema.evidence_events.c.user_id == user_id,
                schema.evidence_events.c.created_at >= _parse_datetime(since),
            )
            .order_by(schema.evidence_events.c.created_at),
        )


def save_evidence_with_learning_state(
    event: dict,
    state: dict,
    *,
    expected_state_version: int,
) -> bool:
    """Insert one immutable event and compare-and-swap its learning state."""

    with session_scope() as session:
        _ensure_user(session, event["userId"])
        inserted = session.execute(
            pg_insert(schema.evidence_events)
            .values(
                user_id=event["userId"],
                event_id=event["id"],
                skill_code=event["skillCode"],
                outcome=event["outcome"],
                created_at=_created(event),
                payload=_payload(event),
            )
            .on_conflict_do_nothing(
                index_elements=[schema.evidence_events.c.user_id, schema.evidence_events.c.event_id]
            )
            .returning(schema.evidence_events.c.event_id)
        )
        if inserted.scalar_one_or_none() is None:
            return False

        values = {
            "version": int(state.get("version", expected_state_version + 1)),
            "updated_at": _updated(state),
            "payload": _payload(state),
        }
        if expected_state_version == 0:
            created = session.execute(
                pg_insert(schema.learning_states)
                .values(
                    user_id=state["userId"],
                    skill_code=state["skillCode"],
                    **values,
                )
                .on_conflict_do_nothing(
                    index_elements=[schema.learning_states.c.user_id, schema.learning_states.c.skill_code]
                )
                .returning(schema.learning_states.c.skill_code)
            )
            if created.scalar_one_or_none() is None:
                raise LearningStateConflictError("Learning state changed; retry the evidence update.")
        else:
            changed = session.execute(
                update(schema.learning_states)
                .where(
                    schema.learning_states.c.user_id == state["userId"],
                    schema.learning_states.c.skill_code == state["skillCode"],
                    schema.learning_states.c.version == expected_state_version,
                )
                .values(**values)
            )
            if changed.rowcount != 1:
                raise LearningStateConflictError("Learning state changed; retry the evidence update.")
        return True


def delete_skill(user_id: str, skill_code: str) -> None:
    with session_scope() as session:
        session.execute(
            delete(schema.skills).where(
                schema.skills.c.user_id == user_id,
                schema.skills.c.skill_code == skill_code,
            )
        )


# ----- Submissions, errors, diagnosis claims, and notes -----


def save_submission(submission: dict) -> None:
    ensure_payload_fits(submission, entity_type="submission")
    with session_scope() as session:
        _ensure_user(session, submission["userId"])
        _upsert(
            session,
            schema.submissions,
            {
                "user_id": submission["userId"],
                "submission_id": submission["id"],
                "mode": submission.get("mode"),
                "created_at": _created(submission),
                "payload": _payload(submission),
            },
            key_columns=[schema.submissions.c.user_id, schema.submissions.c.submission_id],
        )


def list_recent_submissions(user_id: str, limit: Optional[int] = 10) -> list:
    if limit is not None and limit <= 0:
        return []
    statement = (
        select(schema.submissions)
        .where(schema.submissions.c.user_id == user_id)
        .order_by(schema.submissions.c.created_at.desc(), schema.submissions.c.submission_id.desc())
    )
    if limit is not None:
        statement = statement.limit(limit)
    with session_scope() as session:
        return _list_payloads(session, statement)


def list_submissions_since(user_id: str, since: str) -> list[dict]:
    with session_scope() as session:
        return _list_payloads(
            session,
            select(schema.submissions)
            .where(
                schema.submissions.c.user_id == user_id,
                schema.submissions.c.created_at >= _parse_datetime(since),
            )
            .order_by(schema.submissions.c.created_at),
        )


def get_submission(user_id: str, created_at: str, submission_id: str) -> Optional[dict]:
    del created_at
    with session_scope() as session:
        return _get(
            session,
            schema.submissions,
            schema.submissions.c.user_id == user_id,
            schema.submissions.c.submission_id == submission_id,
        )


def delete_submission(user_id: str, created_at: str, submission_id: str) -> None:
    del created_at
    with session_scope() as session:
        session.execute(
            delete(schema.notes).where(
                schema.notes.c.user_id == user_id,
                schema.notes.c.submission_id == submission_id,
            )
        )
        session.execute(
            delete(schema.submissions).where(
                schema.submissions.c.user_id == user_id,
                schema.submissions.c.submission_id == submission_id,
            )
        )


def save_error(error: dict) -> None:
    with session_scope() as session:
        _ensure_user(session, error["userId"])
        _upsert(
            session,
            schema.errors,
            {
                "user_id": error["userId"],
                "error_id": error["id"],
                "submission_id": error["submissionId"],
                "code": error.get("code"),
                "created_at": _created(error),
                "payload": _payload(error),
            },
            key_columns=[schema.errors.c.user_id, schema.errors.c.error_id],
        )


def list_recent_errors(user_id: str, limit: Optional[int] = 20) -> list:
    if limit is not None and limit <= 0:
        return []
    statement = (
        select(schema.errors)
        .where(schema.errors.c.user_id == user_id)
        .order_by(schema.errors.c.created_at.desc(), schema.errors.c.error_id.desc())
    )
    if limit is not None:
        statement = statement.limit(limit)
    with session_scope() as session:
        return _list_payloads(session, statement)


def list_errors_since(user_id: str, since: str) -> list[dict]:
    with session_scope() as session:
        return _list_payloads(
            session,
            select(schema.errors)
            .where(
                schema.errors.c.user_id == user_id,
                schema.errors.c.created_at >= _parse_datetime(since),
            )
            .order_by(schema.errors.c.created_at),
        )


def list_weekly_errors(user_id: str, limit: int = 100) -> list:
    since = datetime.now(timezone.utc) - timedelta(days=7)
    with session_scope() as session:
        return _list_payloads(
            session,
            select(schema.errors)
            .where(schema.errors.c.user_id == user_id, schema.errors.c.created_at >= since)
            .order_by(schema.errors.c.created_at.desc())
            .limit(limit),
        )


def list_errors_for_submission(user_id: str, created_at: str, submission_id: str) -> list:
    del created_at
    with session_scope() as session:
        return _list_payloads(
            session,
            select(schema.errors)
            .where(schema.errors.c.user_id == user_id, schema.errors.c.submission_id == submission_id)
            .order_by(schema.errors.c.created_at),
        )


def delete_error(user_id: str, created_at: str, error_id: str) -> None:
    del created_at
    with session_scope() as session:
        session.execute(
            delete(schema.errors).where(
                schema.errors.c.user_id == user_id,
                schema.errors.c.error_id == error_id,
            )
        )


def get_submission_hash(user_id: str, text_hash: str) -> Optional[dict]:
    with session_scope() as session:
        return _get(
            session,
            schema.diagnosis_requests,
            schema.diagnosis_requests.c.user_id == user_id,
            schema.diagnosis_requests.c.text_hash == text_hash,
        )


def _diagnosis_values(item: dict) -> dict:
    return {
        "user_id": item["userId"],
        "text_hash": item["textHash"],
        "status": item.get("status") or "processing",
        "claim_id": item.get("processingClaimId"),
        "claimed_at": _parse_datetime(item.get("processingClaimedAt")),
        "claimed_at_epoch": item.get("processingClaimedAtEpoch"),
        "submission_id": item.get("submissionId"),
        "submission_created_at": _parse_datetime(item.get("submissionCreatedAt")),
        "created_at": _created(item),
        "updated_at": _updated(item),
        "payload": _payload(item),
    }


def put_submission_hash(
    user_id: str,
    text_hash: str,
    submission_id: str,
    submission_created_at: str,
    claim_id: str,
) -> None:
    with session_scope() as session:
        row = session.execute(
            select(schema.diagnosis_requests)
            .where(
                schema.diagnosis_requests.c.user_id == user_id,
                schema.diagnosis_requests.c.text_hash == text_hash,
            )
            .with_for_update()
        ).mappings().first()
        if not row or row.claim_id != claim_id:
            return
        payload = dict(row.payload or {})
        now = now_iso()
        payload.update({
            "status": "complete",
            "submissionId": submission_id,
            "submissionCreatedAt": submission_created_at,
            "updatedAt": now,
        })
        for name in ("processingClaimId", "processingClaimedAt", "processingClaimedAtEpoch"):
            payload.pop(name, None)
        session.execute(
            update(schema.diagnosis_requests)
            .where(
                schema.diagnosis_requests.c.user_id == user_id,
                schema.diagnosis_requests.c.text_hash == text_hash,
                schema.diagnosis_requests.c.claim_id == claim_id,
            )
            .values(
                status="complete",
                claim_id=None,
                claimed_at=None,
                claimed_at_epoch=None,
                submission_id=submission_id,
                submission_created_at=_parse_datetime(submission_created_at),
                updated_at=_parse_datetime(now),
                payload=payload,
            )
        )


def claim_diagnosis_request(
    user_id: str,
    text_hash: str,
    claim_id: str,
    *,
    stale_after_seconds: int = 900,
) -> dict:
    now = datetime.now(timezone.utc)
    now_text = _datetime_text(now)
    stable_id = "sub_" + hashlib.sha256(
        f"{user_id}\0{text_hash}".encode("utf-8")
    ).hexdigest()[:20]
    item = {
        "userId": user_id,
        "textHash": text_hash,
        "submissionId": stable_id,
        "submissionCreatedAt": now_text,
        "status": "processing",
        "processingClaimId": claim_id,
        "processingClaimedAt": now_text,
        "processingClaimedAtEpoch": int(now.timestamp()),
        "createdAt": now_text,
        "updatedAt": now_text,
    }
    with session_scope() as session:
        _ensure_user(session, user_id)
        inserted = session.execute(
            pg_insert(schema.diagnosis_requests)
            .values(**_diagnosis_values(item))
            .on_conflict_do_nothing(
                index_elements=[schema.diagnosis_requests.c.user_id, schema.diagnosis_requests.c.text_hash]
            )
            .returning(schema.diagnosis_requests.c.text_hash)
        )
        if inserted.scalar_one_or_none() is not None:
            return {**item, "claimState": "acquired"}
        row = session.execute(
            select(schema.diagnosis_requests)
            .where(
                schema.diagnosis_requests.c.user_id == user_id,
                schema.diagnosis_requests.c.text_hash == text_hash,
            )
            .with_for_update()
        ).mappings().one()
        existing = dict(row.payload or {})
        if row.status == "complete" and row.submission_id:
            return {**existing, "claimState": "complete"}
        stale_before = int(now.timestamp()) - max(60, stale_after_seconds)
        if row.claim_id and (row.claimed_at_epoch or 0) >= stale_before:
            return {**existing, "claimState": "busy"}
        replacement = {
            **existing,
            **item,
            "submissionCreatedAt": existing.get("submissionCreatedAt", now_text),
            "createdAt": existing.get("createdAt", now_text),
        }
        session.execute(
            update(schema.diagnosis_requests)
            .where(
                schema.diagnosis_requests.c.user_id == user_id,
                schema.diagnosis_requests.c.text_hash == text_hash,
            )
            .values(**_diagnosis_values(replacement))
        )
        return {**replacement, "claimState": "acquired"}


def save_diagnosis_draft(
    user_id: str,
    text_hash: str,
    claim_id: str,
    draft: dict,
) -> None:
    with session_scope() as session:
        row = session.execute(
            select(schema.diagnosis_requests.c.payload)
            .where(
                schema.diagnosis_requests.c.user_id == user_id,
                schema.diagnosis_requests.c.text_hash == text_hash,
                schema.diagnosis_requests.c.claim_id == claim_id,
                schema.diagnosis_requests.c.status == "processing",
            )
            .with_for_update()
        ).first()
        if not row:
            return
        payload = dict(row.payload or {})
        payload.update({"diagnosisDraft": _jsonable(draft), "diagnosisDraftedAt": now_iso(), "updatedAt": now_iso()})
        session.execute(
            update(schema.diagnosis_requests)
            .where(
                schema.diagnosis_requests.c.user_id == user_id,
                schema.diagnosis_requests.c.text_hash == text_hash,
                schema.diagnosis_requests.c.claim_id == claim_id,
            )
            .values(payload=payload, updated_at=datetime.now(timezone.utc))
        )


def release_diagnosis_request(user_id: str, text_hash: str, claim_id: str) -> None:
    with session_scope() as session:
        row = session.execute(
            select(schema.diagnosis_requests.c.payload)
            .where(
                schema.diagnosis_requests.c.user_id == user_id,
                schema.diagnosis_requests.c.text_hash == text_hash,
                schema.diagnosis_requests.c.claim_id == claim_id,
            )
            .with_for_update()
        ).first()
        if not row:
            return
        payload = dict(row.payload or {})
        payload["status"] = "failed"
        payload["updatedAt"] = now_iso()
        for name in ("processingClaimId", "processingClaimedAt", "processingClaimedAtEpoch"):
            payload.pop(name, None)
        session.execute(
            update(schema.diagnosis_requests)
            .where(
                schema.diagnosis_requests.c.user_id == user_id,
                schema.diagnosis_requests.c.text_hash == text_hash,
                schema.diagnosis_requests.c.claim_id == claim_id,
            )
            .values(status="failed", claim_id=None, claimed_at=None, claimed_at_epoch=None, payload=payload)
        )


def delete_submission_hash(user_id: str, text_hash: str) -> None:
    with session_scope() as session:
        session.execute(
            delete(schema.diagnosis_requests).where(
                schema.diagnosis_requests.c.user_id == user_id,
                schema.diagnosis_requests.c.text_hash == text_hash,
            )
        )


def save_note(note: dict) -> None:
    with session_scope() as session:
        _ensure_user(session, note["userId"])
        _upsert(
            session,
            schema.notes,
            {
                "user_id": note["userId"],
                "note_id": note["id"],
                "submission_id": note.get("submissionId"),
                "category": note.get("category"),
                "created_at": _created(note),
                "payload": _payload(note),
            },
            key_columns=[schema.notes.c.user_id, schema.notes.c.note_id],
        )


def list_notes(user_id: str, limit: Optional[int] = None) -> list:
    if limit is not None and limit <= 0:
        return []
    statement = (
        select(schema.notes)
        .where(schema.notes.c.user_id == user_id)
        .order_by(schema.notes.c.created_at.desc(), schema.notes.c.note_id.desc())
    )
    if limit is not None:
        statement = statement.limit(limit)
    with session_scope() as session:
        return _list_payloads(session, statement)


def list_notes_for_submission(user_id: str, created_at: str, submission_id: str) -> list:
    del created_at
    with session_scope() as session:
        return _list_payloads(
            session,
            select(schema.notes).where(
                schema.notes.c.user_id == user_id,
                schema.notes.c.submission_id == submission_id,
            ),
        )


def get_note(user_id: str, created_at: str, note_id: str) -> Optional[dict]:
    del created_at
    with session_scope() as session:
        return _get(
            session,
            schema.notes,
            schema.notes.c.user_id == user_id,
            schema.notes.c.note_id == note_id,
        )


def delete_note(user_id: str, created_at: str, note_id: str) -> None:
    del created_at
    with session_scope() as session:
        session.execute(
            delete(schema.notes).where(
                schema.notes.c.user_id == user_id,
                schema.notes.c.note_id == note_id,
            )
        )


# ----- Memory -----


def claim_memory_write_lease(
    user_id: str,
    claim_id: str,
    *,
    stale_after_seconds: int = 120,
) -> bool:
    now = datetime.now(timezone.utc)
    epoch = int(now.timestamp())
    with session_scope() as session:
        _ensure_user(session, user_id)
        inserted = session.execute(
            pg_insert(schema.memory_leases)
            .values(user_id=user_id, claim_id=claim_id, claimed_at=now, claimed_at_epoch=epoch)
            .on_conflict_do_nothing(index_elements=[schema.memory_leases.c.user_id])
            .returning(schema.memory_leases.c.user_id)
        )
        if inserted.scalar_one_or_none() is not None:
            return True
        row = session.execute(
            select(schema.memory_leases)
            .where(schema.memory_leases.c.user_id == user_id)
            .with_for_update()
        ).mappings().one()
        if row.claim_id == claim_id:
            return True
        if row.claimed_at_epoch >= epoch - max(30, stale_after_seconds):
            return False
        session.execute(
            update(schema.memory_leases)
            .where(schema.memory_leases.c.user_id == user_id)
            .values(claim_id=claim_id, claimed_at=now, claimed_at_epoch=epoch)
        )
        return True


def release_memory_write_lease(user_id: str, claim_id: str) -> None:
    with session_scope() as session:
        session.execute(
            delete(schema.memory_leases).where(
                schema.memory_leases.c.user_id == user_id,
                schema.memory_leases.c.claim_id == claim_id,
            )
        )


def _memory_values(memory: dict) -> dict:
    ttl = memory.get("ttl")
    return {
        "user_id": memory["userId"],
        "memory_id": memory["id"],
        "kind": memory.get("kind") or "episode",
        "canonical_key": memory.get("canonicalKey"),
        "status": memory.get("status") or "active",
        "pinned": bool(memory.get("pinned", False)),
        "access_count": int(memory.get("accessCount", 0)),
        "created_at": _created(memory),
        "updated_at": _updated(memory),
        "last_accessed_at": _parse_datetime(memory.get("lastAccessedAt")),
        "expires_at": _parse_datetime(memory.get("expiresAt")),
        "delete_after": _parse_datetime(ttl) if ttl is not None else None,
        "embedding": _jsonable(memory.get("embedding")),
        "payload": _payload(memory),
    }


def _save_memory_tx(session: Session, memory: dict) -> None:
    _ensure_user(session, memory["userId"])
    _upsert(
        session,
        schema.memories,
        _memory_values(memory),
        key_columns=[schema.memories.c.user_id, schema.memories.c.memory_id],
    )


def save_memory_with_memory_write_lease(memory: dict, claim_id: str) -> None:
    with session_scope() as session:
        lease = session.execute(
            select(schema.memory_leases.c.claim_id)
            .where(schema.memory_leases.c.user_id == memory["userId"])
            .with_for_update()
        ).scalar_one_or_none()
        if lease != claim_id:
            raise MemoryWriteClaimLostError("The learner memory write lease was replaced.")
        _save_memory_tx(session, memory)


def save_memory(memory: dict) -> None:
    ensure_payload_fits(memory, entity_type="memory")
    with session_scope() as session:
        _save_memory_tx(session, memory)


def get_memory(user_id: str, memory_id: str) -> Optional[dict]:
    with session_scope() as session:
        return _get(
            session,
            schema.memories,
            schema.memories.c.user_id == user_id,
            schema.memories.c.memory_id == memory_id,
        )


def touch_memory_access(user_id: str, memory_id: str, accessed_at: str) -> None:
    with session_scope() as session:
        row = session.execute(
            select(schema.memories).where(
                schema.memories.c.user_id == user_id,
                schema.memories.c.memory_id == memory_id,
                schema.memories.c.status == "active",
            ).with_for_update()
        ).mappings().first()
        if not row:
            return
        payload = dict(row.payload or {})
        payload["accessCount"] = int(payload.get("accessCount", 0)) + 1
        payload["lastAccessedAt"] = accessed_at
        session.execute(
            update(schema.memories)
            .where(schema.memories.c.user_id == user_id, schema.memories.c.memory_id == memory_id)
            .values(
                access_count=schema.memories.c.access_count + 1,
                last_accessed_at=_parse_datetime(accessed_at),
                payload=payload,
            )
        )


def expire_memory_if_due(user_id: str, memory_id: str, now_text: str, ttl_epoch: int) -> None:
    now_value = _parse_datetime(now_text)
    with session_scope() as session:
        row = session.execute(
            select(schema.memories).where(
                schema.memories.c.user_id == user_id,
                schema.memories.c.memory_id == memory_id,
                schema.memories.c.status == "active",
                schema.memories.c.pinned.is_(False),
                schema.memories.c.expires_at <= now_value,
            ).with_for_update()
        ).mappings().first()
        if not row:
            return
        payload = dict(row.payload or {})
        payload.update({"status": "expired", "updatedAt": now_text, "expiresAt": now_text})
        session.execute(
            update(schema.memories)
            .where(schema.memories.c.user_id == user_id, schema.memories.c.memory_id == memory_id)
            .values(
                status="expired",
                updated_at=now_value,
                expires_at=now_value,
                delete_after=_parse_datetime(ttl_epoch),
                payload=payload,
            )
        )


def list_memories(user_id: str, limit: Optional[int] = 200) -> list:
    if limit is not None and limit <= 0:
        return []
    statement = (
        select(schema.memories)
        .where(schema.memories.c.user_id == user_id)
        .order_by(schema.memories.c.updated_at.desc(), schema.memories.c.memory_id.desc())
    )
    if limit is not None:
        statement = statement.limit(limit)
    with session_scope() as session:
        return _list_payloads(session, statement)


def delete_memory(user_id: str, memory_id: str) -> None:
    with session_scope() as session:
        session.execute(delete(schema.memories).where(
            schema.memories.c.user_id == user_id,
            schema.memories.c.memory_id == memory_id,
        ))


def save_memory_trace(trace: dict) -> None:
    ttl = trace.get("ttl")
    with session_scope() as session:
        _ensure_user(session, trace["userId"])
        _upsert(
            session,
            schema.memory_traces,
            {
                "user_id": trace["userId"],
                "trace_id": trace["id"],
                "created_at": _created(trace),
                "expires_at": _parse_datetime(ttl) if ttl is not None else _parse_datetime(trace.get("expiresAt")),
                "payload": _payload(trace),
            },
            key_columns=[schema.memory_traces.c.user_id, schema.memory_traces.c.trace_id],
        )


def list_memory_traces(user_id: str, limit: int = 20) -> list:
    if limit <= 0:
        return []
    now = datetime.now(timezone.utc)
    with session_scope() as session:
        return _list_payloads(
            session,
            select(schema.memory_traces)
            .where(
                schema.memory_traces.c.user_id == user_id,
                or_(schema.memory_traces.c.expires_at.is_(None), schema.memory_traces.c.expires_at > now),
            )
            .order_by(schema.memory_traces.c.created_at.desc())
            .limit(limit),
        )


# ----- Input learning -----


def _source_values(source: dict) -> dict:
    return {
        "user_id": source["userId"],
        "source_id": source["id"],
        "status": source.get("status") or "processing",
        "claim_id": source.get("processingClaimId"),
        "claimed_at": _parse_datetime(source.get("processingClaimedAt")),
        "claimed_at_epoch": source.get("processingClaimedAtEpoch"),
        "created_at": _created(source),
        "updated_at": _updated(source),
        "payload": _payload(source),
    }


def save_input_learning_source(source: dict) -> None:
    with session_scope() as session:
        _ensure_user(session, source["userId"])
        _upsert(
            session,
            schema.input_sources,
            _source_values(source),
            key_columns=[schema.input_sources.c.user_id, schema.input_sources.c.source_id],
        )


def claim_input_learning_source(
    user_id: str,
    source_id: str,
    claim_id: str,
    seed: dict,
    *,
    stale_after_seconds: int = 900,
) -> bool:
    now = datetime.now(timezone.utc)
    now_text = _datetime_text(now)
    candidate = {
        **seed,
        "id": source_id,
        "userId": user_id,
        "status": "processing",
        "processingClaimId": claim_id,
        "processingClaimedAt": now_text,
        "processingClaimedAtEpoch": int(now.timestamp()),
        "createdAt": seed.get("createdAt") or now_text,
        "updatedAt": now_text,
    }
    with session_scope() as session:
        _ensure_user(session, user_id)
        inserted = session.execute(
            pg_insert(schema.input_sources)
            .values(**_source_values(candidate))
            .on_conflict_do_nothing(
                index_elements=[schema.input_sources.c.user_id, schema.input_sources.c.source_id]
            )
            .returning(schema.input_sources.c.source_id)
        )
        if inserted.scalar_one_or_none() is not None:
            return True
        row = session.execute(
            select(schema.input_sources)
            .where(schema.input_sources.c.user_id == user_id, schema.input_sources.c.source_id == source_id)
            .with_for_update()
        ).mappings().one()
        if row.status == "complete":
            return False
        if row.claim_id and (row.claimed_at_epoch or 0) >= int(now.timestamp()) - max(60, stale_after_seconds):
            return row.claim_id == claim_id
        candidate["createdAt"] = dict(row.payload or {}).get("createdAt", candidate["createdAt"])
        session.execute(
            update(schema.input_sources)
            .where(schema.input_sources.c.user_id == user_id, schema.input_sources.c.source_id == source_id)
            .values(**{key: value for key, value in _source_values(candidate).items() if key not in {"user_id", "source_id"}})
        )
        return True


def complete_input_learning_source(source: dict, claim_id: str) -> None:
    with session_scope() as session:
        result = session.execute(
            update(schema.input_sources)
            .where(
                schema.input_sources.c.user_id == source["userId"],
                schema.input_sources.c.source_id == source["id"],
                schema.input_sources.c.claim_id == claim_id,
                schema.input_sources.c.status == "processing",
            )
            .values(**{key: value for key, value in _source_values(source).items() if key not in {"user_id", "source_id"}})
        )
        if result.rowcount != 1:
            raise InputLearningClaimLostError("The input-learning persistence claim was replaced.")


def release_input_learning_source_claim(user_id: str, source_id: str, claim_id: str) -> None:
    with session_scope() as session:
        row = session.execute(
            select(schema.input_sources.c.payload)
            .where(
                schema.input_sources.c.user_id == user_id,
                schema.input_sources.c.source_id == source_id,
                schema.input_sources.c.claim_id == claim_id,
                schema.input_sources.c.status == "processing",
            )
            .with_for_update()
        ).first()
        if not row:
            return
        payload = dict(row.payload or {})
        for field in ("processingClaimId", "processingClaimedAt", "processingClaimedAtEpoch"):
            payload.pop(field, None)
        payload["updatedAt"] = now_iso()
        session.execute(
            update(schema.input_sources)
            .where(schema.input_sources.c.user_id == user_id, schema.input_sources.c.source_id == source_id)
            .values(claim_id=None, claimed_at=None, claimed_at_epoch=None, updated_at=datetime.now(timezone.utc), payload=payload)
        )


def get_input_learning_source(user_id: str, source_id: str) -> Optional[dict]:
    with session_scope() as session:
        return _get(
            session,
            schema.input_sources,
            schema.input_sources.c.user_id == user_id,
            schema.input_sources.c.source_id == source_id,
        )


def _cursor_parts(start_key: Optional[dict]) -> tuple[Optional[datetime], Optional[str]]:
    if not start_key:
        return None, None
    return _parse_datetime(start_key.get("createdAt") or start_key.get("created_at")), start_key.get("id")


def list_input_learning_sources_page(
    user_id: str,
    page_size: int = 50,
    start_key: Optional[dict] = None,
) -> tuple[list, Optional[dict]]:
    if page_size <= 0:
        return [], None
    cursor_time, cursor_id = _cursor_parts(start_key)
    condition = schema.input_sources.c.user_id == user_id
    if cursor_time and cursor_id:
        condition = and_(
            condition,
            or_(
                schema.input_sources.c.created_at < cursor_time,
                and_(schema.input_sources.c.created_at == cursor_time, schema.input_sources.c.source_id < cursor_id),
            ),
        )
    with session_scope() as session:
        rows = session.execute(
            select(schema.input_sources)
            .where(condition)
            .order_by(schema.input_sources.c.created_at.desc(), schema.input_sources.c.source_id.desc())
            .limit(page_size + 1)
        ).mappings().all()
    page_rows = rows[:page_size]
    page = [dict(row.payload or {}) for row in page_rows]
    next_key = None
    if len(rows) > page_size and page_rows:
        last = page_rows[-1]
        next_key = {"createdAt": _datetime_text(last.created_at), "id": last.source_id}
    return page, next_key


def list_input_learning_sources(user_id: str, limit: Optional[int] = None) -> list:
    if limit is not None and limit <= 0:
        return []
    statement = (
        select(schema.input_sources)
        .where(schema.input_sources.c.user_id == user_id)
        .order_by(schema.input_sources.c.created_at.desc(), schema.input_sources.c.source_id.desc())
    )
    if limit is not None:
        statement = statement.limit(limit)
    with session_scope() as session:
        return _list_payloads(session, statement)


def _lock_input_claim(session: Session, user_id: str, source_id: str, claim_id: str) -> None:
    owner = session.execute(
        select(schema.input_sources.c.claim_id)
        .where(
            schema.input_sources.c.user_id == user_id,
            schema.input_sources.c.source_id == source_id,
            schema.input_sources.c.status == "processing",
        )
        .with_for_update()
    ).scalar_one_or_none()
    if owner != claim_id:
        raise InputLearningClaimLostError("The input-learning persistence claim was replaced.")


def _save_input_item_tx(session: Session, item: dict) -> None:
    _upsert(
        session,
        schema.input_items,
        {
            "user_id": item["userId"],
            "source_id": item["sourceId"],
            "item_id": item["id"],
            "position": int(item.get("position", 0)),
            "created_at": _created(item),
            "payload": _payload(item),
        },
        key_columns=[schema.input_items.c.user_id, schema.input_items.c.source_id, schema.input_items.c.item_id],
    )


def save_input_learning_item(item: dict, claim_id: Optional[str] = None) -> None:
    with session_scope() as session:
        if claim_id:
            _lock_input_claim(session, item["userId"], item["sourceId"], claim_id)
        _save_input_item_tx(session, item)


def save_memory_with_input_learning_claim(
    memory: dict,
    source_id: str,
    claim_id: str,
    memory_claim_id: Optional[str] = None,
) -> None:
    with session_scope() as session:
        _lock_input_claim(session, memory["userId"], source_id, claim_id)
        if memory_claim_id:
            owner = session.execute(
                select(schema.memory_leases.c.claim_id)
                .where(schema.memory_leases.c.user_id == memory["userId"])
                .with_for_update()
            ).scalar_one_or_none()
            if owner != memory_claim_id:
                raise MemoryWriteClaimLostError("The learner memory write lease was replaced.")
        _save_memory_tx(session, memory)


def list_input_learning_items(user_id: str, source_id: str) -> list:
    with session_scope() as session:
        return _list_payloads(
            session,
            select(schema.input_items)
            .where(schema.input_items.c.user_id == user_id, schema.input_items.c.source_id == source_id)
            .order_by(schema.input_items.c.position, schema.input_items.c.created_at),
        )


def delete_input_learning_items(
    user_id: str,
    source_id: str,
    claim_id: Optional[str] = None,
) -> None:
    with session_scope() as session:
        if claim_id:
            _lock_input_claim(session, user_id, source_id, claim_id)
        session.execute(delete(schema.input_items).where(
            schema.input_items.c.user_id == user_id,
            schema.input_items.c.source_id == source_id,
        ))


def delete_input_learning_source(user_id: str, source_id: str) -> None:
    with session_scope() as session:
        session.execute(delete(schema.input_sources).where(
            schema.input_sources.c.user_id == user_id,
            schema.input_sources.c.source_id == source_id,
        ))


# ----- Private ebook library, analysis, and practice -----


def _ebook_values(book: dict) -> dict:
    return {
        "user_id": book["userId"],
        "book_id": book["id"],
        "status": book.get("status") or "processing",
        "title": book.get("title") or "Untitled",
        "last_study_pack_id": book.get("lastStudyPackId"),
        "last_studied_page": book.get("lastStudiedPage"),
        "created_at": _created(book),
        "updated_at": _updated(book),
        "payload": _payload(book),
    }


def save_ebook(book: dict) -> None:
    with session_scope() as session:
        _ensure_user(session, book["userId"])
        _upsert(
            session,
            schema.ebooks,
            _ebook_values(book),
            key_columns=[schema.ebooks.c.user_id, schema.ebooks.c.book_id],
        )


def get_ebook(user_id: str, book_id: str) -> Optional[dict]:
    with session_scope() as session:
        return _get(session, schema.ebooks, schema.ebooks.c.user_id == user_id, schema.ebooks.c.book_id == book_id)


def list_ebooks(user_id: str) -> list[dict]:
    with session_scope() as session:
        return _list_payloads(
            session,
            select(schema.ebooks)
            .where(schema.ebooks.c.user_id == user_id)
            .order_by(schema.ebooks.c.updated_at.desc(), schema.ebooks.c.book_id.desc()),
        )


def save_ebook_page(page: dict) -> None:
    with session_scope() as session:
        _upsert(
            session,
            schema.ebook_pages,
            {
                "user_id": page["userId"],
                "book_id": page["bookId"],
                "page_number": int(page["pageNumber"]),
                "created_at": _created(page),
                "payload": _payload(page),
            },
            key_columns=[schema.ebook_pages.c.user_id, schema.ebook_pages.c.book_id, schema.ebook_pages.c.page_number],
        )


def get_ebook_page(user_id: str, book_id: str, page_number: int) -> Optional[dict]:
    with session_scope() as session:
        return _get(
            session,
            schema.ebook_pages,
            schema.ebook_pages.c.user_id == user_id,
            schema.ebook_pages.c.book_id == book_id,
            schema.ebook_pages.c.page_number == page_number,
        )


def list_ebook_pages(user_id: str, book_id: str) -> list[dict]:
    with session_scope() as session:
        return _list_payloads(
            session,
            select(schema.ebook_pages)
            .where(schema.ebook_pages.c.user_id == user_id, schema.ebook_pages.c.book_id == book_id)
            .order_by(schema.ebook_pages.c.page_number),
        )


def save_ebook_analysis_page(page: dict) -> None:
    with session_scope() as session:
        _upsert(
            session,
            schema.ebook_analysis_pages,
            {
                "user_id": page["userId"],
                "cache_id": page["cacheId"],
                "book_id": page.get("bookId"),
                "page_number": page.get("pageNumber"),
                "created_at": _created(page),
                "payload": _payload(page),
            },
            key_columns=[schema.ebook_analysis_pages.c.user_id, schema.ebook_analysis_pages.c.cache_id],
        )


def get_ebook_analysis_page(user_id: str, cache_id: str) -> Optional[dict]:
    with session_scope() as session:
        return _get(
            session,
            schema.ebook_analysis_pages,
            schema.ebook_analysis_pages.c.user_id == user_id,
            schema.ebook_analysis_pages.c.cache_id == cache_id,
        )


def _pack_values(pack: dict) -> dict:
    return {
        "user_id": pack["userId"],
        "pack_id": pack["id"],
        "book_id": pack["bookId"],
        "status": pack.get("status") or "processing",
        "claim_id": pack.get("processingClaimId"),
        "deleted_at": _parse_datetime(pack.get("deletedAt")),
        "created_at": _created(pack),
        "updated_at": _updated(pack),
        "payload": _payload(pack),
    }


def save_ebook_study_pack(pack: dict) -> None:
    ensure_payload_fits(pack, entity_type="ebook study pack")
    with session_scope() as session:
        _upsert(
            session,
            schema.ebook_study_packs,
            _pack_values(pack),
            key_columns=[schema.ebook_study_packs.c.user_id, schema.ebook_study_packs.c.pack_id],
        )


def save_ebook_study_pack_if_processing(pack: dict, claim_id: Optional[str]) -> bool:
    ensure_payload_fits(pack, entity_type="ebook study pack")
    with session_scope() as session:
        conditions = [
            schema.ebook_study_packs.c.user_id == pack["userId"],
            schema.ebook_study_packs.c.pack_id == pack["id"],
            schema.ebook_study_packs.c.status == "processing",
        ]
        if claim_id:
            conditions.append(schema.ebook_study_packs.c.claim_id == claim_id)
        result = session.execute(
            update(schema.ebook_study_packs)
            .where(*conditions)
            .values(**{key: value for key, value in _pack_values(pack).items() if key not in {"user_id", "pack_id"}})
        )
        return result.rowcount == 1


def get_ebook_study_pack(user_id: str, pack_id: str) -> Optional[dict]:
    with session_scope() as session:
        return _get(
            session,
            schema.ebook_study_packs,
            schema.ebook_study_packs.c.user_id == user_id,
            schema.ebook_study_packs.c.pack_id == pack_id,
        )


def list_ebook_study_packs(user_id: str, book_id: str) -> list[dict]:
    with session_scope() as session:
        return _list_payloads(
            session,
            select(schema.ebook_study_packs)
            .where(
                schema.ebook_study_packs.c.user_id == user_id,
                schema.ebook_study_packs.c.book_id == book_id,
                schema.ebook_study_packs.c.deleted_at.is_(None),
            )
            .order_by(schema.ebook_study_packs.c.created_at.desc(), schema.ebook_study_packs.c.pack_id.desc()),
        )


def delete_ebook_study_pack(user_id: str, pack_id: str, deleted_at: str) -> bool:
    with session_scope() as session:
        row = session.execute(
            select(schema.ebook_study_packs.c.payload)
            .where(
                schema.ebook_study_packs.c.user_id == user_id,
                schema.ebook_study_packs.c.pack_id == pack_id,
                schema.ebook_study_packs.c.deleted_at.is_(None),
            )
            .with_for_update()
        ).first()
        if not row:
            return False
        payload = dict(row.payload or {})
        payload.update({"status": "archived", "deletedAt": deleted_at, "updatedAt": deleted_at})
        payload.pop("processingClaimId", None)
        session.execute(
            update(schema.ebook_study_packs)
            .where(schema.ebook_study_packs.c.user_id == user_id, schema.ebook_study_packs.c.pack_id == pack_id)
            .values(status="archived", claim_id=None, deleted_at=_parse_datetime(deleted_at), updated_at=_parse_datetime(deleted_at), payload=payload)
        )
        return True


def replace_ebook_last_study_pack(
    user_id: str,
    book_id: str,
    expected_pack_id: str,
    replacement: Optional[dict],
    updated_at: str,
) -> bool:
    with session_scope() as session:
        row = session.execute(
            select(schema.ebooks).where(
                schema.ebooks.c.user_id == user_id,
                schema.ebooks.c.book_id == book_id,
                schema.ebooks.c.last_study_pack_id == expected_pack_id,
            ).with_for_update()
        ).mappings().first()
        if not row:
            return False
        payload = dict(row.payload or {})
        if replacement:
            payload["lastStudyPackId"] = replacement["id"]
            payload["lastStudyRange"] = {
                "startPage": replacement["startPage"],
                "endPage": replacement["endPage"],
                "modelTier": replacement.get("modelTier") or "deep",
            }
            next_pack = replacement["id"]
        else:
            payload.pop("lastStudyPackId", None)
            payload.pop("lastStudyRange", None)
            next_pack = None
        payload["updatedAt"] = updated_at
        session.execute(
            update(schema.ebooks)
            .where(schema.ebooks.c.user_id == user_id, schema.ebooks.c.book_id == book_id)
            .values(last_study_pack_id=next_pack, updated_at=_parse_datetime(updated_at), payload=payload)
        )
        return True


def update_ebook_last_studied_if_current(
    user_id: str,
    book_id: str,
    pack_id: str,
    end_page: int,
    study_range: dict,
    updated_at: str,
) -> bool:
    with session_scope() as session:
        row = session.execute(
            select(schema.ebooks).where(
                schema.ebooks.c.user_id == user_id,
                schema.ebooks.c.book_id == book_id,
                schema.ebooks.c.last_study_pack_id == pack_id,
            ).with_for_update()
        ).mappings().first()
        if not row:
            return False
        payload = dict(row.payload or {})
        payload.update({
            "lastStudiedPage": end_page,
            "lastStudyRange": _jsonable(study_range),
            "updatedAt": updated_at,
        })
        session.execute(
            update(schema.ebooks)
            .where(schema.ebooks.c.user_id == user_id, schema.ebooks.c.book_id == book_id)
            .values(last_studied_page=end_page, updated_at=_parse_datetime(updated_at), payload=payload)
        )
        return True


def save_ebook_annotation(annotation: dict) -> None:
    with session_scope() as session:
        _upsert(
            session,
            schema.ebook_annotations,
            {
                "user_id": annotation["userId"],
                "annotation_id": annotation["id"],
                "book_id": annotation["bookId"],
                "page_number": annotation.get("pageNumber"),
                "created_at": _created(annotation),
                "payload": _payload(annotation),
            },
            key_columns=[schema.ebook_annotations.c.user_id, schema.ebook_annotations.c.annotation_id],
        )


def get_ebook_annotation(user_id: str, annotation_id: str) -> Optional[dict]:
    with session_scope() as session:
        return _get(
            session,
            schema.ebook_annotations,
            schema.ebook_annotations.c.user_id == user_id,
            schema.ebook_annotations.c.annotation_id == annotation_id,
        )


def save_ebook_learning_target(target: dict) -> None:
    with session_scope() as session:
        _upsert(
            session,
            schema.ebook_targets,
            {
                "user_id": target["userId"],
                "target_id": target["id"],
                "book_id": target["bookId"],
                "status": target.get("status") or "provisional",
                "due_at": _parse_datetime(target.get("dueAt")),
                "created_at": _created(target),
                "updated_at": _updated(target),
                "payload": _payload(target),
            },
            key_columns=[schema.ebook_targets.c.user_id, schema.ebook_targets.c.target_id],
        )


def get_ebook_learning_target(user_id: str, target_id: str) -> Optional[dict]:
    with session_scope() as session:
        return _get(
            session,
            schema.ebook_targets,
            schema.ebook_targets.c.user_id == user_id,
            schema.ebook_targets.c.target_id == target_id,
        )


def list_ebook_learning_targets(user_id: str) -> list[dict]:
    with session_scope() as session:
        return _list_payloads(
            session,
            select(schema.ebook_targets)
            .where(schema.ebook_targets.c.user_id == user_id)
            .order_by(schema.ebook_targets.c.updated_at.desc(), schema.ebook_targets.c.target_id.desc()),
        )


def delete_ebook_learning_target(user_id: str, target_id: str) -> None:
    with session_scope() as session:
        session.execute(delete(schema.ebook_targets).where(
            schema.ebook_targets.c.user_id == user_id,
            schema.ebook_targets.c.target_id == target_id,
        ))


def save_ebook_practice_session(session_item: dict) -> None:
    with session_scope() as session:
        _upsert(
            session,
            schema.ebook_practice_sessions,
            {
                "user_id": session_item["userId"],
                "session_id": session_item["id"],
                "book_id": session_item["bookId"],
                "target_id": session_item["targetId"],
                "status": session_item.get("status") or "active",
                "created_at": _created(session_item),
                "updated_at": _updated(session_item),
                "payload": _payload(session_item),
            },
            key_columns=[schema.ebook_practice_sessions.c.user_id, schema.ebook_practice_sessions.c.session_id],
        )


def get_ebook_practice_session(user_id: str, session_id: str) -> Optional[dict]:
    with session_scope() as session:
        return _get(
            session,
            schema.ebook_practice_sessions,
            schema.ebook_practice_sessions.c.user_id == user_id,
            schema.ebook_practice_sessions.c.session_id == session_id,
        )


def delete_ebook_rows(user_id: str, book_id: str) -> dict[str, int]:
    """Delete one private ebook and all derived rows, returning audit counts."""

    tables = [
        ("practiceSessions", schema.ebook_practice_sessions),
        ("targets", schema.ebook_targets),
        ("annotations", schema.ebook_annotations),
        ("studyPacks", schema.ebook_study_packs),
        ("analysisPages", schema.ebook_analysis_pages),
        ("pages", schema.ebook_pages),
    ]
    counts: dict[str, int] = {}
    with session_scope() as session:
        for label, table in tables:
            condition = table.c.user_id == user_id
            if "book_id" in table.c:
                condition = and_(condition, table.c.book_id == book_id)
            result = session.execute(delete(table).where(condition))
            counts[label] = int(result.rowcount or 0)
        result = session.execute(delete(schema.ebooks).where(
            schema.ebooks.c.user_id == user_id,
            schema.ebooks.c.book_id == book_id,
        ))
        counts["books"] = int(result.rowcount or 0)
    return counts


# ----- Plans and exercises -----


def _plan_values(plan: dict) -> dict:
    return {
        "user_id": plan["userId"],
        "version": int(plan.get("version", 0)),
        "updated_at": _updated(plan),
        "payload": _payload(plan),
    }


def save_active_plan(plan: dict, *, expected_version: Optional[int] = None) -> None:
    ensure_payload_fits(plan, entity_type="plan")
    with session_scope() as session:
        _ensure_user(session, plan["userId"])
        values = _plan_values(plan)
        if expected_version is not None:
            result = session.execute(
                update(schema.plans)
                .where(schema.plans.c.user_id == plan["userId"], schema.plans.c.version == expected_version)
                .values(**{key: value for key, value in values.items() if key != "user_id"})
            )
            if result.rowcount != 1:
                raise PlanProgressConflictError("The active Plan changed; reload and try again.")
        else:
            _upsert(session, schema.plans, values, key_columns=[schema.plans.c.user_id])


def save_plan_with_activity_run(
    plan: dict,
    run: dict,
    *,
    expected_plan_version: Optional[int],
    expected_run_version: Optional[int] = None,
    create_run: bool = False,
    closed_run: Optional[dict] = None,
    expected_closed_run_version: Optional[int] = None,
) -> None:
    with session_scope() as session:
        plan_values = _plan_values(plan)
        result = session.execute(
            update(schema.plans)
            .where(
                schema.plans.c.user_id == plan["userId"],
                schema.plans.c.version == (expected_plan_version or 0),
            )
            .values(**{key: value for key, value in plan_values.items() if key != "user_id"})
        )
        if result.rowcount != 1:
            raise PlanProgressConflictError("The active Plan changed; reload and try again.")
        _save_activity_run_tx(
            session,
            run,
            create_only=create_run,
            expected_version=None if create_run else expected_run_version,
        )
        if closed_run is not None:
            _save_activity_run_tx(session, closed_run, expected_version=expected_closed_run_version)


def get_active_plan(user_id: str) -> Optional[dict]:
    with session_scope() as session:
        return _get(session, schema.plans, schema.plans.c.user_id == user_id)


def save_exercise(exercise: dict) -> None:
    with session_scope() as session:
        _ensure_user(session, exercise["userId"])
        _upsert(
            session,
            schema.exercises,
            {
                "user_id": exercise["userId"],
                "exercise_id": exercise["id"],
                "skill_code": exercise.get("skillCode"),
                "created_at": _created(exercise),
                "payload": _payload(exercise),
            },
            key_columns=[schema.exercises.c.user_id, schema.exercises.c.exercise_id],
        )


def get_exercise(user_id: str, exercise_id: str) -> Optional[dict]:
    with session_scope() as session:
        return _get(
            session,
            schema.exercises,
            schema.exercises.c.user_id == user_id,
            schema.exercises.c.exercise_id == exercise_id,
        )


# ----- Practice attempts and idempotency -----


def stable_practice_attempt_id(user_id: str, client_attempt_id: str) -> str:
    digest = hashlib.sha256(f"{user_id}\0{client_attempt_id}".encode("utf-8")).hexdigest()[:20]
    return f"att_{digest}"


def _practice_values(item: dict) -> dict:
    return {
        "user_id": item["userId"],
        "client_attempt_id": item["clientAttemptId"],
        "request_hash": item["requestHash"],
        "attempt_id": item["attemptId"],
        "status": item.get("status") or "processing",
        "claim_id": item.get("processingClaimId"),
        "claimed_at": _parse_datetime(item.get("processingClaimedAt")),
        "claimed_at_epoch": item.get("processingClaimedAtEpoch"),
        "created_at": _created(item),
        "updated_at": _updated(item),
        "completed_at": _parse_datetime(item.get("completedAt")),
        "payload": _payload(item),
    }


def get_practice_attempt_request(user_id: str, client_attempt_id: str) -> Optional[dict]:
    with session_scope() as session:
        return _get(
            session,
            schema.practice_requests,
            schema.practice_requests.c.user_id == user_id,
            schema.practice_requests.c.client_attempt_id == client_attempt_id,
        )


def claim_practice_attempt_request(
    user_id: str,
    client_attempt_id: str,
    request_hash: str,
    claim_id: str,
    *,
    stale_after_seconds: int = 300,
) -> dict:
    now = datetime.now(timezone.utc)
    now_text = _datetime_text(now)
    item = {
        "userId": user_id,
        "clientAttemptId": client_attempt_id,
        "requestHash": request_hash,
        "attemptId": stable_practice_attempt_id(user_id, client_attempt_id),
        "attemptCreatedAt": now_text,
        "status": "processing",
        "processingClaimId": claim_id,
        "processingClaimedAt": now_text,
        "processingClaimedAtEpoch": int(now.timestamp()),
        "createdAt": now_text,
        "updatedAt": now_text,
    }
    with session_scope() as session:
        _ensure_user(session, user_id)
        inserted = session.execute(
            pg_insert(schema.practice_requests)
            .values(**_practice_values(item))
            .on_conflict_do_nothing(
                index_elements=[schema.practice_requests.c.user_id, schema.practice_requests.c.client_attempt_id]
            )
            .returning(schema.practice_requests.c.client_attempt_id)
        )
        if inserted.scalar_one_or_none() is not None:
            return {**item, "claimState": "acquired"}
        row = session.execute(
            select(schema.practice_requests)
            .where(
                schema.practice_requests.c.user_id == user_id,
                schema.practice_requests.c.client_attempt_id == client_attempt_id,
            )
            .with_for_update()
        ).mappings().one()
        existing = dict(row.payload or {})
        if row.request_hash != request_hash:
            raise PracticeAttemptConflictError(
                "clientAttemptId was already used for a different practice request."
            )
        if row.status == "complete" and isinstance(existing.get("result"), dict):
            return {**existing, "claimState": "complete"}
        stale_before = int(now.timestamp()) - max(60, stale_after_seconds)
        if row.claim_id and row.status != "failed" and (row.claimed_at_epoch or 0) >= stale_before:
            return {**existing, "claimState": "busy"}
        replacement = {
            **existing,
            "status": "processing",
            "processingClaimId": claim_id,
            "processingClaimedAt": now_text,
            "processingClaimedAtEpoch": int(now.timestamp()),
            "updatedAt": now_text,
        }
        session.execute(
            update(schema.practice_requests)
            .where(
                schema.practice_requests.c.user_id == user_id,
                schema.practice_requests.c.client_attempt_id == client_attempt_id,
            )
            .values(status="processing", claim_id=claim_id, claimed_at=now, claimed_at_epoch=int(now.timestamp()), updated_at=now, payload=replacement)
        )
        return {**replacement, "claimState": "acquired"}


def _locked_practice_request(session: Session, user_id: str, client_attempt_id: str, claim_id: str):
    row = session.execute(
        select(schema.practice_requests)
        .where(
            schema.practice_requests.c.user_id == user_id,
            schema.practice_requests.c.client_attempt_id == client_attempt_id,
            schema.practice_requests.c.claim_id == claim_id,
            schema.practice_requests.c.status == "processing",
        )
        .with_for_update()
    ).mappings().first()
    if not row:
        raise PracticeAttemptClaimLostError("The practice attempt claim was replaced.")
    return row


def complete_practice_attempt_request(
    user_id: str,
    client_attempt_id: str,
    claim_id: str,
    result: dict,
) -> None:
    with session_scope() as session:
        row = _locked_practice_request(session, user_id, client_attempt_id, claim_id)
        completed = now_iso()
        payload = dict(row.payload or {})
        payload.update({"status": "complete", "result": _jsonable(result), "completedAt": completed, "updatedAt": completed})
        for field in ("processingClaimId", "processingClaimedAt", "processingClaimedAtEpoch"):
            payload.pop(field, None)
        session.execute(
            update(schema.practice_requests)
            .where(schema.practice_requests.c.user_id == user_id, schema.practice_requests.c.client_attempt_id == client_attempt_id)
            .values(status="complete", claim_id=None, claimed_at=None, claimed_at_epoch=None, completed_at=_parse_datetime(completed), updated_at=_parse_datetime(completed), payload=payload)
        )


def save_practice_attempt_grade_draft(
    user_id: str,
    client_attempt_id: str,
    claim_id: str,
    grade: dict,
) -> None:
    with session_scope() as session:
        row = _locked_practice_request(session, user_id, client_attempt_id, claim_id)
        payload = dict(row.payload or {})
        payload.update({"gradeDraft": _jsonable(grade), "gradeDraftedAt": now_iso(), "updatedAt": now_iso()})
        session.execute(
            update(schema.practice_requests)
            .where(schema.practice_requests.c.user_id == user_id, schema.practice_requests.c.client_attempt_id == client_attempt_id)
            .values(updated_at=datetime.now(timezone.utc), payload=payload)
        )


def release_practice_attempt_request(user_id: str, client_attempt_id: str, claim_id: str) -> None:
    with session_scope() as session:
        row = session.execute(
            select(schema.practice_requests)
            .where(
                schema.practice_requests.c.user_id == user_id,
                schema.practice_requests.c.client_attempt_id == client_attempt_id,
                schema.practice_requests.c.claim_id == claim_id,
                schema.practice_requests.c.status == "processing",
            )
            .with_for_update()
        ).mappings().first()
        if not row:
            return
        payload = dict(row.payload or {})
        payload.update({"status": "failed", "updatedAt": now_iso()})
        for field in ("processingClaimId", "processingClaimedAt", "processingClaimedAtEpoch"):
            payload.pop(field, None)
        session.execute(
            update(schema.practice_requests)
            .where(schema.practice_requests.c.user_id == user_id, schema.practice_requests.c.client_attempt_id == client_attempt_id)
            .values(status="failed", claim_id=None, claimed_at=None, claimed_at_epoch=None, updated_at=datetime.now(timezone.utc), payload=payload)
        )


def save_practice_attempt(attempt: dict) -> None:
    with session_scope() as session:
        _ensure_user(session, attempt["userId"])
        _upsert(
            session,
            schema.practice_attempts,
            {
                "user_id": attempt["userId"],
                "attempt_id": attempt["id"],
                "exercise_id": attempt.get("exerciseId"),
                "created_at": _created(attempt),
                "payload": _payload(attempt),
            },
            key_columns=[schema.practice_attempts.c.user_id, schema.practice_attempts.c.attempt_id],
        )


def list_recent_practice_attempts(user_id: str, limit: int = 100) -> list:
    if limit <= 0:
        return []
    with session_scope() as session:
        return _list_payloads(
            session,
            select(schema.practice_attempts)
            .where(schema.practice_attempts.c.user_id == user_id)
            .order_by(schema.practice_attempts.c.created_at.desc(), schema.practice_attempts.c.attempt_id.desc())
            .limit(limit),
        )


def list_practice_attempts_since(user_id: str, since: str) -> list[dict]:
    with session_scope() as session:
        return _list_payloads(
            session,
            select(schema.practice_attempts)
            .where(
                schema.practice_attempts.c.user_id == user_id,
                schema.practice_attempts.c.created_at >= _parse_datetime(since),
            )
            .order_by(schema.practice_attempts.c.created_at),
        )


# ----- Auth users and rate limits -----


def _upsert_auth_user(provider: str, subject: str, login: str, name: str, avatar_url: str, email: Optional[str] = None) -> dict:
    user_id = f"{'gh' if provider == 'github' else provider}_{subject}"
    now = now_iso()
    with session_scope() as session:
        existing = _get(session, schema.users, schema.users.c.user_id == user_id)
        item = {
            "userId": user_id,
            "provider": provider,
            "login": login,
            "name": name,
            "avatarUrl": avatar_url,
            "createdAt": (existing or {}).get("createdAt", now),
            "lastLoginAt": now,
        }
        if provider == "github":
            item["githubId"] = str(subject)
        else:
            item["googleSub"] = str(subject)
            item["email"] = email or login
        _upsert(
            session,
            schema.users,
            {
                "user_id": user_id,
                "provider": provider,
                "provider_subject": str(subject),
                "login": login,
                "email": email,
                "name": name,
                "avatar_url": avatar_url,
                "created_at": _parse_datetime(item["createdAt"]),
                "updated_at": _parse_datetime(now),
                "last_login_at": _parse_datetime(now),
                "payload": item,
            },
            key_columns=[schema.users.c.user_id],
        )
        return item


def upsert_github_user(gh_id, login, name, avatar_url) -> dict:
    return _upsert_auth_user("github", str(gh_id), login, name, avatar_url)


def get_github_user(gh_id) -> Optional[dict]:
    with session_scope() as session:
        return _get(session, schema.users, schema.users.c.user_id == f"gh_{gh_id}")


def upsert_google_user(sub, email, name, avatar_url) -> dict:
    return _upsert_auth_user("google", str(sub), email, name, avatar_url, email=email)


def incr_rate_counter(rate_key: str, feature: str, day: str, ttl_epoch: int) -> int:
    day_value = date.fromisoformat(day)
    expires_at = datetime.fromtimestamp(int(ttl_epoch), tz=timezone.utc)
    statement = (
        pg_insert(schema.rate_limit_counters)
        .values(rate_key=rate_key, feature=feature, day=day_value, count=1, expires_at=expires_at)
        .on_conflict_do_update(
            index_elements=[
                schema.rate_limit_counters.c.rate_key,
                schema.rate_limit_counters.c.feature,
                schema.rate_limit_counters.c.day,
            ],
            set_={
                "count": schema.rate_limit_counters.c.count + 1,
                "expires_at": expires_at,
            },
        )
        .returning(schema.rate_limit_counters.c.count)
    )
    with session_scope() as session:
        return int(session.execute(statement).scalar_one())


# ----- Chat sessions and messages -----


def _chat_session_values(item: dict) -> dict:
    return {
        "user_id": item["userId"],
        "session_id": item["id"],
        "status": item.get("status"),
        "message_count": max(0, int(item.get("messageCount", 0) or 0)),
        "turn_claim_id": item.get("turnClaimId"),
        "turn_claimed_at_epoch": item.get("turnClaimedAtEpoch"),
        "analysis_claim_id": item.get("analysisClaimId"),
        "analysis_claimed_at_epoch": item.get("analysisClaimedAtEpoch"),
        "deleting_at": _parse_datetime(item.get("deletingAt")),
        "created_at": _created(item),
        "updated_at": _updated(item),
        "payload": _payload(item),
    }


def save_chat_session(session_item: dict) -> None:
    ensure_payload_fits(session_item, entity_type="chat session")
    with session_scope() as session:
        _ensure_user(session, session_item["userId"])
        _upsert(
            session,
            schema.chat_sessions,
            _chat_session_values(session_item),
            key_columns=[schema.chat_sessions.c.user_id, schema.chat_sessions.c.session_id],
        )


def get_chat_session(user_id: str, session_id: str) -> Optional[dict]:
    with session_scope() as session:
        return _get(
            session,
            schema.chat_sessions,
            schema.chat_sessions.c.user_id == user_id,
            schema.chat_sessions.c.session_id == session_id,
        )


def delete_chat_session_rows(user_id: str, session_id: str) -> Optional[dict[str, int]]:
    now = datetime.now(timezone.utc)
    stale_epoch = int(now.timestamp()) - 900
    with session_scope() as session:
        row = session.execute(
            select(schema.chat_sessions)
            .where(schema.chat_sessions.c.user_id == user_id, schema.chat_sessions.c.session_id == session_id)
            .with_for_update()
        ).mappings().first()
        if not row:
            return None
        if row.turn_claim_id and (row.turn_claimed_at_epoch or 0) >= stale_epoch:
            raise ChatSessionBusyError("Finish the active message or analysis before deleting this conversation.")
        if row.analysis_claim_id and (row.analysis_claimed_at_epoch or 0) >= stale_epoch:
            raise ChatSessionBusyError("Finish the active message or analysis before deleting this conversation.")
        message_count = session.execute(
            select(func.count()).select_from(schema.chat_messages).where(
                schema.chat_messages.c.user_id == user_id,
                schema.chat_messages.c.session_id == session_id,
            )
        ).scalar_one()
        batch_count = session.execute(
            select(func.count()).select_from(schema.chat_transcript_batches).where(
                schema.chat_transcript_batches.c.user_id == user_id,
                schema.chat_transcript_batches.c.session_id == session_id,
            )
        ).scalar_one()
        session.execute(delete(schema.chat_sessions).where(
            schema.chat_sessions.c.user_id == user_id,
            schema.chat_sessions.c.session_id == session_id,
        ))
        return {
            "messages": int(message_count),
            "transcriptBatches": int(batch_count),
            "transcriptStages": 0,
            "sessions": 1,
        }


def _chat_payload_update(
    session: Session,
    user_id: str,
    session_id: str,
    fields: dict,
    *,
    require_claim: Optional[tuple[str, str]] = None,
) -> bool:
    row = session.execute(
        select(schema.chat_sessions)
        .where(schema.chat_sessions.c.user_id == user_id, schema.chat_sessions.c.session_id == session_id)
        .with_for_update()
    ).mappings().first()
    if not row:
        return False
    if require_claim:
        claim_kind, claim_id = require_claim
        owner = row.turn_claim_id if claim_kind == "turn" else row.analysis_claim_id
        if owner != claim_id:
            return False
    payload = dict(row.payload or {})
    for key, value in fields.items():
        if value is _REMOVE:
            payload.pop(key, None)
        else:
            payload[key] = _jsonable(value)
    payload.setdefault("updatedAt", now_iso())
    values: dict[str, Any] = {
        "updated_at": _parse_datetime(payload["updatedAt"]),
        "payload": payload,
    }
    typed = {
        "status": "status",
        "messageCount": "message_count",
        "turnClaimId": "turn_claim_id",
        "turnClaimedAtEpoch": "turn_claimed_at_epoch",
        "analysisClaimId": "analysis_claim_id",
        "analysisClaimedAtEpoch": "analysis_claimed_at_epoch",
        "deletingAt": "deleting_at",
    }
    for public_name, column_name in typed.items():
        if public_name not in fields:
            continue
        value = fields[public_name]
        if value is _REMOVE:
            value = None
        if public_name == "deletingAt":
            value = _parse_datetime(value)
        values[column_name] = value
    session.execute(
        update(schema.chat_sessions)
        .where(schema.chat_sessions.c.user_id == user_id, schema.chat_sessions.c.session_id == session_id)
        .values(**values)
    )
    return True


class _RemoveMarker:
    pass


_REMOVE = _RemoveMarker()


def update_chat_session_fields(user_id: str, session_id: str, fields: dict) -> None:
    clean_fields = dict(fields)
    if not clean_fields:
        return
    clean_fields.setdefault("updatedAt", now_iso())
    with session_scope() as session:
        _chat_payload_update(session, user_id, session_id, clean_fields)


def claim_chat_session_analysis(
    user_id: str,
    session_id: str,
    claim_id: str,
    *,
    stale_after_seconds: int = 900,
) -> bool:
    now = datetime.now(timezone.utc)
    stale = int(now.timestamp()) - max(60, stale_after_seconds)
    with session_scope() as session:
        row = session.execute(
            select(schema.chat_sessions)
            .where(schema.chat_sessions.c.user_id == user_id, schema.chat_sessions.c.session_id == session_id)
            .with_for_update()
        ).mappings().first()
        if not row or row.deleting_at:
            return False
        payload = dict(row.payload or {})
        if payload.get("analysis") is not None:
            return False
        if row.analysis_claim_id and (row.analysis_claimed_at_epoch or 0) >= stale:
            return row.analysis_claim_id == claim_id
        if row.turn_claim_id and (row.turn_claimed_at_epoch or 0) >= stale:
            return False
        now_text = _datetime_text(now)
        return _chat_payload_update(
            session,
            user_id,
            session_id,
            {
                "analysisClaimId": claim_id,
                "analysisClaimedAt": now_text,
                "analysisClaimedAtEpoch": int(now.timestamp()),
                "turnClaimId": _REMOVE,
                "turnClaimedAt": _REMOVE,
                "turnClaimedAtEpoch": _REMOVE,
                "updatedAt": now_text,
            },
        )


def claim_chat_session_turn(
    user_id: str,
    session_id: str,
    claim_id: str,
    *,
    stale_after_seconds: int = 900,
) -> bool:
    now = datetime.now(timezone.utc)
    stale = int(now.timestamp()) - max(60, stale_after_seconds)
    with session_scope() as session:
        row = session.execute(
            select(schema.chat_sessions)
            .where(schema.chat_sessions.c.user_id == user_id, schema.chat_sessions.c.session_id == session_id)
            .with_for_update()
        ).mappings().first()
        if not row or row.deleting_at or row.analysis_claim_id:
            return False
        payload = dict(row.payload or {})
        if payload.get("analysis") is not None or payload.get("analysisDraft") is not None:
            return False
        if row.turn_claim_id and (row.turn_claimed_at_epoch or 0) >= stale:
            return row.turn_claim_id == claim_id
        now_text = _datetime_text(now)
        return _chat_payload_update(
            session,
            user_id,
            session_id,
            {
                "turnClaimId": claim_id,
                "turnClaimedAt": now_text,
                "turnClaimedAtEpoch": int(now.timestamp()),
                "updatedAt": now_text,
            },
        )


def release_chat_session_turn_claim(user_id: str, session_id: str, claim_id: str) -> None:
    with session_scope() as session:
        _chat_payload_update(
            session,
            user_id,
            session_id,
            {
                "turnClaimId": _REMOVE,
                "turnClaimedAt": _REMOVE,
                "turnClaimedAtEpoch": _REMOVE,
                "updatedAt": now_iso(),
            },
            require_claim=("turn", claim_id),
        )


def release_chat_session_analysis_claim(user_id: str, session_id: str, claim_id: str) -> None:
    with session_scope() as session:
        row = session.execute(
            select(schema.chat_sessions.c.payload).where(
                schema.chat_sessions.c.user_id == user_id,
                schema.chat_sessions.c.session_id == session_id,
            )
        ).first()
        if row and dict(row.payload or {}).get("analysis") is not None:
            return
        _chat_payload_update(
            session,
            user_id,
            session_id,
            {
                "analysisClaimId": _REMOVE,
                "analysisClaimedAt": _REMOVE,
                "analysisClaimedAtEpoch": _REMOVE,
                "updatedAt": now_iso(),
            },
            require_claim=("analysis", claim_id),
        )


def save_chat_session_analysis_draft(
    user_id: str,
    session_id: str,
    claim_id: str,
    analysis: dict,
) -> None:
    with session_scope() as session:
        row = session.execute(
            select(schema.chat_sessions.c.payload).where(
                schema.chat_sessions.c.user_id == user_id,
                schema.chat_sessions.c.session_id == session_id,
                schema.chat_sessions.c.analysis_claim_id == claim_id,
            ).with_for_update()
        ).first()
        if not row or dict(row.payload or {}).get("analysis") is not None:
            raise ChatSessionBusyError("The chat analysis claim was replaced.")
        created = now_iso()
        _chat_payload_update(
            session,
            user_id,
            session_id,
            {"analysisDraft": analysis, "analysisDraftCreatedAt": created, "updatedAt": created},
            require_claim=("analysis", claim_id),
        )


def request_chat_session_realtime_kick(user_id: str, session_id: str, reason: str) -> None:
    now = now_iso()
    update_chat_session_fields(
        user_id,
        session_id,
        {
            "realtimeStatus": "kick_requested",
            "realtimeKickRequestedAt": now,
            "realtimeKickReason": reason,
            "updatedAt": now,
        },
    )


def list_chat_sessions_page(
    user_id: str,
    page_size: int = 50,
    start_key: Optional[dict] = None,
) -> tuple[list, Optional[dict]]:
    if page_size <= 0:
        return [], None
    cursor_time, cursor_id = _cursor_parts(start_key)
    condition = schema.chat_sessions.c.user_id == user_id
    if cursor_time and cursor_id:
        condition = and_(
            condition,
            or_(
                schema.chat_sessions.c.created_at < cursor_time,
                and_(schema.chat_sessions.c.created_at == cursor_time, schema.chat_sessions.c.session_id < cursor_id),
            ),
        )
    with session_scope() as session:
        rows = session.execute(
            select(schema.chat_sessions)
            .where(condition)
            .order_by(schema.chat_sessions.c.created_at.desc(), schema.chat_sessions.c.session_id.desc())
            .limit(page_size + 1)
        ).mappings().all()
    page_rows = rows[:page_size]
    page: list[dict] = []
    for row in page_rows:
        item = dict(row.payload or {})
        stored_count = item.get("messageCount")
        item["messageCount"] = stored_count if isinstance(stored_count, int) and not isinstance(stored_count, bool) and stored_count >= 0 else 0
        page.append(item)
    next_key = None
    if len(rows) > page_size and page_rows:
        last = page_rows[-1]
        next_key = {"createdAt": _datetime_text(last.created_at), "id": last.session_id}
    return page, next_key


def list_chat_sessions(user_id: str, limit: Optional[int] = None) -> list:
    if limit is not None and limit <= 0:
        return []
    statement = (
        select(schema.chat_sessions)
        .where(schema.chat_sessions.c.user_id == user_id)
        .order_by(schema.chat_sessions.c.created_at.desc(), schema.chat_sessions.c.session_id.desc())
    )
    if limit is not None:
        statement = statement.limit(limit)
    with session_scope() as session:
        result = _list_payloads(session, statement)
    for item in result:
        value = item.get("messageCount")
        item["messageCount"] = value if isinstance(value, int) and not isinstance(value, bool) and value >= 0 else 0
    return result


def _save_chat_message_tx(session: Session, message: dict, *, create_only: bool = False) -> bool:
    ensure_payload_fits(message, entity_type="chat message")
    values = {
        "user_id": message["userId"],
        "session_id": message["sessionId"],
        "message_id": message["id"],
        "role": message.get("role"),
        "created_at": _created(message),
        "payload": _payload(message),
    }
    statement = pg_insert(schema.chat_messages).values(**values)
    if create_only:
        result = session.execute(statement.on_conflict_do_nothing(
            index_elements=[schema.chat_messages.c.user_id, schema.chat_messages.c.session_id, schema.chat_messages.c.message_id]
        ).returning(schema.chat_messages.c.message_id))
        return result.scalar_one_or_none() is not None
    _upsert(
        session,
        schema.chat_messages,
        values,
        key_columns=[schema.chat_messages.c.user_id, schema.chat_messages.c.session_id, schema.chat_messages.c.message_id],
    )
    return True


def save_chat_message(message: dict) -> None:
    with session_scope() as session:
        _save_chat_message_tx(session, message)


def get_chat_message(
    user_id: str,
    created_at: str,
    message_id: str,
    session_id: Optional[str] = None,
) -> Optional[dict]:
    del created_at
    with session_scope() as session:
        conditions = [schema.chat_messages.c.user_id == user_id, schema.chat_messages.c.message_id == message_id]
        if session_id:
            conditions.append(schema.chat_messages.c.session_id == session_id)
        return _get(session, schema.chat_messages, *conditions)


def finalize_chat_session_turn(
    user_id: str,
    session_id: str,
    claim_id: str,
    user_message: dict,
    assistant_message: dict,
    summary: str,
    message_count: int,
    stealth_probes: Optional[list[dict]] = None,
    stealth_probe_history: Optional[list[dict]] = None,
) -> None:
    # Preserve the established contract: reject an oversized half-turn before
    # looking up or mutating its session claim.
    ensure_payload_fits(user_message, entity_type="CHAT_MESSAGE")
    ensure_payload_fits(assistant_message, entity_type="CHAT_MESSAGE")
    with session_scope() as session:
        row = session.execute(
            select(schema.chat_sessions)
            .where(
                schema.chat_sessions.c.user_id == user_id,
                schema.chat_sessions.c.session_id == session_id,
                schema.chat_sessions.c.turn_claim_id == claim_id,
            )
            .with_for_update()
        ).mappings().first()
        if not row:
            raise ChatSessionBusyError("The chat turn claim was replaced.")
        payload = dict(row.payload or {})
        if payload.get("analysis") is not None or payload.get("analysisDraft") is not None or row.analysis_claim_id:
            raise ChatSessionBusyError("Chat analysis has already started.")
        if not _save_chat_message_tx(session, user_message, create_only=True):
            raise ChatSessionBusyError("The chat turn was already committed.")
        if not _save_chat_message_tx(session, assistant_message, create_only=True):
            raise ChatSessionBusyError("The chat turn was already committed.")
        fields: dict[str, Any] = {
            "summary": summary,
            "messageCount": message_count,
            "turnClaimId": _REMOVE,
            "turnClaimedAt": _REMOVE,
            "turnClaimedAtEpoch": _REMOVE,
            "updatedAt": now_iso(),
        }
        if stealth_probes is not None:
            fields["stealthProbes"] = stealth_probes
        if stealth_probe_history is not None:
            fields["stealthProbeHistory"] = stealth_probe_history
        _chat_payload_update(session, user_id, session_id, fields, require_claim=("turn", claim_id))


def finalize_chat_session_transcript_batch(
    user_id: str,
    session_id: str,
    claim_id: str,
    batch_id: str,
    messages: list[dict],
    summary: str,
    message_count: int,
) -> None:
    if not messages:
        raise ValueError("A transcript batch must contain at least one message.")
    if len(messages) > CHAT_TRANSCRIPT_MAX_MESSAGES:
        raise TranscriptCapacityError(
            f"A transcript upload accepts at most {CHAT_TRANSCRIPT_MAX_MESSAGES} messages."
        )
    with session_scope() as session:
        row = session.execute(
            select(schema.chat_sessions)
            .where(
                schema.chat_sessions.c.user_id == user_id,
                schema.chat_sessions.c.session_id == session_id,
                schema.chat_sessions.c.turn_claim_id == claim_id,
            )
            .with_for_update()
        ).mappings().first()
        if not row:
            raise ChatSessionBusyError("The transcript claim was replaced.")
        payload = dict(row.payload or {})
        if payload.get("analysis") is not None or payload.get("analysisDraft") is not None or row.analysis_claim_id:
            raise ChatSessionBusyError("Chat analysis has already started.")
        inserted = session.execute(
            pg_insert(schema.chat_transcript_batches)
            .values(
                user_id=user_id,
                session_id=session_id,
                batch_id=batch_id,
                message_count=len(messages),
                payload={"batchId": batch_id, "status": "committed", "messageCount": len(messages), "createdAt": now_iso()},
            )
            .on_conflict_do_nothing(
                index_elements=[schema.chat_transcript_batches.c.user_id, schema.chat_transcript_batches.c.session_id, schema.chat_transcript_batches.c.batch_id]
            )
            .returning(schema.chat_transcript_batches.c.batch_id)
        )
        if inserted.scalar_one_or_none() is None:
            # An ambiguous retry is successful only if the same marker exists.
            return
        for message in messages:
            stored = {**message, "userId": user_id, "sessionId": session_id, "transcriptBatchId": batch_id}
            if not _save_chat_message_tx(session, stored, create_only=True):
                raise ChatSessionBusyError("A transcript message ID was already used.")
        _chat_payload_update(
            session,
            user_id,
            session_id,
            {
                "summary": summary,
                "messageCount": message_count,
                "turnClaimId": _REMOVE,
                "turnClaimedAt": _REMOVE,
                "turnClaimedAtEpoch": _REMOVE,
                "updatedAt": now_iso(),
            },
            require_claim=("turn", claim_id),
        )


def list_chat_messages(user_id: str, session_id: str, limit: Optional[int] = None) -> list:
    if limit is not None and limit <= 0:
        return []
    statement = (
        select(schema.chat_messages)
        .where(schema.chat_messages.c.user_id == user_id, schema.chat_messages.c.session_id == session_id)
        .order_by(schema.chat_messages.c.created_at, schema.chat_messages.c.message_id)
    )
    if limit is not None:
        statement = statement.limit(limit)
    with session_scope() as session:
        return _list_payloads(session, statement)


def update_chat_session_summary(user_id: str, session_id: str, summary: str, message_count: int) -> None:
    update_chat_session_fields(
        user_id,
        session_id,
        {"summary": summary, "messageCount": message_count, "updatedAt": now_iso()},
    )


def update_chat_session_analysis(
    user_id: str,
    session_id: str,
    analysis: dict,
    saved_notes: list,
    saved_errors: list,
    updated_skills: list,
    analyzed_at: str,
    stealth_practice: Optional[dict] = None,
    stealth_practices: Optional[list[dict]] = None,
    claim_id: Optional[str] = None,
    errors_to_persist: Optional[list[dict]] = None,
    notes_to_persist: Optional[list[dict]] = None,
    skills_to_persist: Optional[list[dict]] = None,
    memory_claim_id: Optional[str] = None,
) -> None:
    effects_count = len(errors_to_persist or []) + len(notes_to_persist or []) + len(skills_to_persist or []) + 1
    if effects_count > 100:
        raise ValueError("Chat analysis produced too many atomic side effects.")
    with session_scope() as session:
        row = session.execute(
            select(schema.chat_sessions)
            .where(schema.chat_sessions.c.user_id == user_id, schema.chat_sessions.c.session_id == session_id)
            .with_for_update()
        ).mappings().first()
        if not row:
            raise ChatSessionBusyError("Chat session not found.")
        payload = dict(row.payload or {})
        if claim_id and (row.analysis_claim_id != claim_id or payload.get("analysis") is not None):
            raise ChatSessionBusyError("The chat analysis claim was replaced.")
        if memory_claim_id:
            owner = session.execute(
                select(schema.memory_leases.c.claim_id)
                .where(schema.memory_leases.c.user_id == user_id)
                .with_for_update()
            ).scalar_one_or_none()
            if owner != memory_claim_id:
                raise MemoryWriteClaimLostError("The learner memory write lease was replaced.")
        for error in errors_to_persist or []:
            _upsert(
                session,
                schema.errors,
                {
                    "user_id": error["userId"],
                    "error_id": error["id"],
                    "submission_id": error["submissionId"],
                    "code": error.get("code"),
                    "created_at": _created(error),
                    "payload": _payload(error),
                },
                key_columns=[schema.errors.c.user_id, schema.errors.c.error_id],
            )
        for note in notes_to_persist or []:
            _upsert(
                session,
                schema.notes,
                {
                    "user_id": note["userId"],
                    "note_id": note["id"],
                    "submission_id": note.get("submissionId"),
                    "category": note.get("category"),
                    "created_at": _created(note),
                    "payload": _payload(note),
                },
                key_columns=[schema.notes.c.user_id, schema.notes.c.note_id],
            )
        for skill in skills_to_persist or []:
            _put_skill(session, skill)
        fields = {
            "analysis": analysis,
            "analysisCreatedAt": analyzed_at,
            "analysisSavedNotes": saved_notes,
            "analysisSavedErrors": saved_errors,
            "analysisUpdatedSkills": updated_skills,
            "stealthPractice": stealth_practice,
            "stealthPractices": stealth_practices or [],
            "analysisClaimId": _REMOVE,
            "analysisClaimedAt": _REMOVE,
            "analysisClaimedAtEpoch": _REMOVE,
            "analysisDraft": _REMOVE,
            "analysisDraftCreatedAt": _REMOVE,
            "updatedAt": analyzed_at,
        }
        _chat_payload_update(
            session,
            user_id,
            session_id,
            fields,
            require_claim=("analysis", claim_id) if claim_id else None,
        )


# ----- Access roles and maintenance -----


def _normalize_access_identifier(identifier: str) -> str:
    return " ".join((identifier or "").strip().lower().split())


def get_access_role(identifier: str) -> Optional[dict]:
    normalized = _normalize_access_identifier(identifier)
    if not normalized:
        return None
    with session_scope() as session:
        return _get(session, schema.access_roles, schema.access_roles.c.identifier == normalized)


def list_access_roles() -> list:
    with session_scope() as session:
        return _list_payloads(
            session,
            select(schema.access_roles).order_by(schema.access_roles.c.identifier),
        )


def set_access_role(identifier: str, role: str, updated_by: str) -> dict:
    normalized = _normalize_access_identifier(identifier)
    if not normalized:
        raise ValueError("identifier is required")
    if role not in {"owner", "member"}:
        raise ValueError("role must be owner or member")
    now = now_iso()
    existing = get_access_role(normalized)
    item = {
        "identifier": normalized,
        "role": role,
        "createdAt": (existing or {}).get("createdAt", now),
        "updatedAt": now,
        "updatedBy": updated_by,
    }
    with session_scope() as session:
        _upsert(
            session,
            schema.access_roles,
            {
                "identifier": normalized,
                "role": role,
                "updated_by": updated_by,
                "created_at": _parse_datetime(item["createdAt"]),
                "updated_at": _parse_datetime(now),
                "payload": item,
            },
            key_columns=[schema.access_roles.c.identifier],
        )
    return item


def delete_access_role(identifier: str) -> None:
    normalized = _normalize_access_identifier(identifier)
    if not normalized:
        return
    with session_scope() as session:
        session.execute(delete(schema.access_roles).where(schema.access_roles.c.identifier == normalized))


def cleanup_expired_records(*, now: Optional[datetime] = None) -> dict[str, int]:
    """Hard-delete rows whose existing business TTL has elapsed."""

    cutoff = now or datetime.now(timezone.utc)
    targets = [
        ("memoryTraces", schema.memory_traces, schema.memory_traces.c.expires_at),
        ("memories", schema.memories, schema.memories.c.delete_after),
        ("rateLimits", schema.rate_limit_counters, schema.rate_limit_counters.c.expires_at),
    ]
    counts: dict[str, int] = {}
    with session_scope() as session:
        for label, table, column in targets:
            result = session.execute(delete(table).where(column.is_not(None), column <= cutoff))
            counts[label] = int(result.rowcount or 0)
        lease_cutoff = int(cutoff.timestamp()) - 86_400
        result = session.execute(delete(schema.memory_leases).where(schema.memory_leases.c.claimed_at_epoch < lease_cutoff))
        counts["memoryLeases"] = int(result.rowcount or 0)
    return counts


def import_legacy_item(item: dict) -> Optional[str]:
    """Import one normalized DynamoDB item into its PostgreSQL table.

    Timeline projections, leases, stages, and rate-limit counters are
    intentionally handled or skipped by the migration orchestrator.
    """

    entity_type = str(item.get("entityType") or "")
    clean_item = _payload(item)
    dispatch = {
        "PROFILE": ("profiles", save_profile),
        "SKILL": ("skills", put_skill),
        "ACTIVITY_RUN": ("activityRuns", save_activity_run),
        "SUBMISSION": ("submissions", save_submission),
        "ERROR": ("errors", save_error),
        "NOTE": ("notes", save_note),
        "MEMORY": ("memories", save_memory),
        "MEMORY_TRACE": ("memoryTraces", save_memory_trace),
        "INPUT_LEARNING_SOURCE": ("inputSources", save_input_learning_source),
        "INPUT_LEARNING_ITEM": ("inputItems", save_input_learning_item),
        "EBOOK": ("ebooks", save_ebook),
        "EBOOK_PAGE": ("ebookPages", save_ebook_page),
        "EBOOK_ANALYSIS_PAGE": ("ebookAnalysisPages", save_ebook_analysis_page),
        "EBOOK_STUDY_PACK": ("ebookStudyPacks", save_ebook_study_pack),
        "EBOOK_ANNOTATION": ("ebookAnnotations", save_ebook_annotation),
        "EBOOK_LEARNING_TARGET": ("ebookTargets", save_ebook_learning_target),
        "EBOOK_PRACTICE_SESSION": ("ebookPracticeSessions", save_ebook_practice_session),
        "PLAN": ("plans", save_active_plan),
        "EXERCISE": ("exercises", save_exercise),
        "ATTEMPT": ("practiceAttempts", save_practice_attempt),
        "CHAT_SESSION": ("chatSessions", save_chat_session),
        "CHAT_MESSAGE": ("chatMessages", save_chat_message),
    }
    target = dispatch.get(entity_type)
    if target:
        label, function = target
        function(clean_item)
        return label

    with session_scope() as session:
        user_id = clean_item.get("userId")
        if user_id:
            _ensure_user(session, str(user_id))
        if entity_type == "LEARNING_STATE":
            _upsert(
                session,
                schema.learning_states,
                {
                    "user_id": clean_item["userId"],
                    "skill_code": clean_item["skillCode"],
                    "version": int(clean_item.get("version", 0)),
                    "updated_at": _updated(clean_item),
                    "payload": clean_item,
                },
                key_columns=[schema.learning_states.c.user_id, schema.learning_states.c.skill_code],
            )
            return "learningStates"
        if entity_type == "EVIDENCE_EVENT":
            _upsert(
                session,
                schema.evidence_events,
                {
                    "user_id": clean_item["userId"],
                    "event_id": clean_item["id"],
                    "skill_code": clean_item["skillCode"],
                    "outcome": clean_item.get("outcome") or "no_opportunity",
                    "created_at": _created(clean_item),
                    "payload": clean_item,
                },
                key_columns=[schema.evidence_events.c.user_id, schema.evidence_events.c.event_id],
            )
            return "evidenceEvents"
        if entity_type == "SUBHASH":
            if clean_item.get("status") == "processing":
                clean_item["status"] = "failed"
                for key in ("processingClaimId", "processingClaimedAt", "processingClaimedAtEpoch"):
                    clean_item.pop(key, None)
            _upsert(
                session,
                schema.diagnosis_requests,
                _diagnosis_values(clean_item),
                key_columns=[schema.diagnosis_requests.c.user_id, schema.diagnosis_requests.c.text_hash],
            )
            return "diagnosisRequests"
        if entity_type == "PRACTICE_REQUEST":
            if clean_item.get("status") == "processing":
                clean_item["status"] = "failed"
                for key in ("processingClaimId", "processingClaimedAt", "processingClaimedAtEpoch"):
                    clean_item.pop(key, None)
            _upsert(
                session,
                schema.practice_requests,
                _practice_values(clean_item),
                key_columns=[schema.practice_requests.c.user_id, schema.practice_requests.c.client_attempt_id],
            )
            return "practiceRequests"
        if entity_type == "AUTH":
            provider = clean_item.get("provider") or ("github" if clean_item.get("githubId") else "google")
            subject = clean_item.get("githubId") or clean_item.get("googleSub")
            _upsert(
                session,
                schema.users,
                {
                    "user_id": clean_item["userId"],
                    "provider": provider,
                    "provider_subject": str(subject) if subject is not None else None,
                    "login": clean_item.get("login"),
                    "email": clean_item.get("email"),
                    "name": clean_item.get("name"),
                    "avatar_url": clean_item.get("avatarUrl"),
                    "created_at": _created(clean_item),
                    "updated_at": _parse_datetime(clean_item.get("lastLoginAt"), default=_created(clean_item)),
                    "last_login_at": _parse_datetime(clean_item.get("lastLoginAt")),
                    "payload": clean_item,
                },
                key_columns=[schema.users.c.user_id],
            )
            return "users"
        if entity_type == "CHAT_TRANSCRIPT_BATCH":
            if clean_item.get("status") != "committed":
                return None
            _upsert(
                session,
                schema.chat_transcript_batches,
                {
                    "user_id": clean_item["userId"],
                    "session_id": clean_item["sessionId"],
                    "batch_id": clean_item["batchId"],
                    "message_count": int(clean_item.get("messageCount", 0)),
                    "created_at": _created(clean_item),
                    "payload": clean_item,
                },
                key_columns=[
                    schema.chat_transcript_batches.c.user_id,
                    schema.chat_transcript_batches.c.session_id,
                    schema.chat_transcript_batches.c.batch_id,
                ],
            )
            return "chatTranscriptBatches"
        if entity_type == "ACCESS_ROLE":
            _upsert(
                session,
                schema.access_roles,
                {
                    "identifier": clean_item["identifier"],
                    "role": clean_item["role"],
                    "updated_by": clean_item.get("updatedBy") or "migration",
                    "created_at": _created(clean_item),
                    "updated_at": _updated(clean_item),
                    "payload": clean_item,
                },
                key_columns=[schema.access_roles.c.identifier],
            )
            return "accessRoles"
    return None


def database_payload_fingerprints() -> tuple[dict[str, int], dict[str, str]]:
    """Return deterministic per-entity counts/checksums for migration audit."""

    table_labels = {
        "users": schema.users,
        "profiles": schema.profiles,
        "skills": schema.skills,
        "learningStates": schema.learning_states,
        "activityRuns": schema.activity_runs,
        "evidenceEvents": schema.evidence_events,
        "submissions": schema.submissions,
        "errors": schema.errors,
        "notes": schema.notes,
        "diagnosisRequests": schema.diagnosis_requests,
        "plans": schema.plans,
        "exercises": schema.exercises,
        "practiceRequests": schema.practice_requests,
        "practiceAttempts": schema.practice_attempts,
        "memories": schema.memories,
        "memoryTraces": schema.memory_traces,
        "inputSources": schema.input_sources,
        "inputItems": schema.input_items,
        "ebooks": schema.ebooks,
        "ebookPages": schema.ebook_pages,
        "ebookAnalysisPages": schema.ebook_analysis_pages,
        "ebookStudyPacks": schema.ebook_study_packs,
        "ebookAnnotations": schema.ebook_annotations,
        "ebookTargets": schema.ebook_targets,
        "ebookPracticeSessions": schema.ebook_practice_sessions,
        "chatSessions": schema.chat_sessions,
        "chatMessages": schema.chat_messages,
        "chatTranscriptBatches": schema.chat_transcript_batches,
        "accessRoles": schema.access_roles,
    }
    counts: dict[str, int] = {}
    checksums: dict[str, str] = {}
    with session_scope() as session:
        for label, table in table_labels.items():
            payloads = [dict(value or {}) for value in session.execute(select(table.c.payload)).scalars()]
            canonical = sorted(
                json.dumps(_jsonable(value), ensure_ascii=False, sort_keys=True, separators=(",", ":"))
                for value in payloads
            )
            counts[label] = len(canonical)
            checksums[label] = hashlib.sha256("\n".join(canonical).encode("utf-8")).hexdigest()
    return counts, checksums


def record_migration_audit(
    migration_id: str,
    source_table: str,
    counts: dict[str, int],
    checksums: dict[str, str],
    *,
    status: str,
) -> None:
    now = datetime.now(timezone.utc)
    with session_scope() as session:
        _upsert(
            session,
            schema.migration_runs,
            {
                "migration_id": migration_id,
                "status": status,
                "source_table": source_table,
                "counts": counts,
                "checksums": checksums,
                "created_at": now,
                "updated_at": now,
            },
            key_columns=[schema.migration_runs.c.migration_id],
        )
