import logging
import time
from uuid import uuid4

from fastapi import APIRouter, Body, Depends, HTTPException

from app.api.deps import Identity, get_llm_provider, rate_limited
from app.config import settings
from app.core.mastery import update_skill_from_error
from app.core.taxonomy import ERROR_TAXONOMY
from app.db.repositories import (
    get_chat_session,
    list_chat_messages,
    list_chat_sessions,
    list_skills,
    now_iso,
    put_skill,
    save_error,
    save_chat_message,
    save_chat_session,
    save_note,
    update_chat_session_analysis,
    update_chat_session_summary,
)
from app.models.chat import AnalyzeSessionRequest, ChatCreateSessionRequest, ChatPredictRequest, ChatSendRequest
from app.services.ai_client import LLMProviderConfig
from app.services.chat_service import chat_reply, predict_completion
from app.services.model_catalog import server_model_by_id, server_model_for_name, server_model_pair
from app.services.memory_service import (
    heuristic_memory_candidates,
    memory_candidates_from_errors,
    remember_candidates,
    retrieve_memory_pack,
)
from app.services.session_analysis_service import analyze_session

router = APIRouter(prefix="/chat")
logger = logging.getLogger("uvicorn.error")

FALLBACK_DEFAULT_TEXT_CHAT_MODEL = "deepseek-v4-flash"


def _default_text_model() -> str:
    return (
        settings.default_llm_fast_model
        or settings.default_llm_model
        or FALLBACK_DEFAULT_TEXT_CHAT_MODEL
    ).strip()


def _allowed_text_models() -> set[str]:
    """Models that can use the active default provider without an ID."""
    configured = {
        settings.default_llm_fast_model.strip() if settings.default_llm_fast_model else "",
        settings.default_llm_model.strip() if settings.default_llm_model else "",
    }
    return {model for model in configured if model}


def _elapsed_ms(started: float) -> int:
    return int((time.perf_counter() - started) * 1000)


def _unlimited_llm_output(identity: Identity) -> bool:
    return identity.is_unlimited


def _validate_text_model(model: str | None) -> str:
    selected = (model or _default_text_model()).strip() or _default_text_model()
    allowed = _allowed_text_models()
    if selected not in allowed:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "invalid_text_model",
                "message": "Unsupported text chat model.",
                "allowed": sorted(allowed),
            },
        )
    return selected


def _new_session_model(
    requested_model: str | None,
    llm_provider: LLMProviderConfig | None,
) -> tuple[str, str | None, str | None, str | None]:
    """Resolve a new session to its exact server model when possible."""
    if llm_provider is not None:
        text_model = (
            llm_provider.model
            if llm_provider.is_byok
            else llm_provider.fast_model or llm_provider.model
        )
        return (
            text_model,
            llm_provider.server_model_id,
            llm_provider.server_deep_model_id,
            llm_provider.server_fast_model_id,
        )

    # Kept for backwards-compatible clients that send an actual model name in
    # the request body. Resolve it to the provider that owns it, rather than
    # forwarding a DeepSeek model name to a Qwen endpoint (or vice versa).
    selected = server_model_for_name(requested_model or "")
    if selected is not None:
        return selected.model, selected.id, None, None

    return _validate_text_model(requested_model), None, None, None


def _session_provider(
    session: dict,
    request_provider: LLMProviderConfig | None,
) -> LLMProviderConfig | None:
    """Prefer a session's saved server-model ID over later UI changes.

    BYOK credentials are intentionally never stored, so a currently supplied
    BYOK provider is the one exception and overrides the saved server choice.
    """
    if request_provider is not None and request_provider.is_byok:
        return request_provider

    deep_model_id = str(session.get("llmServerDeepModelId") or "").strip()
    fast_model_id = str(session.get("llmServerFastModelId") or "").strip()
    if deep_model_id and fast_model_id:
        selected_pair = server_model_pair(deep_model_id, fast_model_id)
        if selected_pair is not None:
            return selected_pair

    server_model_id = str(session.get("llmServerModelId") or "").strip()
    if server_model_id:
        selected = server_model_by_id(server_model_id)
        if selected is not None:
            return selected.config

    # Sessions created before model IDs existed may store an actual model name.
    # Resolve it if that provider still exists. Otherwise, the caller safely
    # falls back to the current server default below.
    selected = server_model_for_name(str(session.get("textModel") or ""))
    return selected.config if selected is not None else None


def _session_text_model(session: dict, llm_provider: LLMProviderConfig | None) -> str:
    if llm_provider is not None:
        if llm_provider.is_byok:
            return llm_provider.model
        return llm_provider.fast_model or llm_provider.model
    stored = str(session.get("textModel") or "").strip()
    return stored if stored in _allowed_text_models() else _default_text_model()


