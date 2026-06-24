from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import Identity, get_llm_provider, rate_limited, resolve_identity
from app.db.repositories import (
    get_active_plan,
    get_or_create_profile,
    list_recent_errors,
    list_skills,
    now_iso,
    save_active_plan,
)
from app.models.plan import GeneratePlanRequest
from app.services.ai_client import LLMProviderConfig
from app.services.plan_service import generate_learning_plan

router = APIRouter()


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
        skills = list_skills(req.userId)
        recent_errors = list_recent_errors(req.userId, limit=20)

        ai_plan = generate_learning_plan(profile, skills, recent_errors, llm_provider=llm_provider)

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
            "days": days,
            "createdAt": now,
            "updatedAt": now,
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
