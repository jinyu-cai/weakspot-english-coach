from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import Identity, get_llm_provider, rate_limited
from app.core.mastery import DEFAULT_MASTERY, update_skill_from_practice
from app.core.taxonomy import ERROR_TAXONOMY
from app.db.repositories import (
    get_exercise,
    get_or_create_profile,
    get_skill,
    list_recent_errors,
    now_iso,
    put_skill,
    save_exercise,
    save_practice_attempt,
    save_profile,
)
from app.models.practice import GeneratePracticeRequest, SubmitPracticeRequest
from app.services.ai_client import LLMProviderConfig
from app.services.practice_service import generate_practice_exercise, grade_practice
from app.services.profile_service import weakest_skill_code

router = APIRouter()

DEFAULT_SKILL = "grammar.verb_tense"


@router.post("/practice/generate")
def generate(
    req: GeneratePracticeRequest,
    llm_provider: LLMProviderConfig | None = Depends(get_llm_provider),
    identity: Identity = Depends(rate_limited("practice_generate")),
):
    req.userId = identity.user_id
    try:
        now = now_iso()
        profile = get_or_create_profile(req.userId)

        skill_code = req.targetSkillCode or weakest_skill_code(req.userId) or DEFAULT_SKILL
        taxonomy = ERROR_TAXONOMY.get(skill_code, {"label": skill_code, "zhLabel": skill_code})

        recent_errors = list_recent_errors(req.userId, limit=20)
        examples = [
            {"originalText": e.get("originalText"), "correctedText": e.get("correctedText")}
            for e in recent_errors
            if e.get("code") == skill_code
        ][:5]

        ai_ex = generate_practice_exercise(
            skill_code=skill_code,
            zh_label=taxonomy["zhLabel"],
            cefr_level=profile.get("estimatedLevel", "B1"),
            recent_error_examples=examples,
            llm_provider=llm_provider,
        )

        exercise = {
            "id": f"ex_{uuid4().hex[:12]}",
            "userId": req.userId,
            "type": ai_ex.type.value,
            "targetSkillCode": ai_ex.targetSkillCode or skill_code,
            "promptZh": ai_ex.promptZh,
            "question": ai_ex.question,
            "answer": ai_ex.answer,
            "explanationZh": ai_ex.explanationZh,
            "createdAt": now,
        }
        save_exercise(exercise)
        return {"exercise": exercise}

    except ValueError as e:
        raise HTTPException(status_code=502, detail=f"AI error: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/practice/submit")
def submit(
    req: SubmitPracticeRequest,
    llm_provider: LLMProviderConfig | None = Depends(get_llm_provider),
    identity: Identity = Depends(rate_limited("practice_submit")),
):
    req.userId = identity.user_id
    try:
        now = now_iso()
        exercise = get_exercise(req.userId, req.exerciseId)
        if not exercise:
            raise HTTPException(status_code=404, detail="Exercise not found")

        grade = grade_practice(
            question=exercise["question"],
            expected_answer=exercise.get("answer", ""),
            user_answer=req.userAnswer,
            target_skill_code=exercise["targetSkillCode"],
            llm_provider=llm_provider,
        )

        attempt = {
            "id": f"att_{uuid4().hex[:12]}",
            "userId": req.userId,
            "exerciseId": req.exerciseId,
            "targetSkillCode": exercise["targetSkillCode"],
            "userAnswer": req.userAnswer,
            "isCorrect": grade.isCorrect,
            "score": grade.score,
            "feedbackZh": grade.feedbackZh,
            "correctedAnswer": grade.correctedAnswer,
            "createdAt": now,
        }
        save_practice_attempt(attempt)

        skill_code = exercise["targetSkillCode"]
        existing = get_skill(req.userId, skill_code)
        if existing is None:
            taxonomy = ERROR_TAXONOMY.get(skill_code, {"label": skill_code, "zhLabel": skill_code})
            existing = {
                "userId": req.userId,
                "skillCode": skill_code,
                "label": taxonomy["label"],
                "zhLabel": taxonomy["zhLabel"],
                "mastery": DEFAULT_MASTERY,
                "errorCount": 0,
                "correctCount": 0,
                "lastSeenAt": None,
                "lastPracticedAt": None,
                "updatedAt": now,
            }

        updated_skill = update_skill_from_practice(
            existing=existing,
            is_correct=grade.isCorrect,
            mastery_delta=grade.skillMasteryDelta,
            now=now,
        )
        put_skill(updated_skill)

        profile = get_or_create_profile(req.userId)
        profile["totalPracticeAttempts"] = int(profile.get("totalPracticeAttempts", 0)) + 1
        profile["updatedAt"] = now
        save_profile(profile)

        return {
            "grade": grade.model_dump(mode="json"),
            "attempt": attempt,
            "updatedSkill": updated_skill,
        }

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=502, detail=f"AI error: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
