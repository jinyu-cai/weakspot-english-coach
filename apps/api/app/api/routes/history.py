from fastapi import APIRouter, Depends

from app.api.deps import Identity, resolve_identity
from app.db.repositories import list_recent_errors, list_recent_submissions

router = APIRouter()


@router.get("/history/{user_id}")
def get_history(user_id: str, identity: Identity = Depends(resolve_identity)):
    return {
        "submissions": list_recent_submissions(identity.user_id, limit=20),
        "errors": list_recent_errors(identity.user_id, limit=20),
    }
