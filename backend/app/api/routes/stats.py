from fastapi import APIRouter, Depends, Query

from app.api.deps import Identity, resolve_identity
from app.services.stats_service import build_daily_stats

router = APIRouter()


@router.get("/stats/daily/{user_id}")
def get_daily_stats(
    user_id: str,
    timezone: str | None = Query(default=None),
    days: int = Query(default=7, ge=1, le=30),
    identity: Identity = Depends(resolve_identity),
):
    return build_daily_stats(identity.user_id, timezone_name=timezone, days=days)
