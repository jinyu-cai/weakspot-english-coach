"""Persistent, explainable, bounded memory for the English learning agent."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from difflib import SequenceMatcher
import hashlib
import math
import re
from typing import Iterable, Optional
from uuid import uuid4

from app.config import settings
from app.db.repositories import (
    get_memory,
    list_memories,
    now_iso,
    save_memory,
    save_memory_trace,
)
from app.models.memory import MemoryCandidate
from app.services.embedding_client import embed_text, embed_texts


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


def _expiry_fields(kind: str, expires_in_days: Optional[int], pinned: bool, now: datetime) -> dict:
    if pinned:
        return {"expiresAt": None}
    days = expires_in_days if expires_in_days is not None else DEFAULT_EXPIRY_DAYS.get(kind)
    if days is None:
        return {"expiresAt": None}
    expires = now + timedelta(days=max(1, int(days)))
    return {"expiresAt": iso_at(expires), "ttl": _ttl_after(expires)}


def _mark_archived(memory: dict, status: str, now: datetime, superseded_by: Optional[str] = None) -> dict:
    memory = dict(memory)
    memory["status"] = status
    memory["updatedAt"] = iso_at(now)
    memory["expiresAt"] = iso_at(now)
    memory["ttl"] = _ttl_after(now)
    if superseded_by:
        memory["supersededBy"] = superseded_by
    save_memory(memory)
    return memory


def _active_memories(user_id: str, *, expire_due: bool = True) -> list[dict]:
    now = utc_now()
    result: list[dict] = []
    for memory in list_memories(user_id, limit=settings.memory_max_items_per_user + 100):
        if memory.get("status", ACTIVE) != ACTIVE:
            continue
        expires_at = parse_iso(memory.get("expiresAt"))
        if expires_at and expires_at <= now and not memory.get("pinned"):
            if expire_due:
                _mark_archived(memory, "expired", now)
            continue
        result.append(memory)
    return result


def list_active_memory_records(user_id: str) -> list[dict]:
    """Return lifecycle-synchronized active rows for internal policies."""
    return _active_memories(user_id, expire_due=True)


def remember_candidates(
    user_id: str,
    candidates: Iterable[MemoryCandidate | dict],
    *,
    source_type: str,
    source_id: str,
    pinned: bool = False,
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

    embeddings = embed_texts([candidate.content for candidate in validated])
    saved: list[dict] = []
    for index, candidate in enumerate(validated):
        now = utc_now()
        now_text = iso_at(now)
        canonical_key = normalize_canonical_key(candidate.kind, candidate.canonicalKey, candidate.content)
        active = _active_memories(user_id)
        matches = [m for m in active if m.get("canonicalKey") == canonical_key]
        existing = max(matches, key=lambda m: m.get("updatedAt", ""), default=None)
        vector = embeddings[index] if index < len(embeddings) else None

        if (
            existing
            and not _looks_conflicting(existing.get("content", ""), candidate.content)
            and _content_similarity(existing.get("content", ""), candidate.content) >= 0.86
        ):
            memory = dict(existing)
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
            if vector is not None:
                memory["embedding"] = vector
                memory["embeddingModel"] = settings.qwen_embedding_model
            memory.update(_expiry_fields(candidate.kind, candidate.expiresInDays, bool(memory.get("pinned")), now))
            if memory.get("expiresAt") is None:
                memory.pop("ttl", None)
            save_memory(memory)
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
        memory.update(_expiry_fields(candidate.kind, candidate.expiresInDays, pinned, now))
        if vector is not None:
            memory["embedding"] = vector
            memory["embeddingModel"] = settings.qwen_embedding_model

        for old in matches:
            _mark_archived(old, "superseded", now, superseded_by=memory_id)
        save_memory(memory)
        saved.append(public_memory(memory))

    _enforce_capacity(user_id)
    return saved


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


def forget_memory(user_id: str, memory_id: str) -> Optional[dict]:
    memory = get_memory(user_id, memory_id)
    if not memory:
        return None
    return public_memory(_mark_archived(memory, "forgotten", utc_now()))


def forget_memories_from_source(user_id: str, source_id: str) -> list[dict]:
    """Retract evidence when its submission is deleted.

    A memory with other independent observations survives; a memory supported
    only by the deleted source is forgotten.
    """
    if not source_id:
        return []
    changed: list[dict] = []
    now = utc_now()
    for memory in _active_memories(user_id):
        refs = list(memory.get("sourceRefs") or [])
        referenced = memory.get("sourceId") == source_id or any(
            ref.get("sourceId") == source_id for ref in refs
        )
        if not referenced:
            continue
        remaining = [ref for ref in refs if ref.get("sourceId") != source_id]
        if not remaining:
            changed.append(public_memory(_mark_archived(memory, "forgotten", now)))
            continue
        memory = dict(memory)
        memory["sourceRefs"] = remaining
        memory["observationCount"] = max(1, int(memory.get("observationCount", 1)) - (len(refs) - len(remaining)))
        memory["sourceType"] = remaining[-1].get("sourceType", memory.get("sourceType"))
        memory["sourceId"] = remaining[-1].get("sourceId", memory.get("sourceId"))
        memory["evidence"] = remaining[-1].get("evidence", memory.get("evidence", ""))
        memory["updatedAt"] = iso_at(now)
        save_memory(memory)
        changed.append(public_memory(memory))
    return changed


def _enforce_capacity(user_id: str) -> None:
    maximum = max(20, settings.memory_max_items_per_user)
    active = _active_memories(user_id)
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
        _mark_archived(memory, "forgotten", utc_now())


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
        importance = float(memory.get("importance", 0.5))
        recency = _recency(memory, now)
        frequency = min(1.0, math.log1p(int(memory.get("accessCount", 0))) / math.log(11))
        critical = 1.0 if memory.get("kind") in {"preference", "goal"} else 0.0
        score = (
            0.50 * semantic
            + 0.15 * lexical
            + 0.15 * importance
            + 0.10 * recency
            + 0.05 * frequency
            + 0.05 * critical
        )
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

    header = "Relevant long-term learner memory (use only when helpful; current user input wins):"
    lines = [header]
    selected: list[dict] = []
    for memory in ordered:
        if len(selected) >= result_limit:
            break
        line = f"- [{memory.get('kind')} | {memory.get('id')}] {memory.get('content', '')}"
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


def record_practice_outcome_memory(
    *,
    user_id: str,
    skill_code: str,
    exercise_type: str,
    score: int,
    is_correct: bool,
    attempt_id: str,
    created_at: str,
) -> list[dict]:
    """Accumulate empirical strategy effectiveness and a short-lived episode."""
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
    _enforce_capacity(user_id)
    return [public_memory(memory), *episodic]
