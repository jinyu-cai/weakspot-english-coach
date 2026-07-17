from __future__ import annotations

from datetime import datetime, timedelta, timezone
import hashlib
import math
from typing import Optional
from uuid import uuid4

from botocore.exceptions import ClientError

from app.core.taxonomy import ERROR_TAXONOMY
from app.db.repositories import (
    LearningStateConflictError,
    get_activity_run,
    get_evidence_event,
    get_learning_state,
    get_skill,
    list_activity_runs,
    list_evidence_events,
    list_learning_states,
    list_memories,
    list_skills,
    now_iso,
    save_activity_run,
    save_evidence_with_learning_state,
)
from app.models.learning import (
    CreateActivityRunRequest,
    RecordEvidenceRequest,
    UpdateActivityRunRequest,
)


TERMINAL_RUN_STATUSES = {"completed", "abandoned", "skipped"}
RUN_TRANSITIONS = {
    "assigned": {"assigned", "started", "completed", "abandoned", "skipped"},
    "started": {"started", "completed", "abandoned", "skipped"},
    "completed": {"completed"},
    "abandoned": {"abandoned"},
    "skipped": {"skipped"},
}


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def _clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))


def _run_id(now: datetime) -> str:
    stamp = now.strftime("%Y%m%dT%H%M%S%fZ")
    return f"run_{stamp}_{uuid4().hex[:10]}"


def create_activity_run(user_id: str, request: CreateActivityRunRequest) -> dict:
    now = _utc_now()
    run = {
        "id": _run_id(now),
        "userId": user_id,
        "activityType": request.activityType,
        "sourceId": request.sourceId,
        "parentRunId": request.parentRunId,
        "title": request.title,
        "taskType": request.taskType,
        "goal": request.goal,
        "targetSkills": request.targetSkills,
        "modality": request.modality,
        "difficulty": request.difficulty,
        "estimatedMinutes": request.estimatedMinutes,
        "status": "assigned",
        "hintLevel": 0,
        "playCount": 0,
        "attemptCount": 0,
        "completedCriteria": [],
        "assignedAt": _iso(now),
        "startedAt": None,
        "completedAt": None,
        "abandonedAt": None,
        "skippedAt": None,
        "createdAt": _iso(now),
        "updatedAt": _iso(now),
        "version": 1,
    }
    save_activity_run(run, create_only=True)
    return run


def update_activity_run(
    user_id: str,
    run_id: str,
    request: UpdateActivityRunRequest,
) -> dict:
    updates = request.model_dump(exclude_none=True)
    if not updates:
        run = get_activity_run(user_id, run_id)
        if not run:
            raise LookupError("Activity run not found.")
        return run

    for _attempt in range(5):
        run = get_activity_run(user_id, run_id)
        if not run:
            raise LookupError("Activity run not found.")
        current_status = str(run.get("status") or "assigned")
        requested_status = str(updates.get("status") or current_status)
        if requested_status not in RUN_TRANSITIONS.get(current_status, {current_status}):
            raise ValueError(
                f"Activity run cannot move from {current_status} to {requested_status}."
            )

        now = now_iso()
        updated = {**run, **updates, "updatedAt": now}
        if requested_status == "started" and not updated.get("startedAt"):
            updated["startedAt"] = now
        if requested_status == "completed" and not updated.get("completedAt"):
            updated["completedAt"] = now
        if requested_status == "abandoned" and not updated.get("abandonedAt"):
            updated["abandonedAt"] = now
        if requested_status == "skipped" and not updated.get("skippedAt"):
            updated["skippedAt"] = now
        prior_version = int(run.get("version", 1))
        updated["version"] = prior_version + 1
        try:
            save_activity_run(updated, expected_version=prior_version)
            return updated
        except ClientError as exc:
            if exc.response.get("Error", {}).get("Code") != "ConditionalCheckFailedException":
                raise
    raise RuntimeError("Activity run changed repeatedly; retry the update.")


