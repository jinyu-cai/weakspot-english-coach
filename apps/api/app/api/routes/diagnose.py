import asyncio
import json
import logging
import time
from decimal import Decimal
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from app.api.deps import Identity, get_llm_provider, rate_limited
from app.core.mastery import update_skill_from_error
from app.core.taxonomy import ERROR_TAXONOMY
from app.core.text_hash import normalized_text_hash
from app.db.repositories import (
    get_or_create_profile,
    get_submission,
    get_submission_hash,
    list_errors_for_submission,
    list_skills,
    now_iso,
    put_skill,
    put_submission_hash,
    save_error,
    save_note,
    save_profile,
    save_submission,
)
from app.models.diagnostic import DiagnoseRequest
from app.services.ai_client import LLMProviderConfig
from app.services.diagnose_service import diagnose_english_text, select_diagnose_model

router = APIRouter()
logger = logging.getLogger("uvicorn.error")


def _elapsed_ms(started: float) -> int:
    return int((time.perf_counter() - started) * 1000)


def _json_default(obj):
    if isinstance(obj, Decimal):
        return int(obj) if obj == int(obj) else float(obj)
    return str(obj)


def _language_text_hash(text: str, output_language: str) -> str:
    return f"{output_language}:{normalized_text_hash(text)}"


@router.post("/diagnose")
async def diagnose(
    req: DiagnoseRequest,
    llm_provider: LLMProviderConfig | None = Depends(get_llm_provider),
    identity: Identity = Depends(rate_limited("diagnose", allow_byok_unlimited=True)),
):
    """Diagnose a piece of writing, persist everything, and update the learner profile.

    Uses StreamingResponse with periodic keepalive bytes so that Cloudflare's
    100-second proxy timeout never fires, even when the upstream LLM takes
    several minutes.  The response body is ``<spaces><json>`` — leading
    whitespace is ignored by JSON.parse on the client side.
    """
    req.userId = identity.user_id
    request_id = uuid4().hex[:10]
    started = time.perf_counter()
    diagnosis_mode = req.diagnosisMode
    selected_model = select_diagnose_model(diagnosis_mode, llm_provider=llm_provider)

    logger.info(
        "diagnose[%s] start user_id=%s mode=%s model=%s chars=%d provider=%s",
        request_id,
        req.userId,
        diagnosis_mode,
        selected_model or "unconfigured",
        len(req.text),
        "custom" if llm_provider else "server-default",
    )

    loop = asyncio.get_running_loop()

    # --- Fast pre-checks (profile + dedup) run in threadpool ---
    try:
        pre = await loop.run_in_executor(
            None, lambda: _pre_check(req.userId, req.text, req.outputLanguage, request_id)
        )
    except Exception as e:
        logger.exception("diagnose[%s] pre_check_error", request_id)
        raise HTTPException(
            status_code=500, detail=f"Request {request_id} failed: {e}"
        ) from e

    if pre.get("duplicate"):
        return pre["response"]

    profile = pre["profile"]
    text_hash = pre["text_hash"]

    resp_headers = {
        "X-Request-ID": request_id,
        "X-Diagnose-Mode": diagnosis_mode,
        "X-LLM-Model": selected_model or "unconfigured",
        "X-Accel-Buffering": "no",
    }

    async def generate():
        future = loop.run_in_executor(
            None,
            lambda: _llm_and_persist(
                req, profile, text_hash, request_id, started,
                diagnosis_mode, identity, llm_provider,
            ),
        )

        # Immediate keepalive flushes HTTP headers through Cloudflare.
        yield b" "

        while not future.done():
            await asyncio.sleep(10)
            if not future.done():
                yield b" "

        try:
            result = future.result()
        except ValueError as e:
            logger.exception(
                "diagnose[%s] ai_error total_ms=%d",
                request_id, _elapsed_ms(started),
            )
            result = {"error": True, "detail": f"AI error [{request_id}]: {e}"}
        except Exception as e:
            logger.exception(
                "diagnose[%s] server_error total_ms=%d",
                request_id, _elapsed_ms(started),
            )
            result = {"error": True, "detail": f"Request {request_id} failed: {e}"}

        yield json.dumps(result, ensure_ascii=False, default=_json_default).encode()

    return StreamingResponse(
        generate(), media_type="application/json", headers=resp_headers,
    )


