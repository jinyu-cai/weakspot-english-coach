import asyncio
import hashlib
import json
import logging
import time
from decimal import Decimal
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import StreamingResponse

from app.api.deps import Identity, get_llm_provider, rate_limited
from app.core.mastery import update_skill_from_error
from app.core.taxonomy import ERROR_TAXONOMY
from app.core.text_hash import normalized_text_hash
from app.db.repositories import (
    get_or_create_profile,
    get_activity_run,
    get_submission,
    get_submission_hash,
    claim_diagnosis_request,
    list_errors_for_submission,
    list_skills,
    now_iso,
    put_skill,
    put_submission_hash,
    release_diagnosis_request,
    save_diagnosis_draft,
    save_error,
    save_note,
    save_profile,
    save_submission,
)
from app.models.diagnostic import DiagnoseRequest, DiagnosticAIResult
from app.models.learning import (
    CreateActivityRunRequest,
    RecordEvidenceRequest,
    UpdateActivityRunRequest,
)
from app.services.ai_client import LLMProviderConfig
from app.services.diagnose_service import diagnose_english_text, select_diagnose_model
from app.services.memory_service import (
    heuristic_memory_candidates,
    memory_candidates_from_errors,
    remember_candidates,
    retrieve_memory_pack,
)
from app.services.learning_service import (
    create_activity_run,
    record_evidence,
    update_activity_run,
)

router = APIRouter()
logger = logging.getLogger("uvicorn.error")


class DiagnosisInProgressError(RuntimeError):
    pass


def _elapsed_ms(started: float) -> int:
    return int((time.perf_counter() - started) * 1000)


def _json_default(obj):
    if isinstance(obj, Decimal):
        return int(obj) if obj == int(obj) else float(obj)
    return str(obj)


def _language_text_hash(
    text: str,
    output_language: str,
    analysis_context: str | None = None,
    learning_context: dict | None = None,
) -> str:
    context_hash = (
        f":context:{normalized_text_hash(analysis_context)}"
        if analysis_context
        else ""
    )
    learning_hash = (
        f":learning:{normalized_text_hash(json.dumps(learning_context, sort_keys=True))}"
        if learning_context
        else ""
    )
    return f"{output_language}:{normalized_text_hash(text)}{context_hash}{learning_hash}"


@router.post("/diagnose")
async def diagnose(
    req: DiagnoseRequest,
    response: Response,
    llm_provider: LLMProviderConfig | None = Depends(get_llm_provider),
    identity: Identity = Depends(rate_limited("diagnose")),
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
            None,
            lambda: _pre_check(
                req.userId,
                req.text,
                req.outputLanguage,
                request_id,
                req.analysisContext,
                req.learningContext.model_dump(mode="json") if req.learningContext else None,
            ),
        )
    except DiagnosisInProgressError as e:
        raise HTTPException(
            status_code=409,
            detail={"code": "diagnosis_in_progress", "message": str(e)},
        ) from e
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
                diagnosis_mode, identity, llm_provider, pre["claim"],
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
            release_diagnosis_request(req.userId, text_hash, request_id)
            logger.exception(
                "diagnose[%s] ai_error total_ms=%d",
                request_id, _elapsed_ms(started),
            )
            result = {"error": True, "detail": f"AI error [{request_id}]: {e}"}
        except Exception as e:
            release_diagnosis_request(req.userId, text_hash, request_id)
            logger.exception(
                "diagnose[%s] server_error total_ms=%d",
                request_id, _elapsed_ms(started),
            )
            result = {"error": True, "detail": f"Request {request_id} failed: {e}"}

        yield json.dumps(result, ensure_ascii=False, default=_json_default).encode()

    stream = StreamingResponse(
        generate(), media_type="application/json", headers=resp_headers,
    )
    # Dependencies attach a first-visit guest cookie to FastAPI's injected
    # Response. Copy it to the explicit streaming response so the learner keeps
    # the same server-resolved identity on the next page/API call.
    for name, value in response.raw_headers:
        if name.lower() == b"set-cookie":
            stream.raw_headers.append((name, value))
    return stream


# ---------------------------------------------------------------------------
# Helpers — run inside the threadpool via run_in_executor
# ---------------------------------------------------------------------------

def _pre_check(
    user_id: str,
    text: str,
    output_language: str,
    request_id: str,
    analysis_context: str | None = None,
    learning_context: dict | None = None,
) -> dict:
    """Load profile, check for duplicate submission."""
    profile = get_or_create_profile(user_id)
    text_hash = _language_text_hash(
        text,
        output_language,
        analysis_context,
        learning_context,
    )
    existing_hash = get_submission_hash(user_id, text_hash)

    if existing_hash and (
        existing_hash.get("status") == "complete"
        or not existing_hash.get("status")
    ):
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
                "targetEvidence": prior.get("targetEvidence") or [],
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

    claim = claim_diagnosis_request(user_id, text_hash, request_id)
    if claim.get("claimState") == "complete":
        return _pre_check(
            user_id,
            text,
            output_language,
            request_id,
            analysis_context,
            learning_context,
        )
    if claim.get("claimState") != "acquired":
        raise DiagnosisInProgressError(
            "This identical diagnosis is already being processed."
        )
    return {
        "duplicate": False,
        "profile": profile,
        "text_hash": text_hash,
        "claim": claim,
    }


