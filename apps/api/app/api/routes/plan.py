import logging
import time
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import Identity, get_llm_provider, rate_limited, resolve_identity
from app.core.taxonomy import ERROR_TAXONOMY
from app.db.repositories import (
    ItemTooLargeError,
    PlanProgressConflictError,
    get_active_plan,
    get_activity_run,
    get_or_create_profile,
    list_recent_errors,
    list_skills,
    list_weekly_errors,
    now_iso,
    save_active_plan,
    save_plan_with_activity_run,
)
from app.models.plan import GeneratePlanRequest
from app.models.plan import UpdatePlanTaskRequest
from app.models.learning import CreateActivityRunRequest, UpdateActivityRunRequest
from app.services.ai_client import LLMProviderConfig
from app.services.plan_service import generate_learning_plan
from app.services.memory_service import retrieve_memory_pack
from app.services.learning_service import (
    build_activity_run,
    create_activity_run,
    prepare_activity_run_update,
)

router = APIRouter()
logger = logging.getLogger("uvicorn.error")


def _decorate_plan(plan: dict | None) -> dict | None:
    if not plan:
        return None
    decorated = dict(plan)
    days = list(decorated.get("days") or [])
    tasks = [task for day in days for task in day.get("tasks") or []]
    completed = sum(1 for task in tasks if task.get("status") == "completed" or task.get("completed"))
    current_day = next(
        (
            day.get("day")
            for day in days
            if any(
                task.get("status") not in {"completed", "skipped"} and not task.get("completed")
                for task in day.get("tasks") or []
            )
        ),
        days[-1].get("day") if days else 1,
    )
    decorated["currentDay"] = current_day
    decorated["progress"] = {
        "completedTasks": completed,
        "totalTasks": len(tasks),
        "percent": round(completed / len(tasks) * 100) if tasks else 0,
    }
    decorated["nextTaskId"] = next(
        (
            task.get("id")
            for day in days
            for task in day.get("tasks") or []
            if task.get("status") not in {"completed", "skipped"} and not task.get("completed")
        ),
        None,
    )
    return decorated


