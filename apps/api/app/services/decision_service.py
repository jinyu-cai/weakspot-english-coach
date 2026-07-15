"""Explainable next-practice policy that improves from learner outcomes."""

from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime, timezone
import math
from typing import Optional

from app.core.mastery import DEFAULT_MASTERY
from app.db.repositories import (
    list_recent_errors,
    list_recent_practice_attempts,
    list_skills,
)
from app.services.memory_service import parse_iso, snapshot_active_memory_records


PRACTICE_TYPES = ("fix_sentence", "fill_blank", "rewrite_sentence")
DEFAULT_SKILL = "grammar.verb_tense"


def _days_since(value: Optional[str]) -> float:
    parsed = parse_iso(value)
    if parsed is None:
        return 30.0
    return max(0.0, (datetime.now(timezone.utc) - parsed).total_seconds() / 86400)


def _skill_scores(user_id: str) -> list[dict]:
    skills = list_skills(user_id)
    errors = list_recent_errors(user_id, limit=100)
    attempts = list_recent_practice_attempts(user_id, limit=100)
    error_counts = Counter(str(error.get("code") or "") for error in errors)
    attempts_by_skill: dict[str, list[dict]] = defaultdict(list)
    for attempt in attempts:
        attempts_by_skill[str(attempt.get("targetSkillCode") or "")].append(attempt)

    known_codes = {str(skill.get("skillCode")) for skill in skills if skill.get("skillCode")}
    known_codes.update(code for code in error_counts if code)
    if not known_codes:
        known_codes.add(DEFAULT_SKILL)
    skill_by_code = {str(skill.get("skillCode")): skill for skill in skills}

    scored: list[dict] = []
    for code in known_codes:
        skill = skill_by_code.get(code, {})
        mastery = float(skill.get("mastery", DEFAULT_MASTERY))
        mastery_need = max(0.0, min(1.0, 1 - mastery / 100))
        error_need = min(1.0, error_counts.get(code, 0) / 5)
        skill_attempts = attempts_by_skill.get(code, [])
        if skill_attempts:
            average = sum(float(item.get("score", 0)) for item in skill_attempts) / len(skill_attempts)
            failure_need = max(0.0, min(1.0, 1 - average / 100))
        else:
            average = None
            failure_need = 0.55
        staleness = min(1.0, _days_since(skill.get("lastPracticedAt")) / 21)
        score = 0.45 * mastery_need + 0.25 * error_need + 0.20 * failure_need + 0.10 * staleness
        scored.append(
            {
                "skillCode": code,
                "label": skill.get("label") or code,
                "score": round(score, 4),
                "mastery": round(mastery, 2),
                "recentErrorCount": error_counts.get(code, 0),
                "attemptCount": len(skill_attempts),
                "averagePracticeScore": round(average, 1) if average is not None else None,
                "daysSincePractice": round(_days_since(skill.get("lastPracticedAt")), 1),
                "breakdown": {
                    "masteryNeed": round(mastery_need, 4),
                    "errorNeed": round(error_need, 4),
                    "failureNeed": round(failure_need, 4),
                    "staleness": round(staleness, 4),
                },
            }
        )
    scored.sort(key=lambda item: item["score"], reverse=True)
    return scored


def _type_scores(skill_code: str, memories: list[dict]) -> tuple[list[dict], list[str]]:
    memories = [
        memory
        for memory in memories
        if memory.get("kind") == "strategy"
        and (memory.get("stats") or {}).get("skillCode") == skill_code
    ]
    by_type = {
        str((memory.get("stats") or {}).get("exerciseType")): memory
        for memory in memories
        if (memory.get("stats") or {}).get("exerciseType")
    }

    type_scores: list[dict] = []
    for exercise_type in PRACTICE_TYPES:
        memory = by_type.get(exercise_type)
        stats = (memory or {}).get("stats") or {}
        attempts = int(stats.get("attempts", 0))
        average = float(stats.get("averageScore", 70))
        need = max(0.0, min(1.0, 1 - average / 100)) if attempts else 0.55
        productive_difficulty = max(0.0, 1 - abs(average - 75) / 75) if attempts else 0.7
        exploration = 1 / math.sqrt(attempts + 1)
        reliability = min(1.0, attempts / 5)
        score = 0.45 * need + 0.25 * productive_difficulty + 0.20 * exploration + 0.10 * reliability

        # Sensible cold-start priors and progression after strong performance.
        if attempts == 0:
            if skill_code.startswith("grammar.") and exercise_type == "fix_sentence":
                score += 0.08
            elif skill_code.startswith("vocab.") and exercise_type == "fill_blank":
                score += 0.08
            elif skill_code.startswith(("sentence.", "style.", "clarity.")) and exercise_type == "rewrite_sentence":
                score += 0.08
        if average >= 85 and exercise_type == "rewrite_sentence":
            score += 0.08
        if average < 60 and exercise_type in {"fix_sentence", "fill_blank"}:
            score += 0.06

        type_scores.append(
            {
                "practiceType": exercise_type,
                "score": round(min(1.0, score), 4),
                "attemptCount": attempts,
                "averageScore": round(average, 1) if attempts else None,
                "successRate": stats.get("successRate") if attempts else None,
                "memoryId": memory.get("id") if memory else None,
                "breakdown": {
                    "learningNeed": round(need, 4),
                    "productiveDifficulty": round(productive_difficulty, 4),
                    "exploration": round(exploration, 4),
                    "reliability": round(reliability, 4),
                },
            }
        )
    type_scores.sort(key=lambda item: item["score"], reverse=True)
    supporting = [item["memoryId"] for item in type_scores if item.get("memoryId")]
    return type_scores, supporting


