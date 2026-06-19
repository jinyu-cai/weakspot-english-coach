from fastapi import APIRouter

from app.db.repositories import list_recent_errors, list_recent_submissions

router = APIRouter()


@router.get("/history/{user_id}")
def get_history(user_id: str):
    return {
        "submissions": list_recent_submissions(user_id, limit=20),
        "errors": list_recent_errors(user_id, limit=20),
    }
