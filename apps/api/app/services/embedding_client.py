"""Best-effort Qwen embeddings for MemoryAgent retrieval.

Memory must never make diagnosis or chat unavailable, so embedding failures are
logged and callers transparently fall back to lexical retrieval.
"""

import logging
from typing import Optional

from openai import OpenAI, OpenAIError

from app.config import settings


logger = logging.getLogger("uvicorn.error")
_client: Optional[OpenAI] = None


def embeddings_available() -> bool:
    return bool(
        settings.memory_enabled
        and settings.qwen_model_studio_api_key
        and settings.qwen_embedding_model
    )


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(
            api_key=settings.qwen_model_studio_api_key,
            base_url=settings.qwen_model_studio_base_url,
        )
    return _client


def embed_texts(texts: list[str]) -> list[Optional[list[float]]]:
    cleaned = [" ".join((text or "").split())[:6000] for text in texts]
    if not cleaned:
        return []
    if not embeddings_available() or settings.use_fake_ai:
        return [None for _ in cleaned]

    try:
        kwargs: dict = {
            "model": settings.qwen_embedding_model,
            "input": cleaned,
            "timeout": 30,
        }
        if settings.qwen_embedding_dimensions > 0:
            kwargs["dimensions"] = settings.qwen_embedding_dimensions
        response = _get_client().embeddings.create(**kwargs)
        vectors: list[Optional[list[float]]] = [None for _ in cleaned]
        for row in response.data:
            if 0 <= row.index < len(vectors):
                vectors[row.index] = [float(value) for value in row.embedding]
        return vectors
    except (OpenAIError, ValueError, TypeError) as exc:
        logger.warning(
            "memory embedding fallback model=%s texts=%d error=%s",
            settings.qwen_embedding_model,
            len(cleaned),
            exc,
        )
        return [None for _ in cleaned]


def embed_text(text: str) -> Optional[list[float]]:
    return embed_texts([text])[0]