def _llm_and_persist(req, profile, text_hash, request_id, started, diagnosis_mode, identity, llm_provider, claim):
    """Call LLM, persist submission + errors + notes + skills, return response dict."""
    now = str(claim.get("submissionCreatedAt") or now_iso())

    try:
        memory_pack = retrieve_memory_pack(
            req.userId,
            f"Diagnose this learner's writing and personalize useful feedback: {req.text[:1200]}",
            purpose="diagnosis",
        )
    except Exception:
        logger.exception("diagnose[%s] memory_retrieval_error", request_id)
        memory_pack = {"text": "", "items": [], "estimatedTokens": 0, "traceId": None}

    stage_started = time.perf_counter()
    if isinstance(claim.get("diagnosticDraft"), dict):
        diagnostic = DiagnosticAIResult.model_validate(claim["diagnosticDraft"])
    else:
        diagnostic = diagnose_english_text(
            req.text,
            diagnosis_mode=diagnosis_mode,
            output_language=req.outputLanguage,
            llm_provider=llm_provider,
            max_output_tokens=None if identity.has_unlimited_llm_quota else identity.max_output_tokens,
            trace_id=request_id,
            memory_context=memory_pack.get("text"),
            analysis_context=req.analysisContext,
            learning_context=req.learningContext,
        )
        save_diagnosis_draft(
            req.userId,
            text_hash,
            request_id,
            diagnostic.model_dump(mode="json"),
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
    submission_id = str(claim["submissionId"])
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
        "analysisContext": req.analysisContext,
        "learningContext": (
            req.learningContext.model_dump(mode="json")
            if req.learningContext
            else None
        ),
        "targetEvidence": [
            item.model_dump(mode="json") for item in diagnostic.targetEvidence
        ],
        "createdAt": now,
    }
    save_submission(submission)

    existing_skills = {s["skillCode"]: s for s in list_skills(req.userId)}
    updated_skills = []
    saved_errors = []

    for error_index, err in enumerate(diagnostic.errors):
        error_id = "err_" + hashlib.sha256(
            f"{submission_id}:error:{error_index}".encode("utf-8")
        ).hexdigest()[:20]
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

        current_skill = existing_skills.get(err.code)
        processed_ids = list((current_skill or {}).get("recentDiagnosticErrorIds") or [])
        if error_id in processed_ids:
            skill = current_skill
        else:
            taxonomy = ERROR_TAXONOMY.get(err.code, {"label": err.code, "zhLabel": err.code})
            skill = update_skill_from_error(
                existing=current_skill,
                user_id=req.userId,
                skill_code=err.code,
                label=taxonomy["label"],
                zh_label=taxonomy["zhLabel"],
                severity=err.severity.value,
                now=now,
            )
            skill["recentDiagnosticErrorIds"] = [*processed_ids, error_id][-50:]
            put_skill(skill)
        existing_skills[err.code] = skill
        updated_skills.append(skill)

    saved_notes = []
    for note_index, note_ai in enumerate(diagnostic.learningNotes):
        note_id = "note_" + hashlib.sha256(
            f"{submission_id}:note:{note_index}".encode("utf-8")
        ).hexdigest()[:20]
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

    recent_submission_ids = list(profile.get("recentSubmissionIds") or [])
    profile["estimatedLevel"] = diagnostic.cefrEstimate.value
    if submission_id not in recent_submission_ids:
        profile["totalSubmissions"] = int(profile.get("totalSubmissions", 0)) + 1
        profile["recentSubmissionIds"] = [*recent_submission_ids, submission_id][-50:]
    profile["updatedAt"] = now
    save_profile(profile)

    try:
        memory_candidates = [
            *diagnostic.memoryCandidates,
            *heuristic_memory_candidates(req.text),
            *memory_candidates_from_errors(saved_errors),
        ]
        saved_memories = remember_candidates(
            req.userId,
            memory_candidates,
            source_type="diagnosis",
            source_id=submission_id,
        )
    except Exception:
        logger.exception("diagnose[%s] memory_persist_error", request_id)
        saved_memories = []

    learning_evidence = []
    if req.learningContext:
        target_by_code = {
            item.skillCode: item.model_dump(mode="json")
            for item in diagnostic.targetEvidence
            if item.skillCode in req.learningContext.targetSkills
        }
        errors_by_code = {
            error["code"]: error for error in saved_errors
            if error.get("code") in req.learningContext.targetSkills
        }
        normalized_text = " ".join(req.text.casefold().split())
        for skill_code in req.learningContext.targetSkills:
            payload = dict(target_by_code.get(skill_code) or {
                "skillCode": skill_code,
                "opportunityPresent": False,
                "outcome": "no_opportunity",
                "evidenceQuote": "",
                "confidence": 0.0,
            })
            matching_error = errors_by_code.get(skill_code)
            if matching_error:
                payload.update({
                    "opportunityPresent": True,
                    "outcome": "failure",
                    "evidenceQuote": matching_error.get("originalText", ""),
                    "confidence": max(0.75, float(payload.get("confidence", 0.0))),
                })
            quote = " ".join(str(payload.get("evidenceQuote") or "").casefold().split())
            if payload.get("opportunityPresent") and (not quote or quote not in normalized_text):
                payload.update({
                    "opportunityPresent": False,
                    "outcome": "no_opportunity",
                    "evidenceQuote": "",
                    "confidence": 0.0,
                })
            learning_evidence.append(record_evidence(
                req.userId,
                RecordEvidenceRequest(
                    clientEventId=f"diagnosis:{submission_id}:{skill_code}",
                    runId=req.learningContext.activityRunId,
                    sourceId=submission_id,
                    skillCode=skill_code,
                    outcome=payload["outcome"],
                    opportunityPresent=bool(payload["opportunityPresent"]),
                    supportLevel=req.learningContext.hintLevel,
                    modality=req.learningContext.modality,
                    taskType=req.learningContext.missionType,
                    taskDifficulty=req.learningContext.taskDifficulty,
                    evaluatorConfidence=float(payload.get("confidence", 0.0)),
                    contextKey=req.learningContext.contextKey,
                    novelContext=req.learningContext.novelContext,
                    delayed=req.learningContext.delayed,
                    evidenceQuote=str(payload.get("evidenceQuote") or ""),
                ),
            ))
        activity_run = get_activity_run(
            req.userId,
            req.learningContext.activityRunId,
        ) or {}
        update_activity_run(
            req.userId,
            req.learningContext.activityRunId,
            UpdateActivityRunRequest(
                status="completed",
                hintLevel=req.learningContext.hintLevel,
                playCount=req.learningContext.playCount,
                attemptCount=int(activity_run.get("attemptCount", 0)) + 1,
            ),
        )
    else:
        diagnostic_targets = list(dict.fromkeys(
            error["code"] for error in saved_errors if error.get("code") in ERROR_TAXONOMY
        ))
        run = create_activity_run(
            req.userId,
            CreateActivityRunRequest(
                activityType="diagnose",
                sourceId=submission_id,
                title="Writing diagnosis",
                taskType="writing_diagnosis",
                targetSkills=diagnostic_targets[:8],
                modality="writing",
                difficulty=diagnostic.cefrEstimate.value,
            ),
        )
        update_activity_run(
            req.userId,
            run["id"],
            UpdateActivityRunRequest(status="started"),
        )
        for skill_code in diagnostic_targets:
            error = next(item for item in saved_errors if item["code"] == skill_code)
            confidence = {"low": 0.7, "medium": 0.82, "high": 0.92}.get(
                str(error.get("severity") or ""),
                0.75,
            )
            learning_evidence.append(record_evidence(
                req.userId,
                RecordEvidenceRequest(
                    clientEventId=f"diagnosis:{submission_id}:{skill_code}",
                    runId=run["id"],
                    sourceId=submission_id,
                    skillCode=skill_code,
                    outcome="failure",
                    opportunityPresent=True,
                    supportLevel=0,
                    modality="writing",
                    taskType="writing_diagnosis",
                    taskDifficulty=0.55,
                    evaluatorConfidence=confidence,
                    contextKey=f"diagnosis:{submission_id}",
                    novelContext=True,
                    evidenceQuote=str(error.get("originalText") or ""),
                ),
            ))
        update_activity_run(
            req.userId,
            run["id"],
            UpdateActivityRunRequest(status="completed", attemptCount=1),
        )
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

    result = {
        "submission": submission,
        "diagnostic": {**diagnostic.model_dump(mode="json"), "errors": saved_errors},
        "updatedSkills": updated_skills,
        "profile": profile,
        "duplicate": False,
        "notes": saved_notes,
        "memoriesSaved": saved_memories,
        "learningEvidence": learning_evidence,
        "memoryRecall": {
            "traceId": memory_pack.get("traceId"),
            "memoryIds": [item.get("id") for item in memory_pack.get("items", [])],
            "estimatedTokens": memory_pack.get("estimatedTokens", 0),
        },
    }
    put_submission_hash(req.userId, text_hash, submission_id, now, request_id)
    return result
