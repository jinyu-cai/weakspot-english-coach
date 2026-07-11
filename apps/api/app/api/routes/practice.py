from uuid import uuid4
import logging

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
    save_error,
    save_exercise,
    save_practice_attempt,
    save_profile,
)
from app.models.practice import (
    GeneratePracticeRequest,
    GradePracticeRequest,
    SubmitPracticeRequest,
)
from app.services.ai_client import LLMProviderConfig
from app.services.practice_service import generate_practice_exercise, grade_practice
from app.services.decision_service import recommend_next_action
from app.services.memory_service import record_practice_outcome_memory, retrieve_memory_pack

router = APIRouter()
logger = logging.getLogger("uvicorn.error")

DEFAULT_SKILL = "grammar.verb_tense"
PLATFORM_PRACTICE_ANSWER_CHAR_LIMIT = 2000


def _severity_from_score(score: int) -> str:
    """Map a practice grade (0-100) to a weakness-library error severity."""
    if score < 40:
        return "high"
    if score < 70:
        return "medium"
    return "low"


def _get_or_default_skill(user_id: str, skill_code: str, now: str) -> dict:
    existing = get_skill(user_id, skill_code)
    if existing is not None:
        return existing
    taxonomy = ERROR_TAXONOMY.get(skill_code, {"label": skill_code, "zhLabel": skill_code})
    return {
        "userId": user_id,
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


def _record_practice_outcome(
    *,
    user_id: str,
    skill_code: str,
    user_answer: str,
    grade,
    now: str,
    exercise_id: str | None = None,
    prompt_zh: str | None = None,
    explanation_zh: str | None = None,
    exercise_type: str = "fix_sentence",
) -> dict:
    """Persist one graded practice attempt and fold it into the learner model.

    Always saves the attempt, updates skill mastery, and bumps the practice
    counter. On a wrong answer it also writes an ERROR into the weakness library
    so the mistake feeds the next plan / analysis — just like a diagnosed error.
    Shared by /practice/submit (stored exercises) and /practice/grade (ad-hoc
    plan exercises). Returns {attempt, updatedSkill, recordedError}.
    """
    attempt = {
        "id": f"att_{uuid4().hex[:12]}",
        "userId": user_id,
        "exerciseId": exercise_id,
        "targetSkillCode": skill_code,
        "exerciseType": exercise_type,
        "userAnswer": user_answer,
        "isCorrect": grade.isCorrect,
        "score": grade.score,
        "feedbackZh": grade.feedbackZh,
        "correctedAnswer": grade.correctedAnswer,
        "createdAt": now,
    }
    save_practice_attempt(attempt)

    updated_skill = update_skill_from_practice(
        existing=_get_or_default_skill(user_id, skill_code, now),
        is_correct=grade.isCorrect,
        mastery_delta=grade.skillMasteryDelta,
        now=now,
    )
    put_skill(updated_skill)

    recorded_error = None
    if not grade.isCorrect:
        taxonomy = ERROR_TAXONOMY.get(skill_code, {"label": skill_code, "zhLabel": skill_code})
        recorded_error = {
            "id": f"err_{uuid4().hex[:12]}",
            "userId": user_id,
            # Practice mistakes aren't tied to a writing submission, but the
            # ERROR shape needs the field — use a synthetic, self-referential id.
            "submissionId": f"practice_{attempt['id']}",
            "code": skill_code,
            "category": taxonomy["label"],
            "severity": _severity_from_score(grade.score),
            "originalText": user_answer,
            "correctedText": grade.correctedAnswer,
            "explanationZh": grade.feedbackZh,
            "microLessonZh": explanation_zh or grade.feedbackZh,
            "practiceGoal": prompt_zh
            or f"Redo this {taxonomy['label']} exercise until you get it right.",
            "source": "practice",
            "createdAt": now,
        }
        save_error(recorded_error)

    profile = get_or_create_profile(user_id)
    profile["totalPracticeAttempts"] = int(profile.get("totalPracticeAttempts", 0)) + 1
    profile["updatedAt"] = now
    save_profile(profile)

    try:
        memory_updates = record_practice_outcome_memory(
            user_id=user_id,
            skill_code=skill_code,
            exercise_type=exercise_type,
            score=grade.score,
            is_correct=grade.isCorrect,
            attempt_id=attempt["id"],
            created_at=now,
        )
    except Exception:
        logger.exception("practice memory_persist_error user_id=%s attempt=%s", user_id, attempt["id"])
        memory_updates = []

    return {
        "attempt": attempt,
        "updatedSkill": updated_skill,
        "recordedError": recorded_error,
        "memoryUpdates": memory_updates,
    }


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

        requested_type = req.practiceType.value if req.practiceType else None
        decision = recommend_next_action(
            req.userId,
            requested_skill_code=req.targetSkillCode,
            requested_practice_type=requested_type,
        )
        skill_code = decision.get("targetSkillCode") or DEFAULT_SKILL
        selected_type = decision.get("practiceType") or requested_type
        taxonomy = ERROR_TAXONOMY.get(skill_code, {"label": skill_code, "zhLabel": skill_code})

        recent_errors = list_recent_errors(
            req.userId,
            limit=50,
        )
        matching_examples = [
            {"originalText": e.get("originalText"), "correctedText": e.get("correctedText")}
            for e in recent_errors
            if e.get("code") == skill_code
        ]
        examples = matching_examples[:8]

        try:
            memory_pack = retrieve_memory_pack(
                req.userId,
                f"Generate the next {selected_type} exercise for {skill_code}; use relevant "
                "learning preferences, strategies, weaknesses, and practice outcomes.",
                purpose="practice_generation",
            )
        except Exception:
            logger.exception("practice memory_retrieval_error user_id=%s", req.userId)
            memory_pack = {"text": "", "items": [], "estimatedTokens": 0, "traceId": None}

        ai_ex = generate_practice_exercise(
            skill_code=skill_code,
            zh_label=taxonomy["zhLabel"],
            cefr_level=profile.get("estimatedLevel", "B1"),
            recent_error_examples=examples,
            llm_provider=llm_provider,
            practice_type=selected_type,
            output_language=req.outputLanguage,
            memory_context=memory_pack.get("text"),
            decision_reason=decision.get("reason"),
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
            "outputLanguage": req.outputLanguage,
            "createdAt": now,
            "decision": decision,
            "memoryRecall": {
                "traceId": memory_pack.get("traceId"),
                "memoryIds": [item.get("id") for item in memory_pack.get("items", [])],
                "estimatedTokens": memory_pack.get("estimatedTokens", 0),
            },
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
        if (
            not identity.has_unlimited_llm_quota
            and len(req.userAnswer) > PLATFORM_PRACTICE_ANSWER_CHAR_LIMIT
        ):
            raise HTTPException(
                status_code=400,
                detail=f"Practice answers are limited to {PLATFORM_PRACTICE_ANSWER_CHAR_LIMIT} characters for the current access tier.",
            )
        exercise = get_exercise(req.userId, req.exerciseId)
        if not exercise:
            raise HTTPException(status_code=404, detail="Exercise not found")

        grade = grade_practice(
            question=exercise["question"],
            expected_answer=exercise.get("answer", ""),
            user_answer=req.userAnswer,
            target_skill_code=exercise["targetSkillCode"],
            llm_provider=llm_provider,
            output_language=req.outputLanguage,
        )

        outcome = _record_practice_outcome(
            user_id=req.userId,
            skill_code=exercise["targetSkillCode"],
            user_answer=req.userAnswer,
            grade=grade,
            now=now,
            exercise_id=req.exerciseId,
            prompt_zh=exercise.get("promptZh"),
            explanation_zh=exercise.get("explanationZh"),
            exercise_type=exercise.get("type", "fix_sentence"),
        )

        return {
            "grade": grade.model_dump(mode="json"),
            "attempt": outcome["attempt"],
            "updatedSkill": outcome["updatedSkill"],
            "recordedError": outcome["recordedError"],
            "memoryUpdates": outcome["memoryUpdates"],
        }

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=502, detail=f"AI error: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/practice/grade")
def grade_adhoc(
    req: GradePracticeRequest,
    llm_provider: LLMProviderConfig | None = Depends(get_llm_provider),
    identity: Identity = Depends(rate_limited("practice_submit")),
):
    """Grade an ad-hoc exercise (e.g. a plan task exercise) and record mistakes.

    Unlike /practice/submit this needs no stored exercise — the question and
    model answer come with the request. Wrong answers are written to the
    weakness library so plan-exercise mistakes feed the next plan / analysis.
    """
    req.userId = identity.user_id
    try:
        now = now_iso()
        if (
            not identity.has_unlimited_llm_quota
            and len(req.userAnswer) > PLATFORM_PRACTICE_ANSWER_CHAR_LIMIT
        ):
            raise HTTPException(
                status_code=400,
                detail=f"Practice answers are limited to {PLATFORM_PRACTICE_ANSWER_CHAR_LIMIT} characters for the current access tier.",
            )

        grade = grade_practice(
            question=req.question,
            expected_answer=req.expectedAnswer,
            user_answer=req.userAnswer,
            target_skill_code=req.targetSkillCode,
            llm_provider=llm_provider,
            output_language=req.outputLanguage,
        )

        outcome = _record_practice_outcome(
            user_id=req.userId,
            skill_code=req.targetSkillCode,
            user_answer=req.userAnswer,
            grade=grade,
            now=now,
            prompt_zh=req.promptZh,
            explanation_zh=req.explanationZh,
            exercise_type=req.exerciseType.value if req.exerciseType else "fix_sentence",
        )

        return {
            "grade": grade.model_dump(mode="json"),
            "attempt": outcome["attempt"],
            "updatedSkill": outcome["updatedSkill"],
            "recordedError": outcome["recordedError"],
            "memoryUpdates": outcome["memoryUpdates"],
        }

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=502, detail=f"AI error: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
