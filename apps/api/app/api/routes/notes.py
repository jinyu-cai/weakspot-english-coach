import re

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import Identity, rate_limited
from app.db.repositories import delete_note, get_note
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