# ---------------------------------------------------------------------------
# Helpers — run inside the threadpool via run_in_executor
# ---------------------------------------------------------------------------

def _pre_check(user_id: str, text: str, output_language: str, request_id: str) -> dict:
    """Load profile, check for duplicate submission."""
    profile = get_or_create_profile(user_id)
    text_hash = _language_text_hash(text, output_language)
    existing_hash = get_submission_hash(user_id, text_hash)

    if existing_hash:
        prior = get_submission(
            user_id,
            existing_hash.get("submissionCreatedAt", ""),
            existing_hash.get("submissionId", ""),
        )
        if prior:
            prior_errors = list_errors_for_submission(
                user_id,
                existing_hash.get("submissionCreatedAt", ""),
                existing_hash.get("submissionId", ""),
            )
            logger.info(
                "diagnose[%s] duplicate of %s — returned prior result, skipped persistence",
                request_id,
                prior.get("id"),
            )
            reconstructed = {
                "cefrEstimate": prior.get("cefrEstimate"),
                "overallScore": int(prior.get("overallScore", 0) or 0),
                "summaryZh": prior.get("summaryZh", ""),
                "strengthsZh": prior.get("strengthsZh") or [],
                "weaknessesZh": prior.get("weaknessesZh") or [],
                "correctedText": prior.get("correctedText", ""),
                "errors": prior_errors,
                "skillUpdates": [],
                "recommendedNextActionsZh": prior.get("recommendedNextActionsZh") or [],
            }
            return {
                "duplicate": True,
                "response": {
                    "submission": prior,
                    "diagnostic": reconstructed,
                    "updatedSkills": [],
                    "profile": profile,
                    "duplicate": True,
                    "duplicateOf": prior.get("id"),
                },
            }

    return {"duplicate": False, "profile": profile, "text_hash": text_hash}


def _llm_and_persist(req, profile, text_hash, request_id, started, diagnosis_mode, identity, llm_provider):
    """Call LLM, persist submission + errors + notes + skills, return response dict."""
    now = now_iso()

    stage_started = time.perf_counter()
    diagnostic = diagnose_english_text(
        req.text,
        diagnosis_mode=diagnosis_mode,
        output_language=req.outputLanguage,
        llm_provider=llm_provider,
        max_output_tokens=None if identity.has_unlimited_llm_quota else identity.max_output_tokens,
        trace_id=request_id,
    )
    llm_ms = _elapsed_ms(stage_started)
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
        "overallScore": diagnostic.overallScore,
        "summaryZh": diagnostic.summaryZh,
        "strengthsZh": diagnostic.strengthsZh,
        "weaknessesZh": diagnostic.weaknessesZh,
        "recommendedNextActionsZh": diagnostic.recommendedNextActionsZh,
        "textHash": text_hash,
        "outputLanguage": req.outputLanguage,
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
        existing_skills[err.code] = skill
        updated_skills.append(skill)

    saved_notes = []
    for note_ai in diagnostic.learningNotes:
        note_id = f"note_{uuid4().hex[:12]}"
        note = {
            "id": note_id,
            "userId": req.userId,
            "submissionId": submission_id,
            "type": note_ai.type,
            "topic": note_ai.topic,
            "original": note_ai.original,
            "natural": note_ai.natural,
            "explanation": note_ai.explanation,
            "context": note_ai.context,
            "examples": note_ai.examples,
            "createdAt": now,
        }
        save_note(note)
        saved_notes.append(note)

    profile["estimatedLevel"] = diagnostic.cefrEstimate.value
    profile["totalSubmissions"] = int(profile.get("totalSubmissions", 0)) + 1
    profile["updatedAt"] = now
    save_profile(profile)
    put_submission_hash(req.userId, text_hash, submission_id, now)
    persist_ms = _elapsed_ms(stage_started)

    logger.info(
        "diagnose[%s] complete total_ms=%d llm_ms=%d persist_ms=%d saved_errors=%d updated_skills=%d notes=%d",
        request_id,
        _elapsed_ms(started),
        llm_ms,
        persist_ms,
        len(saved_errors),
        len(updated_skills),
        len(saved_notes),
    )

    return {
        "submission": submission,
        "diagnostic": {**diagnostic.model_dump(mode="json"), "errors": saved_errors},
        "updatedSkills": updated_skills,
        "profile": profile,
        "duplicate": False,
        "notes": saved_notes,
    }