def _initial_learning_state(user_id: str, skill_code: str, now: str) -> dict:
    legacy = get_skill(user_id, skill_code)
    legacy_count = 0
    alpha = 1.0
    beta = 1.0
    if legacy:
        legacy_count = int(legacy.get("correctCount", 0)) + int(legacy.get("errorCount", 0))
        if legacy_count:
            prior_strength = min(8.0, float(legacy_count))
            prior_mean = _clamp(float(legacy.get("mastery", 50)) / 100.0, 0.02, 0.98)
            alpha += prior_mean * prior_strength
            beta += (1.0 - prior_mean) * prior_strength
    taxonomy = ERROR_TAXONOMY[skill_code]
    return {
        "userId": user_id,
        "skillCode": skill_code,
        "label": taxonomy["label"],
        "zhLabel": taxonomy["zhLabel"],
        "abilityMean": round(alpha / (alpha + beta) * 100, 2) if legacy_count else None,
        "abilityUncertainty": 1.0 if not legacy_count else round(min(1.0, 2 / math.sqrt(alpha + beta)), 4),
        "coverageStatus": "unassessed" if not legacy_count else "exploring",
        "alpha": round(alpha, 6),
        "beta": round(beta, 6),
        "opportunityCount": 0,
        "independentSuccessCount": 0,
        "hintedSuccessCount": 0,
        "failureCount": 0,
        "avoidedCount": 0,
        "noOpportunityCount": 0,
        "delayedIndependentTransferCount": 0,
        "contexts": [],
        "taskTypes": [],
        "modalities": {},
        "retentionStabilityDays": 1.0,
        "retentionDifficulty": 5.0,
        "dueAt": now,
        "lastEvidenceAt": None,
        "lastIndependentUseAt": None,
        "lastOutcome": None,
        "legacyMastery": legacy.get("mastery") if legacy else None,
        "legacyEvidenceCount": legacy_count,
        "createdAt": now,
        "updatedAt": now,
        "version": 0,
    }


def _update_beta_state(alpha: float, beta: float, outcome: str, weight: float) -> tuple[float, float]:
    if outcome == "success":
        alpha += 1.2 * weight
    elif outcome == "hinted_success":
        alpha += 0.45 * weight
        beta += 0.15 * weight
    elif outcome == "failure":
        beta += weight
    elif outcome == "avoided":
        beta += 0.35 * weight
    return alpha, beta


def _evidence_weight(request: RecordEvidenceRequest) -> float:
    weight = request.evaluatorConfidence * (0.75 + 0.5 * request.taskDifficulty)
    if request.delayed:
        weight *= 1.25
    if request.novelContext:
        weight *= 1.15
    return _clamp(weight, 0.05, 1.75)


