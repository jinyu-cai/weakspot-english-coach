from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.deps import Identity, get_llm_provider, rate_limited, resolve_identity
from app.models.input_learning import AnalyzeInputLearningRequest
from app.services.ai_client import LLMProviderConfig
from app.services.input_learning_service import (
    InputLearningInProgressError,
    analyze_input_learning,
    delete_input_learning_source_for_user,
    get_input_learning_source_for_user,
    list_input_learning_sources_for_user,
)


router = APIRouter(prefix="/input-learning")


@router.post("/analyze")
def analyze_source(
    req: AnalyzeInputLearningRequest,
    llm_provider: LLMProviderConfig | None = Depends(get_llm_provider),
    identity: Identity = Depends(rate_limited("input_learning")),
):
    try:
        source = analyze_input_learning(
            identity.user_id,
            req,
            llm_provider=llm_provider,
            max_output_tokens=(
                None if identity.has_unlimited_llm_quota else identity.max_output_tokens
            ),
        )
        return {"source": source}
    except InputLearningInProgressError as exc:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "input_learning_in_progress",
                "message": str(exc),
            },
        ) from exc
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=f"AI error: {exc}") from exc


@router.get("")
def list_sources(
    limit: int = Query(default=50, ge=1, le=200),
    identity: Identity = Depends(resolve_identity),
):
    sources = list_input_learning_sources_for_user(identity.user_id, limit=limit)
    return {"sources": sources, "count": len(sources)}


@router.get("/{source_id}")
def read_source(
    source_id: str,
    identity: Identity = Depends(resolve_identity),
):
    source = get_input_learning_source_for_user(identity.user_id, source_id)
    if not source:
        raise HTTPException(status_code=404, detail="Input-learning source not found.")
    return {"source": source}


@router.delete("/{source_id}")
def delete_source(
    source_id: str,
    identity: Identity = Depends(resolve_identity),
):
    try:
        if not delete_input_learning_source_for_user(identity.user_id, source_id):
            raise HTTPException(status_code=404, detail="Input-learning source not found.")
    except InputLearningInProgressError as exc:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "input_learning_in_progress",
                "message": str(exc),
            },
        ) from exc
    return {"deleted": True, "id": source_id}
