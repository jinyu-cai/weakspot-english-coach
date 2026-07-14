from contextlib import ExitStack
import logging
import time
from uuid import uuid4

from fastapi import APIRouter, Body, Depends, HTTPException, Query

from app.api.deps import Identity, get_llm_provider, rate_limited, resolve_identity
from app.config import settings
from app.core.mastery import update_skill_from_error
from app.core.pagination import decode_dynamo_cursor, encode_dynamo_cursor
from app.core.taxonomy import ERROR_TAXONOMY
from app.db.keys import user_pk
from app.db.repositories import (
    claim_chat_session_analysis,
    claim_chat_session_turn,
    finalize_chat_session_turn,
    get_chat_session,
    list_chat_messages,
    list_chat_sessions_page,
    list_skills,
    now_iso,
    save_chat_session,
    release_chat_session_analysis_claim,
    release_chat_session_turn_claim,
    save_chat_session_analysis_draft,
    update_chat_session_analysis,
)
from app.models.chat import (
    AnalyzeSessionRequest,
    ChatCreateSessionRequest,
    ChatPredictRequest,
    ChatSendRequest,
    SessionAnalysisAI,
)
from app.services.ai_client import LLMProviderConfig
from app.services.chat_service import chat_reply, predict_completion
from app.services.model_catalog import server_model_by_id, server_model_for_name, server_model_pair
from app.services.memory_service import (
    heuristic_memory_candidates,
    memory_candidates_from_errors,
    remember_candidates,
    retrieve_memory_pack,
)
from app.services.memory_write_service import memory_write_lease
from app.services.session_analysis_service import analyze_session
from app.services.stealth_practice_service import (
    build_stealth_probe_instruction,
    record_stealth_probe_outcome,
    select_stealth_probe,
)

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


def _public_session(session: dict) -> dict:
    """Never leak an active adaptive-practice target before analysis."""
    public = dict(session)
    for internal_key in (
        "stealthProbe",
        "stealthProbeHistory",
        "analysisDraft",
        "analysisDraftCreatedAt",
        "analysisClaimId",
        "analysisClaimedAt",
        "analysisClaimedAtEpoch",
        "turnClaimId",
        "turnClaimedAt",
        "turnClaimedAtEpoch",
    ):
        public.pop(internal_key, None)
    return public


def _session_conversation_context(session: dict) -> str | None:
    """Dynamic roleplay context takes precedence over a short topic label."""

    scenario = str(session.get("scenarioPrompt") or "").strip()
    if scenario:
        return scenario
    topic = str(session.get("topic") or "").strip()
    return topic or None


def _conversation_messages_for_ai(session: dict, messages: list[dict]) -> list[dict]:
    """Add the UI-visible generated opener without persisting a fake learner turn."""

    result: list[dict] = []
    starter = str(session.get("starterMessage") or "").strip()
    if starter:
        result.append({"role": "assistant", "content": starter})
    result.extend(
        {"role": message["role"], "content": message["content"]}
        for message in messages
        if message.get("role") in ("user", "assistant")
        and str(message.get("content") or "").strip()
    )
    return result


def _apply_reported_hint_level(assessment: dict, reported_hint_level: int) -> dict:
    """Prevent a hint-assisted answer from being credited as independent use."""

    adjusted = dict(assessment)
    adjusted["hintLevel"] = max(
        int(adjusted.get("hintLevel", 0) or 0),
        reported_hint_level,
    )
    if adjusted["hintLevel"] > 0 and adjusted.get("outcome") == "success":
        adjusted["outcome"] = "hinted_success"
        rationale = str(adjusted.get("rationale") or "").strip()
        assistance_note = (
            "The learner revealed at least one mission hint before analysis."
            if reported_hint_level > 0
            else "The assessment indicates that the response used hint assistance."
        )
        adjusted["rationale"] = f"{rationale} {assistance_note}".strip()
    return adjusted


def _has_exact_user_evidence(messages: list[dict], quote: str) -> bool:
    normalized_quote = " ".join((quote or "").casefold().split())
    if not normalized_quote:
        return False
    return any(
        normalized_quote in " ".join(str(message.get("content") or "").casefold().split())
        for message in messages
        if message.get("role") == "user"
    )


