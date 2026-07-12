"""Server-managed text model catalog.

The browser may independently select deep and fast opaque IDs, but it never
receives an API key or provider base URL. Each entry resolves to an exact model
and provider on the server. The legacy single-ID path remains available for
older clients.
"""

from dataclasses import dataclass
from typing import Literal, Optional

from app.config import Settings, settings
from app.services.ai_client import LLMProviderConfig


@dataclass(frozen=True)
class ServerModelOption:
    id: str
    label: str
    provider_label: str
    model: str
    mode: Literal["deep", "fast"]
    config: LLMProviderConfig

    def public_dict(self) -> dict:
        return {
            "id": self.id,
            "label": self.label,
            "provider": self.provider_label,
            "model": self.model,
            "mode": self.mode,
        }


def _normalized(value: str) -> str:
    return value.strip()


def _add_option(
    options: list[ServerModelOption],
    *,
    option_id: str,
    label: str,
    provider_label: str,
    api_key: str,
    base_url: str,
    model: str,
    mode: Literal["deep", "fast"],
) -> None:
    api_key = _normalized(api_key)
    base_url = _normalized(base_url).rstrip("/")
    model = _normalized(model)
    if not api_key or not base_url or not model:
        return
    options.append(
        ServerModelOption(
            id=option_id,
            label=label,
            provider_label=provider_label,
            model=model,
            mode=mode,
            config=LLMProviderConfig(
                api_key=api_key,
                base_url=base_url,
                model=model,
                # An explicit user choice should not silently switch to a
                # provider's fast model for a different request type.
                fast_model=model,
                server_model_id=option_id,
            ),
        )
    )


def configured_server_models(config: Settings = settings) -> list[ServerModelOption]:
    """Return all selectable server-side text models without exposing secrets."""
    options: list[ServerModelOption] = []

    _add_option(
        options,
        option_id="deepseek-deep",
        label="DeepSeek · Deep",
        provider_label="DeepSeek",
        api_key=config.deepseek_api_key,
        base_url=config.deepseek_base_url,
        model=config.llm_model,
        mode="deep",
    )
    _add_option(
        options,
        option_id="deepseek-fast",
        label="DeepSeek · Fast",
        provider_label="DeepSeek",
        api_key=config.deepseek_api_key,
        base_url=config.deepseek_base_url,
        model=config.llm_model_fast,
        mode="fast",
    )
    _add_option(
        options,
        option_id="qwen-deep",
        label="Qwen 3.7 Max",
        provider_label="Qwen Model Studio",
        api_key=config.qwen_model_studio_api_key,
        base_url=config.qwen_model_studio_base_url,
        model=config.qwen_model_studio_model,
        mode="deep",
    )
    _add_option(
        options,
        option_id="qwen-fast",
        label="Qwen 3.7 Plus",
        provider_label="Qwen Model Studio",
        api_key=config.qwen_model_studio_api_key,
        base_url=config.qwen_model_studio_base_url,
        model=config.qwen_model_studio_fast_model,
        mode="fast",
    )
    _add_option(
        options,
        option_id="openai-compatible-deep",
        label="Configured model · Deep",
        provider_label="OpenAI-compatible",
        api_key=config.openai_compat_api_key,
        base_url=config.openai_compat_base_url,
        model=config.openai_compat_model,
        mode="deep",
    )
    _add_option(
        options,
        option_id="openai-compatible-fast",
        label="Configured model · Fast",
        provider_label="OpenAI-compatible",
        api_key=config.openai_compat_api_key,
        base_url=config.openai_compat_base_url,
        model=config.openai_compat_fast_model,
        mode="fast",
    )

    # Deduplicate repeated configuration within a mode while retaining the
    # same model in both modes when a provider intentionally reuses it.
    deduped: list[ServerModelOption] = []
    seen: set[tuple[str, str, str]] = set()
    for option in options:
        key = (option.provider_label, option.model, option.mode)
        if key in seen:
            continue
        seen.add(key)
        deduped.append(option)
    return deduped


def catalog_payload(config: Settings = settings) -> dict:
    """Public catalog payload used by the web client.

    ``default`` is an adaptive choice: fast requests use the configured fast
    model and deep requests use the configured deep model. Explicit entries use
    one exact model for every text request.
    """
    default_model = _normalized(config.default_llm_model)
    default_fast_model = _normalized(config.default_llm_fast_model) or default_model
    return {
        "models": [
            {
                "id": "default",
                "label": "Server default",
                "provider": "Server",
                "model": default_model,
                "fastModel": default_fast_model,
                "adaptive": True,
            },
            *[option.public_dict() for option in configured_server_models(config)],
        ]
    }


def server_model_by_id(model_id: str, config: Settings = settings) -> Optional[ServerModelOption]:
    normalized_id = model_id.strip()
    if not normalized_id or normalized_id == "default":
        return None
    return next((option for option in configured_server_models(config) if option.id == normalized_id), None)


def server_model_pair(
    deep_model_id: str,
    fast_model_id: str,
    config: Settings = settings,
) -> Optional[LLMProviderConfig]:
    """Resolve independently selected deep/fast IDs into one safe provider config."""
    deep = server_model_by_id(deep_model_id, config)
    fast = server_model_by_id(fast_model_id, config)
    if deep is None or fast is None or deep.mode != "deep" or fast.mode != "fast":
        return None
    return LLMProviderConfig(
        api_key=deep.config.api_key,
        base_url=deep.config.base_url,
        model=deep.model,
        fast_model=fast.model,
        fast_api_key=fast.config.api_key,
        fast_base_url=fast.config.base_url,
        server_deep_model_id=deep.id,
        server_fast_model_id=fast.id,
    )


def server_model_for_name(model: str, config: Settings = settings) -> Optional[ServerModelOption]:
    """Resolve a legacy stored chat model name to its configured provider."""
    normalized_model = model.strip()
    if not normalized_model:
        return None
    return next(
        (option for option in configured_server_models(config) if option.model == normalized_model),
        None,
    )
