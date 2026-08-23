"""Offline contract checks for the private Ollama Qwen Fast model."""

from types import SimpleNamespace
from unittest.mock import patch

from pydantic import BaseModel

from app.config import Settings
from app.services import ai_client
from app.services.model_catalog import (
    catalog_payload,
    default_server_model_ids,
    default_text_provider,
    ebook_annotation_provider,
    local_qwen_translation_provider,
)


class TranslationResult(BaseModel):
    translation: str


def main() -> None:
    config = Settings(
        openrouter_api_key="deep-key",
        opencode_go_api_key="fallback-fast-key",
        qwen_model_studio_api_key="",
        deepseek_api_key="",
        openai_compat_api_key="",
        local_qwen_api_key="ollama",
        local_qwen_base_url="https://private-model.example/v1",
        local_qwen_model="qwen3.5:9b",
    )
    assert config.uses_local_qwen is True
    assert config.default_llm_fast_model == "qwen3.5:9b"
    assert config.default_llm_fast_api_key == "ollama"
    assert config.default_llm_fast_base_url == "https://private-model.example/v1"
    assert default_server_model_ids(config) == ("openrouter-deep", "local-qwen-fast")

    payload = catalog_payload(config)
    models = {item["id"]: item for item in payload["models"]}
    assert models["default"]["fastModel"] == "qwen3.5:9b"
    assert models["local-qwen-fast"] == {
        "id": "local-qwen-fast",
        "label": "Qwen 3.5 9B · Ebook translation only",
        "provider": "Private Ollama",
        "model": "qwen3.5:9b",
        "mode": "fast",
    }
    assert all("apiKey" not in item and "baseUrl" not in item for item in payload["models"])

    provider = default_text_provider(config)
    assert provider is not None
    assert provider.fast_model == "qwen3.5:9b"
    assert provider.fast_api_key == "ollama"
    assert provider.fast_base_url == "https://private-model.example/v1"
    assert provider.fast_reasoning_effort_override == "none"

    translation_provider = local_qwen_translation_provider(config)
    assert translation_provider is not None
    assert translation_provider.model == "qwen3.5:9b"
    annotation_provider = ebook_annotation_provider(translation_provider, config)
    assert annotation_provider is not None
    assert annotation_provider.model == config.openrouter_model

    request: dict = {}

    def create_completion(**kwargs):
        request.update(kwargs)
        return SimpleNamespace(
            choices=[SimpleNamespace(
                message=SimpleNamespace(content='{"translation":"你好，世界"}'),
                finish_reason="stop",
            )],
            usage=None,
        )

    client = SimpleNamespace(
        chat=SimpleNamespace(completions=SimpleNamespace(create=create_completion))
    )
    with (
        patch.object(ai_client.settings, "use_fake_ai", False),
        patch.object(ai_client, "get_client", return_value=client),
    ):
        result = ai_client.parse_with_model(
            messages=[
                {"role": "system", "content": "Return JSON."},
                {"role": "user", "content": "Translate hello world."},
            ],
            response_model=TranslationResult,
            provider=provider,
            model=provider.fast_model,
            reasoning_effort="medium",
        )

    assert result.translation == "你好，世界"
    assert request["model"] == "qwen3.5:9b"
    assert request["reasoning_effort"] == "none"
    assert request["response_format"] == {"type": "json_object"}
    print("Private Qwen Fast model catalog, routing, and reasoning override OK.")


if __name__ == "__main__":
    main()
