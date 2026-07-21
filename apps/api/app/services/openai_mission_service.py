"""GPT-5.6 Responses API adapter for the Build Week mission planner.

This is intentionally separate from the provider-neutral Chat Completions
adapter. It gives the new feature an auditable OpenAI-only path, preserves the
existing Qwen/DeepSeek behavior when disabled, and uses native Pydantic
Structured Outputs instead of prompt-only JSON mode.
"""

from __future__ import annotations

from hashlib import sha256
import logging
import time
from typing import Type, TypeVar

from openai import OpenAI, OpenAIError
from pydantic import BaseModel

from app.config import settings
from app.models.coach import CoachGenerationMetadata


T = TypeVar("T", bound=BaseModel)
logger = logging.getLogger("uvicorn.error")


def _model_name() -> str:
    model = settings.openai_build_week_model.strip()
    if model != "gpt-5.6" and not model.startswith("gpt-5.6-"):
        raise ValueError(
            "OPENAI_BUILD_WEEK_MODEL must be a GPT-5.6 model so the runtime "
            "evidence cannot mislabel another model."
        )
    return model


def _official_base_url() -> str:
    base_url = settings.openai_build_week_base_url.strip().rstrip("/")
    if base_url != "https://api.openai.com/v1":
        raise ValueError(
            "OPENAI_BUILD_WEEK_BASE_URL must be https://api.openai.com/v1 so "
            "this feature is auditable as a direct OpenAI API integration."
        )
    return base_url


def _privacy_safe_user_id(user_id: str) -> str:
    """Create a stable identifier without sending the product user ID."""

    digest = sha256(user_id.encode("utf-8")).hexdigest()
    return f"weakspot_{digest[:32]}"


def parse_gpt56_mission(
    *,
    messages: list[dict],
    response_model: Type[T],
    user_id: str,
    max_output_tokens: int | None,
    trace_id: str | None = None,
) -> tuple[T, CoachGenerationMetadata]:
    """Generate and parse one mission through the official Responses API."""

    api_key = settings.openai_build_week_effective_api_key.strip()
    if not api_key:
        raise ValueError(
            "OPENAI_BUILD_WEEK_ENABLED is true but neither "
            "OPENAI_BUILD_WEEK_API_KEY nor OPENAI_API_KEY is configured."
        )

    model = _model_name()
    reasoning_effort = settings.openai_build_week_reasoning_effort
    trace = trace_id or "-"
    started = time.perf_counter()
    logger.info(
        "openai_mission[%s] start model=%s api=responses response_model=%s "
        "reasoning_effort=%s max_output_tokens=%s",
        trace,
        model,
        response_model.__name__,
        reasoning_effort,
        max_output_tokens if max_output_tokens is not None else "unlimited",
    )

    try:
        response = OpenAI(
            api_key=api_key,
            base_url=_official_base_url(),
        ).responses.parse(
            model=model,
            input=messages,
            text_format=response_model,
            reasoning={"effort": reasoning_effort},
            max_output_tokens=max_output_tokens,
            safety_identifier=_privacy_safe_user_id(user_id),
            store=False,
            timeout=settings.openai_build_week_timeout_seconds,
        )
    except OpenAIError as exc:
        status_code = getattr(exc, "status_code", None)
        error_code = getattr(exc, "code", None)
        logger.warning(
            "openai_mission[%s] upstream_error model=%s status=%s code=%s "
            "error_type=%s message=%s",
            trace,
            model,
            status_code,
            error_code,
            type(exc).__name__,
            str(exc),
        )
        raise ValueError(
            f"OpenAI Responses request failed ({type(exc).__name__}, "
            f"status={status_code}, code={error_code}): {exc}"
        ) from exc

    parsed = response.output_parsed
    if parsed is None:
        refusal = response.output_text.strip()
        detail = refusal[:300] if refusal else "no parsed structured output"
        raise ValueError(f"GPT-5.6 did not return a usable mission: {detail}")

    elapsed_ms = int((time.perf_counter() - started) * 1000)
    usage = response.usage
    logger.info(
        "openai_mission[%s] upstream_ok response_id=%s model=%s elapsed_ms=%d "
        "input_tokens=%s output_tokens=%s total_tokens=%s",
        trace,
        response.id,
        response.model,
        elapsed_ms,
        getattr(usage, "input_tokens", None),
        getattr(usage, "output_tokens", None),
        getattr(usage, "total_tokens", None),
    )
    metadata = CoachGenerationMetadata(
        provider="OpenAI",
        model=response.model or model,
        api="responses",
        reasoningEffort=reasoning_effort,
        feature="adaptive_mission_planner_v1",
    )
    return parsed, metadata