@router.post("/plan")
def create_plan(
    req: GeneratePlanRequest,
    llm_provider: LLMProviderConfig | None = Depends(get_llm_provider),
    identity: Identity = Depends(rate_limited("plan")),
):
    req.userId = identity.user_id
    request_id = uuid4().hex[:10]
    started = time.perf_counter()
    try:
        logger.info(
            "plan[%s] start user_id=%s scope=%s",
            request_id,
            req.userId,
            req.errorScope,
        )
        now = now_iso()
        profile = get_or_create_profile(req.userId)
        skills = sorted(
            (
                skill
                for skill in list_skills(req.userId)
                if str(skill.get("skillCode") or "") in ERROR_TAXONOMY
            ),
            key=lambda skill: float(skill.get("mastery", 50)),
        )[:20]
        if req.errorScope == "weekly":
            recent_errors = list_weekly_errors(req.userId)
        else:
            recent_errors = list_recent_errors(req.userId, limit=50)

        # Keep raw evidence bounded; cross-session context comes from the fixed
        # Memory Pack instead of dumping an ever-growing learner history.
        bounded_errors = []
        for error in recent_errors[:40]:
            error_code = str(error.get("code") or "")
            if error_code and error_code not in ERROR_TAXONOMY:
                continue
            compact = {
                key: error.get(key)
                for key in (
                    "code", "category", "severity", "originalText", "correctedText",
                    "practiceGoal", "createdAt",
                )
                if key in error
            }
            bounded_errors.append(compact or error)
        recent_errors = bounded_errors
        try:
            memory_pack = retrieve_memory_pack(
                req.userId,
                "Create a seven-day English learning plan using current goals, preferences, "
                "proven strategies, recurring weaknesses, and recent practice outcomes.",
                purpose="plan",
            )
        except Exception:
            logger.exception("plan memory_retrieval_error user_id=%s", req.userId)
            memory_pack = {"text": "", "items": [], "estimatedTokens": 0, "traceId": None}

        ai_plan = generate_learning_plan(
            profile, skills, recent_errors,
            llm_provider=llm_provider,
            max_output_tokens=None if identity.has_unlimited_llm_quota else identity.max_output_tokens,
            output_language=req.outputLanguage,
            memory_context=memory_pack.get("text"),
            trace_id=request_id,
        )

        plan_id = f"plan_{uuid4().hex[:12]}"
        days = []
        for day_number, day in enumerate(ai_plan.days, start=1):
            tasks = []
            for t in day.tasks:
                task_id = f"task_{uuid4().hex[:8]}"
                run = create_activity_run(
                    req.userId,
                    CreateActivityRunRequest(
                        activityType="plan",
                        sourceId=task_id,
                        title=t.titleZh[:240],
                        taskType=t.practiceType.value,
                        goal=day.goalZh,
                        targetSkills=day.targetSkillCodes,
                        modality="exercise",
                        difficulty=f"day_{day_number}",
                        estimatedMinutes=t.estimatedMinutes,
                    ),
                )
                tasks.append({
                    "id": task_id,
                    "titleZh": t.titleZh,
                    "descriptionZh": t.descriptionZh,
                    "practiceType": t.practiceType.value,
                    "estimatedMinutes": t.estimatedMinutes,
                    "completed": False,
                    "status": "assigned",
                    "activityRunId": run["id"],
                    "score": None,
                    "startedAt": None,
                    "completedAt": None,
                    "exercises": [
                        {
                            "id": f"pex_{uuid4().hex[:8]}",
                            "promptZh": ex.promptZh,
                            "question": ex.question,
                            "answer": ex.answer,
                            "explanationZh": ex.explanationZh,
                        }
                        for ex in t.exercises
                    ],
                })
            days.append(
                {
                    "day": day_number,
                    "goalZh": day.goalZh,
                    "targetSkillCodes": day.targetSkillCodes,
                    "tasks": tasks,
                }
            )

        plan = {
            "id": plan_id,
            "userId": req.userId,
            "title": ai_plan.title,
            "outputLanguage": req.outputLanguage,
            "days": days,
            "createdAt": now,
            "updatedAt": now,
            "version": 1,
            "policy": "rolling-seven-step-jit-v1",
            "memoryRecall": {
                "traceId": memory_pack.get("traceId"),
                "memoryIds": [item.get("id") for item in memory_pack.get("items", [])],
                "estimatedTokens": memory_pack.get("estimatedTokens", 0),
                "tokenBudget": memory_pack.get("tokenBudget"),
            },
        }
        save_active_plan(plan)
        logger.info(
            "plan[%s] complete total_ms=%d days=%d tasks=%d exercises=%d",
            request_id,
            int((time.perf_counter() - started) * 1000),
            len(days),
            sum(len(day["tasks"]) for day in days),
            sum(
                len(task["exercises"])
                for day in days
                for task in day["tasks"]
            ),
        )
        return {"plan": _decorate_plan(plan)}

    except ValueError as e:
        logger.exception(
            "plan[%s] ai_error total_ms=%d",
            request_id,
            int((time.perf_counter() - started) * 1000),
        )
        raise HTTPException(
            status_code=502,
            detail={
                "code": "plan_ai_failed",
                "message": "The AI could not generate a valid plan. Please try again.",
                "requestId": request_id,
            },
        ) from e
    except Exception as e:
        logger.exception(
            "plan[%s] server_error total_ms=%d",
            request_id,
            int((time.perf_counter() - started) * 1000),
        )
        raise HTTPException(
            status_code=500,
            detail={
                "code": "plan_generation_failed",
                "message": "Plan generation failed. Please try again.",
                "requestId": request_id,
            },
        ) from e


@router.get("/plan/{user_id}")
def read_plan(user_id: str, identity: Identity = Depends(resolve_identity)):
    return {"plan": _decorate_plan(get_active_plan(identity.user_id))}


