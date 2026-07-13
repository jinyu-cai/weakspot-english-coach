from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.deps import Identity, rate_limited, resolve_identity
from app.db.repositories import list_memories, list_memory_traces
from app.models.memory import CreateMemoryRequest, RetrieveMemoryRequest, UpdateMemoryRequest
from app.services.decision_service import recommend_next_action
from app.services.memory_service import (
    create_manual_memory,
    forget_memory,
    list_active_memory_records,
    public_memory,
    retrieve_memory_pack,
    update_memory,
)
from app.services.stealth_practice_service import select_stealth_probe


router = APIRouter(prefix="/memory")


@router.get("")
def get_memories(
    status: Optional[Literal["active", "resolved", "superseded", "expired", "forgotten", "all"]] = "active",
    kind: Optional[Literal["preference", "goal", "strategy", "weakness", "episode"]] = None,
    limit: int = Query(default=200, ge=1, le=500),
    identity: Identity = Depends(resolve_identity),
):
    # Synchronize status before listing so an expired row never appears active
    # merely because no retrieval has happened yet.
    list_active_memory_records(identity.user_id)
    memories = list_memories(identity.user_id, limit=limit)
    if status and status != "all":
        memories = [memory for memory in memories if memory.get("status", "active") == status]
    if kind:
        memories = [memory for memory in memories if memory.get("kind") == kind]
    public = [public_memory(memory) for memory in memories]
    return {
        "memories": public,
        "count": len(public),
        "activeCount": sum(memory.get("status", "active") == "active" for memory in public),
    }


@router.post("")
def add_memory(req: CreateMemoryRequest, identity: Identity = Depends(rate_limited("memory"))):
    memory = create_manual_memory(
        identity.user_id,
        kind=req.kind,
        canonical_key=req.canonicalKey,
        content=req.content,
        evidence=req.evidence,
        confidence=req.confidence,
        importance=req.importance,
        pinned=req.pinned,
        expires_in_days=req.expiresInDays,
    )
    return {"memory": memory}


@router.post("/retrieve")
def retrieve(req: RetrieveMemoryRequest, identity: Identity = Depends(rate_limited("memory"))):
    pack = retrieve_memory_pack(
        identity.user_id,
        req.query,
        token_budget=req.tokenBudget,
        limit=req.limit,
        purpose="preview",
    )
    return {"memoryPack": pack}


@router.get("/traces")
def traces(
    limit: int = Query(default=20, ge=1, le=100),
    identity: Identity = Depends(resolve_identity),
):
    rows = list_memory_traces(identity.user_id, limit=limit)
    return {
        "traces": [
            {key: value for key, value in row.items() if key not in {"PK", "SK", "entityType"}}
            for row in rows
        ]
    }


@router.get("/next-action")
def next_action(identity: Identity = Depends(resolve_identity)):
    return {"decision": recommend_next_action(identity.user_id)}


@router.get("/stealth-next")
def stealth_next(
    modality: str = Query(default="text_chat", min_length=2, max_length=40),
    topic: Optional[str] = Query(default=None, max_length=300),
    identity: Identity = Depends(resolve_identity),
):
    """Explain the next due target to owners for QA only.

    Active probes contain the learner's hidden teaching objective, so this
    endpoint must never be available to ordinary learner sessions.
    """
    if not identity.is_owner:
        raise HTTPException(status_code=403, detail="Owner access required.")
    return {
        "probe": select_stealth_probe(
            identity.user_id,
            modality=modality,
            topic=topic,
        )
    }


@router.patch("/{memory_id}")
def patch_memory(
    memory_id: str,
    req: UpdateMemoryRequest,
    identity: Identity = Depends(rate_limited("memory")),
):
    memory = update_memory(
        identity.user_id,
        memory_id,
        req.model_dump(exclude_unset=True),
    )
    if not memory:
        raise HTTPException(status_code=404, detail="Memory not found.")
    return {"memory": memory}


@router.delete("/{memory_id}")
def remove_memory(memory_id: str, identity: Identity = Depends(resolve_identity)):
    memory = forget_memory(identity.user_id, memory_id)
    if not memory:
        raise HTTPException(status_code=404, detail="Memory not found.")
    return {"memory": memory, "forgotten": True}
