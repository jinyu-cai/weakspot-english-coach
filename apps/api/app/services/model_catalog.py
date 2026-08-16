"""Server-managed text model catalog.

The browser may independently select deep and fast opaque IDs, but it never
receives an API key or provider base URL. Each entry resolves to an exact model
and provider on the server. The legacy single-ID path remains available for
older clients.
"""

from dataclasses import dataclass, replace
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
        option_id="openrouter-deep",
        label="GPT-5.6 Luna Pro",
        provider_label="OpenRouter",
        api_key=config.openrouter_api_key,
        base_url=config.openrouter_base_url,
        model=config.openrouter_model,
        mode="deep",
    )
    _add_option(
        options,
        option_id="openrouter-fast",
        label="GPT-5.6 Luna",
        provider_label="OpenRouter",
        api_key=config.openrouter_api_key,
        base_url=config.openrouter_base_url,
        model=config.openrouter_fast_model,
        mode="fast",
    )
    if config.uses_opencode_go:
        _add_option(
            options,
            option_id="deepseek-deep",
            label="DeepSeek V4 Pro",
            provider_label="OpenCode Go",
            api_key=config.opencode_go_api_key,
            base_url=config.opencode_go_base_url,
            model=config.opencode_go_deepseek_model,
            mode="deep",
        )
        _add_option(
            options,
            option_id="deepseek-fast",
            label="DeepSeek V4 Flash",
            provider_label="OpenCode Go",
            api_key=config.opencode_go_api_key,
            base_url=config.opencode_go_base_url,
            model=config.opencode_go_deepseek_fast_model,
            mode="fast",
        )
    else:
        # Preserve old single-provider deployments until an OpenCode Go key is
        # configured. The stable DeepSeek catalog IDs then resolve through Go.
        _add_option(
            options,
            option_id="deepseek-deep",
            label="DeepSeek · Deep",
            provider_label="DeepSeek Official (legacy)",
            api_key=config.deepseek_api_key,
            base_url=config.deepseek_base_url,
            model=config.llm_model,
            mode="deep",
        )
        _add_option(
            options,
            option_id="deepseek-fast",
            label="DS V4 Flash 0731",
            provider_label="DeepSeek Official (legacy)",
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


def openrouter_text_provider(config: Settings = settings) -> Optional[LLMProviderConfig]:
    """Return the selectable OpenRouter Luna Pro/Luna pair when configured."""
    if not config.uses_openrouter:
        return None
    return LLMProviderConfig(
        api_key=_normalized(config.openrouter_api_key),
        base_url=_normalized(config.openrouter_base_url).rstrip("/"),
        model=_normalized(config.openrouter_model),
        fast_model=_normalized(config.openrouter_fast_model),
        server_deep_model_id="openrouter-deep",
        server_fast_model_id="openrouter-fast",
    )


def catalog_payload(config: Settings = settings) -> dict:
    """Public catalog payload used by the web client.

    ``default`` is an adaptive choice: fast requests use the configured fast
    model and deep requests use the configured deep model. Explicit entries use
    one exact model for every text request.
    """
    default_provider = default_text_provider(config)
    default_model = _normalized(
        default_provider.model if default_provider else config.default_llm_model
    )
    default_fast_model = _normalized(
        default_provider.fast_model if default_provider and default_provider.fast_model
        else config.default_llm_fast_model
    ) or default_model
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


def default_server_model_ids(config: Settings = settings) -> tuple[str, str] | None:
    """Return the preferred Deep/Fast IDs for this deployment's configured keys."""
    available_ids = {option.id for option in configured_server_models(config)}

    deep_priority: list[str] = []
    fast_priority: list[str] = []
    if config.uses_openrouter:
        deep_priority.append("openrouter-deep")
    if config.uses_opencode_go:
        deep_priority.append("deepseek-deep")
        fast_priority.append("deepseek-fast")
    if config.uses_openrouter:
        fast_priority.append("openrouter-fast")
    if config.uses_qwen_model_studio:
        deep_priority.append("qwen-deep")
        fast_priority.append("qwen-fast")
    if config.openai_compat_api_key.strip():
        deep_priority.append("openai-compatible-deep")
        fast_priority.append("openai-compatible-fast")
    if config.uses_deepseek and not config.uses_opencode_go:
        deep_priority.append("deepseek-deep")
        fast_priority.append("deepseek-fast")

    deep_id = next(
        (model_id for model_id in deep_priority if model_id in available_ids),
        None,
    )
    fast_id = next(
        (model_id for model_id in fast_priority if model_id in available_ids),
        None,
    )
    return (deep_id, fast_id) if deep_id and fast_id else None


def default_text_provider(config: Settings = settings) -> Optional[LLMProviderConfig]:
    """Resolve the deployment default, including a cross-provider Fast slot."""
    model_ids = default_server_model_ids(config)
    if model_ids is None:
        return None
    provider = server_model_pair(*model_ids, config=config)
    return replace(provider, is_default=True) if provider is not None else None


def server_model_for_name(model: str, config: Settings = settings) -> Optional[ServerModelOption]:
    """Resolve a legacy stored chat model name to its configured provider."""
    normalized_model = model.strip()
    if not normalized_model:
        return None
    return next(
        (option for option in configured_server_models(config) if option.model == normalized_model),
        None,
    )
