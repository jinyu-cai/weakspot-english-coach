"""Shared quality/latency policy for provider-neutral text-model calls."""

from typing import Literal, Optional

from app.config import settings
from app.services.ai_client import (
    DEEP_REASONING_EFFORT,
    FAST_REASONING_EFFORT,
    LLMProviderConfig,
)


ModelTier = Literal["fast", "deep"]


def select_text_model(
    tier: ModelTier,
    provider: Optional[LLMProviderConfig] = None,
) -> str:
    """Resolve one task tier against the request's Deep/Fast model pair."""

    if provider is not None:
        if tier == "fast":
            return provider.fast_model or provider.model
        return provider.model

    if tier == "fast":
        return settings.default_llm_fast_model or settings.default_llm_model
    return settings.default_llm_model


def reasoning_effort_for_tier(tier: ModelTier) -> Optional[str]:
    """Resolve the product's explicit reasoning contract for each model tier."""

    return FAST_REASONING_EFFORT if tier == "fast" else DEEP_REASONING_EFFORT
