from fastapi import APIRouter

from app.services.profile_service import build_profile_overview

router = APIRouter()


@router.get("/profile/{user_id}")
def get_profile_page_data(user_id: str):
    return build_profile_overview(user_id)
