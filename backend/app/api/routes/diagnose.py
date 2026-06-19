import logging
import time
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Response

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
from app.services.diagnose_service import diagnose_english_text, select_diagnose_model

router = APIRouter()
logger = logging.getLogger("uvicorn.error")


def elapsed_ms(started: float) -> int:
    return int((time.perf_counter() - started) * 1000)


@router.post("/diagnose")
def diagnose(
    req: DiagnoseRequest,
    response: Response,
    llm_provider: LLMProviderConfig | None = Depends(get_llm_provider),
):
    """Diagnose a piece of writing, persist everything, and update the learner profile."""
    request_id = uuid4().hex[:10]
    started = time.perf_counter()
    diagnosis_mode = req.diagnosisMode
    selected_model = select_diagnose_model(diagnosis_mode, llm_provider=llm_provider)

    response.headers["X-Request-ID"] = request_id
    response.headers["X-Diagnose-Mode"] = diagnosis_mode
    response.headers["X-LLM-Model"] = selected_model or "unconfigured"

    try:
        logger.info(
            "diagnose[%s] start user_id=%s mode=%s model=%s chars=%d provider=%s",
            request_id,
            req.userId,
            diagnosis_mode,
            selected_model or "unconfigured",
            len(req.text),
            "custom" if llm_provider else "server-default",
        )

        now = now_iso()
        stage_started = time.perf_counter()
        profile = get_or_create_profile(req.userId)
        profile_load_ms = elapsed_ms(stage_started)

        stage_started = time.perf_counter()
        diagnostic = diagnose_english_text(
            req.text,
            diagnosis_mode=diagnosis_mode,
            llm_provider=llm_provider,
            trace_id=request_id,
        )
        llm_ms = elapsed_ms(stage_started)
        logger.info(
            "diagnose[%s] llm_done llm_ms=%d errors=%d score=%d cefr=%s",
            request_id,
            llm_ms,
            len(diagnostic.errors),
            diagnostic.overallScore,
            diagnostic.cefrEstimate.value,
        )

        stage_started = time.perf_counter()
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
        persist_ms = elapsed_ms(stage_started)

        logger.info(
            "diagnose[%s] complete total_ms=%d profile_load_ms=%d llm_ms=%d persist_ms=%d saved_errors=%d updated_skills=%d",
            request_id,
            elapsed_ms(started),
            profile_load_ms,
            llm_ms,
            persist_ms,
            len(saved_errors),
            len(updated_skills),
        )

        return {
            "submission": submission,
            "diagnostic": {**diagnostic.model_dump(mode="json"), "errors": saved_errors},
            "updatedSkills": updated_skills,
            "profile": profile,
        }

    except ValueError as e:
        logger.exception("diagnose[%s] ai_error total_ms=%d", request_id, elapsed_ms(started))
        raise HTTPException(status_code=502, detail=f"AI error [{request_id}]: {e}") from e
    except Exception as e:
        logger.exception("diagnose[%s] server_error total_ms=%d", request_id, elapsed_ms(started))
        raise HTTPException(status_code=500, detail=f"Request {request_id} failed: {e}") from e
