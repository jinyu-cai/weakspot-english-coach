from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.deps import Identity, resolve_identity
from app.db.repositories import get_activity_run
from app.models.learning import (
    CreateActivityRunRequest,
    RecordEvidenceRequest,
    UpdateActivityRunRequest,
)
from app.services.learning_service import (
    create_activity_run,
    learning_overview,
    record_evidence,
    update_activity_run,
)


router = APIRouter(prefix="/learning")


@router.post("/runs")
def create_run(
    request: CreateActivityRunRequest,
    identity: Identity = Depends(resolve_identity),
):
    return {"run": create_activity_run(identity.user_id, request)}


@router.get("/runs/{run_id}")
def read_run(run_id: str, identity: Identity = Depends(resolve_identity)):
    run = get_activity_run(identity.user_id, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Activity run not found.")
    return {"run": run}


@router.patch("/runs/{run_id}")
def update_run(
    run_id: str,
    request: UpdateActivityRunRequest,
    identity: Identity = Depends(resolve_identity),
):
    try:
        return {"run": update_activity_run(identity.user_id, run_id, request)}
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.post("/evidence")
def create_evidence(
    request: RecordEvidenceRequest,
    identity: Identity = Depends(resolve_identity),
):
    try:
        return record_evidence(identity.user_id, request)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/overview")
def read_learning_overview(
    _days: int = Query(default=30, alias="days", ge=1, le=180),
    identity: Identity = Depends(resolve_identity),
):
    return learning_overview(identity.user_id)
