"""Skill mastery scoring.

Mastery is a 0-100 score per skill. Errors push it down (by severity);
correct practice pushes it up. All math here operates on floats — the
DynamoDB layer is responsible for float<->Decimal conversion.
"""

from typing import Optional

DEFAULT_MASTERY = 70.0


def clamp(value: float, min_value: float = 0, max_value: float = 100) -> float:
    return max(min_value, min(max_value, value))


def severity_penalty(severity: str) -> float:
    if severity == "low":
        return -3.0
    if severity == "medium":
        return -7.0
    return -12.0


def update_skill_from_error(
    existing: Optional[dict],
    user_id: str,
    skill_code: str,
    label: str,
    zh_label: str,
    severity: str,
    now: str,
) -> dict:
    old_mastery = float(existing.get("mastery", DEFAULT_MASTERY)) if existing else DEFAULT_MASTERY
    old_error_count = int(existing.get("errorCount", 0)) if existing else 0
    old_correct_count = int(existing.get("correctCount", 0)) if existing else 0

    return {
        "userId": user_id,
        "skillCode": skill_code,
        "label": label,
        "zhLabel": zh_label,
        "mastery": clamp(old_mastery + severity_penalty(severity)),
        "errorCount": old_error_count + 1,
        "correctCount": old_correct_count,
        "lastSeenAt": now,
        "lastPracticedAt": existing.get("lastPracticedAt") if existing else None,
        "updatedAt": now,
    }


def reverse_skill_from_error(existing: dict, severity: str, now: str) -> dict:
    """Undo one previously-applied error penalty.

    Used when a submission is deleted from history: each of its errors that
    pushed a skill's mastery down (and bumped its error count) is rolled back so
    the weakness profile reflects only the writing the learner actually kept.
    Clamped to 0-100, so a skill that had hit the floor self-corrects over time.
    """
    old_mastery = float(existing.get("mastery", DEFAULT_MASTERY))
    old_error_count = int(existing.get("errorCount", 0))
    return {
        **existing,
        # severity_penalty is negative, so subtracting it adds the mastery back.
        "mastery": clamp(old_mastery - severity_penalty(severity)),
        "errorCount": max(0, old_error_count - 1),
        "updatedAt": now,
    }


def update_skill_from_practice(
    existing: dict,
    is_correct: bool,
    mastery_delta: float,
    now: str,
) -> dict:
    return {
        **existing,
        "mastery": clamp(float(existing.get("mastery", DEFAULT_MASTERY)) + float(mastery_delta)),
        "correctCount": int(existing.get("correctCount", 0)) + (1 if is_correct else 0),
        "errorCount": int(existing.get("errorCount", 0)) + (0 if is_correct else 1),
        "lastPracticedAt": now,
        "updatedAt": now,
    }
