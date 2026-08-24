"""Contract checks that ebook translation and annotation use separate models."""

from collections import Counter
from threading import Barrier, Event, Lock, Thread
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


def nonlinguistic_translation_contract() -> None:
    page = {
        "pageNumber": 52,
        "text": "A transferable insight matters.\n\n42",
    }
    rows = ebook_service._normalized_translation_units(
        page,
        "zh-CN",
        [
            EbookAIUnit(unitId="p52_u0", counterpartText="可迁移的见解很重要。"),
            EbookAIUnit(unitId="p52_u1", counterpartText="42"),
        ],
    )
    assert rows[1]["sourceText"] == "42"
    assert rows[1]["counterpartText"] == "42"

    try:
        ebook_service._normalized_translation_units(
            {"pageNumber": 1, "text": "Translate this sentence."},
            "zh-CN",
            [EbookAIUnit(unitId="p1_u0", counterpartText="Translate this sentence.")],
        )
        raise AssertionError("English prose must not pass through unchanged")
    except ebook_service.EbookProcessingError:
        pass


def translation_content_repair_contract() -> None:
    units = [{
        "unitId": "p27_u11",
        "sourceText": "• Burner: 350 F",
    }]
    invalid = EbookTranslationAIResult(
        units=[EbookAIUnit(unitId="p27_u11", counterpartText="• Burner：350 F")]
    )
    repaired = EbookTranslationAIResult(
        units=[EbookAIUnit(unitId="p27_u11", counterpartText="• 炉灶：350 F")]
    )
    repair_modes: list[bool] = []

    def translation_stub(
        chunk,
        comparison_language,
        provider,
        max_output_tokens,
        trace_id,
        repair_content=False,
    ):
        del chunk, comparison_language, provider, max_output_tokens, trace_id
        repair_modes.append(repair_content)
        return repaired if repair_content else invalid

    with (
        patch.object(ebook_service.settings, "use_fake_ai", False),
        patch.object(
            ebook_service,
            "_call_translation_model",
            side_effect=translation_stub,
        ),
    ):
        result = ebook_service._generate_translation_result(
            units,
            "zh-CN",
            None,
            4000,
            "repair-test",
        )

    assert result.units[0].counterpartText == "• 炉灶：350 F"
    assert repair_modes == [False, True]

    with (
        patch.object(ebook_service.settings, "use_fake_ai", False),
        patch.object(ebook_service, "_call_translation_model", return_value=invalid),
    ):
        try:
            ebook_service._generate_translation_result(
                units,
                "zh-CN",
                None,
                4000,
                "invalid-content-test",
            )
            raise AssertionError("Repeated content validation failures must fail the page")
        except ebook_service.EbookTranslationContentInvalid:
            pass


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
    page_one_annotation_attempts = 0

    def page_number_from_trace(trace_id: str) -> int:
        return int(trace_id.rsplit(":", 1)[-1])

    def translate_stub(units, language, provider, max_output_tokens, trace_id):
        del language, provider, max_output_tokens
        page_number = page_number_from_trace(trace_id)
        translation_calls.append(page_number)
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
    assert Counter(annotation_calls) == Counter({1: 2, 2: 1})
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


def parallel_annotation_contract() -> None:
    page_count = 4
    pack = {
        "id": "parallel-pack",
        "userId": "reader",
        "bookId": "parallel-book",
        "bookTitle": "Parallel Book",
        "startPage": 1,
        "endPage": page_count,
        "comparisonLanguage": "zh-CN",
        "comparisonMode": "translation",
        "modelTier": "fast",
        "status": "processing",
        "processingClaimId": "parallel-claim",
        "completedPageCount": 0,
        "failedPages": [],
    }
    source = "Careful readers distinguish a transferable insight from a memorable detail."
    pages = {
        number: {
            "id": f"parallel-page-{number}",
            "bookId": "parallel-book",
            "pageNumber": number,
            "text": source,
            "textHash": f"parallel-hash-{number}",
            "chapterTitle": None,
        }
        for number in range(1, page_count + 1)
    }
    analyses: dict[str, dict] = {}
    translation_calls: list[int] = []
    annotation_calls: list[int] = []
    annotation_barrier = Barrier(page_count)
    counter_lock = Lock()
    active_translations = 0
    max_active_translations = 0
    active_annotations = 0
    max_active_annotations = 0

    def page_number_from_trace(trace_id: str) -> int:
        return int(trace_id.rsplit(":", 1)[-1])

    def translate_stub(units, language, provider, max_output_tokens, trace_id):
        nonlocal active_translations, max_active_translations
        del language, provider, max_output_tokens
        page_number = page_number_from_trace(trace_id)
        with counter_lock:
            active_translations += 1
            max_active_translations = max(max_active_translations, active_translations)
        try:
            translation_calls.append(page_number)
            return EbookTranslationAIResult(
                units=[
                    EbookAIUnit(
                        unitId=unit["unitId"],
                        counterpartText=f"第{page_number}页的中文翻译。",
                    )
                    for unit in units
                ]
            )
        finally:
            with counter_lock:
                active_translations -= 1

    def annotate_stub(units, language, model_tier, provider, max_output_tokens, trace_id):
        nonlocal active_annotations, max_active_annotations
        del language, model_tier, provider, max_output_tokens
        page_number = page_number_from_trace(trace_id)
        with counter_lock:
            active_annotations += 1
            max_active_annotations = max(max_active_annotations, active_annotations)
        try:
            annotation_calls.append(page_number)
            annotation_barrier.wait(timeout=5)
            return EbookAnnotationsAIResult(
                annotations=[_annotation(units[0]["unitId"])]
            )
        finally:
            with counter_lock:
                active_annotations -= 1

    def save_analysis(row: dict) -> None:
        analyses[row["cacheId"]] = row.copy()

    def get_pack(user_id: str, pack_id: str):
        del user_id, pack_id
        return pack.copy()

    def save_pack(row: dict, claim_id: str | None) -> bool:
        del claim_id
        pack.update(row)
        return True

    with (
        patch.object(ebook_service, "get_ebook_study_pack", side_effect=get_pack),
        patch.object(ebook_service, "get_ebook", return_value={"id": "parallel-book"}),
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
            "parallel-pack",
            None,
            4000,
            "parallel-claim",
        )

    assert translation_calls == [1, 2, 3, 4]
    assert max_active_translations == 1
    assert sorted(annotation_calls) == [1, 2, 3, 4]
    assert max_active_annotations == page_count
    assert pack["status"] == "ready"
    assert pack["completedPageCount"] == page_count
    assert pack["failedPages"] == []