def _ensure_text_session_writable(session: dict) -> None:
    """Reject cross-modality writes and writes after end-session analysis."""
    if session.get("mode") == "voice":
        raise HTTPException(
            status_code=400,
            detail={
                "code": "session_mode_mismatch",
                "message": "Realtime voice sessions only accept transcript uploads.",
            },
        )
    if session.get("analysis") or session.get("analysisDraft") or session.get("analysisClaimId"):
        raise HTTPException(
            status_code=409,
            detail={
                "code": "session_closed_for_analysis",
                "message": "This session has ended or is being analyzed. Start a new text session.",
            },
        )


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
    try:
        stealth_probe = select_stealth_probe(
            req.userId,
            modality="text_chat",
            topic=req.scenarioPrompt or req.topic,
        )
    except Exception:
        logger.exception("chat session stealth_selection_error user_id=%s", req.userId)
        stealth_probe = None
    session = {
        "id": session_id,
        "userId": req.userId,
        "topic": req.topic,
        "scenarioPrompt": req.scenarioPrompt,
        "starterMessage": req.starterMessage,
        "scenarioFamily": req.scenarioFamily,
        "scenarioKey": req.scenarioKey,
        "mode": "text",
        "textModel": text_model,
        "llmServerModelId": server_model_id,
        "llmServerDeepModelId": deep_model_id,
        "llmServerFastModelId": fast_model_id,
        "messageCount": 0,
        "summary": None,
        "createdAt": now,
        "updatedAt": now,
    }
    if stealth_probe:
        session["stealthProbe"] = stealth_probe
    save_chat_session(session)
    return {"session": _public_session(session)}


