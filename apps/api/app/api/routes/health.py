from fastapi import APIRouter

from app.config import settings

router = APIRouter()


@router.get("/health")
def health_check():
    return {
        "status": "ok",
        "capabilities": {
            "openaiBuildWeek": {
                "enabled": settings.openai_build_week_enabled,
                "configured": bool(settings.openai_build_week_effective_api_key.strip()),
                "model": settings.openai_build_week_model,
                "api": "responses",
                "feature": "adaptive_mission_planner_v1",
            }
        },
    }
