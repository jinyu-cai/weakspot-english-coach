"""Persistent, explainable, bounded memory for the English learning agent."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from difflib import SequenceMatcher
import hashlib
import math
import re
from typing import Callable, Iterable, Optional
from uuid import uuid4

from app.config import settings
from app.db.repositories import (
    get_memory,
    list_memories,
    now_iso,
    save_memory_trace,
)
from app.models.memory import MemoryCandidate
from app.services.embedding_client import embed_text, embed_texts
from app.services.memory_write_service import memory_write_locked, save_memory


MEMORY_EXTRACTION_INSTRUCTION = """
MemoryAgent extraction (internal; do not mention this to the learner):
- Return `memoryCandidates` for explicit facts that will remain useful in future sessions.
- Allowed kinds: preference, goal, strategy, weakness, episode.
- Preferences include feedback style, learning focus, target register, and language choices.
- Goals include exams, scores, communication outcomes, deadlines, and career learning goals.
- Strategies are learning methods with evidence that they help or hurt this learner.
- Weaknesses must be recurring or strongly evidenced, not guesses from one ambiguous typo.
- Episodes are only consequential recent learning events worth recalling for a few weeks.
- Use a stable `canonicalKey` for the same fact (for example preference.feedback_style,
  goal.exam.ielts, strategy.practice.grammar.verb_tense.fix_sentence).
