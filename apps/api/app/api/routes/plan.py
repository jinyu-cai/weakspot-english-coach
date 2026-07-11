from uuid import uuid4
import logging

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import Identity, get_llm_provider, rate_limited, resolve_identity
from app.db.repositories import (
    get_active_plan,
    get_or_create_profile,
    list_recent_errors,
    list_skills,
    list_weekly_errors,
    now_iso,
    save_active_plan,
)
from app.models.plan import GeneratePlanRequest
from app.services.ai_client import LLMProviderConfig
from app.services.plan_service import generate_learning_plan
from app.services.memory_service import retrieve_memory_pack

router = APIRouter()
logger = logging.getLogger("uvicorn.error")


@router.post("/plan")
def create_plan(
    req: GeneratePlanRequest,
    llm_provider: LLMProviderConfig | None = Depends(get_llm_provider),
    identity: Identity = Depends(rate_limited("plan")),
):
    req.userId = identity.user_id
    try:
        now = now_iso()
        profile = get_or_create_profile(req.userId)
        skills = sorted(
            list_skills(req.userId),
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
        )

        days = []
        for day in ai_plan.days:
            tasks = [
                {
                    "id": f"task_{uuid4().hex[:8]}",
                    "titleZh": t.titleZh,
                    "descriptionZh": t.descriptionZh,
                    "practiceType": t.practiceType.value,
                    "estimatedMinutes": t.estimatedMinutes,
                    "completed": False,
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
                }
                for t in day.tasks
            ]
            days.append(
                {
                    "day": day.day,
                    "goalZh": day.goalZh,
                    "targetSkillCodes": day.targetSkillCodes,
                    "tasks": tasks,
                }
            )

        plan = {
            "id": f"plan_{uuid4().hex[:12]}",
            "userId": req.userId,
            "title": ai_plan.title,
            "outputLanguage": req.outputLanguage,
            "days": days,
            "createdAt": now,
            "updatedAt": now,
            "memoryRecall": {
                "traceId": memory_pack.get("traceId"),
                "memoryIds": [item.get("id") for item in memory_pack.get("items", [])],
                "estimatedTokens": memory_pack.get("estimatedTokens", 0),
                "tokenBudget": memory_pack.get("tokenBudget"),
            },
        }
        save_active_plan(plan)
        return {"plan": plan}

    except ValueError as e:
        raise HTTPException(status_code=502, detail=f"AI error: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/plan/{user_id}")
def read_plan(user_id: str, identity: Identity = Depends(resolve_identity)):
    return {"plan": get_active_plan(identity.user_id)}
