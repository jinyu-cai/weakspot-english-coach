import hashlib
import logging
import time
from typing import List, Literal, Optional
from uuid import uuid4

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.api.deps import Identity, rate_limited, resolve_identity
from app.config import settings
from app.models.common import OutputLanguage
from app.db.repositories import (
    claim_chat_session_turn,
    finalize_chat_session_transcript_batch,
    get_chat_session,
    list_chat_messages,
    now_iso,
    release_chat_session_turn_claim,
    save_chat_session,
)
from app.services.realtime_prompts import REALTIME_FUNCTION_TOOLS, REALTIME_SYSTEM_PROMPT, realtime_hint_instruction
from app.services.realtime_sideband import (
    has_active_realtime_sideband,
    kick_realtime_session,
    start_realtime_sideband,
)
from app.services.memory_service import (
    heuristic_memory_candidates,
    remember_candidates,
    retrieve_memory_pack,
)
from app.services.stealth_practice_service import (
    build_stealth_probe_instruction,
    select_stealth_probe,
)

router = APIRouter(prefix="/chat")
logger = logging.getLogger("uvicorn.error")


class RealtimeSessionRequest(BaseModel):
    userId: str
    topic: Optional[str] = None
    model: Optional[str] = None
    outputLanguage: OutputLanguage = "en"


class TranscriptMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=16000)
    clientMessageId: Optional[str] = Field(default=None, min_length=1, max_length=160)
    createdAt: Optional[str] = None


class SaveTranscriptRequest(BaseModel):
    userId: str
    messages: List[TranscriptMessage] = Field(min_length=1, max_length=500)


class RealtimeSidebandAttachRequest(BaseModel):
    callId: str = Field(min_length=6, max_length=160)


class RealtimeKickRequest(BaseModel):
    reason: Optional[str] = Field(default="manual", max_length=120)


REALTIME_AUDIT_KEYS = [
    "realtimeStatus",
    "realtimeCallId",
    "realtimeSidebandRequestedAt",
    "realtimeSidebandStartedAt",
    "realtimeSidebandStartedAtEpoch",
    "realtimeLastEventAt",
    "realtimeLastEventType",
    "realtimeEventCount",
    "realtimeResponseCount",
    "realtimeUsageEventCount",
    "realtimeTranscriptCount",
    "realtimeAssistantTranscriptCount",
    "realtimeTranscriptSavedCount",
    "realtimeLastUserTranscript",
    "realtimeLastAssistantTranscript",
    "realtimeLastUsage",
    "realtimeUsage",
    "realtimeLastError",
    "realtimeKickRequestedAt",
    "realtimeKickSentAt",
    "realtimeKickReason",
    "realtimeForcedExpiresAt",
    "realtimeElapsedSeconds",
    "realtimeEndedAt",
]


def _allowed_realtime_models() -> set[str]:
    return set(settings.openai_realtime_model_list) | {settings.openai_realtime_model}


def _validate_realtime_model(model: str | None, identity: Identity) -> str:
    selected = (model or settings.openai_realtime_model).strip() or settings.openai_realtime_model
    if identity.is_unlimited:
        return selected

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


def _resolve_realtime_session_user(identity: Identity, requested_user_id: str | None = None) -> str:
    if requested_user_id and requested_user_id != identity.user_id:
        if not identity.is_owner:
            raise HTTPException(status_code=403, detail="Owner access required for this session.")
        return requested_user_id
    return identity.user_id


def _realtime_audit_payload(session: dict, active_sideband: bool) -> dict:
    return {
        "sessionId": session["id"],
        "userId": session["userId"],
        "mode": session.get("mode"),
        "voiceModel": session.get("voiceModel"),
        "maxDurationSeconds": session.get("maxDurationSeconds"),
        "expiresAt": session.get("expiresAt"),
        "activeSideband": active_sideband,
        "audit": {key: session.get(key) for key in REALTIME_AUDIT_KEYS if key in session},
    }


def _message_dedupe_key(
    role: str,
    content: str,
    client_message_id: Optional[str] = None,
) -> tuple[str, str]:
    # New clients send a stable per-turn ID, which makes network retries
    # idempotent without collapsing two legitimate identical utterances.
    if client_message_id and client_message_id.strip():
        return "client_message", client_message_id.strip()
    return role, " ".join(content.strip().split())