def _apply_evidence(state: dict, request: RecordEvidenceRequest, now: str) -> dict:
    updated = dict(state)
    outcome = request.outcome
    if outcome == "success" and request.supportLevel > 0:
        outcome = "hinted_success"
    weight = _evidence_weight(request)

    if request.opportunityPresent:
        updated["opportunityCount"] = int(updated.get("opportunityCount", 0)) + 1
        alpha, beta = _update_beta_state(
            float(updated.get("alpha", 1.0)),
            float(updated.get("beta", 1.0)),
            outcome,
            weight,
        )
        updated["alpha"] = round(alpha, 6)
        updated["beta"] = round(beta, 6)
        updated["abilityMean"] = round(alpha / (alpha + beta) * 100, 2)
        updated["abilityUncertainty"] = round(min(1.0, 2 / math.sqrt(alpha + beta)), 4)

        count_fields = {
            "success": "independentSuccessCount",
            "hinted_success": "hintedSuccessCount",
            "failure": "failureCount",
            "avoided": "avoidedCount",
        }
        count_field = count_fields[outcome]
        updated[count_field] = int(updated.get(count_field, 0)) + 1
    else:
        updated["noOpportunityCount"] = int(updated.get("noOpportunityCount", 0)) + 1

    contexts = list(updated.get("contexts") or [])
    if request.contextKey and request.contextKey not in contexts:
        contexts.append(request.contextKey)
    updated["contexts"] = contexts[-20:]
    task_types = list(updated.get("taskTypes") or [])
    if request.taskType not in task_types:
        task_types.append(request.taskType)
    updated["taskTypes"] = task_types[-20:]

    if request.opportunityPresent:
        opportunity_count = int(updated["opportunityCount"])
        enough_variety = len(updated["contexts"]) >= 2 or len(updated["taskTypes"]) >= 2
        updated["coverageStatus"] = (
            "enough_evidence"
            if opportunity_count >= 5 and enough_variety
            else "exploring"
        )

    stability = float(updated.get("retentionStabilityDays", 1.0))
    difficulty = float(updated.get("retentionDifficulty", 5.0))
    if request.opportunityPresent:
        if outcome == "success":
            stability = min(365.0, stability * (2.2 if request.delayed else 1.8) + 0.25)
            difficulty -= 0.3
        elif outcome == "hinted_success":
            stability = min(365.0, max(0.75, stability * 1.25))
            difficulty -= 0.08
        elif outcome == "failure":
            stability = max(0.25, stability * 0.5)
            difficulty += 0.55
        elif outcome == "avoided":
            stability = max(0.25, stability * 0.75)
            difficulty += 0.3
        updated["retentionStabilityDays"] = round(stability, 3)
        updated["retentionDifficulty"] = round(_clamp(difficulty, 1.0, 10.0), 3)
        due = _utc_now() + timedelta(days=stability)
        updated["dueAt"] = _iso(due)
        updated["lastEvidenceAt"] = now
        updated["lastOutcome"] = outcome

    if outcome == "success" and request.supportLevel == 0 and request.opportunityPresent:
        updated["lastIndependentUseAt"] = now
        if request.delayed and request.novelContext:
            updated["delayedIndependentTransferCount"] = (
                int(updated.get("delayedIndependentTransferCount", 0)) + 1
            )

    modalities = dict(updated.get("modalities") or {})
    modality = dict(modalities.get(request.modality) or {
        "alpha": 1.0,
        "beta": 1.0,
        "opportunityCount": 0,
        "abilityMean": None,
    })
    if request.opportunityPresent:
        modality_alpha, modality_beta = _update_beta_state(
            float(modality.get("alpha", 1.0)),
            float(modality.get("beta", 1.0)),
            outcome,
            weight,
        )
        modality.update({
            "alpha": round(modality_alpha, 6),
            "beta": round(modality_beta, 6),
            "opportunityCount": int(modality.get("opportunityCount", 0)) + 1,
            "abilityMean": round(modality_alpha / (modality_alpha + modality_beta) * 100, 2),
            "lastOutcome": outcome,
            "lastEvidenceAt": now,
        })
    else:
        modality["noOpportunityCount"] = int(modality.get("noOpportunityCount", 0)) + 1
    modalities[request.modality] = modality
    updated["modalities"] = modalities
    updated["updatedAt"] = now
    updated["version"] = int(state.get("version", 0)) + 1
    return updated


def record_evidence(user_id: str, request: RecordEvidenceRequest) -> dict:
    event_id = "ev_" + hashlib.sha256(
        f"{user_id}\0{request.clientEventId}".encode("utf-8")
    ).hexdigest()[:24]
    existing_event = get_evidence_event(user_id, event_id)
    if existing_event:
        return {
            "event": existing_event,
            "state": get_learning_state(user_id, request.skillCode),
            "duplicate": True,
        }

    if request.runId and not get_activity_run(user_id, request.runId):
        raise LookupError("Activity run not found.")

    for _attempt in range(6):
        now = now_iso()
        state = get_learning_state(user_id, request.skillCode)
        if state is None:
            state = _initial_learning_state(user_id, request.skillCode, now)
        expected_version = int(state.get("version", 0))
        updated_state = _apply_evidence(state, request, now)
        normalized_outcome = (
            "hinted_success"
            if request.outcome == "success" and request.supportLevel > 0
            else request.outcome
        )
        event = {
            "id": event_id,
            "clientEventId": request.clientEventId,
            "userId": user_id,
            "runId": request.runId,
            "sourceId": request.sourceId,
            "skillCode": request.skillCode,
            "outcome": normalized_outcome,
            "opportunityPresent": request.opportunityPresent,
            "supportLevel": request.supportLevel,
            "modality": request.modality,
            "taskType": request.taskType,
            "taskDifficulty": request.taskDifficulty,
            "evaluatorConfidence": request.evaluatorConfidence,
            "evidenceWeight": round(_evidence_weight(request), 4),
            "contextKey": request.contextKey,
            "novelContext": request.novelContext,
            "delayed": request.delayed,
            "evidenceQuote": request.evidenceQuote,
            "createdAt": now,
        }
        try:
            created = save_evidence_with_learning_state(
                event,
                updated_state,
                expected_state_version=expected_version,
            )
            if created:
                return {"event": event, "state": updated_state, "duplicate": False}
            duplicate = get_evidence_event(user_id, event_id)
            return {
                "event": duplicate,
                "state": get_learning_state(user_id, request.skillCode),
                "duplicate": True,
            }
        except LearningStateConflictError:
            continue
    raise RuntimeError("Learning state remained busy; retry this evidence event.")


