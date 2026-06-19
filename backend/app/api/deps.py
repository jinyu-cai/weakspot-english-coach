from typing import Annotated, Optional

from fastapi import Header, HTTPException

from app.services.ai_client import LLMProviderConfig


def get_llm_provider(
    x_llm_api_key: Annotated[Optional[str], Header(alias="X-LLM-API-Key")] = None,
    x_llm_base_url: Annotated[Optional[str], Header(alias="X-LLM-Base-URL")] = None,
    x_llm_model: Annotated[Optional[str], Header(alias="X-LLM-Model")] = None,
) -> Optional[LLMProviderConfig]:
    """Build an optional per-request OpenAI-compatible provider config.

    No headers means the server default provider is used. If a caller opts into
    BYOK, require both key and model so we do not accidentally pair an OpenAI key
    with a server-side DeepSeek model name.
    """
    raw_values = [x_llm_api_key, x_llm_base_url, x_llm_model]
    if not any(value and value.strip() for value in raw_values):
        return None

    api_key = (x_llm_api_key or "").strip()
    base_url = (x_llm_base_url or "https://api.openai.com/v1").strip().rstrip("/")
    model = (x_llm_model or "").strip()

    if not api_key:
        raise HTTPException(status_code=400, detail="X-LLM-API-Key is required for custom LLM provider requests.")
    if not model:
        raise HTTPException(status_code=400, detail="X-LLM-Model is required for custom LLM provider requests.")
    if not base_url.startswith(("https://", "http://")):
        raise HTTPException(status_code=400, detail="X-LLM-Base-URL must be an absolute URL.")

    return LLMProviderConfig(api_key=api_key, base_url=base_url, model=model)