@router.post("/sessions")
def create_session(
    req: ChatCreateSessionRequest,
    llm_provider: LLMProviderConfig | None = Depends(get_llm_provider),
    identity: Identity = Depends(rate_limited("chat")),
):
    req.userId = identity.user_id
    text_model, server_model_id, deep_model_id, fast_model_id = _new_session_model(req.textModel, llm_provider)
    now = now_iso()
    session_id = f"cs_{uuid4().hex[:12]}"
    session = {
        "id": session_id,
        "userId": req.userId,
        "topic": req.topic,
        "scenarioPrompt": req.scenarioPrompt,
        "textModel": text_model,
        "llmServerModelId": server_model_id,
        "llmServerDeepModelId": deep_model_id,
        "llmServerFastModelId": fast_model_id,
        "messageCount": 0,
        "summary": None,
        "createdAt": now,
        "updatedAt": now,
    }
    save_chat_session(session)
    return {"session": session}


@router.get("/sessions")
def get_sessions(
    identity: Identity = Depends(rate_limited("chat")),
):
    sessions = list_chat_sessions(identity.user_id)
    return {"sessions": sessions}


@router.get("/sessions/{session_id}/messages")
def get_messages(
    session_id: str,
    identity: Identity = Depends(rate_limited("chat")),
):
    session = get_chat_session(identity.user_id, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found.")
    messages = list_chat_messages(identity.user_id, session_id, limit=None)
    session["messageCount"] = len(messages)
    return {"session": session, "messages": messages}


@router.post("/send")
def send_message(
    req: ChatSendRequest,
    llm_provider: LLMProviderConfig | None = Depends(get_llm_provider),
    identity: Identity = Depends(rate_limited("chat")),
):
    req.userId = identity.user_id
    request_id = uuid4().hex[:10]
    started = time.perf_counter()

    session = get_chat_session(req.userId, req.sessionId)
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found.")
    effective_provider = _session_provider(session, llm_provider)
    text_model = _session_text_model(session, effective_provider)

    try:
        logger.info(
            "chat[%s] start user_id=%s session=%s model=%s chars=%d",
            request_id, req.userId, req.sessionId, text_model, len(req.text),
        )

        history = list_chat_messages(req.userId, req.sessionId, limit=None)
        history_for_ai = [
            {"role": m["role"], "content": m["content"]}
            for m in history
        ]

        try:
            memory_pack = retrieve_memory_pack(
                req.userId,
                f"Conversation topic: {session.get('topic') or 'general'}. Learner message: {req.text}",
                purpose="chat",
            )
        except Exception:
            logger.exception("chat[%s] memory_retrieval_error", request_id)
            memory_pack = {"text": "", "items": [], "estimatedTokens": 0, "traceId": None}

        now = now_iso()
        user_msg_id = f"cm_{uuid4().hex[:12]}"
        user_msg = {
            "id": user_msg_id,
            "userId": req.userId,
            "sessionId": req.sessionId,
            "role": "user",
            "content": req.text,
            "corrections": None,
            "betterExpression": None,
            "createdAt": now,
        }
        save_chat_message(user_msg)

        ai_result = chat_reply(
            history=history_for_ai,
            user_text=req.text,
            topic=session.get("topic"),
            llm_provider=effective_provider,
            model=text_model,
            max_tokens=None if _unlimited_llm_output(identity) else 2000,
            trace_id=request_id,
            memory_context=memory_pack.get("text"),
        )

        assistant_now = now_iso()
        assistant_msg_id = f"cm_{uuid4().hex[:12]}"
        assistant_msg = {
            "id": assistant_msg_id,
            "userId": req.userId,
            "sessionId": req.sessionId,
            "role": "assistant",
            "content": ai_result.reply,
            "corrections": [c.model_dump() for c in ai_result.corrections] if ai_result.corrections else [],
            "betterExpression": ai_result.betterExpression.model_dump() if ai_result.betterExpression else None,
            "createdAt": assistant_now,
        }
        save_chat_message(assistant_msg)

        msg_count = len(history) + 2
        summary_text = session.get("summary") or req.text[:80]
        update_chat_session_summary(req.userId, req.sessionId, summary_text, msg_count)

        try:
            saved_memories = remember_candidates(
                req.userId,
                [*ai_result.memoryCandidates, *heuristic_memory_candidates(req.text)],
                source_type="chat",
                source_id=req.sessionId,
            )
        except Exception:
            logger.exception("chat[%s] memory_persist_error", request_id)
            saved_memories = []

        logger.info(
            "chat[%s] complete total_ms=%d corrections=%d",
            request_id, _elapsed_ms(started), len(ai_result.corrections),
        )

        return {
            "userMessage": user_msg,
            "assistantMessage": assistant_msg,
            "memoriesSaved": saved_memories,
            "memoryRecall": {
                "traceId": memory_pack.get("traceId"),
                "memoryIds": [item.get("id") for item in memory_pack.get("items", [])],
                "estimatedTokens": memory_pack.get("estimatedTokens", 0),
            },
        }

    except ValueError as e:
        logger.exception("chat[%s] ai_error total_ms=%d", request_id, _elapsed_ms(started))
        raise HTTPException(status_code=502, detail=f"AI error [{request_id}]: {e}") from e
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("chat[%s] server_error total_ms=%d", request_id, _elapsed_ms(started))
        raise HTTPException(status_code=500, detail=f"Request {request_id} failed: {e}") from e


@router.post("/predict")
def predict(
    req: ChatPredictRequest,
    llm_provider: LLMProviderConfig | None = Depends(get_llm_provider),
    identity: Identity = Depends(rate_limited("chat")),
):
    req.userId = identity.user_id
    request_id = uuid4().hex[:10]
    started = time.perf_counter()

    session = get_chat_session(req.userId, req.sessionId)
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found.")
    effective_provider = _session_provider(session, llm_provider)

    try:
        logger.info(
            "predict[%s] start user_id=%s session=%s partial_chars=%d",
            request_id, req.userId, req.sessionId, len(req.partialText),
        )

        history = list_chat_messages(req.userId, req.sessionId)
        history_for_ai = [
            {"role": m["role"], "content": m["content"]}
            for m in history
        ]

        result = predict_completion(
            history=history_for_ai,
            partial_text=req.partialText,
            topic=session.get("topic"),
            llm_provider=effective_provider,
            max_tokens=None if _unlimited_llm_output(identity) else 500,
            trace_id=request_id,
        )

        logger.info(
            "predict[%s] complete total_ms=%d predictions=%d",
            request_id, _elapsed_ms(started), len(result.predictions),
        )

        return {"predictions": result.predictions}

    except ValueError as e:
        logger.exception("predict[%s] ai_error total_ms=%d", request_id, _elapsed_ms(started))
        raise HTTPException(status_code=502, detail=f"AI error [{request_id}]: {e}") from e
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("predict[%s] server_error total_ms=%d", request_id, _elapsed_ms(started))
        raise HTTPException(status_code=500, detail=f"Request {request_id} failed: {e}") from e


@router.post("/sessions/{session_id}/analyze")
def analyze_chat_session(
    session_id: str,
    req: AnalyzeSessionRequest = Body(default_factory=AnalyzeSessionRequest),
    llm_provider: LLMProviderConfig | None = Depends(get_llm_provider),
    identity: Identity = Depends(rate_limited("chat")),
):
    """Analyze an entire chat session for corrections, natural expressions, and weaknesses."""
    user_id = identity.user_id
    request_id = uuid4().hex[:10]
    started = time.perf_counter()

    session = get_chat_session(user_id, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found.")
    if session.get("analysis"):
        return {
            "analysis": session.get("analysis"),
            "savedNotes": session.get("analysisSavedNotes") or [],
            "savedErrors": session.get("analysisSavedErrors") or [],
            "updatedSkills": session.get("analysisUpdatedSkills") or [],
            "sessionId": session_id,
            "duplicate": True,
        }

    messages = list_chat_messages(user_id, session_id, limit=None)
    user_messages = [m for m in messages if m.get("role") == "user"]
    if not user_messages:
        raise HTTPException(status_code=400, detail="No user messages to analyze.")
    effective_provider = _session_provider(session, llm_provider)

    try:
        logger.info(
            "analyze[%s] start user_id=%s session=%s messages=%d",
            request_id, user_id, session_id, len(messages),
        )

        messages_for_ai = [
            {"role": m["role"], "content": m["content"]}
            for m in messages if m.get("content", "").strip()
        ]

        try:
            memory_pack = retrieve_memory_pack(
                user_id,
                f"Analyze learning evidence for topic {session.get('topic') or 'general'}: "
                + " ".join(m.get("content", "") for m in user_messages)[-2000:],
                purpose="session_analysis",
            )
        except Exception:
            logger.exception("analyze[%s] memory_retrieval_error", request_id)
            memory_pack = {"text": "", "items": [], "estimatedTokens": 0, "traceId": None}

        analysis = analyze_session(
            messages=messages_for_ai,
            topic=session.get("topic"),
            output_language=req.outputLanguage,
            llm_provider=effective_provider,
            max_tokens=None if _unlimited_llm_output(identity) else identity.max_output_tokens,
            trace_id=request_id,
            memory_context=memory_pack.get("text"),
        )

        now = now_iso()
        existing_skills = {s["skillCode"]: s for s in list_skills(user_id)}
        updated_skills = []
        correction_codes = set()

        def apply_skill_update(code: str, category: str, severity: str):
            taxonomy = ERROR_TAXONOMY.get(code, {"label": category, "zhLabel": category})
            skill = update_skill_from_error(
                existing=existing_skills.get(code),
                user_id=user_id,
                skill_code=code,
                label=taxonomy["label"],
                zh_label=taxonomy["zhLabel"],
                severity=severity,
                now=now,
            )
            put_skill(skill)
            existing_skills[code] = skill
            updated_skills.append(skill)

        saved_errors = []
        for correction in analysis.corrections:
            severity = correction.severity.value
            error_id = f"err_{uuid4().hex[:12]}"
            error = {
                "id": error_id,
                "userId": user_id,
                "submissionId": session_id,
                "code": correction.code,
                "category": correction.category,
                "severity": severity,
                "originalText": correction.original,
                "correctedText": correction.corrected,
                "explanationZh": correction.explanationZh,
                "microLessonZh": correction.microLessonZh,
                "practiceGoal": correction.practiceGoal,
                "createdAt": now,
            }
            save_error(error)
            saved_errors.append(error)
            correction_codes.add(correction.code)
            apply_skill_update(correction.code, correction.category, severity)

        for w in analysis.weaknesses:
            if w.code not in correction_codes:
                apply_skill_update(w.code, w.category, w.severity)

        saved_notes = []
        for expr in analysis.naturalExpressions:
            note_id = f"note_{uuid4().hex[:12]}"
            note = {
                "id": note_id,
                "userId": user_id,
                "submissionId": session_id,
                "type": "expression",
                "topic": expr.original[:40],
                "original": expr.original,
                "natural": expr.natural,
                "explanation": expr.explanationZh,
                "context": expr.context,
                "examples": expr.examples,
                "createdAt": now,
            }
            save_note(note)
            saved_notes.append(note)

        analysis_json = analysis.model_dump(mode="json")

        try:
            weakness_evidence = [
                {
                    "code": weakness.code,
                    "category": weakness.category,
                    "severity": weakness.severity,
                    "evidenceQuote": weakness.evidenceQuote,
                }
                for weakness in analysis.weaknesses
            ]
            saved_memories = remember_candidates(
                user_id,
                [
                    *analysis.memoryCandidates,
                    *heuristic_memory_candidates(" ".join(m.get("content", "") for m in user_messages)),
                    *memory_candidates_from_errors([*saved_errors, *weakness_evidence]),
                ],
                source_type="session_analysis",
                source_id=session_id,
            )
        except Exception:
            logger.exception("analyze[%s] memory_persist_error", request_id)
            saved_memories = []
        update_chat_session_analysis(
            user_id=user_id,
            session_id=session_id,
            analysis=analysis_json,
            saved_notes=saved_notes,
            saved_errors=saved_errors,
            updated_skills=updated_skills,
            analyzed_at=now,
        )

        logger.info(
            "analyze[%s] complete total_ms=%d corrections=%d expressions=%d weaknesses=%d notes=%d errors=%d skills=%d",
            request_id, _elapsed_ms(started),
            len(analysis.corrections), len(analysis.naturalExpressions),
            len(analysis.weaknesses), len(saved_notes), len(saved_errors), len(updated_skills),
        )

        return {
            "analysis": analysis_json,
            "savedNotes": saved_notes,
            "savedErrors": saved_errors,
            "updatedSkills": updated_skills,
            "sessionId": session_id,
            "duplicate": False,
            "memoriesSaved": saved_memories,
            "memoryRecall": {
                "traceId": memory_pack.get("traceId"),
                "memoryIds": [item.get("id") for item in memory_pack.get("items", [])],
                "estimatedTokens": memory_pack.get("estimatedTokens", 0),
            },
        }

    except ValueError as e:
        logger.exception("analyze[%s] ai_error total_ms=%d", request_id, _elapsed_ms(started))
        raise HTTPException(status_code=502, detail=f"AI error [{request_id}]: {e}") from e
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("analyze[%s] server_error total_ms=%d", request_id, _elapsed_ms(started))
        raise HTTPException(status_code=500, detail=f"Request {request_id} failed: {e}") from e
