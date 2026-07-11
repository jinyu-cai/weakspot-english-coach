import asyncio
import json
import logging
import time
from dataclasses import dataclass, field
from typing import Any
from urllib.parse import quote
from uuid import uuid4

import websockets
from websockets.exceptions import ConnectionClosed

from app.config import settings
from app.db.repositories import (
    get_chat_session,
    now_iso,
    request_chat_session_realtime_kick,
    save_chat_message,
    update_chat_session_fields,
    update_chat_session_summary,
)
from app.services.memory_service import heuristic_memory_candidates, remember_candidates

logger = logging.getLogger("uvicorn.error")

AUDIT_FLUSH_SECONDS = 5
AUDIT_EVENT_FLUSH_INTERVAL = 20

_ZERO_USAGE = {
    "totalTokens": 0,
    "inputTokens": 0,
    "outputTokens": 0,
    "inputTextTokens": 0,
    "inputAudioTokens": 0,
    "inputCachedTokens": 0,
    "outputTextTokens": 0,
    "outputAudioTokens": 0,
    "responses": 0,
}


@dataclass
class RealtimeSidebandState:
    user_id: str
    session_id: str
    call_id: str
    max_duration_seconds: int | None
    task: asyncio.Task | None = None
    ws: Any | None = None
    kick_event: asyncio.Event = field(default_factory=asyncio.Event)
    kick_reason: str = "manual"
    kick_sent: bool = False
    kick_sent_epoch: float | None = None
    started_epoch: float = field(default_factory=time.time)
    event_count: int = 0
    response_count: int = 0
    usage_event_count: int = 0
    transcript_count: int = 0
    assistant_transcript_count: int = 0
    last_event_type: str | None = None
    last_error: str | None = None
    last_user_transcript: str | None = None
    last_assistant_transcript: str | None = None
    last_usage: dict[str, Any] | None = None
    usage: dict[str, int] = field(default_factory=lambda: dict(_ZERO_USAGE))
    assistant_transcript_buffers: dict[str, str] = field(default_factory=dict)
    saved_transcript_keys: set[str] = field(default_factory=set)
    saved_transcript_message_count: int = 0
    transcript_summary: str | None = None
    last_flush_epoch: float = 0
    last_control_check_epoch: float = 0


_monitors: dict[str, RealtimeSidebandState] = {}


def _monitor_key(user_id: str, session_id: str) -> str:
    return f"{user_id}:{session_id}"


def _safe_int(value: Any) -> int:
    if isinstance(value, bool):
        return 0
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return 0


def _usage_details(usage: dict[str, Any], *keys: str) -> dict[str, Any]:
    current: Any = usage
    for key in keys:
        if not isinstance(current, dict):
            return {}
        current = current.get(key) or current.get(_camel_to_snake(key)) or current.get(_snake_to_camel(key))
    return current if isinstance(current, dict) else {}


def _camel_to_snake(value: str) -> str:
    out = []
    for char in value:
        if char.isupper():
            out.extend(["_", char.lower()])
        else:
            out.append(char)
    return "".join(out).lstrip("_")


def _snake_to_camel(value: str) -> str:
    first, *rest = value.split("_")
    return first + "".join(part.capitalize() for part in rest)


def _usage_value(usage: dict[str, Any], key: str) -> int:
    return _safe_int(usage.get(key) or usage.get(_snake_to_camel(key)))


def _normalize_usage(raw_usage: Any) -> dict[str, int]:
    usage = raw_usage if isinstance(raw_usage, dict) else {}
    input_details = _usage_details(usage, "input_token_details")
    output_details = _usage_details(usage, "output_token_details")
    return {
        "totalTokens": _usage_value(usage, "total_tokens"),
        "inputTokens": _usage_value(usage, "input_tokens"),
        "outputTokens": _usage_value(usage, "output_tokens"),
        "inputTextTokens": _usage_value(input_details, "text_tokens"),
        "inputAudioTokens": _usage_value(input_details, "audio_tokens"),
        "inputCachedTokens": _usage_value(input_details, "cached_tokens"),
        "outputTextTokens": _usage_value(output_details, "text_tokens"),
        "outputAudioTokens": _usage_value(output_details, "audio_tokens"),
    }


def _add_usage(state: RealtimeSidebandState, raw_usage: Any) -> None:
    normalized = _normalize_usage(raw_usage)
    for key, value in normalized.items():
        state.usage[key] = state.usage.get(key, 0) + value
    state.usage_event_count += 1
    state.last_usage = normalized


