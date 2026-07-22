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
HIGH_REASONING_EFFORT = "high"


@dataclass(frozen=True)
class LLMProviderConfig:
    api_key: str
    base_url: str
    model: str
    fast_model: Optional[str] = None
    # A server-managed fast slot may use a different provider from the deep
    # slot (for example Qwen Max + DeepSeek Flash). Keep its credentials on the
    # server and select them only when the fast model is requested.
    fast_api_key: Optional[str] = None
    fast_base_url: Optional[str] = None
    # Server-managed choices are resolved from a small allowlist and never send
    # their credentials to the browser. BYOK remains request-scoped and is
    # intentionally distinguished so quotas cannot be relaxed merely because a
    # caller supplied arbitrary headers.
    server_model_id: Optional[str] = None
    server_deep_model_id: Optional[str] = None
    server_fast_model_id: Optional[str] = None
    is_byok: bool = False


def _provider_connection(
    provider: LLMProviderConfig,
    selected_model: str,
) -> tuple[str, str]:
    if (
        provider.fast_model
        and selected_model == provider.fast_model
        and provider.fast_api_key
        and provider.fast_base_url
    ):
        return provider.fast_api_key, provider.fast_base_url
    return provider.api_key, provider.base_url


def get_client(
    provider: Optional[LLMProviderConfig] = None,
    model: Optional[str] = None,
) -> OpenAI:
    """Lazily construct the client so the module can be imported without secrets."""
    if provider is not None:
        api_key, base_url = _provider_connection(provider, model or provider.model)
        return OpenAI(api_key=api_key, base_url=base_url)

    global _client
    if _client is None:
        _client = OpenAI(
            api_key=settings.default_llm_api_key,
            base_url=settings.default_llm_base_url,
        )
    return _client


def _is_unsupported_reasoning_effort(error: OpenAIError) -> bool:
    text = str(error).lower()
    code = str(getattr(error, "code", "") or "").lower()
    return (
        "reasoning_effort" in text
        or "reasoning effort" in text
        or ("unsupported" in text and "reasoning" in text)
        or code in {"unsupported_parameter", "unknown_parameter", "invalid_parameter"}
    )


def _uses_model_studio_qwen(model: str, base_url: str) -> bool:
    normalized_model = model.strip().lower()
    normalized_base_url = base_url.strip().lower()
    return normalized_model.startswith("qwen") and (
        "dashscope" in normalized_base_url or "maas.aliyuncs.com" in normalized_base_url
    )


def parse_with_model(
    messages: list,
    response_model: Type[T],
    max_tokens: Optional[int] = None,
    model: Optional[str] = None,
    provider: Optional[LLMProviderConfig] = None,
    trace_id: Optional[str] = None,
    reasoning_effort: Optional[str] = HIGH_REASONING_EFFORT,
) -> T:
    # Local testing: return canned results without calling an external model.
    if settings.use_fake_ai:
        from app.services.fake_ai import fake_for

        return fake_for(response_model)

    selected_model = model or (provider.model if provider else settings.default_llm_model)
    if not selected_model:
        raise ValueError("No LLM model configured.")
    if provider:
        _, base_url = _provider_connection(provider, selected_model)
    else:
        base_url = settings.default_llm_base_url
    uses_model_studio_qwen = _uses_model_studio_qwen(selected_model, base_url)

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
        "llm[%s] start model=%s response_model=%s schema_bytes=%d max_tokens=%s reasoning_effort=%s qwen_json_mode=%s",
        trace,
        selected_model,
        response_model.__name__,
        len(schema.encode("utf-8")),
        max_tokens if max_tokens is not None else "unlimited",
        reasoning_effort or "disabled",
        uses_model_studio_qwen,
    )

    use_reasoning_effort = bool(reasoning_effort) and not uses_model_studio_qwen
    for attempt in range(1, 3):  # one retry
        attempt_started = time.perf_counter()
        try:
            create_kwargs: dict = dict(
                model=selected_model,
                messages=messages,
                response_format={"type": "json_object"},
                temperature=0.2,
                timeout=600,
            )
            if max_tokens is not None:
                create_kwargs["max_tokens"] = max_tokens
            if uses_model_studio_qwen:
                create_kwargs["extra_body"] = {"enable_thinking": False}
            while True:
                if use_reasoning_effort:
                    create_kwargs["reasoning_effort"] = reasoning_effort
                else:
                    create_kwargs.pop("reasoning_effort", None)
                try:
                    resp = get_client(provider, selected_model).chat.completions.create(**create_kwargs)
                    break
                except OpenAIError as e:
                    if use_reasoning_effort and _is_unsupported_reasoning_effort(e):
                        use_reasoning_effort = False
                        logger.info(
                            "llm[%s] reasoning_effort_unsupported model=%s fallback=omit_param",
                            trace,
                            selected_model,
                        )
                        continue
                    raise
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