@router.post("/realtime/session")
def create_realtime_session(
    req: RealtimeSessionRequest,
    identity: Identity = Depends(rate_limited("chat")),
):
    req.userId = identity.user_id
    realtime_model = _validate_realtime_model(req.model, identity)

    if not settings.openai_api_key:
        raise HTTPException(
            status_code=503,
            detail="OpenAI Realtime API key not configured on the server.",
        )

    expires_at = int(time.time()) + identity.max_realtime_seconds if identity.max_realtime_seconds else None
    now = now_iso()
    session_id = f"cs_{uuid4().hex[:12]}"
    try:
        memory_pack = retrieve_memory_pack(
            req.userId,
            f"Start a realtime English conversation about {req.topic or 'general conversation'}; "
            "honor learner preferences and goals.",
            purpose="realtime_chat",
        )
    except Exception:
        logger.exception("realtime memory_retrieval_error user_id=%s", req.userId)
        memory_pack = {"text": "", "items": [], "estimatedTokens": 0, "traceId": None}
    try:
        stealth_probe = select_stealth_probe(
            req.userId,
            modality="voice",
            topic=req.topic,
        )
    except Exception:
        logger.exception("realtime stealth_selection_error user_id=%s", req.userId)
        stealth_probe = None
    session = {
        "id": session_id,
        "userId": req.userId,
        "topic": req.topic,
        "scenarioPrompt": None,
        "mode": "voice",
        "voiceModel": realtime_model,
        "outputLanguage": req.outputLanguage,
        "maxDurationSeconds": identity.max_realtime_seconds,
        "expiresAt": expires_at,
        "realtimeStatus": "created",
        "realtimeUsage": {
            "totalTokens": 0,
            "inputTokens": 0,
            "outputTokens": 0,
            "inputTextTokens": 0,
            "inputAudioTokens": 0,
            "inputCachedTokens": 0,
            "outputTextTokens": 0,
            "outputAudioTokens": 0,
            "responses": 0,
        },
        "messageCount": 0,
        "summary": None,
        "createdAt": now,
        "updatedAt": now,
        "memoryRecall": {
            "traceId": memory_pack.get("traceId"),
            "memoryIds": [item.get("id") for item in memory_pack.get("items", [])],
            "estimatedTokens": memory_pack.get("estimatedTokens", 0),
        },
    }
    if stealth_probe:
        session["stealthProbe"] = stealth_probe
    save_chat_session(session)

    topic_text = req.topic or "Free conversation — talk about anything"
    instructions = REALTIME_SYSTEM_PROMPT.format(
        topic=topic_text,
        language_instruction=realtime_hint_instruction(req.outputLanguage),
    )
    if memory_pack.get("text"):
        instructions += (
            f"\n\n{memory_pack['text']}\nPersonalize naturally. The learner's current statement always overrides memory. "
            "If a relevant input-learning expression is present, model at most one naturally and give the learner "
            "a light chance to notice or reuse it; hearing it is not evidence of mastery."
        )
    hidden_practice_instruction = build_stealth_probe_instruction(stealth_probe)
    if hidden_practice_instruction:
        instructions += f"\n\n{hidden_practice_instruction}"

    try:
        safety_identifier = hashlib.sha256(req.userId.encode("utf-8")).hexdigest()
        realtime_session_config = {
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
        }
        if expires_at is not None:
            realtime_session_config["expires_at"] = expires_at

        resp = httpx.post(
            "https://api.openai.com/v1/realtime/client_secrets",
            headers={
                "Authorization": f"Bearer {settings.openai_api_key}",
                "Content-Type": "application/json",
                "OpenAI-Safety-Identifier": safety_identifier,
            },
            json={
                "session": realtime_session_config,
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
        "maxDurationSeconds": identity.max_realtime_seconds,
        "expiresAt": expires_at,
    }


@router.post("/realtime/{session_id}/sideband")
async def attach_realtime_sideband(
    session_id: str,
    req: RealtimeSidebandAttachRequest,
    identity: Identity = Depends(resolve_identity),
):
    user_id = _resolve_realtime_session_user(identity)
    session = get_chat_session(user_id, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Realtime session not found.")
    if session.get("mode") != "voice":
        raise HTTPException(status_code=400, detail="Session is not a realtime voice session.")
    if not settings.openai_api_key:
        raise HTTPException(status_code=503, detail="OpenAI Realtime API key not configured on the server.")

    result = await start_realtime_sideband(
        user_id=user_id,
        session_id=session_id,
        call_id=req.callId,
        max_duration_seconds=session.get("maxDurationSeconds"),
    )
    return {"sessionId": session_id, "callId": req.callId, **result}


@router.get("/realtime/{session_id}/audit")
def get_realtime_audit(
    session_id: str,
    user_id: Optional[str] = Query(default=None, alias="userId"),
    identity: Identity = Depends(resolve_identity),
):
    target_user_id = _resolve_realtime_session_user(identity, user_id)
    session = get_chat_session(target_user_id, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Realtime session not found.")
    return _realtime_audit_payload(
        session,
        active_sideband=has_active_realtime_sideband(target_user_id, session_id),
    )


@router.post("/realtime/{session_id}/kick")
async def kick_realtime_voice_session(
    session_id: str,
    req: RealtimeKickRequest | None = None,
    user_id: Optional[str] = Query(default=None, alias="userId"),
    identity: Identity = Depends(resolve_identity),
):
    target_user_id = _resolve_realtime_session_user(identity, user_id)
    session = get_chat_session(target_user_id, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Realtime session not found.")
    if session.get("mode") != "voice":
        raise HTTPException(status_code=400, detail="Session is not a realtime voice session.")

    reason = (req.reason if req and req.reason else "manual").strip() or "manual"
    result = await kick_realtime_session(user_id=target_user_id, session_id=session_id, reason=reason)
    updated = get_chat_session(target_user_id, session_id) or session
    return {
        "sessionId": session_id,
        "userId": target_user_id,
        **result,
        "realtimeStatus": updated.get("realtimeStatus"),
    }


@router.post("/sessions/{session_id}/transcript")
def save_transcript(
    session_id: str,
    req: SaveTranscriptRequest,
    identity: Identity = Depends(rate_limited("chat")),
):
    req.userId = identity.user_id
    request_id = f"transcript_{uuid4().hex[:12]}"
    turn_claimed = False

    session = get_chat_session(req.userId, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found.")
    if session.get("mode") != "voice":
        raise HTTPException(
            status_code=400,
            detail={
                "code": "session_mode_mismatch",
                "message": "Transcript uploads are only accepted for realtime voice sessions.",
            },
        )
    if session.get("analysis") or session.get("analysisDraft") or session.get("analysisClaimId"):
        raise HTTPException(
            status_code=409,
            detail={
                "code": "session_closed_for_analysis",
                "message": "This voice session has ended or is being analyzed.",
            },
        )

    if not claim_chat_session_turn(req.userId, session_id, request_id):
        current = get_chat_session(req.userId, session_id)
        if current and (
            current.get("analysis")
            or current.get("analysisDraft")
            or current.get("analysisClaimId")
        ):
            raise HTTPException(
                status_code=409,
                detail={
                    "code": "session_closed_for_analysis",
                    "message": "This voice session has ended or is being analyzed.",
                },
            )
        raise HTTPException(
            status_code=409,
            detail={
                "code": "transcript_in_progress",
                "message": "Another transcript upload is already being processed. Try again shortly.",
            },
        )
    turn_claimed = True

    try:
        # Re-read all state only after the claim.  This makes deduplication and
        # the analysis snapshot share one serial ordering.
        session = get_chat_session(req.userId, session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Chat session not found.")
        if session.get("mode") != "voice":
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "session_mode_mismatch",
                    "message": "Transcript uploads are only accepted for realtime voice sessions.",
                },
            )
        if session.get("analysis") or session.get("analysisDraft") or session.get("analysisClaimId"):
            raise HTTPException(
                status_code=409,
                detail={
                    "code": "session_closed_for_analysis",
                    "message": "This voice session has ended or is being analyzed.",
                },
            )

        existing_messages = list_chat_messages(req.userId, session_id, limit=None)
        existing_keys = {
            _message_dedupe_key(
                str(msg.get("role") or ""),
                str(msg.get("content") or ""),
                str(msg.get("clientMessageId") or "") or None,
            )
            for msg in existing_messages
            if str(msg.get("content") or "").strip()
        }
        skipped_duplicates = 0
        new_user_texts: list[str] = []
        messages_to_save: list[dict] = []
        for msg in req.messages:
            content = msg.content.strip()
            if not content:
                continue
            dedupe_key = _message_dedupe_key(msg.role, content, msg.clientMessageId)
            if dedupe_key in existing_keys:
                skipped_duplicates += 1
                continue
            existing_keys.add(dedupe_key)
            message = {
                "id": f"cm_{uuid4().hex[:12]}",
                "userId": req.userId,
                "sessionId": session_id,
                "role": msg.role,
                "content": content,
                "clientMessageId": msg.clientMessageId,
                "corrections": None,
                "betterExpression": None,
                "source": "client_transcript",
                "createdAt": msg.createdAt or now_iso(),
            }
            messages_to_save.append(message)
            if msg.role == "user":
                new_user_texts.append(content)

        saved = len(messages_to_save)
        batch_id = f"tb_{uuid4().hex[:16]}"
        if saved:
            first_text = messages_to_save[0]["content"]
            summary = session.get("summary") or first_text[:80]
            finalize_chat_session_transcript_batch(
                req.userId,
                session_id,
                request_id,
                batch_id,
                messages_to_save,
                summary,
                len(existing_messages) + saved,
            )
        else:
            release_chat_session_turn_claim(req.userId, session_id, request_id)
        turn_claimed = False

        try:
            saved_memories = remember_candidates(
                req.userId,
                heuristic_memory_candidates(" ".join(new_user_texts)),
                source_type="chat",
                source_id=batch_id,
            )
        except Exception:
            logger.exception("realtime transcript memory_persist_error session=%s", session_id)
            saved_memories = []

        logger.info(
            "transcript saved session=%s messages=%d skipped_duplicates=%d",
            session_id,
            saved,
            skipped_duplicates,
        )
        return {
            "saved": saved,
            "skippedDuplicates": skipped_duplicates,
            "sessionId": session_id,
            "memoriesSaved": saved_memories,
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("realtime transcript save_error session=%s", session_id)
        raise HTTPException(
            status_code=500,
            detail=f"Transcript upload failed: {exc}",
        ) from exc
    finally:
        if turn_claimed:
            try:
                release_chat_session_turn_claim(req.userId, session_id, request_id)
            except Exception:
                logger.exception(
                    "realtime transcript claim_release_error session=%s",
                    session_id,
                )
