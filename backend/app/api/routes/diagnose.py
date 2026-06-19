from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import get_llm_provider
from app.core.mastery import update_skill_from_error
from app.core.taxonomy import ERROR_TAXONOMY
from app.db.repositories import (
    get_or_create_profile,
    list_skills,
    now_iso,
    put_skill,
    save_error,
    save_profile,
    save_submission,
)
from app.models.diagnostic import DiagnoseRequest
from app.services.ai_client import LLMProviderConfig
from app.services.diagnose_service import diagnose_english_text

router = APIRouter()


@router.post("/diagnose")
def diagnose(req: DiagnoseRequest, llm_provider: LLMProviderConfig | None = Depends(get_llm_provider)):
    """Diagnose a piece of writing, persist everything, and update the learner profile."""
    try:
        now = now_iso()
        profile = get_or_create_profile(req.userId)

        diagnostic = diagnose_english_text(req.text, llm_provider=llm_provider)

        submission_id = f"sub_{uuid4().hex[:12]}"
        submission = {
            "id": submission_id,
            "userId": req.userId,
            "mode": "writing",
            "originalText": req.text,
            "correctedText": diagnostic.correctedText,
            "cefrEstimate": diagnostic.cefrEstimate.value,
            "summaryZh": diagnostic.summaryZh,
            "createdAt": now,
        }
        save_submission(submission)

        existing_skills = {s["skillCode"]: s for s in list_skills(req.userId)}

        updated_skills = []
        saved_errors = []

        for err in diagnostic.errors:
            error_id = f"err_{uuid4().hex[:12]}"
            error = {
                "id": error_id,
                "userId": req.userId,
                "submissionId": submission_id,
                "code": err.code,
                "category": err.category,
                "severity": err.severity.value,
                "originalText": err.originalText,
                "correctedText": err.correctedText,
                "explanationZh": err.explanationZh,
                "microLessonZh": err.microLessonZh,
                "practiceGoal": err.practiceGoal,
                "createdAt": now,
            }
            save_error(error)
            saved_errors.append(error)

            taxonomy = ERROR_TAXONOMY.get(err.code, {"label": err.code, "zhLabel": err.code})
            skill = update_skill_from_error(
                existing=existing_skills.get(err.code),
                user_id=req.userId,
                skill_code=err.code,
                label=taxonomy["label"],
                zh_label=taxonomy["zhLabel"],
                severity=err.severity.value,
                now=now,
            )
            put_skill(skill)
            # so repeated codes within one submission accumulate instead of overwrite
            existing_skills[err.code] = skill
            updated_skills.append(skill)

        profile["estimatedLevel"] = diagnostic.cefrEstimate.value
        profile["totalSubmissions"] = int(profile.get("totalSubmissions", 0)) + 1
        profile["updatedAt"] = now
        save_profile(profile)

        return {
            "submission": submission,
            "diagnostic": {**diagnostic.model_dump(mode="json"), "errors": saved_errors},
            "updatedSkills": updated_skills,
            "profile": profile,
        }

    except ValueError as e:
        raise HTTPException(status_code=502, detail=f"AI error: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
