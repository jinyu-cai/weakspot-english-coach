"""Hidden, evidence-gated practice scheduling for persistent learner weaknesses.

The coach may create a natural opportunity to use a previously weak skill, but
the learner is never told that a probe is active.  Retention and modality
mastery change only when the end-of-session analysis confirms that a real
opportunity occurred.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
import hashlib
import math
import re
from typing import Optional
from uuid import uuid4

from app.db.repositories import get_memory, list_memories
from app.services.memory_service import iso_at, normalize_canonical_key, parse_iso, public_memory, utc_now
from app.services.memory_write_service import memory_write_locked, save_memory


PROBE_HISTORY_LIMIT = 20
NO_OPPORTUNITY_COOLDOWN_HOURS = 12
STRATEGY_ARMS = ("personal_story", "roleplay", "opinion_followup", "retell")
INTERACTION_MOVES = (
    "meaning_recast",
    "confirmation_check",
    "clarification_request",
    "content_extension",
)
VALID_OUTCOMES = {"success", "hinted_success", "failure", "avoided", "no_opportunity"}
SAFE_GENERATION_SKILL_CODES = {
    "grammar.verb_tense",
    "grammar.article",
    "grammar.preposition",
    "grammar.subject_verb_agreement",
    "vocab.word_choice",
    "vocab.repetition",
    "sentence.structure",
    "sentence.variety",
    "discourse.coherence",
    "style.register",
    "clarity.expression",
}
MODALITY_ALIASES = {
    "text": "text_chat",
    "chat": "text_chat",
    "realtime": "voice",
    "spoken": "voice",
    "practice": "exercise",
}


def _as_now(value: Optional[datetime | str]) -> datetime:
    if isinstance(value, datetime):
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)
    if isinstance(value, str):
        return parse_iso(value) or utc_now()
    return utc_now()


def _clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))


def _tokens(value: str) -> set[str]:
    return set(re.findall(r"[a-z0-9][a-z0-9_.-]*", (value or "").lower()))


def _topic_overlap(topic: Optional[str], memory: dict, goals: list[dict]) -> float:
    if not topic:
        return 0.5
    topic_tokens = _tokens(topic)
    if not topic_tokens:
        return 0.5
    memory_text = " ".join(
        str(memory.get(key) or "")
        for key in ("content", "evidence", "canonicalKey")
    )
    goal_text = " ".join(str(goal.get("content") or "") for goal in goals)
    candidate_tokens = _tokens(f"{memory_text} {goal_text}")
    overlap = len(topic_tokens & candidate_tokens) / max(1, math.sqrt(len(topic_tokens) * max(1, len(candidate_tokens))))
    # Grammar and discourse skills are broadly elicitable even when the topic
    # does not share literal words with the stored evidence.
    raw_fingerprint = memory.get("errorFingerprint")
    fingerprint = raw_fingerprint if isinstance(raw_fingerprint, dict) else {}
    code = str(fingerprint.get("skillCode") or memory.get("canonicalKey") or "")
    broad_fit = 0.6 if code.startswith(("grammar.", "sentence.", "discourse.", "clarity.")) else 0.35
    return round(_clamp(max(overlap, broad_fit), 0.0, 1.0), 4)


def _retention_state(memory: dict, now: datetime) -> dict:
    current = dict(memory.get("retention") or {})
    stability = _clamp(float(current.get("stabilityDays", 1.0)), 0.25, 365.0)
    difficulty = _clamp(float(current.get("difficulty", 5.0)), 1.0, 10.0)
    due_at = parse_iso(current.get("dueAt")) or now
    overdue_days = max(0.0, (now - due_at).total_seconds() / 86400)
    scheduled_interval = max(0.5, stability)
    computed_risk = 1.0 - math.exp(-overdue_days / scheduled_interval) if overdue_days else 0.0
    return {
        **current,
        "stabilityDays": round(stability, 3),
        "difficulty": round(difficulty, 3),
        "dueAt": iso_at(due_at),
        "relapseRisk": round(_clamp(max(float(current.get("relapseRisk", 0.35)), computed_risk), 0.0, 1.0), 4),
        "attempts": int(current.get("attempts", 0)),
        "successes": int(current.get("successes", 0)),
        "hintedSuccesses": int(current.get("hintedSuccesses", 0)),
        "failures": int(current.get("failures", 0)),
        "avoided": int(current.get("avoided", 0)),
    }


def _skill_code(memory: dict) -> str:
    raw_fingerprint = memory.get("errorFingerprint")
    fingerprint = raw_fingerprint if isinstance(raw_fingerprint, dict) else {}
    if fingerprint.get("skillCode"):
        return str(fingerprint["skillCode"])
    key = str(memory.get("canonicalKey") or "")
    for prefix in ("weakness.", "weakness:"):
        if key.startswith(prefix):
            return key[len(prefix):]
    return key or "clarity.expression"


def _fingerprint(memory: dict) -> dict:
    raw_fingerprint = memory.get("errorFingerprint")
    fingerprint = dict(raw_fingerprint) if isinstance(raw_fingerprint, dict) else {}
    if isinstance(raw_fingerprint, str) and raw_fingerprint.strip():
        fingerprint["description"] = raw_fingerprint.strip()[:400]
    evidence = str(memory.get("evidence") or "")
    if "→" in evidence:
        original, corrected = (part.strip() for part in evidence.split("→", 1))
    elif "->" in evidence:
        original, corrected = (part.strip() for part in evidence.split("->", 1))
    else:
        original, corrected = evidence.strip(), ""
    fingerprint.setdefault("skillCode", _skill_code(memory))
    fingerprint.setdefault("originalExamples", [original] if original else [])
    fingerprint.setdefault("correctedExamples", [corrected] if corrected else [])
    fingerprint.setdefault("contexts", [])
    return fingerprint


def _modality_state(memory: dict, modality: str) -> dict:
    state = dict((memory.get("modalityMastery") or {}).get(modality) or {})
    return {
        **state,
        "mastery": round(_clamp(float(state.get("mastery", 35.0)), 0.0, 100.0), 2),
        "attempts": int(state.get("attempts", 0)),
        "coldSuccesses": int(state.get("coldSuccesses", 0)),
        "hintedSuccesses": int(state.get("hintedSuccesses", 0)),
        "failures": int(state.get("failures", 0)),
        "avoided": int(state.get("avoided", 0)),
    }


def _progression_stage(memory: dict) -> str:
    """Advance only on independent use, never on visible guided exercises."""
    cold_rows = [
        row for row in list(memory.get("probeHistory") or [])
        if row.get("outcome") == "success"
        and str(row.get("elicitationStrategy") or "") != "guided_practice"
    ]
    contexts = {
        str(row.get("context") or "").strip().lower()
        for row in cold_rows
        if str(row.get("context") or "").strip()
    }
    modalities = {str(row.get("modality") or "") for row in cold_rows if row.get("modality")}
    if not cold_rows:
        return "replay"
    if len(cold_rows) < 2 or len(contexts) < 2:
        return "variation"
    if len(contexts) >= 2 and len(modalities) >= 1:
        return "transfer"
    return "variation"


def _strategy_stats(memories: list[dict], skill_code: str, arm: str) -> tuple[int, float]:
    canonical = normalize_canonical_key("strategy", f"stealth.{skill_code}.{arm}")
    row = next((item for item in memories if item.get("canonicalKey") == canonical), None)
    stats = dict((row or {}).get("stats") or {})
    attempts = int(stats.get("attempts", 0))
    reward = float(stats.get("totalReward", 0.0))
    return attempts, reward


def _choose_strategy(memories: list[dict], skill_code: str) -> str:
    arm_stats = {arm: _strategy_stats(memories, skill_code, arm) for arm in STRATEGY_ARMS}
    total_attempts = sum(attempts for attempts, _ in arm_stats.values())
    best_arm = STRATEGY_ARMS[0]
    best_score = float("-inf")
    # UCB learns which natural conversational setup gives this learner usable
    # opportunities, while still trying under-observed approaches.
    for arm in STRATEGY_ARMS:
        attempts, total_reward = arm_stats[arm]
        if attempts == 0:
            score = 2.0
        else:
            mean_reward = total_reward / attempts
            exploration = math.sqrt(2.0 * math.log(max(2, total_attempts)) / attempts)
            score = mean_reward + exploration
        # Stable tie-breaking avoids random behavior in tests and deployments.
        tie_break = int(hashlib.sha256(f"{skill_code}:{arm}".encode()).hexdigest()[:4], 16) / 65535 / 1000
        score += tie_break
        if score > best_score:
            best_arm, best_score = arm, score
    return best_arm


def _interaction_move_stats(
    memories: list[dict],
    skill_code: str,
    interaction_move: str,
) -> tuple[int, float]:
    """Aggregate one conversational move across every setup arm for a skill."""

    attempts = 0
    total_reward = 0.0
    for memory in memories:
        stats = memory.get("stats")
        if not isinstance(stats, dict) or stats.get("skillCode") != skill_code:
            continue
        raw_interaction_moves = stats.get("interactionMoves")
        if not isinstance(raw_interaction_moves, dict):
            continue
        move_stats = raw_interaction_moves.get(interaction_move)
        if not isinstance(move_stats, dict):
            continue
        attempts += int(move_stats.get("attempts", 0))
        total_reward += float(move_stats.get("totalReward", 0.0))
    return attempts, total_reward


def _choose_interaction_move(
    memories: list[dict],
    skill_code: str,
    excluded_moves: set[str],
) -> str:
    """Rotate implicit feedback moves while learning which ones create uptake."""

    candidates = [move for move in INTERACTION_MOVES if move not in excluded_moves]
    if not candidates:
        candidates = list(INTERACTION_MOVES)
    move_stats = {
        move: _interaction_move_stats(memories, skill_code, move)
        for move in candidates
    }
    total_attempts = sum(attempts for attempts, _ in move_stats.values())
    best_move = candidates[0]
    best_score = float("-inf")
    for move in candidates:
        attempts, total_reward = move_stats[move]
        if attempts == 0:
            score = 2.0
        else:
            mean_reward = total_reward / attempts
            exploration = math.sqrt(2.0 * math.log(max(2, total_attempts)) / attempts)
            score = mean_reward + exploration
        tie_break = (
            int(hashlib.sha256(f"{skill_code}:{move}".encode()).hexdigest()[:4], 16)
            / 65535
            / 1000
        )
        score += tie_break
        if score > best_score:
            best_move, best_score = move, score
    return best_move


def select_stealth_probe(
    user_id: str,
    modality: str = "text_chat",
    topic: Optional[str] = None,
    now: Optional[datetime | str] = None,
    exclude_memory_ids: Optional[set[str]] = None,
    exclude_skill_codes: Optional[set[str]] = None,
    exclude_interaction_moves: Optional[set[str]] = None,
) -> Optional[dict]:
    """Choose one explainable hidden target without mutating learner state."""
    current = _as_now(now)
    normalized_modality = MODALITY_ALIASES.get(modality, modality or "text_chat")
    excluded_memories = {str(value) for value in (exclude_memory_ids or set()) if value}
    excluded_skills = {str(value) for value in (exclude_skill_codes or set()) if value}
    excluded_moves = {
        str(value) for value in (exclude_interaction_moves or set()) if value
    }
    memories = list_memories(user_id, limit=500)
    weaknesses = [
        item for item in memories
        if item.get("kind") == "weakness" and item.get("status", "active") == "active"
        and str(item.get("id") or "") not in excluded_memories
        and _skill_code(item) not in excluded_skills
    ]
    if not weaknesses:
        return None
    goals = [item for item in memories if item.get("kind") == "goal" and item.get("status", "active") == "active"]

    ranked: list[tuple[float, dict, dict]] = []
    for memory in weaknesses:
        stored_due_at = parse_iso((memory.get("retention") or {}).get("dueAt"))
        # A scheduled future review is protected from over-testing. Memories
        # created before retention scheduling have no dueAt and remain eligible.
        if stored_due_at is not None and stored_due_at > current:
            continue
        retention = _retention_state(memory, current)
        modality_state = _modality_state(memory, normalized_modality)
        last_seen = parse_iso(memory.get("lastObservedAt") or memory.get("updatedAt") or memory.get("createdAt")) or current
        staleness_days = max(0.0, (current - last_seen).total_seconds() / 86400)
        history = list(memory.get("probeHistory") or [])
        recent_probes = [
            row for row in history
            if (stamp := parse_iso(row.get("createdAt"))) is not None
            and (current - stamp).total_seconds() < 7 * 86400
        ]
        dated_history = [
            (stamp, row)
            for row in history
            if (stamp := parse_iso(row.get("createdAt"))) is not None
        ]
        last_probe, last_probe_event = max(
            dated_history,
            key=lambda item: item[0],
            default=(None, None),
        )
        hours_since_probe = (current - last_probe).total_seconds() / 3600 if last_probe else 999.0
        # A no-op means the setup did not create a fair chance to use the
        # target. Keep the weakness due, but do not immediately aim at the same
        # hidden target again in the learner's next session.
        if (
            last_probe_event
            and last_probe_event.get("outcome") == "no_opportunity"
            and hours_since_probe < NO_OPPORTUNITY_COOLDOWN_HOURS
        ):
            continue
        fatigue_penalty = min(1.0, len(recent_probes) / 4.0) + (0.6 if hours_since_probe < 12 else 0.0)
        opportunity_fit = _topic_overlap(topic, memory, goals)
        goal_relevance = opportunity_fit if goals else 0.45
        uncertainty = 1.0 - float(memory.get("confidence", 0.7))
        transfer_count = len(memory.get("transferContexts") or [])
        progression_stage = _progression_stage(memory)
        stage_need = {"replay": 0.15, "variation": 0.25, "transfer": 0.35}[progression_stage]
        transfer_need = _clamp(
            (100.0 - modality_state["mastery"]) / 100.0
            + (0.25 if transfer_count < 2 else 0.0)
            + stage_need,
            0.0,
            1.0,
        )
        relapse_risk = float(retention["relapseRisk"])
        staleness = _clamp(staleness_days / 30.0, 0.0, 1.0)
        score_breakdown = {
            "relapseRisk": round(relapse_risk, 4),
            "uncertainty": round(uncertainty, 4),
            "goalRelevance": round(goal_relevance, 4),
            "opportunityFit": round(opportunity_fit, 4),
            "staleness": round(staleness, 4),
            "transferNeed": round(transfer_need, 4),
            "fatiguePenalty": round(fatigue_penalty, 4),
        }
        priority = (
            0.28 * relapse_risk
            + 0.12 * uncertainty
            + 0.15 * goal_relevance
            + 0.18 * opportunity_fit
            + 0.10 * staleness
            + 0.22 * transfer_need
            - 0.18 * fatigue_penalty
        )
        ranked.append((priority, memory, score_breakdown))

    if not ranked:
        return None
    priority, memory, score_breakdown = max(ranked, key=lambda item: (item[0], item[1].get("importance", 0)))
    skill_code = _skill_code(memory)
    fingerprint = _fingerprint(memory)
    strategy = _choose_strategy(memories, skill_code)
    interaction_move = _choose_interaction_move(memories, skill_code, excluded_moves)
    progression_stage = _progression_stage(memory)
    top_goal = max(goals, key=lambda row: float(row.get("importance", 0.0)), default=None)
    goal_context = str((top_goal or {}).get("content") or "").strip()
    context = (topic or goal_context or "general conversation").strip()
    return {
        "probeId": f"spr_{uuid4().hex[:12]}",
        "memoryId": memory["id"],
        "targetSkillCode": skill_code,
        "targetDescription": str(memory.get("content") or f"Use {skill_code} naturally."),
        "errorFingerprint": fingerprint,
        "modality": normalized_modality,
        "context": context[:200],
        "goalContext": goal_context[:300] or None,
        "elicitationStrategy": strategy,
        "interactionMove": interaction_move,
        "progressionStage": progression_stage,
        "priority": round(priority, 4),
        "scoreBreakdown": score_breakdown,
        "createdAt": iso_at(current),
    }


def _skill_elicitation_brief(skill_code: str) -> str:
    """Describe a skill family without replaying private error examples."""

    return {
        "grammar.verb_tense": (
            "If the learner is already discussing time or events, one natural follow-up may invite "
            "them to describe what happened, what usually happens, or what will happen."
        ),
        "grammar.article": (
            "If the current topic naturally calls for concrete people, places, or objects, invite a "
            "little more specific detail."
        ),
        "grammar.preposition": (
            "If the learner is already describing time, place, movement, or a relationship, invite one "
            "useful detail about it."
        ),
        "grammar.subject_verb_agreement": (
            "If it follows naturally, ask about a person, group, habit, or routine in the current topic."
        ),
        "vocab.word_choice": (
            "Let the learner explain the current idea in their own words. Never seed a desired word, "
            "spelling, capitalization, brand, product, person, or place name."
        ),
        "vocab.repetition": (
            "If the learner is already expanding an idea, invite a fresh detail without suggesting "
            "replacement vocabulary."
        ),
        "sentence.structure": (
            "If useful for the real conversation, invite the learner to connect a reason, contrast, "
            "condition, or result to what they just said."
        ),
        "sentence.variety": (
            "Invite one slightly fuller response only when a normal conversational follow-up calls for it."
        ),
        "discourse.coherence": (
            "If the learner is explaining several ideas or events, ask for the next step, reason, or "
            "connection that a real listener would want to know."
        ),
        "style.register": (
            "Only if the current situation already has a clear audience or relationship, let the learner "
            "choose naturally how formal or casual to sound."
        ),
        "clarity.expression": (
            "Ask for clarification only when something in the learner's current message genuinely needs it."
        ),
    }.get(
        skill_code,
        "Observe the skill in the learner's spontaneous reply; do not steer the topic to manufacture it.",
    )


def build_stealth_probe_instruction(probe: Optional[dict]) -> str:
    """Build a private, one-turn and context-gated elicitation prompt."""
    if not probe:
        return ""
    strategy = probe.get("elicitationStrategy", "opinion_followup")
    interaction_move = probe.get("interactionMove", "content_extension")
    stage = probe.get("progressionStage", "replay")
    strategy_instruction = {
        "personal_story": "A personal follow-up is allowed only when it is already the obvious next question.",
        "roleplay": "Continue a role-play only when the conversation is already in one; never start an unrelated scene.",
        "opinion_followup": "An opinion follow-up is allowed only when it directly responds to the learner's point.",
        "retell": "A retell or sequence question is allowed only when the learner is already discussing an event or process.",
    }.get(strategy, "Use at most one follow-up, and only when it is the natural next conversational move.")
    interaction_instruction = {
        "meaning_recast": (
            "If the learner's current message actually contains the target pattern and their meaning is clear, "
            "briefly reflect that meaning once in natural English, then respond to the content. Do not identify, "
            "explain, emphasize, or quote the error, and do not ask them to repeat your wording."
        ),
        "confirmation_check": (
            "Only when the intended meaning is plausible but genuinely needs confirmation, confirm it once using "
            "natural wording. The check must resolve meaning, not test grammar."
        ),
        "clarification_request": (
            "Only when a real listener would not understand an important detail, ask one short content-level "
            "clarification question that lets the learner repair the message in their own words."
        ),
        "content_extension": (
            "Respond to the meaning and, only if it fits, model the target family once in a new sentence that "
            "extends the same topic. A follow-up is optional; never force one merely to test the learner."
        ),
    }.get(
        str(interaction_move),
        "Use one brief, meaning-focused conversational move only when it naturally advances the live exchange.",
    )
    stage_instruction = {
        "replay": "Stay entirely inside the live conversation; do not recreate the stored mistake or its old setting.",
        "variation": "Use only details the learner introduced in this conversation; do not borrow old examples.",
        "transfer": "Observe transfer in this live context without introducing a remembered topic.",
    }.get(stage, "Use only the live conversation as context.")
    skill_code = str(probe.get("targetSkillCode") or "clarity.expression")
    generation_skill_code = (
        skill_code if skill_code in SAFE_GENERATION_SKILL_CODES else "general language production"
    )
    return (
        "Optional hidden practice check for this reply only (never reveal or mention it):\n"
        "First answer the learner's actual message directly, accurately, and completely. The real conversation "
        "always takes priority over this optional check.\n"
        f"Target skill family: {generation_skill_code}. {_skill_elicitation_brief(skill_code)}\n"
        f"Progression stage: {stage}. {stage_instruction}\n"
        f"Use only the live roleplay and conversation messages below as context. {strategy_instruction}\n"
        f"Assigned interaction move: {interaction_move}. {interaction_instruction}\n"
        "Naturalness gate: silently skip the check unless the assigned move is what a thoughtful human conversation "
        "partner would naturally do next. Skip it if it needs a generic topic-changing segue such as 'by the way', "
        "an unrelated named entity, a return to an earlier topic, fake confusion, or a second follow-up after answering. "
        "It is correct to create no practice opportunity in this reply.\n"
        "Never copy or paraphrase stored evidence, old examples, a remembered correction, or an unrelated learner "
        "goal. Never introduce a product, platform, brand, person, or place merely to test spelling or capitalization. "
        "Do not ask for a named grammar rule or saved phrase. Do not announce a test, weakness, memory, score, or "
        "correction. Use at most one short practice-bearing conversational move; it does not have to be a question. "
        "Keep ordinary errors uncorrected until end-of-session analysis."
    )


def _strategy_reward(outcome: str) -> float:
    return {
        "success": 1.0,
        "hinted_success": 0.65,
        "failure": 0.35,
        "avoided": 0.1,
        "no_opportunity": 0.0,
    }.get(outcome, 0.0)


def _record_strategy_result(user_id: str, probe: dict, outcome: str, now: datetime) -> None:
    arm = str(probe.get("elicitationStrategy") or "opinion_followup")
    skill_code = str(probe.get("targetSkillCode") or "clarity.expression")
    canonical = normalize_canonical_key("strategy", f"stealth.{skill_code}.{arm}")
    rows = list_memories(user_id, limit=500)
    existing = next((item for item in rows if item.get("canonicalKey") == canonical and item.get("status", "active") == "active"), None)
    probe_id = str(probe.get("probeId") or "stealth-practice")
    if existing and any(
        str(ref.get("sourceId") or "") == probe_id
        for ref in existing.get("sourceRefs") or []
    ):
        return
    row = dict(existing or {})
    stats = dict(row.get("stats") or {})
    attempts = int(stats.get("attempts", 0)) + 1
    total_reward = float(stats.get("totalReward", 0.0)) + _strategy_reward(outcome)
    opportunities = int(stats.get("opportunities", 0)) + (0 if outcome == "no_opportunity" else 1)
    interaction_move = str(probe.get("interactionMove") or "content_extension")
    raw_interaction_moves = stats.get("interactionMoves")
    interaction_moves = (
        dict(raw_interaction_moves) if isinstance(raw_interaction_moves, dict) else {}
    )
    move_stats = dict(interaction_moves.get(interaction_move) or {})
    move_attempts = int(move_stats.get("attempts", 0)) + 1
    move_total_reward = float(move_stats.get("totalReward", 0.0)) + _strategy_reward(outcome)
    move_opportunities = int(move_stats.get("opportunities", 0)) + (
        0 if outcome == "no_opportunity" else 1
    )
    interaction_moves[interaction_move] = {
        "attempts": move_attempts,
        "opportunities": move_opportunities,
        "totalReward": round(move_total_reward, 4),
        "meanReward": round(move_total_reward / move_attempts, 4),
        "lastOutcome": outcome,
        "lastAttemptAt": iso_at(now),
    }
    now_text = iso_at(now)
    if not row:
        row = {
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
    row.update({
        "content": (
            f"For {skill_code}, the {arm} stealth-practice setup has produced "
            f"{opportunities} usable opportunity/opportunities in {attempts} attempt(s)."
        ),
        "evidence": f"Latest hidden-practice outcome: {outcome}.",
        "confidence": round(min(0.95, 0.55 + 0.07 * math.sqrt(attempts)), 4),
        "importance": 0.68,
        "status": "active",
        "sourceType": "system",
        "sourceId": probe_id,
        "updatedAt": now_text,
        "observationCount": int(row.get("observationCount", 0)) + 1,
        "stats": {
            "skillCode": skill_code,
            "elicitationStrategy": arm,
            "attempts": attempts,
            "opportunities": opportunities,
            "totalReward": round(total_reward, 4),
            "meanReward": round(total_reward / attempts, 4),
            "lastOutcome": outcome,
            "lastAttemptAt": now_text,
            "interactionMoves": interaction_moves,
        },
        "expiresAt": iso_at(now + timedelta(days=180)),
        "ttl": int((now + timedelta(days=210)).timestamp()),
    })
    refs = list(row.get("sourceRefs") or [])
    refs.append({
        "sourceType": "system",
        "sourceId": row["sourceId"],
        "evidence": row["evidence"],
        "createdAt": now_text,
    })
    row["sourceRefs"] = refs[-12:]
    save_memory(row)


def _summary(
    probe: dict,
    assessment: dict,
    *,
    state_changed: bool,
    next_review_at: Optional[str],
    mastery_before: Optional[float],
    mastery_after: Optional[float],
) -> dict:
    outcome = assessment.get("outcome", "no_opportunity")
    labels = {
        "success": "你在自然对话中独立用对了",
        "hinted_success": "你在轻微提示后用对了",
        "failure": "这次真实场景仍暴露了同一弱点",
        "avoided": "你绕开了这个表达机会，系统会换一种更自然的方式再验证",
        "no_opportunity": "本次没有形成公平的使用机会，因此不会改变掌握度",
    }
    return {
        "probeId": probe.get("probeId"),
        "memoryId": probe.get("memoryId"),
        "targetSkillCode": probe.get("targetSkillCode"),
        "targetDescription": probe.get("targetDescription"),
        "modality": probe.get("modality"),
        "context": probe.get("context"),
        "elicitationStrategy": probe.get("elicitationStrategy"),
        "interactionMove": probe.get("interactionMove"),
        "progressionStage": probe.get("progressionStage", "replay"),
        "outcome": outcome,
        "messageZh": labels.get(outcome, labels["no_opportunity"]),
        "opportunityPresent": bool(assessment.get("opportunityPresent")),
        "evidenceQuote": str(assessment.get("evidenceQuote") or "")[:500],
        "rationale": str(assessment.get("rationale") or "")[:800],
        "confidence": round(_clamp(float(assessment.get("confidence", 0.0)), 0.0, 1.0), 4),
        "hintLevel": int(assessment.get("hintLevel", 0) or 0),
        "stateChanged": state_changed,
        "nextReviewAt": next_review_at,
        "masteryBefore": mastery_before,
        "masteryAfter": mastery_after,
    }


@memory_write_locked
def record_stealth_probe_outcome(
    user_id: str,
    probe: dict,
    assessment: dict,
    now: Optional[datetime | str] = None,
) -> dict:
    """Persist one gated outcome and return the post-session learner summary."""
    current = _as_now(now)
    payload = assessment.model_dump(mode="json") if hasattr(assessment, "model_dump") else dict(assessment or {})
    outcome = str(payload.get("outcome") or "no_opportunity")
    if outcome not in VALID_OUTCOMES:
        outcome = "no_opportunity"
    reliable_evidence = (
        float(payload.get("confidence", 0.0)) >= 0.6
        and bool(str(payload.get("evidenceQuote") or "").strip())
    )
    if not payload.get("opportunityPresent") or (outcome != "no_opportunity" and not reliable_evidence):
        outcome = "no_opportunity"
    payload["outcome"] = outcome
    payload["opportunityPresent"] = outcome != "no_opportunity"

    memory = get_memory(user_id, str(probe.get("memoryId") or ""))
    if not memory or memory.get("kind") != "weakness":
        return _summary(
            probe, payload, state_changed=False, next_review_at=None,
            mastery_before=None, mastery_after=None,
        )

    modality = MODALITY_ALIASES.get(str(probe.get("modality") or "text_chat"), str(probe.get("modality") or "text_chat"))
    previous_modality = _modality_state(memory, modality)
    mastery_before = float(previous_modality["mastery"])
    retention = _retention_state(memory, current)
    prior_event = next(
        (
            row for row in memory.get("probeHistory") or []
            if row.get("probeId") == probe.get("probeId")
        ),
        None,
    )
    if prior_event:
        prior_payload = {
            **payload,
            "opportunityPresent": bool(prior_event.get("opportunityPresent")),
            "outcome": prior_event.get("outcome", "no_opportunity"),
            "evidenceQuote": prior_event.get("evidenceQuote", ""),
            "confidence": prior_event.get("confidence", 0.0),
            "hintLevel": prior_event.get("hintLevel", 0),
        }
        return _summary(
            probe,
            prior_payload,
            # This invocation is idempotent, but the probe itself did apply a
            # learning update. Preserve that stable result for a session whose
            # later memory/finalization step is being retried.
            state_changed=prior_event.get("outcome") != "no_opportunity",
            next_review_at=prior_event.get("nextReviewAt") or retention.get("dueAt"),
            mastery_before=prior_event.get("masteryBefore", mastery_before),
            mastery_after=prior_event.get("masteryAfter", mastery_before),
        )

    # Strategy learning is intentionally separate from learner mastery: a
    # failed opportunity setup can be retired without pretending the learner
    # succeeded or failed a skill they never had a fair chance to use.
    if probe.get("elicitationStrategy") != "guided_practice":
        _record_strategy_result(user_id, probe, outcome, current)

    if outcome == "no_opportunity":
        # Audit the attempted setup so the scheduler can cool this target down,
        # while deliberately leaving learner retention and modality mastery
        # untouched. The probe ID also makes a retried analysis idempotent.
        memory = dict(memory)
        now_text = iso_at(current)
        history = [
            row for row in list(memory.get("probeHistory") or [])
            if row.get("probeId") != probe.get("probeId")
        ]
        history.append({
            "probeId": probe.get("probeId"),
            "createdAt": now_text,
            "modality": modality,
            "context": probe.get("context"),
            "elicitationStrategy": probe.get("elicitationStrategy"),
            "interactionMove": probe.get("interactionMove"),
            "progressionStage": probe.get("progressionStage", "replay"),
            "outcome": "no_opportunity",
            "opportunityPresent": False,
            "evidenceQuote": "",
            "confidence": round(_clamp(float(payload.get("confidence", 0.0)), 0.0, 1.0), 4),
            "hintLevel": int(payload.get("hintLevel", 0) or 0),
        })
        memory["probeHistory"] = history[-PROBE_HISTORY_LIMIT:]
        memory["lastProbeAttemptAt"] = now_text
        memory["updatedAt"] = now_text
        save_memory(memory)
        return _summary(
            probe, payload, state_changed=False,
            next_review_at=retention.get("dueAt"),
            mastery_before=mastery_before, mastery_after=mastery_before,
        )

    memory = dict(memory)
    now_text = iso_at(current)
    old_stability = float(retention["stabilityDays"])
    old_difficulty = float(retention["difficulty"])
    mastery_delta = 0.0
    if outcome == "success":
        stability = min(365.0, max(1.0, old_stability * 2.2 + 0.5))
        difficulty = old_difficulty - 0.35
        relapse_risk = max(0.08, float(retention["relapseRisk"]) * 0.55)
        mastery_delta = 9.0
        retention["successes"] += 1
        retention["lastColdRecallAt"] = now_text
    elif outcome == "hinted_success":
        stability = min(365.0, max(0.75, old_stability * 1.3))
        difficulty = old_difficulty - 0.1
        relapse_risk = max(0.2, float(retention["relapseRisk"]) * 0.82)
        mastery_delta = 3.5
        retention["hintedSuccesses"] += 1
    elif outcome == "avoided":
        stability = max(0.25, old_stability * 0.75)
        difficulty = old_difficulty + 0.35
        relapse_risk = max(0.72, float(retention["relapseRisk"]))
        mastery_delta = -4.0
        retention["avoided"] += 1
    else:
        stability = max(0.25, old_stability * 0.5)
        difficulty = old_difficulty + 0.6
        relapse_risk = max(0.85, float(retention["relapseRisk"]))
        mastery_delta = -7.0
        retention["failures"] += 1

    retention.update({
        "stabilityDays": round(stability, 3),
        "difficulty": round(_clamp(difficulty, 1.0, 10.0), 3),
        "dueAt": iso_at(current + timedelta(days=stability)),
        "lastOutcome": outcome,
        "lastReviewedAt": now_text,
        "relapseRisk": round(_clamp(relapse_risk, 0.0, 1.0), 4),
        "attempts": int(retention.get("attempts", 0)) + 1,
    })
    memory["retention"] = retention

    modality_state = dict(previous_modality)
    modality_state["attempts"] += 1
    modality_state["mastery"] = round(_clamp(mastery_before + mastery_delta, 0.0, 100.0), 2)
    if outcome == "success":
        modality_state["coldSuccesses"] += 1
    elif outcome == "hinted_success":
        modality_state["hintedSuccesses"] += 1
    elif outcome == "avoided":
        modality_state["avoided"] += 1
    else:
        modality_state["failures"] += 1
    modality_state.update({
        "lastOutcome": outcome,
        "lastEvidenceAt": now_text,
        "lastEvidenceQuote": str(payload.get("evidenceQuote") or "")[:300],
    })
    modality_mastery = dict(memory.get("modalityMastery") or {})
    modality_mastery[modality] = modality_state
    memory["modalityMastery"] = modality_mastery

    history = [row for row in list(memory.get("probeHistory") or []) if row.get("probeId") != probe.get("probeId")]
    history.append({
        "probeId": probe.get("probeId"),
        "createdAt": now_text,
        "modality": modality,
        "context": probe.get("context"),
        "elicitationStrategy": probe.get("elicitationStrategy"),
        "interactionMove": probe.get("interactionMove"),
        "progressionStage": probe.get("progressionStage", "replay"),
        "outcome": outcome,
        "opportunityPresent": True,
        "evidenceQuote": str(payload.get("evidenceQuote") or "")[:300],
        "confidence": round(_clamp(float(payload.get("confidence", 0.0)), 0.0, 1.0), 4),
        "hintLevel": int(payload.get("hintLevel", 0) or 0),
        "nextReviewAt": retention["dueAt"],
        "masteryBefore": round(mastery_before, 2),
        "masteryAfter": modality_state["mastery"],
    })
    memory["probeHistory"] = history[-PROBE_HISTORY_LIMIT:]
    memory["progressionStage"] = _progression_stage(memory)

    contexts = list(memory.get("transferContexts") or [])
    context = str(probe.get("context") or "").strip()
    if outcome == "success" and context and context.lower() not in {str(item).lower() for item in contexts}:
        contexts.append(context[:200])
    memory["transferContexts"] = contexts[-12:]

    if outcome in {"failure", "avoided"}:
        memory["lastObservedAt"] = now_text
        if memory.get("status") == "resolved":
            memory["status"] = "active"
            memory["reopenedCount"] = int(memory.get("reopenedCount", 0)) + 1
            memory.pop("resolvedAt", None)
            memory.pop("resolutionReason", None)
        graduation = dict(memory.get("graduation") or {})
        graduation.update({"state": "collecting", "eligible": False, "lastObservedAt": now_text})
        memory["graduation"] = graduation

    memory["updatedAt"] = now_text
    if memory.get("pinned"):
        memory["expiresAt"] = None
        memory.pop("ttl", None)
    else:
        memory["expiresAt"] = iso_at(current + timedelta(days=180))
        memory["ttl"] = int((current + timedelta(days=210)).timestamp())
    save_memory(memory)
    return _summary(
        probe,
        payload,
        state_changed=True,
        next_review_at=retention["dueAt"],
        mastery_before=round(mastery_before, 2),
        mastery_after=modality_state["mastery"],
    )


def record_guided_practice_retention(
    user_id: str,
    skill_code: str,
    score: int,
    is_correct: bool,
    modality: str = "exercise",
    context: Optional[str] = None,
    attempt_id: Optional[str] = None,
    now: Optional[datetime | str] = None,
) -> Optional[dict]:
    """Feed normal exercises into retention as prompted, not cold, evidence."""
    canonical = normalize_canonical_key("weakness", f"weakness.{skill_code}")
    matches = [
        row for row in list_memories(user_id, limit=500)
        if row.get("canonicalKey") == canonical and row.get("status", "active") in {"active", "resolved"}
    ]
    memory = max(matches, key=lambda row: row.get("updatedAt", ""), default=None)
    if not memory:
        return None
    current = _as_now(now)
    stable_probe_id = (
        "guided_"
        + hashlib.sha256(
            f"{user_id}\0{attempt_id}".encode("utf-8")
        ).hexdigest()[:20]
        if attempt_id
        else f"guided_{uuid4().hex[:12]}"
    )
    probe = {
        "probeId": stable_probe_id,
        "memoryId": memory["id"],
        "targetSkillCode": skill_code,
        "targetDescription": memory.get("content"),
        "modality": MODALITY_ALIASES.get(modality, modality),
        "context": (context or "guided exercise")[:200],
        "elicitationStrategy": "guided_practice",
        "interactionMove": "explicit_scaffold",
        "progressionStage": _progression_stage(memory),
        "createdAt": iso_at(current),
    }
    assessment = {
        "opportunityPresent": True,
        "outcome": "hinted_success" if is_correct else "failure",
        "evidenceQuote": f"Guided practice score: {int(score)}/100.",
        "rationale": "A visible exercise is prompted evidence, so it cannot count as cold recall.",
        "confidence": 1.0,
        "hintLevel": 1,
    }
    return record_stealth_probe_outcome(user_id, probe, assessment, now=current)


def stealth_practice_summary(history: list[dict]) -> dict:
    """Aggregate revealed post-session results without exposing active probes."""
    rows = [row for row in (history or []) if isinstance(row, dict)]
    counts = {outcome: 0 for outcome in VALID_OUTCOMES}
    for row in rows:
        outcome = str(row.get("outcome") or "no_opportunity")
        counts[outcome if outcome in counts else "no_opportunity"] += 1
    assessed = sum(counts[name] for name in ("success", "hinted_success", "failure", "avoided"))
    successes = counts["success"] + counts["hinted_success"]
    return {
        "total": len(rows),
        "assessed": assessed,
        "successes": successes,
        "coldSuccesses": counts["success"],
        "successRate": round(successes / assessed, 4) if assessed else None,
        "outcomes": counts,
        "latest": rows[-1] if rows else None,
    }