def learning_overview(user_id: str) -> dict:
    states_by_code = {
        state["skillCode"]: state for state in list_learning_states(user_id)
    }
    states = []
    for skill_code, taxonomy in ERROR_TAXONOMY.items():
        states.append(
            states_by_code.get(skill_code)
            or {
                "userId": user_id,
                "skillCode": skill_code,
                "label": taxonomy["label"],
                "zhLabel": taxonomy["zhLabel"],
                "abilityMean": None,
                "abilityUncertainty": 1.0,
                "coverageStatus": "unassessed",
                "opportunityCount": 0,
                "independentSuccessCount": 0,
                "hintedSuccessCount": 0,
                "failureCount": 0,
                "avoidedCount": 0,
                "noOpportunityCount": 0,
                "delayedIndependentTransferCount": 0,
                "contexts": [],
                "taskTypes": [],
                "modalities": {},
                "retentionStabilityDays": None,
                "retentionDifficulty": None,
                "dueAt": None,
                "lastEvidenceAt": None,
                "lastIndependentUseAt": None,
                "lastOutcome": None,
            }
        )
    states.sort(
        key=lambda row: (
            {"unassessed": 0, "exploring": 1, "enough_evidence": 2}.get(
                row.get("coverageStatus"), 0
            ),
            row.get("abilityMean") if row.get("abilityMean") is not None else -1,
        )
    )
    return {
        "states": states,
        "recentRuns": list_activity_runs(user_id, limit=30),
        "recentEvidence": list_evidence_events(user_id, limit=100),
        "generatedAt": now_iso(),
    }


