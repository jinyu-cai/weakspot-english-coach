from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.api.deps import Identity, require_owner
from app.db.repositories import delete_access_role, get_access_role, list_access_roles, set_access_role

router = APIRouter(prefix="/admin")


class AccessRoleRequest(BaseModel):
    identifier: str = Field(min_length=1, max_length=180)
    role: Literal["owner", "member"]


@router.get("/access-roles")
def list_access_roles_endpoint(identity: Identity = Depends(require_owner)):
    roles = list_access_roles()
    return {"accessRoles": roles}


@router.get("/access-roles/{identifier}")
def read_access_role(identifier: str, identity: Identity = Depends(require_owner)):
    role = get_access_role(identifier)
    if not role:
        raise HTTPException(status_code=404, detail="Access role not found.")
    return {"accessRole": role}


@router.post("/access-roles")
def upsert_access_role(req: AccessRoleRequest, identity: Identity = Depends(require_owner)):
    role = set_access_role(req.identifier, req.role, updated_by=identity.login or identity.user_id)
    return {"accessRole": role}


@router.delete("/access-roles/{identifier}")
def remove_access_role(identifier: str, identity: Identity = Depends(require_owner)):
    existing = get_access_role(identifier)
    if not existing:
        raise HTTPException(status_code=404, detail="Access role not found.")
    delete_access_role(identifier)
    return {"deleted": True, "identifier": existing["identifier"]}
