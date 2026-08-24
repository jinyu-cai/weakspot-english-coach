"""Contract checks that ebook translation and annotation use separate models."""

from threading import Event
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


def _annotation(unit_id: str = "p1_u0") -> EbookAIAnnotation:
    return EbookAIAnnotation(
        unitId=unit_id,
        selectedText="transferable insight",
        kind="phrase",
        title="transferable insight",
        meaningInContext="A useful idea that applies elsewhere.",
        usage="Use it for knowledge that remains useful in a new context.",
        transferPrompt="Describe one transferable insight from your work.",
        skillCode="vocab.word_choice",
    )


def split_call_contract() -> None:
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
    annotation_attempts = 0

    def parse_stub(**kwargs):
        nonlocal annotation_attempts
        calls.append(kwargs)
        if kwargs["response_model"] is EbookTranslationAIResult:
            return EbookTranslationAIResult(
                units=[EbookAIUnit(unitId="p1_u0", counterpartText="可迁移的见解很重要。")]
            )
        if kwargs["response_model"] is EbookAnnotationsAIResult:
            annotation_attempts += 1
            if annotation_attempts == 1:
                raise ValueError("temporary annotation failure")
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
        "openai/gpt-5.6-luna-pro",
    ]
    assert calls[0]["provider"] is qwen
    assert calls[1]["provider"] is selected_pair
    assert calls[2]["provider"] is selected_pair
    assert calls[3]["provider"] is selected_pair
    assert "Do not select, explain, rank, or annotate" in calls[0]["messages"][0]["content"]
    assert "Analyze only the English source" in calls[1]["messages"][0]["content"]
    assert ":translation:" in calls[0]["trace_id"]
    assert ":annotations:" in calls[1]["trace_id"]
    assert ":annotations:" in calls[2]["trace_id"]


def pipeline_and_circuit_contract() -> None:
    pack = {
        "id": "pipeline-pack",
        "userId": "reader",
        "bookId": "book",
        "bookTitle": "Book",
        "startPage": 1,
        "endPage": 4,
        "comparisonLanguage": "zh-CN",
        "comparisonMode": "translation",
        "modelTier": "fast",
        "status": "processing",
        "processingClaimId": "claim",
        "completedPageCount": 0,
        "failedPages": [],
    }
    source = "Careful readers distinguish a transferable insight from a memorable detail."
    pages = {
        number: {
            "id": f"page-{number}",
            "bookId": "book",
            "pageNumber": number,
            "text": source,
            "textHash": f"hash-{number}",
            "chapterTitle": None,
        }
        for number in range(1, 5)
    }
    analyses: dict[str, dict] = {}
    saved_statuses: list[tuple[int, str]] = []
    translation_calls: list[int] = []
    annotation_calls: list[int] = []
    page_two_translation_started = Event()
    page_one_annotation_attempts = 0

    def page_number_from_trace(trace_id: str) -> int:
        return int(trace_id.rsplit(":", 1)[-1])

    def translate_stub(units, language, provider, max_output_tokens, trace_id):
        del language, provider, max_output_tokens
        page_number = page_number_from_trace(trace_id)
        translation_calls.append(page_number)
        if page_number == 2:
            page_two_translation_started.set()
        if page_number == 3:
            raise ebook_service.EbookTranslationUnavailable("two failed requests")
        return EbookTranslationAIResult(
            units=[
                EbookAIUnit(
                    unitId=unit["unitId"],
                    counterpartText=f"第{page_number}页的中文翻译。",
                )
                for unit in units
            ]
        )

    def annotate_stub(units, language, model_tier, provider, max_output_tokens, trace_id):
        nonlocal page_one_annotation_attempts
        del language, model_tier, provider, max_output_tokens
        page_number = page_number_from_trace(trace_id)
        annotation_calls.append(page_number)
        if page_number == 1:
            assert page_two_translation_started.wait(2), (
                "page 2 translation did not overlap page 1 annotation"
            )
            page_one_annotation_attempts += 1
            if page_one_annotation_attempts == 1:
                raise ValueError("temporary annotation failure")
        return EbookAnnotationsAIResult(
            annotations=[_annotation(units[0]["unitId"])]
        )

    def save_analysis(row: dict) -> None:
        analyses[row["cacheId"]] = row.copy()
        saved_statuses.append((int(row["pageNumber"]), str(row["status"])))

    def get_pack(user_id: str, pack_id: str):
        del user_id, pack_id
        return pack.copy()

    def save_pack(row: dict, claim_id: str | None) -> bool:
        del claim_id
        pack.update(row)
        return True

    with (
        patch.object(ebook_service, "get_ebook_study_pack", side_effect=get_pack),
        patch.object(ebook_service, "get_ebook", return_value={"id": "book"}),
        patch.object(
            ebook_service,
            "get_ebook_page",
            side_effect=lambda user_id, book_id, number: pages.get(number),
        ),
        patch.object(
            ebook_service,
            "get_ebook_analysis_page",
            side_effect=lambda user_id, cache_id: analyses.get(cache_id),
        ),
        patch.object(ebook_service, "save_ebook_analysis_page", side_effect=save_analysis),
        patch.object(ebook_service, "save_ebook_annotation"),
        patch.object(
            ebook_service,
            "save_ebook_study_pack_if_processing",
            side_effect=save_pack,
        ),
        patch.object(ebook_service, "update_ebook_last_studied_if_current"),
        patch.object(ebook_service, "_generate_translation_result", side_effect=translate_stub),
        patch.object(ebook_service, "_generate_annotation_result", side_effect=annotate_stub),
    ):
        ebook_service.process_study_pack(
            "reader",
            "pipeline-pack",
            None,
            4000,
            "claim",
        )

        first_page_cache_id = ebook_service._analysis_cache_id(
            "book",
            pages[1],
            "zh-CN",
            "fast",
        )
        assert analyses[first_page_cache_id]["status"] == (
            ebook_service.TRANSLATION_READY_STATUS
        )
        pack.update({
            "status": "processing",
            "processingClaimId": "claim-2",
            "completedPageCount": 0,
            "failedPages": [],
            "error": None,
        })
        ebook_service.process_study_pack(
            "reader",
            "pipeline-pack",
            None,
            4000,
            "claim-2",
        )

    assert translation_calls == [1, 2, 3, 3]
    assert translation_calls.count(1) == 1
    assert annotation_calls == [1, 2, 1]
    assert (1, ebook_service.TRANSLATION_READY_STATUS) in saved_statuses
    assert (2, ebook_service.TRANSLATION_READY_STATUS) in saved_statuses
    assert saved_statuses.index(
        (1, ebook_service.TRANSLATION_READY_STATUS)
    ) < saved_statuses.index((1, "ready"))
    assert saved_statuses.index(
        (2, ebook_service.TRANSLATION_READY_STATUS)
    ) < saved_statuses.index((2, "ready"))
    assert pack["status"] == "failed"
    assert pack["completedPageCount"] == 2
    assert pack["failedPages"] == [3, 4]
    assert "remaining pages were not attempted" in pack["error"]


def main() -> None:
    split_call_contract()
    pipeline_and_circuit_contract()
    print(
        "Ebook translation is durable and pipelined; annotations retry independently; "
        "translation failures open the circuit."
    )


if __name__ == "__main__":
    main()
