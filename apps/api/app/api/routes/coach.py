import logging
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Response

from app.api.deps import Identity, get_llm_provider, rate_limited, require_owner
from app.db.repositories import list_chat_sessions_page, list_skills
from app.models.coach import (
    CoachMissionRequest,
    CoachMissionResponse,
    CoachSpeechRequest,
    InputLab2TranscriptMissionRequest,
)
from app.models.learning import CreateActivityRunRequest
from app.services.ai_client import LLMProviderConfig
from app.services.coach_service import generate_coach_mission, generate_transcript_mission
from app.services.learning_service import create_activity_run, recommend_coach_mission
from app.services.tts_service import (
    TTSNotConfiguredError,
    TTSProviderError,
    generate_speech,
)


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
        decision = recommend_coach_mission(
            identity.user_id,
            modality=req.modality,
            preferred_type=req.preferredType,
        )
        effective_req = (
            req
            if req.preferredType
            else req.model_copy(update={"preferredType": decision["recommendedType"]})
        )
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

        try:
            recent_sessions, _ = list_chat_sessions_page(identity.user_id, page_size=20)
            recent_scenario_families = [
                str(session.get("scenarioFamily"))
                for session in recent_sessions
                if session.get("scenarioFamily")
            ]
        except Exception:
            logger.exception("coach[%s] scenario_history_error", request_id)
            recent_scenario_families = []

        response = generate_coach_mission(
            effective_req,
            learner_skills=learner_skills,
            recent_scenario_families=recent_scenario_families,
            recommended_skills=decision["targetSkills"],
            learning_context=(
                f"Goals: {decision['goalContext']}\n"
                f"Preferences: {decision['preferenceContext']}\n"
                f"Strategies: {decision['strategyContext']}\n"
                f"Selection reason: {decision['reason']}"
            ),
            llm_provider=llm_provider,
            user_id=identity.user_id,
            max_tokens=(
                4000
                if identity.has_unlimited_llm_quota
                else min(identity.max_output_tokens or 4000, 4000)
            ),
            trace_id=request_id,
        )
        mission = response.mission
        run = create_activity_run(
            identity.user_id,
            CreateActivityRunRequest(
                activityType="coach",
                sourceId=mission.id,
                title=mission.title,
                taskType=mission.type,
                goal=mission.taskPrompt,
                targetSkills=mission.targetSkills,
                modality=effective_req.modality,
                difficulty=effective_req.energy,
                estimatedMinutes=effective_req.durationMinutes,
            ),
        )
        payload = response.model_dump(mode="json")
        payload["mission"]["activityRunId"] = run["id"]
        payload["mission"]["schedulerDecision"] = {
            "targetSkills": decision["targetSkills"],
            "recommendedType": decision["recommendedType"],
            "reason": decision["reason"],
            "skillScores": decision["skillScores"][:8],
            "missionTypeScores": decision["missionTypeScores"],
            "policy": decision["policy"],
            "generatedAt": decision["generatedAt"],
        }
        return CoachMissionResponse.model_validate(payload)
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


@router.post("/speech")
def create_coach_speech(
    req: CoachSpeechRequest,
    identity: Identity = Depends(rate_limited("coach_speech")),
):
    """Return AI-generated MP3 audio; the OpenAI key stays on the server."""

    try:
        audio = generate_speech(req.text, req.style)
    except TTSNotConfiguredError as exc:
        raise HTTPException(
            status_code=503,
            detail={
                "code": "tts_not_configured",
                "message": "AI speech is unavailable; use browser speech fallback.",
            },
        ) from exc
    except TTSProviderError as exc:
        logger.warning("coach speech provider_error user_id=%s error=%s", identity.user_id, exc)
        raise HTTPException(
            status_code=502,
            detail={
                "code": "tts_provider_error",
                "message": "AI speech generation failed; use browser speech fallback.",
            },
        ) from exc

    return Response(
        content=audio,
        media_type="audio/mpeg",
        headers={
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )


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