def _progression_context(skill_code: str, memories: list[dict]) -> dict:
    weakness = next(
        (
            memory
            for memory in memories
            if memory.get("kind") == "weakness"
            and (
                (memory.get("errorFingerprint") or {}).get("skillCode") == skill_code
                if isinstance(memory.get("errorFingerprint"), dict)
                else str(memory.get("canonicalKey") or "").endswith(skill_code)
            )
        ),
        None,
    )
    if not weakness:
        return {
            "stage": "replay",
            "reason": "No independent retrieval evidence exists yet, so begin close to a known error.",
            "memoryId": None,
            "errorFingerprint": None,
        }
    stage = str(weakness.get("progressionStage") or "")
    if stage not in {"replay", "variation", "transfer"}:
        cold = [row for row in weakness.get("probeHistory") or [] if row.get("outcome") == "success"]
        contexts = {str(row.get("context") or "").strip().lower() for row in cold if row.get("context")}
        stage = "replay" if not cold else "variation" if len(cold) < 2 or len(contexts) < 2 else "transfer"
    reasons = {
        "replay": "Rebuild the correct form near the learner's original error before adding novelty.",
        "variation": "The learner has one cold success; vary surface details while preserving the skill.",
        "transfer": "The learner has repeated cold success; require independent use in a new real-world context.",
    }
    return {
        "stage": stage,
        "reason": reasons[stage],
        "memoryId": weakness.get("id"),
        "errorFingerprint": weakness.get("errorFingerprint"),
    }


def _stage_practice_type(skill_code: str, stage: str, ranked_types: list[dict]) -> str:
    """Keep evidence-based format selection until open transfer is warranted."""
    if stage == "transfer":
        return "rewrite_sentence"
    # Replay and variation are prompt-level transformations; the strategy
    # memory still chooses the format that has the best observed learning fit.
    return ranked_types[0]["practiceType"]


def recommend_next_action(
    user_id: str,
    *,
    requested_skill_code: Optional[str] = None,
    requested_practice_type: Optional[str] = None,
) -> dict:
    skills = _skill_scores(user_id)
    target = requested_skill_code or skills[0]["skillCode"]
    # Practice selection only reads memory. Use one non-mutating snapshot for
    # the whole decision so four parallel exercise requests cannot serialize
    # behind a learner-scoped MemoryAgent writer lease.
    memories = snapshot_active_memory_records(user_id)
    type_scores, memory_ids = _type_scores(target, memories)
    progression = _progression_context(target, memories)
    practice_type = requested_practice_type or _stage_practice_type(target, progression["stage"], type_scores)
    chosen_skill = next((item for item in skills if item["skillCode"] == target), None)

    if requested_skill_code:
        skill_reason = f"You explicitly selected {target}."
    elif chosen_skill:
        skill_reason = (
            f"{target} has the strongest current learning need: mastery {chosen_skill['mastery']}, "
            f"{chosen_skill['recentErrorCount']} recent error(s), and "
            f"{chosen_skill['daysSincePractice']} day(s) since practice."
        )
    else:
        skill_reason = f"{target} is the cold-start target."
    chosen_type = next((item for item in type_scores if item["practiceType"] == practice_type), None)
    if requested_practice_type:
        type_reason = f"You explicitly selected {practice_type}."
    elif chosen_type and chosen_type["attemptCount"]:
        type_reason = (
            f"{practice_type} best balances learning need, useful difficulty, and exploration "
            f"from {chosen_type['attemptCount']} prior attempt(s)."
        )
    else:
        type_reason = f"{practice_type} is the best cold-start format for this skill."
    progression_reason = progression["reason"]

    return {
        "targetSkillCode": target,
        "practiceType": practice_type,
        "reason": f"{skill_reason} {type_reason} {progression_reason}",
        "skillReason": skill_reason,
        "practiceTypeReason": type_reason,
        "supportingMemoryIds": [
            *memory_ids,
            *([progression["memoryId"]] if progression.get("memoryId") else []),
        ],
        "progressionStage": progression["stage"],
        "progressionReason": progression_reason,
        "errorFingerprint": progression.get("errorFingerprint"),
        "skillScores": skills[:8],
        "practiceTypeScores": type_scores,
        "policy": "hybrid-need-effectiveness-progression-v2",
        "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }
