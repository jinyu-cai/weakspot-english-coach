import hashlib
import logging
from typing import List, Optional
from uuid import uuid4

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.api.deps import Identity, rate_limited
from app.config import settings
from app.db.repositories import (
    get_chat_session,
    now_iso,
    save_chat_message,
    save_chat_session,
    update_chat_session_summary,
)
from app.services.realtime_prompts import REALTIME_FUNCTION_TOOLS, REALTIME_SYSTEM_PROMPT

router = APIRouter(prefix="/chat")
logger = logging.getLogger("uvicorn.error")


class RealtimeSessionRequest(BaseModel):
    userId: str
    topic: Optional[str] = None
    model: Optional[str] = None


class TranscriptMessage(BaseModel):
    role: str
    content: str
    createdAt: Optional[str] = None


class SaveTranscriptRequest(BaseModel):
    userId: str
    messages: List[TranscriptMessage]


def _allowed_realtime_models() -> set[str]:
    return set(settings.openai_realtime_model_list) | {settings.openai_realtime_model}


def _validate_realtime_model(model: str | None) -> str:
    selected = (model or settings.openai_realtime_model).strip()
    allowed = _allowed_realtime_models()
    if selected not in allowed:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "invalid_realtime_model",
                "message": "Unsupported realtime voice model.",
                "allowed": sorted(allowed),
            },
        )
    return selected


@router.post("/realtime/session")
def create_realtime_session(
    req: RealtimeSessionRequest,
    identity: Identity = Depends(rate_limited("chat")),
):
    req.userId = identity.user_id
    realtime_model = _validate_realtime_model(req.model)

    if not settings.openai_api_key:
        raise HTTPException(
            status_code=503,
            detail="OpenAI Realtime API key not configured on the server.",
        )

    now = now_iso()
    session_id = f"cs_{uuid4().hex[:12]}"
    session = {
        "id": session_id,
        "userId": req.userId,
        "topic": req.topic,
        "scenarioPrompt": None,
        "mode": "voice",
        "voiceModel": realtime_model,
        "messageCount": 0,
        "summary": None,
        "createdAt": now,
        "updatedAt": now,
    }
    save_chat_session(session)

    topic_text = req.topic or "Free conversation — talk about anything"
    instructions = REALTIME_SYSTEM_PROMPT.format(topic=topic_text)

    try:
        safety_identifier = hashlib.sha256(req.userId.encode("utf-8")).hexdigest()
        resp = httpx.post(
            "https://api.openai.com/v1/realtime/client_secrets",
            headers={
                "Authorization": f"Bearer {settings.openai_api_key}",
                "Content-Type": "application/json",
                "OpenAI-Safety-Identifier": safety_identifier,
            },
            json={
                "session": {
                    "type": "realtime",
                    "model": realtime_model,
                    "instructions": instructions,
                    "output_modalities": ["audio"],
                    "tools": REALTIME_FUNCTION_TOOLS,
                    "tool_choice": "auto",
                    "audio": {
                        "input": {
                            "turn_detection": {
                                "type": "server_vad",
                                "threshold": 0.5,
                                "prefix_padding_ms": 300,
                                "silence_duration_ms": 800,
                                "create_response": True,
                                "interrupt_response": True,
                            },
                            "transcription": {
                                "model": "gpt-4o-mini-transcribe",
                                "language": "en",
                            },
                        },
                        "output": {
                            "voice": "marin",
                        },
                    },
                },
            },
            timeout=15,
        )
        resp.raise_for_status()
    except httpx.HTTPStatusError as e:
        logger.error("realtime session create failed: %s %s", e.response.status_code, e.response.text[:500])
        raise HTTPException(status_code=502, detail="Failed to create OpenAI Realtime session.") from e
    except httpx.RequestError as e:
        logger.error("realtime session create network error: %s", e)
        raise HTTPException(status_code=502, detail="Network error connecting to OpenAI.") from e

    data = resp.json()
    client_secret = data.get("value") or data.get("client_secret", {}).get("value")
    if not client_secret:
        logger.error("realtime session response missing client_secret: %s", data)
        raise HTTPException(status_code=502, detail="Invalid response from OpenAI Realtime API.")

    logger.info(
        "realtime session created user_id=%s session=%s model=%s",
        req.userId, session_id, realtime_model,
    )

    return {
        "clientSecret": client_secret,
        "sessionId": session_id,
        "model": realtime_model,
    }


@router.post("/sessions/{session_id}/transcript")
def save_transcript(
    session_id: str,
    req: SaveTranscriptRequest,
    identity: Identity = Depends(rate_limited("chat")),
):
    req.userId = identity.user_id

    session = get_chat_session(req.userId, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found.")

    saved = 0
    for msg in req.messages:
        if not msg.content.strip():
            continue
        msg_id = f"cm_{uuid4().hex[:12]}"
        message = {
            "id": msg_id,
            "userId": req.userId,
            "sessionId": session_id,
            "role": msg.role,
            "content": msg.content,
            "corrections": None,
            "betterExpression": None,
            "createdAt": msg.createdAt or now_iso(),
        }
        save_chat_message(message)
        saved += 1

    if saved > 0:
        summary = req.messages[0].content[:80] if req.messages else None
        update_chat_session_summary(req.userId, session_id, summary, saved)

    logger.info("transcript saved session=%s messages=%d", session_id, saved)
    return {"saved": saved, "sessionId": session_id}
