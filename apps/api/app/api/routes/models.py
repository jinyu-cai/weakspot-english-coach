from fastapi import APIRouter

from app.services.model_catalog import catalog_payload

router = APIRouter(prefix="/llm")


@router.get("/models")
def list_models():
    """List selectable server text models without exposing credentials."""
    return catalog_payload()
