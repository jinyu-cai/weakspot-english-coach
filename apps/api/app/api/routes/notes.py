from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import Identity, rate_limited
from app.db.repositories import delete_note, get_note, list_notes

router = APIRouter()


@router.get("/notes")
def get_notes(identity: Identity = Depends(rate_limited("notes"))):
    notes = list_notes(identity.user_id)
    return {"notes": notes}


@router.delete("/notes/{note_id}")
def remove_note(
    note_id: str,
    createdAt: str,
    identity: Identity = Depends(rate_limited("notes")),
):
    existing = get_note(identity.user_id, createdAt, note_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Note not found")
    delete_note(identity.user_id, createdAt, note_id)
    return {"deleted": True, "noteId": note_id}