def _parse_iso(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except (TypeError, ValueError):
        return None


def recommend_coach_mission(
    user_id: str,
    *,
    modality: str,
    preferred_type: Optional[str] = None,
) -> dict:
    """Choose a mission from learning need, review timing, uncertainty, and fatigue."""

    now = _utc_now()
    persisted = {row["skillCode"]: row for row in list_learning_states(user_id)}
    legacy = {row["skillCode"]: row for row in list_skills(user_id)}
    memories = list_memories(user_id, limit=250)
    active_memories = [
        row for row in memories if row.get("status", "active") == "active"
    ]
    weaknesses = {
        str(row.get("canonicalKey") or "").removeprefix("weakness."): row
        for row in active_memories
        if row.get("kind") == "weakness"
    }
    goals = [row for row in active_memories if row.get("kind") == "goal"]
    preferences = [row for row in active_memories if row.get("kind") == "preference"]
    strategies = [row for row in active_memories if row.get("kind") == "strategy"]
    recent_runs = list_activity_runs(user_id, limit=20)
    recent_target_counts: dict[str, int] = {}
    recent_type_counts: dict[str, int] = {}
    for run in recent_runs[:12]:
        if run.get("status") not in {"started", "completed", "abandoned"}:
            continue
        for code in run.get("targetSkills") or []:
            recent_target_counts[str(code)] = recent_target_counts.get(str(code), 0) + 1
        task_type = str(run.get("taskType") or "")
        if task_type:
            recent_type_counts[task_type] = recent_type_counts.get(task_type, 0) + 1

    scored: list[dict] = []
    for skill_code in ERROR_TAXONOMY:
        state = persisted.get(skill_code)
        legacy_skill = legacy.get(skill_code)
        coverage = str((state or {}).get("coverageStatus") or "")
        if not coverage:
            coverage = "exploring" if legacy_skill else "unassessed"
        ability = (state or {}).get("abilityMean")
        if ability is None and legacy_skill:
            ability = float(legacy_skill.get("mastery", 50))
        ability_need = 0.55 if ability is None else _clamp(1 - float(ability) / 100, 0, 1)
        uncertainty = float((state or {}).get("abilityUncertainty", 1.0))
        if coverage == "unassessed":
            information_gain = 1.0
        elif coverage == "exploring":
            information_gain = max(0.65, uncertainty)
        else:
            information_gain = uncertainty * 0.6

        weakness = weaknesses.get(skill_code)
        retention = (
            weakness.get("retention")
            if isinstance((weakness or {}).get("retention"), dict)
            else {}
        )
        due_at = _parse_iso((state or {}).get("dueAt")) or _parse_iso(retention.get("dueAt"))
        if due_at is None:
            due_risk = 0.55
        elif due_at <= now:
            overdue = (now - due_at).total_seconds() / 86400
            due_risk = _clamp(0.75 + overdue / 30, 0, 1)
        else:
            days_until = (due_at - now).total_seconds() / 86400
            due_risk = _clamp(0.55 - days_until / 60, 0.05, 0.55)
        due_risk = max(due_risk, float(retention.get("relapseRisk", 0) or 0))
        if weakness:
            ability_need = max(ability_need, 0.65)

        last_outcome = str((state or {}).get("lastOutcome") or "")
        expected_gain = {
            "failure": 0.9,
            "avoided": 0.82,
            "hinted_success": 0.76,
            "success": 0.48,
        }.get(last_outcome, 0.65)
        goal_relevance = 0.55 if goals else 0.4
        skill_words = set(skill_code.replace(".", " ").replace("_", " ").split())
        goal_text = " ".join(str(row.get("content") or "").lower() for row in goals)
        if any(word in goal_text for word in skill_words):
            goal_relevance = 0.9
        fatigue = _clamp(recent_target_counts.get(skill_code, 0) / 4, 0, 1)
        score = (
            0.30 * ability_need
            + 0.25 * due_risk
            + 0.25 * information_gain
            + 0.10 * goal_relevance
            + 0.10 * expected_gain
            - 0.15 * fatigue
        )
        scored.append({
            "skillCode": skill_code,
            "score": round(score, 4),
            "coverageStatus": coverage,
            "abilityMean": ability,
            "breakdown": {
                "abilityNeed": round(ability_need, 4),
                "dueRisk": round(due_risk, 4),
                "informationGain": round(information_gain, 4),
                "goalRelevance": round(goal_relevance, 4),
                "expectedDelayedGain": round(expected_gain, 4),
                "fatigue": round(fatigue, 4),
            },
        })
    scored.sort(key=lambda item: item["score"], reverse=True)
    targets = [item["skillCode"] for item in scored[:3]]

    format_fit = {
        "guided_scene": 0.72,
        "picture_story": 0.68,
        "listen_retell": 0.7 if modality == "voice" else 0.62,
        "decision_response": 0.72,
        "vocabulary_in_action": 0.58,
    }
    primary = targets[0]
    if primary.startswith("vocab."):
        format_fit["vocabulary_in_action"] += 0.34
        format_fit["decision_response"] += 0.08
    if primary.startswith(("sentence.", "discourse.", "clarity.")):
        format_fit["picture_story"] += 0.2
        format_fit["listen_retell"] += 0.18
        format_fit["decision_response"] += 0.12
    if primary.startswith(("grammar.", "style.")):
        format_fit["guided_scene"] += 0.22
    if scored[0]["coverageStatus"] == "unassessed":
        format_fit["decision_response"] += 0.2
        format_fit["picture_story"] += 0.12

    format_scores = []
    for mission_type, fit in format_fit.items():
        attempts = recent_type_counts.get(mission_type, 0)
        exploration = 1 / math.sqrt(attempts + 1)
        score = fit + 0.25 * exploration - 0.08 * min(attempts, 4)
        format_scores.append({
            "missionType": mission_type,
            "score": round(score, 4),
            "recentCount": attempts,
            "fit": round(fit, 4),
            "exploration": round(exploration, 4),
        })
    format_scores.sort(key=lambda item: item["score"], reverse=True)
    recommended_type = preferred_type or format_scores[0]["missionType"]
    top = scored[0]
    reason = (
        f"{primary} is the best next target: coverage={top['coverageStatus']}, "
        f"ability={top['abilityMean'] if top['abilityMean'] is not None else 'unknown'}, "
        f"due risk={top['breakdown']['dueRisk']}, and information gain="
        f"{top['breakdown']['informationGain']}. {recommended_type} balances target fit, "
        "novelty, and recent fatigue."
    )
    return {
        "targetSkills": targets,
        "recommendedType": recommended_type,
        "reason": reason,
        "skillScores": scored,
        "missionTypeScores": format_scores,
        "goalContext": [str(row.get("content") or "")[:300] for row in goals[:4]],
        "preferenceContext": [str(row.get("content") or "")[:300] for row in preferences[:4]],
        "strategyContext": [str(row.get("content") or "")[:300] for row in strategies[:4]],
        "policy": "need-due-information-goal-delayed-gain-v1",
        "generatedAt": now_iso(),
    }