def _event_usage(event: dict[str, Any]) -> Any:
    response = event.get("response")
    if isinstance(response, dict) and "usage" in response:
        return response.get("usage")
    return event.get("usage")


def _event_error(event: dict[str, Any]) -> str | None:
    error = event.get("error")
    if isinstance(error, dict):
        return str(error.get("message") or error.get("code") or error)
    if error:
        return str(error)
    return None


def _short_text(value: Any, limit: int = 500) -> str | None:
    if not isinstance(value, str):
        return None
    text = value.strip()
    if not text:
        return None
    return text[:limit]


def _transcript_text(value: Any, limit: int = 8000) -> str | None:
    if not isinstance(value, str):
        return None
    text = value.strip()
    if not text:
        return None
    return text[:limit]


def _transcript_event_key(event: dict[str, Any], role: str, text: str) -> str:
    stable_parts = [
        event.get("item_id"),
        event.get("response_id"),
        event.get("output_index"),
        event.get("content_index"),
    ]
    stable = [str(part) for part in stable_parts if part is not None and str(part)]
    if stable:
        return f"{role}:" + ":".join(stable)
    return f"{role}:{text[:300]}"


def _assistant_buffer_key(event: dict[str, Any]) -> str:
    stable_parts = [
        event.get("response_id"),
        event.get("item_id"),
        event.get("output_index"),
        event.get("content_index"),
    ]
    stable = [str(part) for part in stable_parts if part is not None and str(part)]
    return ":".join(stable) if stable else "assistant"


async def _update_fields(user_id: str, session_id: str, fields: dict[str, Any]) -> None:
    await asyncio.to_thread(update_chat_session_fields, user_id, session_id, fields)


async def _get_session(user_id: str, session_id: str) -> dict | None:
    return await asyncio.to_thread(get_chat_session, user_id, session_id)


async def _request_kick(user_id: str, session_id: str, reason: str) -> None:
    await asyncio.to_thread(request_chat_session_realtime_kick, user_id, session_id, reason)


async def _save_transcript_message(
    state: RealtimeSidebandState,
    *,
    role: str,
    text: str,
    event: dict[str, Any],
) -> None:
    key = _transcript_event_key(event, role, text)
    if key in state.saved_transcript_keys:
        return
    state.saved_transcript_keys.add(key)

    created_at = now_iso()
    message = {
        "id": f"cm_{uuid4().hex[:12]}",
        "userId": state.user_id,
        "sessionId": state.session_id,
        "role": role,
        "content": text,
        "corrections": None,
        "betterExpression": None,
        "source": "realtime_sideband",
        "realtimeCallId": state.call_id,
        "createdAt": created_at,
    }
    await asyncio.to_thread(save_chat_message, message)
    if role == "user":
        try:
            await asyncio.to_thread(
                remember_candidates,
                state.user_id,
                heuristic_memory_candidates(text),
                source_type="chat",
                source_id=state.session_id,
            )
        except Exception as exc:
            logger.warning("realtime memory persist failed session=%s: %s", state.session_id, exc)
    state.saved_transcript_message_count += 1
    if role == "user" and not state.transcript_summary:
        state.transcript_summary = text[:80]
    summary = state.transcript_summary or text[:80]
    await asyncio.to_thread(
        update_chat_session_summary,
        state.user_id,
        state.session_id,
        summary,
        state.saved_transcript_message_count,
    )


async def _connect_realtime_sideband(call_id: str):
    url = f"wss://api.openai.com/v1/realtime?call_id={quote(call_id)}"
    headers = {"Authorization": f"Bearer {settings.openai_api_key}"}
    try:
        return await websockets.connect(
            url,
            additional_headers=headers,
            open_timeout=10,
            ping_interval=20,
            ping_timeout=20,
        )
    except TypeError:
        return await websockets.connect(
            url,
            extra_headers=headers,
            open_timeout=10,
            ping_interval=20,
            ping_timeout=20,
        )


