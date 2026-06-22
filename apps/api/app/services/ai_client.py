"""OpenAI-compatible AI client.

DeepSeek and many other model providers expose OpenAI-compatible APIs but not all
of them support OpenAI's strict `client.beta.chat.completions.parse` helper. This
client uses chat completions JSON mode plus Pydantic validation so the same path
works across OpenAI-compatible providers.
"""

from dataclasses import dataclass
import json
import logging
import time
from typing import Optional, Type, TypeVar

from openai import OpenAI, OpenAIError
from pydantic import BaseModel, ValidationError

from app.config import settings

T = TypeVar("T", bound=BaseModel)

_client: Optional[OpenAI] = None
logger = logging.getLogger("uvicorn.error")


@dataclass(frozen=True)
class LLMProviderConfig:
    api_key: str
    base_url: str
    model: str
    fast_model: Optional[str] = None


def get_client(provider: Optional[LLMProviderConfig] = None) -> OpenAI:
    """Lazily construct the client so the module can be imported without secrets."""
    if provider is not None:
        return OpenAI(api_key=provider.api_key, base_url=provider.base_url)

    global _client
    if _client is None:
        _client = OpenAI(
            api_key=settings.default_llm_api_key,
            base_url=settings.default_llm_base_url,
        )
    return _client


def parse_with_model(
    messages: list,
    response_model: Type[T],
    max_tokens: int = 4000,
    model: Optional[str] = None,
    provider: Optional[LLMProviderConfig] = None,
    trace_id: Optional[str] = None,
) -> T:
    # Local testing: return canned results without calling an external model.
    if settings.use_fake_ai:
        from app.services.fake_ai import fake_for

        return fake_for(response_model)

    selected_model = model or (provider.model if provider else settings.default_llm_model)
    if not selected_model:
        raise ValueError("No LLM model configured.")

    schema = json.dumps(response_model.model_json_schema(), ensure_ascii=False)

    messages = list(messages)
    messages[0] = {
        "role": "system",
        "content": messages[0]["content"]
        + "\n\nReturn ONLY a valid json object that conforms to this JSON schema. "
        "Do not use markdown code fences and do not add any commentary.\n"
        "JSON schema:\n" + schema,
    }

    last_error: Optional[Exception] = None
    trace = trace_id or "-"
    logger.info(
        "llm[%s] start model=%s response_model=%s schema_bytes=%d max_tokens=%d",
        trace,
        selected_model,
        response_model.__name__,
        len(schema.encode("utf-8")),
        max_tokens,
    )

    for attempt in range(1, 3):  # one retry
        attempt_started = time.perf_counter()
        try:
            resp = get_client(provider).chat.completions.create(
                model=selected_model,
                messages=messages,
                response_format={"type": "json_object"},
                temperature=0.2,
                max_tokens=max_tokens,
                timeout=600,
            )
        except OpenAIError as e:
            elapsed_ms = int((time.perf_counter() - attempt_started) * 1000)
            status_code = getattr(e, "status_code", None)
            error_code = getattr(e, "code", None)
            logger.warning(
                "llm[%s] upstream_error attempt=%d model=%s elapsed_ms=%d error_type=%s status=%s code=%s message=%s",
                trace,
                attempt,
                selected_model,
                elapsed_ms,
                type(e).__name__,
                status_code,
                error_code,
                str(e),
            )
            raise ValueError(
                f"LLM request failed ({type(e).__name__}, status={status_code}, code={error_code}): {e}"
            ) from e

        upstream_ms = int((time.perf_counter() - attempt_started) * 1000)
        choice = resp.choices[0]
        content = choice.message.content or ""
        usage = getattr(resp, "usage", None)
        logger.info(
            "llm[%s] upstream_ok attempt=%d model=%s upstream_ms=%d output_chars=%d finish_reason=%s prompt_tokens=%s completion_tokens=%s total_tokens=%s",
            trace,
            attempt,
            selected_model,
            upstream_ms,
            len(content),
            choice.finish_reason,
            getattr(usage, "prompt_tokens", None),
            getattr(usage, "completion_tokens", None),
            getattr(usage, "total_tokens", None),
        )
        try:
            parsed = response_model.model_validate_json(content)
            logger.info(
                "llm[%s] validation_ok attempt=%d model=%s",
                trace,
                attempt,
                selected_model,
            )
            return parsed
        except ValidationError as e:
            last_error = e
            logger.warning(
                "llm[%s] validation_error attempt=%d model=%s finish_reason=%s error_count=%d output_chars=%d first_error=%s",
                trace,
                attempt,
                selected_model,
                choice.finish_reason,
                e.error_count(),
                len(content),
                e.errors()[0] if e.errors() else str(e),
            )
            if settings.llm_debug_log_content:
                logger.warning("llm[%s] invalid_output_preview=%r", trace, content[:1200])
            messages.append(
                {
                    "role": "user",
                    "content": f"Your previous json was invalid: {e}. "
                    "Return corrected valid json only.",
                }
            )

    raise ValueError(f"LLM provider did not return valid structured output after retry: {last_error}")
