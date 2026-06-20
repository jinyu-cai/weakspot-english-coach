from fastapi import APIRouter, Depends

from app.api.deps import Identity, resolve_identity
from app.services.profile_service import build_profile_overview

router = APIRouter()


@router.get("/profile/{user_id}")
def get_profile_page_data(user_id: str, identity: Identity = Depends(resolve_identity)):
    return build_profile_overview(identity.user_id)