async def start_realtime_sideband(
    *,
    user_id: str,
    session_id: str,
    call_id: str,
    max_duration_seconds: int | None,
) -> dict[str, Any]:
    key = _monitor_key(user_id, session_id)
    existing = _monitors.get(key)
    if existing and existing.task and not existing.task.done():
        if existing.call_id == call_id:
            return {"sidebandStatus": "already_monitoring", "activeSideband": True}
        existing.kick_reason = "replaced_by_new_call"
        existing.kick_event.set()

    now = now_iso()
    await _update_fields(
        user_id,
        session_id,
        {
            "realtimeCallId": call_id,
            "realtimeStatus": "sideband_starting",
            "realtimeSidebandRequestedAt": now,
            "realtimeEventCount": 0,
            "realtimeResponseCount": 0,
            "realtimeUsageEventCount": 0,
            "realtimeTranscriptSavedCount": 0,
            "realtimeUsage": dict(_ZERO_USAGE),
            "realtimeLastError": None,
            "updatedAt": now,
        },
    )

    state = RealtimeSidebandState(
        user_id=user_id,
        session_id=session_id,
        call_id=call_id,
        max_duration_seconds=max_duration_seconds,
    )
    state.task = asyncio.create_task(_run_realtime_sideband(state))
    _monitors[key] = state
    return {"sidebandStatus": "starting", "activeSideband": True}


async def kick_realtime_session(*, user_id: str, session_id: str, reason: str = "manual") -> dict[str, Any]:
    await _request_kick(user_id, session_id, reason)
    state = _monitors.get(_monitor_key(user_id, session_id))
    if not state or not state.task or state.task.done():
        return {"kickRequested": True, "activeSideband": False, "kickSent": False}

    state.kick_reason = reason
    state.kick_event.set()
    sent = await _send_kick(state, reason=reason)
    return {"kickRequested": True, "activeSideband": True, "kickSent": sent}


def has_active_realtime_sideband(user_id: str, session_id: str) -> bool:
    state = _monitors.get(_monitor_key(user_id, session_id))
    return bool(state and state.task and not state.task.done())


async def _run_realtime_sideband(state: RealtimeSidebandState) -> None:
    key = _monitor_key(state.user_id, state.session_id)
    try:
        async with await _connect_realtime_sideband(state.call_id) as ws:
            state.ws = ws
            state.started_epoch = time.time()
            now = now_iso()
            await _update_fields(
                state.user_id,
                state.session_id,
                {
                    "realtimeStatus": "monitoring",
                    "realtimeSidebandStartedAt": now,
                    "realtimeSidebandStartedAtEpoch": int(state.started_epoch),
                    "realtimeLastEventAt": now,
                    "updatedAt": now,
                },
            )
            logger.info("realtime sideband started session=%s call_id=%s", state.session_id, state.call_id)
            await _monitor_messages(state, ws)
    except ConnectionClosed:
        now = now_iso()
        await _update_fields(
            state.user_id,
            state.session_id,
            {
                "realtimeStatus": "kicked" if state.kick_sent else "ended",
                "realtimeEndedAt": now,
                "realtimeElapsedSeconds": int(time.time() - state.started_epoch),
                "updatedAt": now,
            },
        )
    except asyncio.CancelledError:
        raise
    except Exception as exc:
        logger.warning("realtime sideband failed session=%s: %s", state.session_id, exc)
        await _update_fields(
            state.user_id,
            state.session_id,
            {
                "realtimeStatus": "sideband_error",
                "realtimeLastError": str(exc)[:500],
                "realtimeEndedAt": now_iso(),
            },
        )
    finally:
        state.ws = None
        if _monitors.get(key) is state:
            _monitors.pop(key, None)


async def _monitor_messages(state: RealtimeSidebandState, ws: Any) -> None:
    while True:
        if await _maybe_enforce_kick(state, ws):
            continue

        try:
            raw = await asyncio.wait_for(ws.recv(), timeout=AUDIT_FLUSH_SECONDS)
        except asyncio.TimeoutError:
            await _maybe_flush(state, force=True)
            continue

        if isinstance(raw, bytes):
            raw = raw.decode("utf-8", errors="replace")

        try:
            event = json.loads(raw)
        except json.JSONDecodeError:
            state.event_count += 1
            state.last_event_type = "invalid_json"
            await _maybe_flush(state)
            continue

        await _handle_realtime_event(state, event)