def cancellation_contract() -> None:
    source = "Careful readers distinguish a transferable insight from a memorable detail."
    page = {
        "id": "cancel-page-1",
        "bookId": "cancel-book",
        "pageNumber": 1,
        "text": source,
        "textHash": "cancel-hash-1",
        "chapterTitle": None,
    }
    units = ebook_service.sentence_units(source, 1)
    translation = EbookTranslationAIResult(
        units=[
            EbookAIUnit(unitId=unit["unitId"], counterpartText="认真阅读可区分可迁移的见解。")
            for unit in units
        ]
    )
    cache_id = ebook_service._analysis_cache_id("cancel-book", page, "zh-CN", "fast")
    analyses = {
        cache_id: ebook_service._translation_ready_analysis(
            "reader",
            "cancel-book",
            page,
            "zh-CN",
            "fast",
            translation,
        )
    }
    pack = {
        "id": "cancel-pack",
        "userId": "reader",
        "bookId": "cancel-book",
        "bookTitle": "Cancel Book",
        "startPage": 1,
        "endPage": 1,
        "comparisonLanguage": "zh-CN",
        "comparisonMode": "translation",
        "modelTier": "fast",
        "status": "processing",
        "processingClaimId": "cancel-claim",
        "completedPageCount": 0,
        "failedPages": [],
    }
    annotation_started = Event()
    progress_persisted = Event()
    release_annotation = Event()
    analysis_saved = Event()

    def annotate_stub(units, language, model_tier, provider, max_output_tokens, trace_id):
        del language, model_tier, provider, max_output_tokens, trace_id
        annotation_started.set()
        assert release_annotation.wait(timeout=10)
        return EbookAnnotationsAIResult(
            annotations=[_annotation(units[0]["unitId"])]
        )

    def get_pack(user_id: str, pack_id: str):
        del user_id, pack_id
        return pack.copy()

    def save_pack(row: dict, claim_id: str | None) -> bool:
        if pack.get("status") != "processing" or pack.get("processingClaimId") != claim_id:
            return False
        pack.update(row)
        progress_persisted.set()
        return True

    def save_analysis(row: dict) -> None:
        analyses[row["cacheId"]] = row.copy()
        if row.get("status") == "ready":
            analysis_saved.set()

    with (
        patch.object(ebook_service, "get_ebook_study_pack", side_effect=get_pack),
        patch.object(ebook_service, "get_ebook", return_value={"id": "cancel-book"}),
        patch.object(ebook_service, "get_ebook_page", return_value=page),
        patch.object(
            ebook_service,
            "get_ebook_analysis_page",
            side_effect=lambda user_id, requested_cache_id: analyses.get(requested_cache_id),
        ),
        patch.object(ebook_service, "save_ebook_analysis_page", side_effect=save_analysis),
        patch.object(ebook_service, "save_ebook_annotation"),
        patch.object(
            ebook_service,
            "save_ebook_study_pack_if_processing",
            side_effect=save_pack,
        ),
        patch.object(ebook_service, "_generate_annotation_result", side_effect=annotate_stub),
    ):
        worker = Thread(
            target=ebook_service.process_study_pack,
            args=("reader", "cancel-pack", None, 4000, "cancel-claim"),
        )
        worker.start()
        assert annotation_started.wait(timeout=3)
        assert progress_persisted.wait(timeout=3)
        pack.update({"status": "cancelled", "processingClaimId": None})
        worker.join(timeout=4)
        assert not worker.is_alive(), "cancelled pack remained blocked on an external request"
        release_annotation.set()
        assert analysis_saved.wait(timeout=3)

    assert pack["status"] == "cancelled"
    assert analyses[cache_id]["status"] == "ready"


def main() -> None:
    split_call_contract()
    nonlinguistic_translation_contract()
    translation_content_repair_contract()
    parallel_annotation_contract()
    cancellation_contract()
    pipeline_and_circuit_contract()
    print(
        "Qwen translation is serial and durable; Luna annotations fan out across all "
        "pages and retry independently; cancellation releases the pack without "
        "discarding completed work; translation failures open the circuit."
    )


if __name__ == "__main__":
    main()
