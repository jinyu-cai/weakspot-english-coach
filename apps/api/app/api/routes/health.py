from fastapi import APIRouter, HTTPException

from app.config import settings
from app.db.database import database_ready

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


@router.get("/health/ready")
def readiness_check():
    if not database_ready():
        raise HTTPException(status_code=503, detail="Database is unavailable.")
    return {"status": "ready", "database": "postgresql"}
