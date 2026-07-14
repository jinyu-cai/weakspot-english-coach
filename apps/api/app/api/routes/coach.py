import logging
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import Identity, get_llm_provider, rate_limited, require_owner
from app.db.repositories import list_skills
from app.models.coach import (
    CoachMissionRequest,
    CoachMissionResponse,
    InputLab2TranscriptMissionRequest,
)
from app.services.ai_client import LLMProviderConfig
from app.services.coach_service import generate_coach_mission, generate_transcript_mission


router = APIRouter(prefix="/coach")
logger = logging.getLogger("uvicorn.error")


@router.post("/missions", response_model=CoachMissionResponse)
def create_coach_mission(
    req: CoachMissionRequest,
    llm_provider: LLMProviderConfig | None = Depends(get_llm_provider),
    identity: Identity = Depends(rate_limited("coach")),
):
    request_id = uuid4().hex[:10]
    try:
        try:
            learner_skills = sorted(
                list_skills(identity.user_id),
                key=lambda skill: float(skill.get("mastery", 50)),
            )[:5]
        except Exception:
            # A mission should still help a new learner if historical state is
            # temporarily unavailable. No weakness is fabricated in this path.
            logger.exception("coach[%s] skill_context_error", request_id)
            learner_skills = []

        return generate_coach_mission(
            req,
            learner_skills=learner_skills,
            llm_provider=llm_provider,
            max_tokens=(
                4000
                if identity.has_unlimited_llm_quota
                else min(identity.max_output_tokens or 4000, 4000)
            ),
            trace_id=request_id,
        )
    except ValueError as exc:
        logger.exception("coach[%s] ai_error", request_id)
        raise HTTPException(
            status_code=502,
            detail=f"AI mission generation failed [{request_id}]: {exc}",
        ) from exc
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("coach[%s] server_error", request_id)
        raise HTTPException(
            status_code=500,
            detail=f"Mission request {request_id} failed.",
        ) from exc


@router.post(
    "/input-lab-2/transcript-missions",
    response_model=CoachMissionResponse,
)
def create_input_lab_2_transcript_mission(
    req: InputLab2TranscriptMissionRequest,
    identity: Identity = Depends(require_owner),
    llm_provider: LLMProviderConfig | None = Depends(get_llm_provider),
):
    """Build an owner-only mission from explicitly supplied transcript text.

    The contract intentionally has no URL field and performs no remote fetch.
    ``rightsBasis`` is required as an owner assertion, but is neither logged nor
    treated as an automated legal determination.
    """

    request_id = uuid4().hex[:10]
    try:
        return generate_transcript_mission(
            req,
            llm_provider=llm_provider,
            max_tokens=4000,
            trace_id=request_id,
        )
    except ValueError as exc:
        logger.exception("coach_input2[%s] ai_error owner=%s", request_id, identity.user_id)
        raise HTTPException(
            status_code=502,
            detail=f"AI transcript mission generation failed [{request_id}]: {exc}",
        ) from exc
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("coach_input2[%s] server_error owner=%s", request_id, identity.user_id)
        raise HTTPException(
            status_code=500,
            detail=f"Transcript mission request {request_id} failed.",
        ) from exc