async def _handle_realtime_event(state: RealtimeSidebandState, event: dict[str, Any]) -> None:
    event_type = str(event.get("type") or "unknown")
    state.event_count += 1
    state.last_event_type = event_type

    if event_type == "conversation.item.input_audio_transcription.completed":
        state.transcript_count += 1
        text = _transcript_text(event.get("transcript"))
        if text:
            state.last_user_transcript = _short_text(text)
            await _save_transcript_message(state, role="user", text=text, event=event)

    if event_type == "response.audio_transcript.delta":
        key = _assistant_buffer_key(event)
        state.assistant_transcript_buffers[key] = (
            state.assistant_transcript_buffers.get(key, "") + str(event.get("delta") or "")
        )

    if event_type == "response.audio_transcript.done":
        state.assistant_transcript_count += 1
        key = _assistant_buffer_key(event)
        text = _transcript_text(event.get("transcript")) or _transcript_text(
            state.assistant_transcript_buffers.pop(key, "")
        )
        if text:
            state.last_assistant_transcript = _short_text(text)
            await _save_transcript_message(state, role="assistant", text=text, event=event)

    if event_type == "response.done":
        state.response_count += 1
        state.usage["responses"] = state.response_count
        _add_usage(state, _event_usage(event))

    if event_type == "error":
        state.last_error = _event_error(event) or "Unknown realtime error"

    await _maybe_flush(state, important=event_type in {
        "session.created",
        "session.updated",
        "conversation.item.input_audio_transcription.completed",
        "response.audio_transcript.done",
        "response.done",
        "error",
    })


async def _maybe_enforce_kick(state: RealtimeSidebandState, ws: Any) -> bool:
    now_epoch = time.time()
    if state.kick_sent and state.kick_sent_epoch and now_epoch - state.kick_sent_epoch > 8:
        await ws.close(code=1000, reason="quota enforced")
        return True

    if state.kick_event.is_set():
        await _send_kick(state, reason=state.kick_reason)
        return True

    if state.last_control_check_epoch and now_epoch - state.last_control_check_epoch < AUDIT_FLUSH_SECONDS:
        return False

    state.last_control_check_epoch = now_epoch
    session = await _get_session(state.user_id, state.session_id)
    if not session:
        await _send_kick(state, reason="session_not_found")
        return True

    if session.get("realtimeStatus") == "kick_requested":
        await _send_kick(state, reason=state.kick_reason or session.get("realtimeKickReason") or "manual")
        return True

    expires_at = _safe_int(session.get("expiresAt"))
    if expires_at and int(time.time()) >= expires_at:
        await _send_kick(state, reason="duration_limit")
        return True

    return False


async def _send_kick(state: RealtimeSidebandState, *, reason: str) -> bool:
    if state.kick_sent:
        return True
    ws = state.ws
    if ws is None:
        return False

    forced_expires_at = int(time.time()) + 1
    payload = {
        "type": "session.update",
        "session": {
            "type": "realtime",
            "expires_at": forced_expires_at,
        },
    }
    await ws.send(json.dumps(payload))
    state.kick_sent = True
    state.kick_sent_epoch = time.time()
    state.kick_event.clear()
    now = now_iso()
    await _update_fields(
        state.user_id,
        state.session_id,
        {
            "realtimeStatus": "kick_sent",
            "realtimeKickSentAt": now,
            "realtimeKickReason": reason,
            "realtimeForcedExpiresAt": forced_expires_at,
            "realtimeElapsedSeconds": int(time.time() - state.started_epoch),
            "updatedAt": now,
        },
    )
    logger.info("realtime sideband kick sent session=%s reason=%s", state.session_id, reason)
    return True


async def _maybe_flush(state: RealtimeSidebandState, *, important: bool = False, force: bool = False) -> None:
    now_epoch = time.time()
    should_flush = (
        force
        or important
        or state.last_flush_epoch == 0
        or state.event_count % AUDIT_EVENT_FLUSH_INTERVAL == 0
        or now_epoch - state.last_flush_epoch >= AUDIT_FLUSH_SECONDS
    )
    if not should_flush:
        return

    state.last_flush_epoch = now_epoch
    now = now_iso()
    await _update_fields(
        state.user_id,
        state.session_id,
        {
            "realtimeStatus": "kick_sent" if state.kick_sent else "monitoring",
            "realtimeLastEventAt": now,
            "realtimeLastEventType": state.last_event_type,
            "realtimeEventCount": state.event_count,
            "realtimeResponseCount": state.response_count,
            "realtimeUsageEventCount": state.usage_event_count,
            "realtimeTranscriptCount": state.transcript_count,
            "realtimeAssistantTranscriptCount": state.assistant_transcript_count,
            "realtimeTranscriptSavedCount": state.saved_transcript_message_count,
            "realtimeLastUserTranscript": state.last_user_transcript,
            "realtimeLastAssistantTranscript": state.last_assistant_transcript,
            "realtimeLastUsage": state.last_usage,
            "realtimeUsage": state.usage,
            "realtimeLastError": state.last_error,
            "realtimeElapsedSeconds": int(now_epoch - state.started_epoch),
            "updatedAt": now,
        },
    )
