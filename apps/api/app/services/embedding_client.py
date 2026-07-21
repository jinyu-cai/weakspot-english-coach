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
EMBEDDING_MAX_BATCH_SIZE = 10


def embeddings_available() -> bool:
    return bool(
        settings.memory_enabled
        and settings.embedding_api_key
        and settings.qwen_embedding_model
    )


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(
            api_key=settings.embedding_api_key,
            base_url=settings.embedding_base_url,
        )
    return _client


def embed_texts(texts: list[str]) -> list[Optional[list[float]]]:
    cleaned = [" ".join((text or "").split())[:6000] for text in texts]
    if not cleaned:
        return []
    if not embeddings_available() or settings.use_fake_ai:
        return [None for _ in cleaned]

    vectors: list[Optional[list[float]]] = [None for _ in cleaned]
    for start in range(0, len(cleaned), EMBEDDING_MAX_BATCH_SIZE):
        batch = cleaned[start : start + EMBEDDING_MAX_BATCH_SIZE]
        try:
            kwargs: dict = {
                "model": settings.qwen_embedding_model,
                "input": batch,
                "timeout": 30,
            }
            if settings.qwen_embedding_dimensions > 0:
                kwargs["dimensions"] = settings.qwen_embedding_dimensions
            response = _get_client().embeddings.create(**kwargs)
            for row in response.data:
                target = start + row.index
                if start <= target < start + len(batch):
                    vectors[target] = [float(value) for value in row.embedding]
        except (OpenAIError, ValueError, TypeError) as exc:
            logger.warning(
                "memory embedding fallback model=%s batch_start=%d texts=%d error=%s",
                settings.qwen_embedding_model,
                start,
                len(batch),
                exc,
            )
    return vectors


def embed_text(text: str) -> Optional[list[float]]:
    return embed_texts([text])[0]