@router.get("/sessions")
def get_sessions(
    page_size: int = Query(default=50, alias="pageSize", ge=1, le=100),
    cursor: str | None = Query(default=None, max_length=2048),
    identity: Identity = Depends(resolve_identity),
):
    try:
        start_key = decode_dynamo_cursor(
            cursor,
            expected_pk=user_pk(identity.user_id),
            expected_sk_prefix="CHAT#",
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail={"code": "invalid_cursor", "message": str(exc)},
        ) from exc
    sessions, next_key = list_chat_sessions_page(
        identity.user_id,
        page_size=page_size,
        start_key=start_key,
    )
    return {
        "sessions": [_public_session(session) for session in sessions],
        "count": len(sessions),
        "nextCursor": encode_dynamo_cursor(next_key),
    }


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
    return {"session": _public_session(session), "messages": messages}


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
    _ensure_text_session_writable(session)
    effective_provider = _session_provider(session, llm_provider)
    text_model = _session_text_model(session, effective_provider)
    turn_claimed = False

    if not claim_chat_session_turn(req.userId, req.sessionId, request_id):
        current = get_chat_session(req.userId, req.sessionId)
        if not current:
            raise HTTPException(status_code=404, detail="Chat session not found.")
        _ensure_text_session_writable(current)
        raise HTTPException(
            status_code=409,
            detail={
                "code": "turn_in_progress",
                "message": "Another message is already being processed. Try again shortly.",
            },
        )
    turn_claimed = True

    try:
        logger.info(
            "chat[%s] start user_id=%s session=%s model=%s chars=%d",
            request_id, req.userId, req.sessionId, text_model, len(req.text),
        )

        history = list_chat_messages(req.userId, req.sessionId, limit=None)
        history_for_ai = _conversation_messages_for_ai(session, history)

        try:
            conversation_context = _session_conversation_context(session)
            memory_pack = retrieve_memory_pack(
                req.userId,
                f"Conversation topic: {conversation_context or 'general'}. Learner message: {req.text}",
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

        ai_result = chat_reply(
            history=history_for_ai,
            user_text=req.text,
            topic=_session_conversation_context(session),
            llm_provider=effective_provider,
            model=text_model,
            max_tokens=None if _unlimited_llm_output(identity) else 2000,
            trace_id=request_id,
            memory_context=memory_pack.get("text"),
            hidden_practice_instruction=build_stealth_probe_instruction(session.get("stealthProbe")),
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

        msg_count = len(history) + 2
        summary_text = session.get("summary") or req.text[:80]
        finalize_chat_session_turn(
            req.userId,
            req.sessionId,
            request_id,
            user_msg,
            assistant_msg,
            summary_text,
            msg_count,
        )
        turn_claimed = False

        try:
            saved_memories = remember_candidates(
                req.userId,
                [*ai_result.memoryCandidates, *heuristic_memory_candidates(req.text)],
                source_type="chat",
                # Each learner turn is an evidence event; retries of that same
                # event remain idempotent while later turns can corroborate it.
                source_id=user_msg_id,
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
    finally:
        if turn_claimed:
            try:
                release_chat_session_turn_claim(req.userId, req.sessionId, request_id)
            except Exception:
                logger.exception("chat[%s] turn_claim_release_error", request_id)


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
    _ensure_text_session_writable(session)
    effective_provider = _session_provider(session, llm_provider)

    try:
        logger.info(
            "predict[%s] start user_id=%s session=%s partial_chars=%d",
            request_id, req.userId, req.sessionId, len(req.partialText),
        )

        history = list_chat_messages(req.userId, req.sessionId)
        history_for_ai = _conversation_messages_for_ai(session, history)

        result = predict_completion(
            history=history_for_ai,
            partial_text=req.partialText,
            topic=_session_conversation_context(session),
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
    learning_effects_stack = ExitStack()

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
            "stealthPractice": session.get("stealthPractice"),
        }

    effective_provider = _session_provider(session, llm_provider)

    if not claim_chat_session_analysis(user_id, session_id, request_id):
        current = get_chat_session(user_id, session_id)
        if current and current.get("analysis"):
            return {
                "analysis": current.get("analysis"),
                "savedNotes": current.get("analysisSavedNotes") or [],
                "savedErrors": current.get("analysisSavedErrors") or [],
                "updatedSkills": current.get("analysisUpdatedSkills") or [],
                "sessionId": session_id,
                "duplicate": True,
                "stealthPractice": current.get("stealthPractice"),
            }
        raise HTTPException(
            status_code=409,
            detail={
                "code": "analysis_in_progress",
                "message": "This session is already being analyzed. Try again shortly.",
            },
        )
    analysis_claimed = True

    try:
        # Claim before reading so the analysis snapshot cannot omit a turn
        # that was still generating when this request began.
        messages = list_chat_messages(user_id, session_id, limit=None)
        user_messages = [m for m in messages if m.get("role") == "user"]
        if not user_messages:
            raise HTTPException(status_code=400, detail="No user messages to analyze.")

        logger.info(
            "analyze[%s] start user_id=%s session=%s messages=%d",
            request_id, user_id, session_id, len(messages),
        )

        messages_for_ai = _conversation_messages_for_ai(session, messages)

        try:
            conversation_context = _session_conversation_context(session)
            memory_pack = retrieve_memory_pack(
                user_id,
                f"Analyze learning evidence for topic {conversation_context or 'general'}: "
                + " ".join(m.get("content", "") for m in user_messages)[-2000:],
                purpose="session_analysis",
            )
        except Exception:
            logger.exception("analyze[%s] memory_retrieval_error", request_id)
            memory_pack = {"text": "", "items": [], "estimatedTokens": 0, "traceId": None}

        if session.get("analysisDraft"):
            analysis = SessionAnalysisAI.model_validate(session["analysisDraft"])
        else:
            analysis = analyze_session(
                messages=messages_for_ai,
                topic=_session_conversation_context(session),
                output_language=req.outputLanguage,
                llm_provider=effective_provider,
                max_tokens=None if _unlimited_llm_output(identity) else identity.max_output_tokens,
                trace_id=request_id,
                memory_context=memory_pack.get("text"),
                stealth_probe=session.get("stealthProbe"),
            )
            # Store the exact LLM result before any learning state is changed.
            # If a later write fails, the retry reuses this draft verbatim.
            save_chat_session_analysis_draft(
                user_id,
                session_id,
                request_id,
                analysis.model_dump(mode="json"),
            )

        # The LLM call and durable draft stay outside the learner write lease.
        # From this fresh skill snapshot through the final effects transaction,
        # however, every learner-model mutation shares one fenced owner. This
        # prevents a concurrent practice attempt or second chat analysis from
        # being overwritten by a stale skill snapshot.
        memory_claim_id = learning_effects_stack.enter_context(
            memory_write_lease(user_id)
        )
        now = now_iso()
        existing_skills = {s["skillCode"]: s for s in list_skills(user_id)}
        skills_to_persist: dict[str, dict] = {}
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
            existing_skills[code] = skill
            skills_to_persist[code] = skill

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
            saved_notes.append(note)

        updated_skills = list(skills_to_persist.values())
        analysis_json = analysis.model_dump(mode="json")
        stealth_practice = None
        if session.get("stealthProbe"):
            assessment = analysis.stealthProbeAssessment
            assessment_payload = (
                assessment.model_dump(mode="json")
                if assessment is not None
                else {
                    "opportunityPresent": False,
                    "outcome": "no_opportunity",
                    "evidenceQuote": "",
                    "rationale": "The analyzer returned no reliable evidence for the hidden target.",
                    "confidence": 0.0,
                    "hintLevel": 0,
                }
            )
            assessment_payload = _apply_reported_hint_level(
                assessment_payload,
                req.hintLevel,
            )
            if (
                assessment_payload.get("opportunityPresent")
                and not _has_exact_user_evidence(
                    messages_for_ai,
                    str(assessment_payload.get("evidenceQuote") or ""),
                )
            ):
                assessment_payload.update({
                    "opportunityPresent": False,
                    "outcome": "no_opportunity",
                    "rationale": (
                        "The proposed evidence quote was not found verbatim in a learner message; "
                        "no mastery update was applied."
                    ),
                    "confidence": 0.0,
                })
            stealth_practice = record_stealth_probe_outcome(
                user_id,
                session["stealthProbe"],
                assessment_payload,
            )
            assessment_payload.update({
                "outcome": stealth_practice["outcome"],
                "opportunityPresent": stealth_practice["opportunityPresent"],
            })
            analysis_json["stealthProbeAssessment"] = assessment_payload
            analysis_json["stealthPractice"] = stealth_practice

        weakness_evidence = [
            {
                "code": weakness.code,
                "category": weakness.category,
                "severity": weakness.severity,
                "evidenceQuote": weakness.evidenceQuote,
            }
            for weakness in analysis.weaknesses
        ]
        # Durable memory is part of analysis completion. A transient write
        # failure keeps the immutable draft retryable instead of finalizing a
        # session that permanently lost its learning evidence.
        saved_memories = remember_candidates(
            user_id,
            [
                *analysis.memoryCandidates,
                *heuristic_memory_candidates(" ".join(m.get("content", "") for m in user_messages)),
                *memory_candidates_from_errors([*saved_errors, *weakness_evidence]),
            ],
            source_type="session_analysis",
            source_id=session_id,
            weakness_learning_skip_codes=(
                {str(stealth_practice.get("targetSkillCode"))}
                if stealth_practice and stealth_practice.get("stateChanged")
                else None
            ),
            weakness_modality="voice" if session.get("mode") == "voice" else "text_chat",
        )
        update_chat_session_analysis(
            user_id=user_id,
            session_id=session_id,
            analysis=analysis_json,
            saved_notes=saved_notes,
            saved_errors=saved_errors,
            updated_skills=updated_skills,
            analyzed_at=now,
            stealth_practice=stealth_practice,
            claim_id=request_id,
            errors_to_persist=saved_errors,
            notes_to_persist=saved_notes,
            skills_to_persist=updated_skills,
            memory_claim_id=memory_claim_id,
        )
        analysis_claimed = False
        learning_effects_stack.close()

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
            "stealthPractice": stealth_practice,
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
    finally:
        # A learner-lease release error must not skip the independent session
        # claim cleanup. The nested finally preserves the lease close
        # exception while still making a best-effort attempt at both releases.
        try:
            learning_effects_stack.close()
        finally:
            if analysis_claimed:
                try:
                    release_chat_session_analysis_claim(user_id, session_id, request_id)
                except Exception:
                    logger.exception("analyze[%s] claim_release_error", request_id)
