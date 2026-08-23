"""Contract checks that ebook translation and annotation use separate models."""

from unittest.mock import patch

from app.models.ebook import (
    EbookAIAnnotation,
    EbookAIUnit,
    EbookAnnotationsAIResult,
    EbookOnDemandAnnotationAIResult,
    EbookTranslationAIResult,
)
from app.services.ai_client import LLMProviderConfig
from app.services import ebook_service


def _annotation() -> EbookAIAnnotation:
    return EbookAIAnnotation(
        unitId="p1_u0",
        selectedText="transferable insight",
        kind="phrase",
        title="transferable insight",
        meaningInContext="A useful idea that applies elsewhere.",
        usage="Use it for knowledge that remains useful in a new context.",
        transferPrompt="Describe one transferable insight from your work.",
        skillCode="vocab.word_choice",
    )


def main() -> None:
    qwen = LLMProviderConfig(
        api_key="ollama",
        base_url="https://private-model.example/v1",
        model="qwen3.5:9b",
        fast_model="qwen3.5:9b",
        reasoning_effort_override="none",
        fast_reasoning_effort_override="none",
        server_model_id="local-qwen-fast",
    )
    selected_pair = LLMProviderConfig(
        api_key="deep-key",
        base_url="https://openrouter.ai/api/v1",
        model="openai/gpt-5.6-luna-pro",
        fast_model="qwen3.5:9b",
        fast_api_key="ollama",
        fast_base_url="https://private-model.example/v1",
        server_deep_model_id="openrouter-deep",
        server_fast_model_id="local-qwen-fast",
    )
    calls: list[dict] = []

    def parse_stub(**kwargs):
        calls.append(kwargs)
        if kwargs["response_model"] is EbookTranslationAIResult:
            return EbookTranslationAIResult(
                units=[EbookAIUnit(unitId="p1_u0", counterpartText="可迁移的见解很重要。")]
            )
        if kwargs["response_model"] is EbookAnnotationsAIResult:
            return EbookAnnotationsAIResult(annotations=[_annotation()])
        if kwargs["response_model"] is EbookOnDemandAnnotationAIResult:
            return EbookOnDemandAnnotationAIResult(annotation=_annotation())
        raise AssertionError(f"Unexpected response model: {kwargs['response_model']}")

    units = [{"unitId": "p1_u0", "sourceText": "A transferable insight matters."}]
    with (
        patch.object(ebook_service.settings, "use_fake_ai", False),
        patch.object(ebook_service, "local_qwen_translation_provider", return_value=qwen),
        patch.object(ebook_service, "ebook_annotation_provider", return_value=selected_pair),
        patch.object(ebook_service, "parse_with_model", side_effect=parse_stub),
    ):
        result = ebook_service._generate_page_result(
            units,
            "zh-CN",
            "fast",
            selected_pair,
            4000,
            "split-test",
        )
        ebook_service._call_on_demand_model(
            units[0],
            "transferable insight",
            "zh-CN",
            "fast",
            selected_pair,
            4000,
            "on-demand-test",
        )

    assert result.units[0].counterpartText == "可迁移的见解很重要。"
    assert len(result.annotations) == 1
    assert [call["model"] for call in calls] == [
        "qwen3.5:9b",
        "openai/gpt-5.6-luna-pro",
        "openai/gpt-5.6-luna-pro",
    ]
    assert calls[0]["provider"] is qwen
    assert calls[1]["provider"] is selected_pair
    assert calls[2]["provider"] is selected_pair
    assert "Do not select, explain, rank, or annotate" in calls[0]["messages"][0]["content"]
    assert "Analyze only the English source" in calls[1]["messages"][0]["content"]
    assert ":translation:" in calls[0]["trace_id"]
    assert ":annotations:" in calls[1]["trace_id"]
    print("Ebook translation uses Qwen; automatic and on-demand annotations use Deep.")


if __name__ == "__main__":
    main()