@router.patch("/plan/tasks/{task_id}")
def update_plan_task(
    task_id: str,
    req: UpdatePlanTaskRequest,
    identity: Identity = Depends(resolve_identity),
):
    plan = get_active_plan(identity.user_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    selected = None
    selected_day = None
    for day in plan.get("days") or []:
        selected = next((task for task in day.get("tasks") or [] if task.get("id") == task_id), None)
        if selected:
            selected_day = day
            break
    if not selected:
        raise HTTPException(status_code=404, detail="Plan task not found")

    current_run_id = str(selected.get("activityRunId") or "")
    current_run = (
        get_activity_run(identity.user_id, current_run_id)
        if current_run_id
        else None
    )
    replacement = current_run is None
    closed_run = None
    expected_closed_run_version = None
    expected_run_version = (
        current_run.get("version")
        if current_run is not None and "version" in current_run
        else None
    )
    run_request = UpdateActivityRunRequest(status=req.status)

    if current_run is not None:
        try:
            updated_run = prepare_activity_run_update(current_run, run_request)
        except ValueError as exc:
            # A backward reset or terminal reopen is a new learning attempt,
            # not a mutation of immutable historical completion evidence.
            if req.status not in {"assigned", "started"}:
                raise HTTPException(
                    status_code=409,
                    detail={
                        "code": "invalid_plan_task_transition",
                        "message": str(exc),
                    },
                ) from exc
            replacement = True
            if str(current_run.get("status") or "assigned") == "started":
                expected_closed_run_version = (
                    current_run.get("version")
                    if "version" in current_run
                    else None
                )
                closed_run = prepare_activity_run_update(
                    current_run,
                    UpdateActivityRunRequest(
                        status="abandoned",
                        abandonReason="Plan task reset for a new attempt.",
                    ),
                )

    if replacement:
        try:
            updated_run = build_activity_run(
                identity.user_id,
                CreateActivityRunRequest(
                    activityType="plan",
                    sourceId=task_id,
                    title=str(selected.get("titleZh") or "Plan task")[:240],
                    taskType=str(selected.get("practiceType") or "practice"),
                    goal=str((selected_day or {}).get("goalZh") or "Repeat this plan task."),
                    targetSkills=[
                        code
                        for code in (selected_day or {}).get("targetSkillCodes") or []
                        if code in ERROR_TAXONOMY
                    ],
                    modality="exercise",
                    difficulty=f"day_{(selected_day or {}).get('day', 1)}",
                    estimatedMinutes=int(selected.get("estimatedMinutes") or 15),
                ),
            )
            if req.status != "assigned":
                updated_run = prepare_activity_run_update(updated_run, run_request)
        except ValueError as exc:
            raise HTTPException(
                status_code=409,
                detail={
                    "code": "invalid_plan_activity",
                    "message": "This Plan task cannot create a valid learning activity.",
                },
            ) from exc
        selected["activityRunId"] = updated_run["id"]
        selected["startedAt"] = None
        selected["completedAt"] = None
        selected["score"] = None

    now = now_iso()
    selected["status"] = req.status
    selected["completed"] = req.status == "completed"
    if req.status == "started" and not selected.get("startedAt"):
        selected["startedAt"] = updated_run.get("startedAt") or now
    if req.status == "completed":
        selected["completedAt"] = updated_run.get("completedAt") or now
    elif req.status in {"assigned", "started", "skipped"}:
        selected["completedAt"] = None
    if req.score is not None:
        selected["score"] = req.score
    plan["updatedAt"] = now
    expected_plan_version = plan.get("version") if "version" in plan else None
    plan["version"] = int(plan.get("version", 1)) + 1
    try:
        save_plan_with_activity_run(
            plan,
            updated_run,
            expected_plan_version=expected_plan_version,
            expected_run_version=expected_run_version,
            create_run=replacement,
            closed_run=closed_run,
            expected_closed_run_version=expected_closed_run_version,
        )
    except PlanProgressConflictError as exc:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "plan_changed",
                "message": "The Plan or task activity changed; reload and try again.",
            },
        ) from exc
    except ItemTooLargeError as exc:
        raise HTTPException(
            status_code=413,
            detail={
                "code": "plan_storage_limit",
                "message": "This Plan is too large to update safely.",
            },
        ) from exc
    return {"plan": _decorate_plan(plan), "task": selected}
