import re
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import Identity, rate_limited
from app.db.repositories import (
    delete_note,
    get_chat_message,
    get_chat_session,
    get_note,
    now_iso,
    save_note,
)
from app.models.notes import SaveChatSelectionRequest
from app.services.notebook_service import list_notebook_notes

router = APIRouter()

_BROKEN_TZ = re.compile(r" (\d{2}:\d{2})$")


def _fix_tz(value: str) -> str:
    """URL query parsers decode '+' as space; restore '+00:00' from ' 00:00'."""
    return _BROKEN_TZ.sub(r"+\1", value)


@router.get("/notes")
def get_notes(identity: Identity = Depends(rate_limited("notes"))):
    notes = list_notebook_notes(identity.user_id)
    return {"notes": notes}


def _normalized_text(value: str) -> str:
    return " ".join(value.split())


def _message_context(content: str, selected_text: str, max_chars: int = 700) -> str:
    """Keep enough surrounding text to make a saved excerpt useful later."""
    content = content.strip()
    if not content or _normalized_text(content) == _normalized_text(selected_text):
        return ""
    if len(content) <= max_chars:
        return content

    selected_at = content.find(selected_text)
    if selected_at < 0:
        return f"{content[:max_chars].rstrip()}…"

    before = max(0, selected_at - max_chars // 3)
    after = min(len(content), before + max_chars)
    before = max(0, after - max_chars)
    excerpt = content[before:after].strip()
    return f"{'…' if before else ''}{excerpt}{'…' if after < len(content) else ''}"


@router.post("/notes/from-chat")
def save_chat_selection(
    req: SaveChatSelectionRequest,
    identity: Identity = Depends(rate_limited("notes")),
):
    session = get_chat_session(identity.user_id, req.sessionId)
    if not session:
        raise HTTPException(status_code=404, detail="Chat session not found.")

    starter_id = f"session-starter-{req.sessionId}"
    if req.messageId == starter_id:
        source_content = str(session.get("starterMessage") or "").strip()
        source_role = "assistant"
        if not source_content:
            raise HTTPException(status_code=404, detail="Chat message not found.")
    else:
        message = get_chat_message(
            identity.user_id,
            req.messageCreatedAt,
            req.messageId,
            req.sessionId,
        )
        if not message or message.get("sessionId") != req.sessionId:
            raise HTTPException(status_code=404, detail="Chat message not found.")
        source_content = str(message.get("content") or "").strip()
        source_role = "user" if message.get("role") == "user" else "assistant"

    selected_text = req.selectedText.strip()
    if _normalized_text(selected_text) not in _normalized_text(source_content):
        raise HTTPException(
            status_code=400,
            detail="Selected text must come from the specified chat message.",
        )

    now = now_iso()
    note = {
        "id": f"note_{uuid4().hex[:12]}",
        "userId": identity.user_id,
        # A learner-message selection follows the same weakness lifecycle as
        # memories learned from that turn; coach selections remain current.
        "submissionId": req.messageId,
        "type": "expression",
        "topic": str(session.get("topic") or "").strip(),
        "original": selected_text,
        # Retain the established note shape for exports and older clients.
        "natural": selected_text,
        "explanation": "",
        "context": _message_context(source_content, selected_text),
        "examples": [],
        "sourceType": "chat_selection",
        "sourceRole": source_role,
        "sessionId": req.sessionId,
        "messageId": req.messageId,
        "createdAt": now,
    }
    save_note(note)
    return {
        "note": {
            **note,
            "learningState": "current",
            "relatedWeaknesses": [],
        }
    }


@router.delete("/notes/{note_id}")
def remove_note(
    note_id: str,
    createdAt: str,
    identity: Identity = Depends(rate_limited("notes")),
):
    createdAt = _fix_tz(createdAt)
    existing = get_note(identity.user_id, createdAt, note_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Note not found")
    delete_note(identity.user_id, createdAt, note_id)
    return {"deleted": True, "noteId": note_id}
