import logging
import time
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import Identity, get_llm_provider, rate_limited
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
from app.models.chat import ChatCreateSessionRequest, ChatPredictRequest, ChatSendRequest
from app.services.ai_client import LLMProviderConfig
from app.services.chat_service import chat_reply, predict_completion
from app.services.session_analysis_service import analyze_session

router = APIRouter(prefix="/chat")
logger = logging.getLogger("uvicorn.error")


def _elapsed_ms(started: float) -> int:
    return int((time.perf_counter() - started) * 1000)


@router.post("/sessions")
def create_session(
    req: ChatCreateSessionRequest,
    llm_provider: LLMProviderConfig | None = Depends(get_llm_provider),
    identity: Identity = Depends(rate_limited("chat")),
):
    req.userId = identity.user_id
    now = now_iso()
    session_id = f"cs_{uuid4().hex[:12]}"
    session = {
        "id": session_id,
        "userId": req.userId,
        "topic": req.topic,
        "scenarioPrompt": req.scenarioPrompt,
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
    messages = list_chat_messages(identity.user_id, session_id)
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

    try:
        logger.info(
            "chat[%s] start user_id=%s session=%s chars=%d",
            request_id, req.userId, req.sessionId, len(req.text),
        )

        history = list_chat_messages(req.userId, req.sessionId)
        history_for_ai = [
            {"role": m["role"], "content": m["content"]}
            for m in history
        ]

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
            llm_provider=llm_provider,
            trace_id=request_id,
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
        summary_text = req.text[:80] if msg_count <= 2 else None
        if summary_text:
            update_chat_session_summary(req.userId, req.sessionId, summary_text, msg_count)

        logger.info(
            "chat[%s] complete total_ms=%d corrections=%d",
            request_id, _elapsed_ms(started), len(ai_result.corrections),
        )

        return {
            "userMessage": user_msg,
            "assistantMessage": assistant_msg,
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
            llm_provider=llm_provider,
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

    messages = list_chat_messages(user_id, session_id)
    user_messages = [m for m in messages if m.get("role") == "user"]
    if not user_messages:
        raise HTTPException(status_code=400, detail="No user messages to analyze.")

    try:
        logger.info(
            "analyze[%s] start user_id=%s session=%s messages=%d",
            request_id, user_id, session_id, len(messages),
        )

        messages_for_ai = [
            {"role": m["role"], "content": m["content"]}
            for m in messages if m.get("content", "").strip()
        ]

        analysis = analyze_session(
            messages=messages_for_ai,
            topic=session.get("topic"),
            llm_provider=llm_provider,
            trace_id=request_id,
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
        }

    except ValueError as e:
        logger.exception("analyze[%s] ai_error total_ms=%d", request_id, _elapsed_ms(started))
        raise HTTPException(status_code=502, detail=f"AI error [{request_id}]: {e}") from e
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("analyze[%s] server_error total_ms=%d", request_id, _elapsed_ms(started))
        raise HTTPException(status_code=500, detail=f"Request {request_id} failed: {e}") from e
