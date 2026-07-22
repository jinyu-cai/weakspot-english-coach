"""Shared quality/latency policy for provider-neutral text-model calls."""

from typing import Literal, Optional

from app.config import settings
from app.services.ai_client import HIGH_REASONING_EFFORT, LLMProviderConfig


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
    """Fast work favors response time; Deep work keeps the quality setting."""

    return None if tier == "fast" else HIGH_REASONING_EFFORT