- When a newer statement contradicts an older one, reuse the same canonicalKey so it can replace it.
- Keep content self-contained and concise. Put the supporting quote or observation in evidence.
- Never infer sensitive personal facts. Do not save a transient request as a durable preference.
- If there is no reliable durable fact, return an empty array.
""".strip()


DEFAULT_EXPIRY_DAYS: dict[str, Optional[int]] = {
    "preference": None,
    "goal": 365,
    "strategy": 180,
    "weakness": 60,
    "episode": 30,
}
HALF_LIFE_DAYS = {
    "preference": 365.0,
    "goal": 180.0,
    "strategy": 90.0,
    "weakness": 45.0,
    "episode": 14.0,
}
ACTIVE = "active"
ARCHIVE_GRACE_DAYS = 30
MIN_AUTO_CONFIDENCE = 0.55

# A weakness is not considered mastered after a few back-to-back answers. The
# graduation gate requires repeated retrieval across time, strong recent
# performance, transfer across exercise formats, high skill mastery, and no
# recent recurrence. These conservative defaults are intentionally explicit so
# they can be calibrated from real learner data later.
WEAKNESS_GRADUATION_POLICY = "spaced-evidence-v1"
WEAKNESS_GRADUATION_THRESHOLDS = {
    "minAttempts": 5,
    "minDistinctDays": 3,
    "minSpanDays": 14,
    "recentWindow": 5,
    "minRecentSuccessRate": 0.80,
    "recentAverageWindow": 3,
    "minRecentAverageScore": 85,
    "minMastery": 85,
    "minExerciseTypes": 2,
    "recurrenceFreeDays": 14,
}
WEAKNESS_PRACTICE_EVIDENCE_LIMIT = 20
RESOLVED_WEAKNESS_RETENTION_DAYS = 180
WEAKNESS_PROBE_HISTORY_LIMIT = 20


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def parse_iso(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    except (TypeError, ValueError):
        return None


def iso_at(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def _ttl_after(value: datetime, grace_days: int = ARCHIVE_GRACE_DAYS) -> int:
    return int((value + timedelta(days=grace_days)).timestamp())


def normalize_canonical_key(kind: str, key: str, content: str = "") -> str:
    raw = " ".join((key or "").strip().lower().split())
    raw = re.sub(r"[^a-z0-9._:-]+", "-", raw).strip("-._:")
    if not raw:
        digest = hashlib.sha256(content.strip().lower().encode("utf-8")).hexdigest()[:12]
        raw = f"manual-{digest}"
    if not raw.startswith(f"{kind}.") and not raw.startswith(f"{kind}:"):
        raw = f"{kind}.{raw}"
    return raw[:160]


def public_memory(memory: dict, *, include_scores: bool = True) -> dict:
    hidden = {"PK", "SK", "entityType", "embedding"}
    if not include_scores:
        hidden |= {"retrievalScore", "scoreBreakdown"}
    return {key: value for key, value in memory.items() if key not in hidden}


def _content_similarity(left: str, right: str) -> float:
    a = " ".join(left.lower().split())
    b = " ".join(right.lower().split())
    if not a or not b:
        return 0.0
    sequence = SequenceMatcher(None, a, b).ratio()
    a_tokens = set(_tokens(a))
    b_tokens = set(_tokens(b))
    union = a_tokens | b_tokens
    jaccard = len(a_tokens & b_tokens) / len(union) if union else 0.0
    return max(sequence, 0.55 * sequence + 0.45 * jaccard)


def _looks_conflicting(left: str, right: str) -> bool:
    """Catch common preference/goal reversals despite high string overlap."""
    a = f" {left.lower()} "
    b = f" {right.lower()} "
    opposites = (
        ({"concise", "brief", "short", "简洁", "精简"}, {"detailed", "thorough", "long", "详细", "详尽"}),
        ({"english", "英文"}, {"chinese", "中文"}),
        ({"formal", "正式"}, {"casual", "informal", "轻松", "非正式"}),
    )
    for first, second in opposites:
        if (any(token in a for token in first) and any(token in b for token in second)) or (
            any(token in b for token in first) and any(token in a for token in second)
        ):
            return True
    negations = (" not ", " don't ", " do not ", " no longer ", "不再", "不要")
    return any(token in a for token in negations) != any(token in b for token in negations)


def _source_ref(source_type: str, source_id: str, evidence: str, created_at: str) -> dict:
    return {
        "sourceType": source_type,
        "sourceId": source_id,
        "evidence": evidence[:400],
        "createdAt": created_at,
    }


def _verification_snapshot(
    *,
    confidence: float,
    source_refs: Iterable[dict],
    source_type: str,
    now: datetime,
) -> dict:
    """Track whether a memory is tentative, observed, or corroborated."""
    refs = list(source_refs)
    independent_sources = {
        (str(ref.get("sourceType") or ""), str(ref.get("sourceId") or ""))
        for ref in refs
        if ref.get("sourceId")
    }
    if source_type == "manual":
        state = "confirmed"
        reason = "learner_confirmed"
    elif len(independent_sources) >= 2 and confidence >= 0.7:
        state = "confirmed"
        reason = "corroborated_sources"
    elif confidence >= 0.7:
        state = "observed"
        reason = "single_strong_observation"
    else:
        state = "candidate"
        reason = "tentative_observation"
    return {
        "state": state,
        "reason": reason,
        "independentSourceCount": len(independent_sources),
        "needsConfirmation": state == "candidate",
        "updatedAt": iso_at(now),
    }


def _error_evidence_pairs(evidence: str) -> list[tuple[str, str]]:
    compact = " ".join((evidence or "").split())
    pairs: list[tuple[str, str]] = []
    for segment in re.split(r"\s+\|\s+", compact):
        if "→" in segment:
            original, corrected = (part.strip() for part in segment.split("→", 1))
        elif "->" in segment:
            original, corrected = (part.strip() for part in segment.split("->", 1))
        else:
            original, corrected = segment.strip(), ""
        if original or corrected:
            pairs.append((original, corrected))
    return pairs or [("", "")]


def _error_evidence_parts(evidence: str) -> tuple[str, str]:
    return _error_evidence_pairs(evidence)[0]


def _weakness_skill_code(canonical_key: str) -> str:
    for prefix in ("weakness.", "weakness:"):
        if canonical_key.startswith(prefix):
            return canonical_key[len(prefix):]
    return canonical_key or "clarity.expression"


def _source_modality(source_type: str) -> Optional[str]:
    return {
        "diagnosis": "writing",
        "chat": "text_chat",
        "chat_import": "text_chat",
        "session_analysis": "text_chat",
    }.get(source_type)


def _append_unique(values: Iterable[str], value: str, *, limit: int) -> list[str]:
    rows = [str(item) for item in values if str(item).strip()]
    compact = " ".join((value or "").split()).strip()
    if compact and compact.lower() not in {item.lower() for item in rows}:
        rows.append(compact)
    return rows[-limit:]


def _initialize_weakness_learning_state(
    canonical_key: str,
    evidence: str,
    source_type: str,
    importance: float,
    now: datetime,
    modality_override: Optional[str] = None,
) -> dict:
    """Create backward-compatible scheduling and evidence fields."""
    now_text = iso_at(now)
    evidence_pairs = _error_evidence_pairs(evidence)
    original, _ = evidence_pairs[0]
    skill_code = _weakness_skill_code(canonical_key)
    difficulty = round(max(3.0, min(8.0, 4.0 + float(importance) * 3.0)), 3)
    modality = modality_override or _source_modality(source_type)
    modality_mastery = {}
    if modality:
        modality_mastery[modality] = {
            "mastery": 30.0,
            "attempts": 1,
            "coldSuccesses": 0,
            "hintedSuccesses": 0,
            "failures": 1,
            "avoided": 0,
            "lastOutcome": "observed_error",
            "lastEvidenceAt": now_text,
            "lastEvidenceQuote": original[:300],
        }
    return {
        "errorFingerprint": {
            "skillCode": skill_code,
            "originalExamples": [row[0][:400] for row in evidence_pairs if row[0]][-8:],
            "correctedExamples": [row[1][:400] for row in evidence_pairs if row[1]][-8:],
            "contexts": [source_type] if source_type else [],
        },
        "retention": {
            "stabilityDays": 1.0,
            "difficulty": difficulty,
            "dueAt": iso_at(now + timedelta(days=1)),
            "lastColdRecallAt": None,
            "lastReviewedAt": None,
            "lastOutcome": "observed_error",
            "attempts": 0,
            "successes": 0,
            "hintedSuccesses": 0,
            "failures": 0,
            "avoided": 0,
            "observedErrors": 1,
            "relapseRisk": 0.8,
        },
        "modalityMastery": modality_mastery,
        "probeHistory": [],
        "transferContexts": [],
        "progressionStage": "replay",
    }


def _merge_weakness_learning_state(
    memory: dict,
    canonical_key: str,
    evidence: str,
    source_type: str,
    importance: float,
    now: datetime,
    modality_override: Optional[str] = None,
) -> None:
    defaults = _initialize_weakness_learning_state(
        canonical_key,
        evidence,
        source_type,
        importance,
        now,
        modality_override,
    )
    evidence_pairs = _error_evidence_pairs(evidence)
    original, _ = evidence_pairs[0]
    raw_fingerprint = memory.get("errorFingerprint")
    fingerprint = (
        dict(raw_fingerprint)
        if isinstance(raw_fingerprint, dict)
        else dict(defaults["errorFingerprint"])
    )
    if isinstance(raw_fingerprint, str) and raw_fingerprint.strip():
        fingerprint["description"] = raw_fingerprint.strip()[:400]
    fingerprint["skillCode"] = fingerprint.get("skillCode") or _weakness_skill_code(canonical_key)
    originals = list(fingerprint.get("originalExamples") or [])
    corrections = list(fingerprint.get("correctedExamples") or [])
    for source_example, corrected_example in evidence_pairs:
        originals = _append_unique(originals, source_example[:400], limit=8)
        corrections = _append_unique(corrections, corrected_example[:400], limit=8)
    fingerprint["originalExamples"] = originals
    fingerprint["correctedExamples"] = corrections
    fingerprint["contexts"] = _append_unique(
        fingerprint.get("contexts") or [], source_type, limit=8,
    )
    memory["errorFingerprint"] = fingerprint

    retention = dict(memory.get("retention") or defaults["retention"])
    old_stability = max(0.25, float(retention.get("stabilityDays", 1.0)))
    retention.update({
        "stabilityDays": round(max(0.25, old_stability * 0.65), 3),
        "difficulty": round(min(10.0, float(retention.get("difficulty", 5.0)) + 0.35), 3),
        "dueAt": iso_at(now + timedelta(days=1)),
        "lastOutcome": "observed_error",
        "observedErrors": int(retention.get("observedErrors", 0)) + 1,
        "relapseRisk": max(0.85, float(retention.get("relapseRisk", 0.0))),
    })
    for key, value in defaults["retention"].items():
        retention.setdefault(key, value)
    memory["retention"] = retention

    modality_mastery = dict(memory.get("modalityMastery") or {})
    modality = modality_override or _source_modality(source_type)
    if modality:
        state = dict(modality_mastery.get(modality) or defaults["modalityMastery"].get(modality) or {})
        # Defaults already represent this observation; only increment an
        # existing modality row.
        if modality in modality_mastery:
            state["attempts"] = int(state.get("attempts", 0)) + 1
            state["failures"] = int(state.get("failures", 0)) + 1
            state["mastery"] = round(max(0.0, float(state.get("mastery", 35.0)) - 4.0), 2)
        state.update({
            "lastOutcome": "observed_error",
            "lastEvidenceAt": iso_at(now),
            "lastEvidenceQuote": original[:300],
        })
        modality_mastery[modality] = state
    memory["modalityMastery"] = modality_mastery
    memory["probeHistory"] = list(memory.get("probeHistory") or [])[-WEAKNESS_PROBE_HISTORY_LIMIT:]
    memory["transferContexts"] = list(memory.get("transferContexts") or [])[-12:]
    memory.setdefault("progressionStage", "replay")


def _expiry_fields(kind: str, expires_in_days: Optional[int], pinned: bool, now: datetime) -> dict:
    if pinned:
        return {"expiresAt": None}
    days = expires_in_days if expires_in_days is not None else DEFAULT_EXPIRY_DAYS.get(kind)
    if days is None:
        return {"expiresAt": None}
    expires = now + timedelta(days=max(1, int(days)))
    return {"expiresAt": iso_at(expires), "ttl": _ttl_after(expires)}


def _mark_archived(
    memory: dict,
    status: str,
    now: datetime,
    superseded_by: Optional[str] = None,
    *,
    persist_memory: Callable[[dict], None] = save_memory,
) -> dict:
    memory = dict(memory)
    memory["status"] = status
    memory["updatedAt"] = iso_at(now)
    memory["expiresAt"] = iso_at(now)
    memory["ttl"] = _ttl_after(now)
    if superseded_by:
        memory["supersededBy"] = superseded_by
    persist_memory(memory)
    return memory


def _active_memories(
    user_id: str,
    *,
    expire_due: bool = True,
    persist_memory: Callable[[dict], None] = save_memory,
) -> list[dict]:
    now = utc_now()
    result: list[dict] = []
    for memory in list_memories(user_id, limit=settings.memory_max_items_per_user + 100):
        if memory.get("status", ACTIVE) != ACTIVE:
            continue
        expires_at = parse_iso(memory.get("expiresAt"))
        if expires_at and expires_at <= now and not memory.get("pinned"):
            if expire_due:
                _mark_archived(memory, "expired", now, persist_memory=persist_memory)
            continue
        result.append(memory)
    return result


@memory_write_locked
def list_active_memory_records(user_id: str) -> list[dict]:
    """Return lifecycle-synchronized active rows for internal policies."""
    return _active_memories(user_id, expire_due=True)


def _matching_memories(
    user_id: str,
    canonical_key: str,
    *,
    include_resolved: bool = False,
    persist_memory: Callable[[dict], None] = save_memory,
) -> list[dict]:
    matches = [
        memory
        for memory in _active_memories(user_id, persist_memory=persist_memory)
        if memory.get("canonicalKey") == canonical_key
    ]
    if include_resolved:
        known_ids = {memory.get("id") for memory in matches}
        matches.extend(
            memory
            for memory in list_memories(
                user_id,
                limit=settings.memory_max_items_per_user + 100,
            )
            if memory.get("id") not in known_ids
            and memory.get("status") == "resolved"
            and memory.get("canonicalKey") == canonical_key
        )
    return matches


def _reactivate_weakness(memory: dict, now: datetime) -> dict:
    """Reopen a resolved weakness when fresh error evidence appears."""
    memory = dict(memory)
    now_text = iso_at(now)
    if memory.get("status") == "resolved":
        history = list(memory.get("resolutionHistory") or [])
        history.append({
            "resolvedAt": memory.get("resolvedAt"),
            "reopenedAt": now_text,
            "policy": memory.get("resolutionReason") or WEAKNESS_GRADUATION_POLICY,
        })
        memory["resolutionHistory"] = history[-10:]
        memory["reopenedCount"] = int(memory.get("reopenedCount", 0)) + 1
    memory["status"] = ACTIVE
    memory["lastObservedAt"] = now_text
    memory.pop("resolvedAt", None)
    memory.pop("resolutionReason", None)
    graduation = dict(memory.get("graduation") or {})
    graduation.update({
        "policy": WEAKNESS_GRADUATION_POLICY,
        "state": "collecting",
        "eligible": False,
        "lastObservedAt": now_text,
    })
    memory["graduation"] = graduation
    memory.update(_expiry_fields("weakness", None, bool(memory.get("pinned")), now))
    if memory.get("expiresAt") is None:
        memory.pop("ttl", None)
    return memory


def _weakness_graduation_snapshot(
    memory: dict,
    *,
    mastery: Optional[float],
    now: datetime,
) -> dict:
    thresholds = WEAKNESS_GRADUATION_THRESHOLDS
    evidence = sorted(
        (
            row
            for row in list(memory.get("practiceEvidence") or [])
            if parse_iso(row.get("createdAt")) is not None
        ),
        key=lambda row: row.get("createdAt", ""),
    )
    attempts = len(evidence)
    successful = [
        row
        for row in evidence
        if bool(row.get("isCorrect")) and float(row.get("score", 0)) >= 80
    ]
    distinct_days = {
        parsed.date().isoformat()
        for row in evidence
        if (parsed := parse_iso(row.get("createdAt"))) is not None
    }
    timestamps = [
        parsed
        for row in evidence
        if (parsed := parse_iso(row.get("createdAt"))) is not None
    ]
    span_days = (
        max(0.0, (max(timestamps) - min(timestamps)).total_seconds() / 86400)
        if len(timestamps) >= 2
        else 0.0
    )
    recent = evidence[-int(thresholds["recentWindow"]):]
    recent_success_rate = (
        sum(
            bool(row.get("isCorrect")) and float(row.get("score", 0)) >= 80
            for row in recent
        )
        / len(recent)
        if recent
        else 0.0
    )
    recent_average_rows = evidence[-int(thresholds["recentAverageWindow"]):]
    recent_average_score = (
        sum(float(row.get("score", 0)) for row in recent_average_rows)
        / len(recent_average_rows)
        if recent_average_rows
        else 0.0
    )
    exercise_types = {
        str(row.get("exerciseType"))
        for row in successful
        if row.get("exerciseType")
    }
    last_observed = parse_iso(memory.get("lastObservedAt"))
    days_since_observed = (
        max(0.0, (now - last_observed).total_seconds() / 86400)
        if last_observed is not None
        else 0.0
    )
    mastery_value = float(mastery if mastery is not None else 0.0)
    criteria = {
        "attempts": attempts >= int(thresholds["minAttempts"]),
        "distinctDays": len(distinct_days) >= int(thresholds["minDistinctDays"]),
        "spanDays": span_days >= float(thresholds["minSpanDays"]),
        "recentSuccessRate": (
            len(recent) >= int(thresholds["recentWindow"])
            and recent_success_rate >= float(thresholds["minRecentSuccessRate"])
        ),
        "recentAverageScore": (
            len(recent_average_rows) >= int(thresholds["recentAverageWindow"])
            and recent_average_score >= float(thresholds["minRecentAverageScore"])
        ),
        "mastery": mastery_value >= float(thresholds["minMastery"]),
        "exerciseTypes": len(exercise_types) >= int(thresholds["minExerciseTypes"]),
        "recurrenceFree": (
            last_observed is not None
            and days_since_observed >= float(thresholds["recurrenceFreeDays"])
        ),
    }
    passed = sum(bool(value) for value in criteria.values())
    eligible = passed == len(criteria)
    return {
        "policy": WEAKNESS_GRADUATION_POLICY,
        "state": "eligible" if eligible else "collecting",
        "eligible": eligible,
        "progress": round(passed / len(criteria), 4),
        "attempts": attempts,
        "successfulAttempts": len(successful),
        "distinctDays": len(distinct_days),
        "spanDays": round(span_days, 1),
        "recentSuccessRate": round(recent_success_rate, 4),
        "recentAverageScore": round(recent_average_score, 1),
        "mastery": round(mastery_value, 2),
        "exerciseTypeCount": len(exercise_types),
        "daysSinceLastObserved": round(days_since_observed, 1),
        "lastObservedAt": memory.get("lastObservedAt"),
        "criteria": criteria,
        "thresholds": dict(thresholds),
    }


def _record_weakness_practice_evidence(
    *,
    user_id: str,
    skill_code: str,
    exercise_type: str,
    score: int,
    is_correct: bool,
    attempt_id: str,
    created_at: str,
    mastery: Optional[float],
) -> Optional[dict]:
    canonical_key = normalize_canonical_key("weakness", f"weakness.{skill_code}")
    matches = _matching_memories(user_id, canonical_key, include_resolved=True)
    memory = max(matches, key=lambda row: row.get("updatedAt", ""), default=None)
    created = False

    if memory is None and not is_correct:
        saved = remember_candidates(
            user_id,
            [MemoryCandidate(
                kind="weakness",
                canonicalKey=canonical_key,
                content=f"The learner needs recurring practice with {skill_code}.",
                evidence=f"Practice score: {score}/100.",
                confidence=0.72,
                importance=0.75,
                expiresInDays=60,
            )],
            source_type="practice",
            source_id=attempt_id,
        )
        if not saved:
            return None
        memory = get_memory(user_id, saved[-1]["id"])
        created = True

    if memory is None:
        return None

    now = parse_iso(created_at) or utc_now()
    now_text = iso_at(now)
    if memory.get("status") == "resolved":
        if is_correct:
            return None
        memory = _reactivate_weakness(memory, now)

    if memory.get("status", ACTIVE) != ACTIVE:
        return None

    memory = dict(memory)
    if any(
        str(row.get("attemptId") or "") == attempt_id
        for row in list(memory.get("practiceEvidence") or [])
    ):
        # A completed practice outcome may be replayed after the client missed
        # the HTTP response. It must not alter graduation or learner state.
        return public_memory(memory)
    already_referenced = any(
        str(ref.get("sourceType") or "") == "practice"
        and str(ref.get("sourceId") or "") == attempt_id
        for ref in list(memory.get("sourceRefs") or [])
    )
    if not memory.get("lastObservedAt"):
        memory["lastObservedAt"] = (
            memory.get("createdAt") or memory.get("updatedAt") or now_text
        )
    rows = [
        row
        for row in list(memory.get("practiceEvidence") or [])
        if row.get("attemptId") != attempt_id
    ]
    rows.append({
        "attemptId": attempt_id,
        "createdAt": now_text,
        "score": int(score),
        "isCorrect": bool(is_correct),
        "exerciseType": exercise_type,
    })
    memory["practiceEvidence"] = sorted(
        rows,
        key=lambda row: row.get("createdAt", ""),
    )[-WEAKNESS_PRACTICE_EVIDENCE_LIMIT:]
    memory["updatedAt"] = now_text

    if not is_correct:
        memory["lastObservedAt"] = now_text
        if not created and not already_referenced:
            refs = list(memory.get("sourceRefs") or [])
            refs.append(_source_ref(
                "practice",
                attempt_id,
                f"Practice score: {score}/100; correct={is_correct}.",
                now_text,
            ))
            memory["sourceRefs"] = refs[-12:]
            memory["sourceType"] = "practice"
            memory["sourceId"] = attempt_id
            memory["evidence"] = f"Practice score: {score}/100; correct={is_correct}."
            memory["observationCount"] = int(memory.get("observationCount", 1)) + 1

    graduation = _weakness_graduation_snapshot(memory, mastery=mastery, now=now)
    if graduation["eligible"]:
        memory["status"] = "resolved"
        memory["resolvedAt"] = now_text
        memory["resolutionReason"] = WEAKNESS_GRADUATION_POLICY
        graduation["state"] = "resolved"
        memory.update(_expiry_fields(
            "weakness",
            RESOLVED_WEAKNESS_RETENTION_DAYS,
            bool(memory.get("pinned")),
            now,
        ))
    else:
        memory.update(_expiry_fields("weakness", None, bool(memory.get("pinned")), now))
        if memory.get("expiresAt") is None:
            memory.pop("ttl", None)
    memory["graduation"] = graduation
    save_memory(memory)
    return public_memory(memory)


@memory_write_locked
def remember_candidates(
    user_id: str,
    candidates: Iterable[MemoryCandidate | dict],
    *,
    source_type: str,
    source_id: str,
    pinned: bool = False,
    weakness_learning_skip_codes: Optional[set[str]] = None,
    weakness_modality: Optional[str] = None,
    persist_memory: Callable[[dict], None] = save_memory,
) -> list[dict]:
    """Merge, replace, and persist durable candidate memories."""
    if not settings.memory_enabled:
        return []

    validated: list[MemoryCandidate] = []
    for raw in candidates:
        try:
            candidate = raw if isinstance(raw, MemoryCandidate) else MemoryCandidate.model_validate(raw)
        except ValueError:
            continue
        if source_type != "manual" and candidate.confidence < MIN_AUTO_CONFIDENCE:
            continue
        validated.append(candidate)
    if not validated:
        return []

    # One analyzer response may describe the same durable fact in corrections,
    # weaknesses, and memoryCandidates. Coalesce it so one learner event never
    # becomes multiple mastery/retention penalties.
    coalesced: dict[tuple[str, str], MemoryCandidate] = {}
    for candidate in validated:
        normalized_key = normalize_canonical_key(candidate.kind, candidate.canonicalKey, candidate.content)
        key = (candidate.kind, normalized_key)
        previous = coalesced.get(key)
        if previous is None:
            coalesced[key] = candidate.model_copy(update={"canonicalKey": normalized_key})
            continue
        evidence_parts = [part for part in (previous.evidence, candidate.evidence) if part]
        evidence = " | ".join(dict.fromkeys(evidence_parts))[:800]
        coalesced[key] = previous.model_copy(update={
            "content": candidate.content if len(candidate.content) > len(previous.content) else previous.content,
            "evidence": evidence,
            "confidence": max(previous.confidence, candidate.confidence),
            "importance": max(previous.importance, candidate.importance),
            "expiresInDays": candidate.expiresInDays or previous.expiresInDays,
        })
    validated = list(coalesced.values())
    skipped_learning_codes = set(weakness_learning_skip_codes or set())

    embeddings = embed_texts([candidate.content for candidate in validated])
    saved: list[dict] = []
    for index, candidate in enumerate(validated):
        now = utc_now()
        now_text = iso_at(now)
        canonical_key = normalize_canonical_key(candidate.kind, candidate.canonicalKey, candidate.content)
        matches = _matching_memories(
            user_id,
            canonical_key,
            include_resolved=candidate.kind == "weakness",
            persist_memory=persist_memory,
        )
        existing = max(matches, key=lambda m: m.get("updatedAt", ""), default=None)
        vector = embeddings[index] if index < len(embeddings) else None
        # A source is one independent observation. Retrying a failed workflow
        # must not raise confidence, increment observationCount, or apply the
        # same weakness evidence twice.
        if existing and any(
            str(ref.get("sourceType") or "") == source_type
            and str(ref.get("sourceId") or "") == source_id
            for ref in existing.get("sourceRefs") or []
        ):
            saved.append(public_memory(existing))
            continue
        resolved_weakness = bool(
            candidate.kind == "weakness"
            and existing
            and existing.get("status") == "resolved"
        )

        if (
            existing
            and (
                resolved_weakness
                or (
                    not _looks_conflicting(existing.get("content", ""), candidate.content)
                    and _content_similarity(existing.get("content", ""), candidate.content) >= 0.86
                )
            )
        ):
            memory = (
                _reactivate_weakness(existing, now)
                if resolved_weakness
                else dict(existing)
            )
            refs = list(memory.get("sourceRefs") or [])
            refs.append(_source_ref(source_type, source_id, candidate.evidence, now_text))
            memory.update(
                {
                    "content": candidate.content,
                    "evidence": candidate.evidence or memory.get("evidence", ""),
                    "confidence": round(
                        min(0.99, 1 - (1 - float(memory.get("confidence", 0.5))) * (1 - candidate.confidence)),
                        4,
                    ),
                    "importance": round(max(float(memory.get("importance", 0.5)), candidate.importance), 4),
                    "updatedAt": now_text,
                    "sourceType": source_type,
                    "sourceId": source_id,
                    "sourceRefs": refs[-12:],
                    "observationCount": int(memory.get("observationCount", 1)) + 1,
                    "status": ACTIVE,
                }
            )
            memory["verification"] = _verification_snapshot(
                confidence=float(memory.get("confidence", candidate.confidence)),
                source_refs=memory.get("sourceRefs") or [],
                source_type=source_type,
                now=now,
            )
            if candidate.kind == "weakness":
                memory["lastObservedAt"] = now_text
                graduation = dict(memory.get("graduation") or {})
                graduation.update({
                    "policy": WEAKNESS_GRADUATION_POLICY,
                    "state": "collecting",
                    "eligible": False,
                    "lastObservedAt": now_text,
                })
                memory["graduation"] = graduation
                if _weakness_skill_code(canonical_key) not in skipped_learning_codes:
                    _merge_weakness_learning_state(
                        memory,
                        canonical_key,
                        candidate.evidence,
                        source_type,
                        candidate.importance,
                        now,
                        weakness_modality,
                    )
            if vector is not None:
                memory["embedding"] = vector
                memory["embeddingModel"] = settings.qwen_embedding_model
            memory.update(_expiry_fields(candidate.kind, candidate.expiresInDays, bool(memory.get("pinned")), now))
            if memory.get("expiresAt") is None:
                memory.pop("ttl", None)
            persist_memory(memory)
            saved.append(public_memory(memory))
            continue

        memory_id = f"mem_{uuid4().hex[:12]}"
        memory = {
            "id": memory_id,
            "userId": user_id,
            "kind": candidate.kind,
            "canonicalKey": canonical_key,
            "content": candidate.content,
            "evidence": candidate.evidence,
            "confidence": round(candidate.confidence, 4),
            "importance": round(candidate.importance, 4),
            "status": ACTIVE,
            "pinned": pinned,
            "sourceType": source_type,
            "sourceId": source_id,
            "sourceRefs": [_source_ref(source_type, source_id, candidate.evidence, now_text)],
            "observationCount": 1,
            "accessCount": 0,
            "lastAccessedAt": None,
            "createdAt": now_text,
            "updatedAt": now_text,
        }
        memory["verification"] = _verification_snapshot(
            confidence=candidate.confidence,
            source_refs=memory["sourceRefs"],
            source_type=source_type,
            now=now,
        )
        if candidate.kind == "weakness":
            memory["lastObservedAt"] = now_text
            memory["graduation"] = {
                "policy": WEAKNESS_GRADUATION_POLICY,
                "state": "collecting",
                "eligible": False,
                "progress": 0.0,
                "lastObservedAt": now_text,
            }
            memory.update(_initialize_weakness_learning_state(
                canonical_key,
                candidate.evidence,
                source_type,
                candidate.importance,
                now,
                weakness_modality,
            ))
        memory.update(_expiry_fields(candidate.kind, candidate.expiresInDays, pinned, now))
        if vector is not None:
            memory["embedding"] = vector
            memory["embeddingModel"] = settings.qwen_embedding_model

        for old in matches:
            archived = dict(old)
            if _looks_conflicting(old.get("content", ""), candidate.content):
                archived["verification"] = {
                    "state": "contradicted",
                    "reason": "newer_conflicting_evidence",
                    "needsConfirmation": False,
                    "contradictedAt": now_text,
                    "contradictedBy": memory_id,
                    "updatedAt": now_text,
                }
            _mark_archived(
                archived,
                "superseded",
                now,
                superseded_by=memory_id,
                persist_memory=persist_memory,
            )
        persist_memory(memory)
        saved.append(public_memory(memory))

    _enforce_capacity(user_id, persist_memory=persist_memory)
    return saved


@memory_write_locked
def create_manual_memory(
    user_id: str,
    *,
    kind: str,
    canonical_key: Optional[str],
    content: str,
    evidence: str = "",
    confidence: float = 1.0,
    importance: float = 0.8,
    pinned: bool = False,
    expires_in_days: Optional[int] = None,
) -> dict:
    manual_key = canonical_key or (
        "manual-" + hashlib.sha256(content.strip().lower().encode("utf-8")).hexdigest()[:12]
    )
    candidate = MemoryCandidate(
        kind=kind,
        canonicalKey=manual_key,
        content=content,
        evidence=evidence or "Added by the learner.",
        confidence=confidence,
        importance=importance,
        expiresInDays=expires_in_days,
    )
    saved = remember_candidates(
        user_id,
        [candidate],
        source_type="manual",
        source_id=f"manual_{uuid4().hex[:8]}",
        pinned=pinned,
    )
    if not saved:
        raise ValueError("Memory could not be saved.")
    return saved[-1]


@memory_write_locked
def update_memory(
    user_id: str,
    memory_id: str,
    fields: dict,
) -> Optional[dict]:
    memory = get_memory(user_id, memory_id)
    if not memory:
        return None
    now = utc_now()
    for field in ("content", "evidence", "confidence", "importance", "pinned"):
        if field in fields and fields[field] is not None:
            memory[field] = fields[field]
    memory["updatedAt"] = iso_at(now)
    # A direct learner edit is explicit confirmation of the resulting fact.
    if any(field in fields for field in ("content", "evidence", "confidence")):
        memory["verification"] = {
            "state": "confirmed",
            "reason": "learner_confirmed",
            "independentSourceCount": len({
                str(ref.get("sourceId"))
                for ref in memory.get("sourceRefs") or []
                if ref.get("sourceId")
            }),
            "needsConfirmation": False,
            "updatedAt": iso_at(now),
        }
    if fields.get("content") is not None:
        vector = embed_text(str(fields["content"]))
        if vector is not None:
            memory["embedding"] = vector
            memory["embeddingModel"] = settings.qwen_embedding_model
    if fields.get("pinned") is True:
        memory["expiresAt"] = None
        memory.pop("ttl", None)
    elif "expiresInDays" in fields and fields["expiresInDays"] is not None:
        memory.update(_expiry_fields(memory.get("kind", "episode"), fields["expiresInDays"], False, now))
    elif fields.get("pinned") is False and not memory.get("expiresAt"):
        memory.update(_expiry_fields(memory.get("kind", "episode"), None, False, now))
    save_memory(memory)
    return public_memory(memory)


@memory_write_locked
def forget_memory(user_id: str, memory_id: str) -> Optional[dict]:
    memory = get_memory(user_id, memory_id)
    if not memory:
        return None
    return public_memory(_mark_archived(memory, "forgotten", utc_now()))


@memory_write_locked
def forget_memories_from_source(
    user_id: str,
    source_id: str,
    *,
    persist_memory: Callable[[dict], None] = save_memory,
) -> list[dict]:
    """Retract evidence when its submission is deleted.

    A memory with other independent observations survives; a memory supported
    only by the deleted source is forgotten.
    """
    if not source_id:
        return []
    changed: list[dict] = []
    now = utc_now()
    for memory in _active_memories(user_id, persist_memory=persist_memory):
        refs = list(memory.get("sourceRefs") or [])
        referenced = memory.get("sourceId") == source_id or any(
            ref.get("sourceId") == source_id for ref in refs
        )
        if not referenced:
            continue
        remaining = [ref for ref in refs if ref.get("sourceId") != source_id]
        if not remaining:
            changed.append(public_memory(_mark_archived(
                memory,
                "forgotten",
                now,
                persist_memory=persist_memory,
            )))
            continue
        memory = dict(memory)
        memory["sourceRefs"] = remaining
        memory["observationCount"] = max(1, int(memory.get("observationCount", 1)) - (len(refs) - len(remaining)))
        memory["sourceType"] = remaining[-1].get("sourceType", memory.get("sourceType"))
        memory["sourceId"] = remaining[-1].get("sourceId", memory.get("sourceId"))
        memory["evidence"] = remaining[-1].get("evidence", memory.get("evidence", ""))
        memory["updatedAt"] = iso_at(now)
        memory["verification"] = _verification_snapshot(
            confidence=float(memory.get("confidence", 0.5)),
            source_refs=remaining,
            source_type=str(memory.get("sourceType") or "system"),
            now=now,
        )
        persist_memory(memory)
        changed.append(public_memory(memory))
    return changed


def _enforce_capacity(
    user_id: str,
    *,
    persist_memory: Callable[[dict], None] = save_memory,
) -> None:
    maximum = max(20, settings.memory_max_items_per_user)
    active = _active_memories(user_id, persist_memory=persist_memory)
    if len(active) <= maximum:
        return
    kind_rank = {"episode": 0, "weakness": 1, "strategy": 2, "goal": 3, "preference": 4}
    removable = sorted(
        (m for m in active if not m.get("pinned")),
        key=lambda m: (
            kind_rank.get(m.get("kind", "episode"), 0),
            float(m.get("importance", 0.5)),
            m.get("updatedAt", ""),
        ),
    )
    for memory in removable[: max(0, len(active) - maximum)]:
        _mark_archived(
            memory,
            "forgotten",
            utc_now(),
            persist_memory=persist_memory,
        )


def memory_candidates_from_errors(errors: Iterable[dict]) -> list[MemoryCandidate]:
    candidates: list[MemoryCandidate] = []
    severity_score = {"low": 0.58, "medium": 0.72, "high": 0.9}
    for error in errors:
        code = str(error.get("code") or "clarity.expression")
        category = str(error.get("category") or code)
        severity = str(error.get("severity") or "medium")
        original = str(error.get("originalText") or error.get("evidenceQuote") or "")
        corrected = str(error.get("correctedText") or error.get("suggestedBetterEnglish") or "")
        evidence = f"{original} → {corrected}".strip(" →")
        candidates.append(
            MemoryCandidate(
                kind="weakness",
                canonicalKey=f"weakness.{code}",
                content=f"The learner needs recurring practice with {category} ({code}).",
                evidence=evidence[:800],
                confidence=severity_score.get(severity, 0.7),
                importance=min(0.95, severity_score.get(severity, 0.7) + 0.05),
                expiresInDays=60,
            )
        )
    return candidates


def heuristic_memory_candidates(text: str) -> list[MemoryCandidate]:
    """Conservative fallback for fake/offline mode and explicit preferences."""
    compact = " ".join((text or "").split())
    lowered = compact.lower()
    evidence = compact[:800]
    found: list[MemoryCandidate] = []

    if re.search(r"business english|商务英语", lowered):
        found.append(MemoryCandidate(
            kind="preference",
            canonicalKey="preference.learning_focus",
            content="The learner wants to focus on business English.",
            evidence=evidence,
            confidence=0.88,
            importance=0.78,
        ))
    if re.search(r"(?:prepar|stud|goal|target|exam|备考|准备|目标).{0,40}(?:ielts|雅思)|(?:ielts|雅思).{0,40}(?:prepar|stud|goal|target|exam|备考|准备|目标)", lowered):
        found.append(MemoryCandidate(
            kind="goal",
            canonicalKey="goal.exam.ielts",
            content="The learner is preparing for IELTS.",
            evidence=evidence,
            confidence=0.9,
            importance=0.9,
        ))
    if re.search(r"(?:concise|brief|short|简洁|精简).{0,24}(?:feedback|explanation|反馈|解释)|(?:feedback|explanation|反馈|解释).{0,24}(?:concise|brief|short|简洁|精简)", lowered):
        found.append(MemoryCandidate(
            kind="preference",
            canonicalKey="preference.feedback_style",
            content="The learner prefers concise feedback.",
            evidence=evidence,
            confidence=0.92,
            importance=0.82,
        ))
    if re.search(r"(?:please|prefer|希望|请).{0,18}(?:use |用)?(?:chinese|中文).{0,18}(?:feedback|explain|回答|反馈|解释)?", lowered):
        found.append(MemoryCandidate(
            kind="preference",
            canonicalKey="preference.explanation_language",
            content="The learner prefers explanations in Chinese.",
            evidence=evidence,
            confidence=0.86,
            importance=0.76,
        ))
    return found


def _tokens(text: str) -> list[str]:
    lowered = text.lower()
    words = re.findall(r"[a-z0-9][a-z0-9_.-]*", lowered)
    cjk = "".join(re.findall(r"[\u3400-\u9fff]", lowered))
    words.extend(cjk[index : index + 2] for index in range(max(0, len(cjk) - 1)))
    if len(cjk) == 1:
        words.append(cjk)
    return words


def lexical_similarity(query: str, text: str) -> float:
    query_tokens = set(_tokens(query))
    text_tokens = set(_tokens(text))
    if not query_tokens or not text_tokens:
        return 0.0
    overlap = len(query_tokens & text_tokens)
    return min(1.0, overlap / math.sqrt(len(query_tokens) * len(text_tokens)))


def cosine_similarity(left: Optional[list[float]], right: Optional[list[float]]) -> Optional[float]:
    if not left or not right or len(left) != len(right):
        return None
    dot = sum(a * b for a, b in zip(left, right))
    left_norm = math.sqrt(sum(value * value for value in left))
    right_norm = math.sqrt(sum(value * value for value in right))
    if left_norm == 0 or right_norm == 0:
        return None
    return max(0.0, min(1.0, (dot / (left_norm * right_norm) + 1.0) / 2.0))


def estimate_tokens(text: str) -> int:
    if not text:
        return 0
    cjk_count = len(re.findall(r"[\u3400-\u9fff]", text))
    other_count = max(0, len(text) - cjk_count)
    return cjk_count + math.ceil(other_count / 4)


def _truncate_to_budget(text: str, budget: int) -> str:
    if estimate_tokens(text) <= budget:
        return text
    if budget <= 2:
        return ""
    low, high = 0, len(text)
    while low < high:
        middle = (low + high + 1) // 2
        if estimate_tokens(text[:middle] + "…") <= budget:
            low = middle
        else:
            high = middle - 1
    return text[:low].rstrip() + "…"


def _recency(memory: dict, now: datetime) -> float:
    updated = parse_iso(memory.get("updatedAt")) or parse_iso(memory.get("createdAt")) or now
    age_days = max(0.0, (now - updated).total_seconds() / 86400)
    half_life = HALF_LIFE_DAYS.get(memory.get("kind", "episode"), 30.0)
    return math.pow(0.5, age_days / half_life)


@memory_write_locked
def retrieve_memory_pack(
    user_id: str,
    query: str,
    *,
    token_budget: Optional[int] = None,
    limit: Optional[int] = None,
    purpose: str = "general",
    record_trace: bool = True,
) -> dict:
    budget = max(100, min(2000, token_budget or settings.memory_context_token_budget))
    result_limit = max(1, min(20, limit or settings.memory_retrieval_limit))
    if not settings.memory_enabled:
        return {
            "text": "",
            "items": [],
            "estimatedTokens": 0,
            "tokenBudget": budget,
            "totalCandidates": 0,
            "traceId": None,
        }

    memories = _active_memories(user_id)
    if purpose == "chat":
        # Weaknesses and learned probe strategies are internal scheduling
        # state, not conversational personalization. Feeding their raw content
        # or evidence into every reply makes the coach repeat old mistakes,
        # named entities, and topics even when no natural practice opportunity
        # exists. Text chat receives at most one separately gated probe instead.
        memories = [
            memory
            for memory in memories
            if memory.get("kind") not in {"weakness", "strategy"}
        ]
    query_vector = embed_text(query)
    now = utc_now()
    scored: list[dict] = []
    for memory in memories:
        searchable = " ".join(
            str(memory.get(field) or "")
            for field in ("kind", "canonicalKey", "content", "evidence")
        )
        lexical = lexical_similarity(query, searchable)
        semantic_value = cosine_similarity(query_vector, memory.get("embedding"))
        semantic = semantic_value if semantic_value is not None else lexical
        if purpose == "chat" and not (
            lexical >= 0.16
            or (semantic_value is not None and semantic_value >= 0.62)
        ):
            # Retrieval must not turn an unrelated long-term goal or episode
            # into the next conversation topic. Chat memory is optional
            # personalization, so low-relevance rows are safer to omit.
            continue
        importance = float(memory.get("importance", 0.5))
        recency = _recency(memory, now)
        frequency = min(1.0, math.log1p(int(memory.get("accessCount", 0))) / math.log(11))
        critical = 1.0 if memory.get("kind") in {"preference", "goal"} else 0.0
        raw_verification = memory.get("verification")
        verification_state = (
            str(raw_verification.get("state") or "legacy")
            if isinstance(raw_verification, dict)
            else "legacy"
        )
        verification_factor = 0.75 if verification_state == "candidate" else 1.0
        score = (
            0.50 * semantic
            + 0.15 * lexical
            + 0.15 * importance
            + 0.10 * recency
            + 0.05 * frequency
            + 0.05 * critical
        ) * verification_factor
        if memory.get("pinned"):
            score += 0.15
        scored_memory = dict(memory)
        scored_memory["retrievalScore"] = round(min(1.0, score), 4)
        scored_memory["scoreBreakdown"] = {
            "semantic": round(semantic, 4),
            "lexical": round(lexical, 4),
            "importance": round(importance, 4),
            "recency": round(recency, 4),
            "frequency": round(frequency, 4),
            "critical": critical,
            "verification": verification_state,
            "verificationFactor": verification_factor,
        }
        scored.append(scored_memory)

    scored.sort(key=lambda memory: memory["retrievalScore"], reverse=True)
    ranked = scored[: max(result_limit * 3, result_limit)]

    # Reserve critical learner preferences/goals even when lexical overlap is low.
    critical = sorted(
        (m for m in scored if m.get("kind") in {"preference", "goal"} and float(m.get("importance", 0)) >= 0.65),
        key=lambda memory: (memory.get("pinned", False), memory.get("importance", 0)),
        reverse=True,
    )[:2]
    ordered: list[dict] = []
    seen: set[str] = set()
    for memory in [*critical, *ranked]:
        if memory["id"] not in seen:
            seen.add(memory["id"])
            ordered.append(memory)

    header = (
        "Relevant long-term learner memory (use only when helpful; current user input wins). "
        "A [candidate] memory is tentative: confirm it naturally before relying on or asserting it:"
    )
    lines = [header]
    selected: list[dict] = []
    for memory in ordered:
        if len(selected) >= result_limit:
            break
        raw_verification = memory.get("verification")
        verification_state = (
            str(raw_verification.get("state") or "legacy")
            if isinstance(raw_verification, dict)
            else "legacy"
        )
        line = (
            f"- [{memory.get('kind')} | {verification_state} | {memory.get('id')}] "
            f"{memory.get('content', '')}"
        )
        evidence = str(memory.get("evidence") or "").strip()
        if evidence:
            line += f" Evidence: {evidence}"
        remaining = budget - estimate_tokens("\n".join(lines))
        if remaining <= 8:
            break
        fitted = _truncate_to_budget(line, remaining)
        if not fitted:
            continue
        lines.append(fitted)
        selected.append(memory)

    pack_text = "\n".join(lines) if selected else ""
    estimated = estimate_tokens(pack_text)
    now_text = iso_at(now)
    for memory in selected:
        stored = get_memory(user_id, memory["id"])
        if not stored or stored.get("status", ACTIVE) != ACTIVE:
            continue
        stored["accessCount"] = int(stored.get("accessCount", 0)) + 1
        stored["lastAccessedAt"] = now_text
        save_memory(stored)

    trace_id: Optional[str] = None
    if record_trace:
        trace_id = f"mtr_{uuid4().hex[:12]}"
        expires = now + timedelta(days=30)
        trace = {
            "id": trace_id,
            "userId": user_id,
            "purpose": purpose,
            "queryPreview": " ".join(query.split())[:180],
            "queryHash": hashlib.sha256(query.encode("utf-8")).hexdigest()[:16],
            "selectedMemoryIds": [memory["id"] for memory in selected],
            "selected": [
                {
                    "id": memory["id"],
                    "kind": memory.get("kind"),
                    "content": str(memory.get("content") or "")[:200],
                    "score": memory.get("retrievalScore"),
                    "scoreBreakdown": memory.get("scoreBreakdown"),
                }
                for memory in selected
            ],
            "totalCandidates": len(memories),
            "estimatedTokens": estimated,
            "tokenBudget": budget,
            "createdAt": now_text,
            "expiresAt": iso_at(expires),
            "ttl": _ttl_after(expires, grace_days=0),
        }
        save_memory_trace(trace)

    return {
        "text": pack_text,
        "items": [public_memory(memory) for memory in selected],
        "estimatedTokens": estimated,
        "tokenBudget": budget,
        "totalCandidates": len(memories),
        "traceId": trace_id,
    }


@memory_write_locked
def record_practice_outcome_memory(
    *,
    user_id: str,
    skill_code: str,
    exercise_type: str,
    score: int,
    is_correct: bool,
    attempt_id: str,
    created_at: str,
    mastery: Optional[float] = None,
) -> list[dict]:
    """Accumulate strategy, episode, and weakness-graduation evidence."""
    if not settings.memory_enabled:
        return []
    canonical = normalize_canonical_key("strategy", f"practice.{skill_code}.{exercise_type}")
    existing = next(
        (m for m in _active_memories(user_id) if m.get("canonicalKey") == canonical),
        None,
    )
    now = parse_iso(created_at) or utc_now()
    now_text = iso_at(now)
    memory = dict(existing or {})
    strategy_already_recorded = bool(existing) and any(
        str(ref.get("sourceType") or "") == "practice"
        and str(ref.get("sourceId") or "") == attempt_id
        for ref in list(existing.get("sourceRefs") or [])
    )
    if not strategy_already_recorded:
        stats = dict(memory.get("stats") or {})
        attempts = int(stats.get("attempts", 0)) + 1
        total_score = int(stats.get("totalScore", 0)) + int(score)
        correct = int(stats.get("correct", 0)) + (1 if is_correct else 0)
        average = round(total_score / attempts, 1)
        success_rate = round(correct / attempts, 3)
        content = (
            f"For {skill_code}, {exercise_type} has {attempts} recorded attempt(s), "
            f"an average score of {average}, and a {round(success_rate * 100)}% success rate."
        )
        if not memory:
            memory = {
                "id": f"mem_{uuid4().hex[:12]}",
                "userId": user_id,
                "kind": "strategy",
                "canonicalKey": canonical,
                "createdAt": now_text,
                "accessCount": 0,
                "lastAccessedAt": None,
                "observationCount": 0,
                "sourceRefs": [],
                "pinned": False,
            }
        memory.update(
            {
                "content": content,
                "evidence": f"Latest score: {score}/100; correct={is_correct}.",
                "confidence": round(min(0.95, 0.55 + 0.08 * math.sqrt(attempts)), 4),
                "importance": round(min(0.9, 0.58 + 0.04 * math.sqrt(attempts)), 4),
                "status": ACTIVE,
                "sourceType": "practice",
                "sourceId": attempt_id,
                "updatedAt": now_text,
                "observationCount": int(memory.get("observationCount", 0)) + 1,
                "stats": {
                    "skillCode": skill_code,
                    "exerciseType": exercise_type,
                    "attempts": attempts,
                    "totalScore": total_score,
                    "correct": correct,
                    "averageScore": average,
                    "successRate": success_rate,
                    "lastScore": score,
                    "lastAttemptAt": now_text,
                },
            }
        )
        refs = list(memory.get("sourceRefs") or [])
        refs.append(_source_ref("practice", attempt_id, memory["evidence"], now_text))
        memory["sourceRefs"] = refs[-12:]
        memory.update(_expiry_fields("strategy", 180, False, now))
        vector = embed_text(content)
        if vector is not None:
            memory["embedding"] = vector
            memory["embeddingModel"] = settings.qwen_embedding_model
        save_memory(memory)

    episode = MemoryCandidate(
        kind="episode",
        canonicalKey=f"episode.practice.{attempt_id}",
        content=f"The learner scored {score}/100 on a {exercise_type} exercise for {skill_code}.",
        evidence=f"Practice attempt {attempt_id}; correct={is_correct}.",
        confidence=1.0,
        importance=0.72 if score < 60 or score >= 90 else 0.55,
        expiresInDays=30,
    )
    episodic = remember_candidates(
        user_id,
        [episode],
        source_type="practice",
        source_id=attempt_id,
    )
    weakness_update = _record_weakness_practice_evidence(
        user_id=user_id,
        skill_code=skill_code,
        exercise_type=exercise_type,
        score=score,
        is_correct=is_correct,
        attempt_id=attempt_id,
        created_at=created_at,
        mastery=mastery,
    )
    _enforce_capacity(user_id)
    return [
        public_memory(memory),
        *([weakness_update] if weakness_update is not None else []),
        *episodic,
    ]
