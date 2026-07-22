"""Offline smoke test — NO network calls (no DeepSeek, no AWS).

Verifies the whole backend imports, every AI response model produces a valid
JSON schema, a realistic diagnostic payload validates, and the mastery +
Decimal round-trip works.

Run from the apps/api directory:

    python -m scripts.smoke_test
"""

import json
from decimal import Decimal

from pydantic import ValidationError


def main() -> None:
    # 1. Import the FastAPI app (exercises config, routes, services, db, models)
    #    and build the OpenAPI schema (exercises every route + request model).
    from app.main import app
    from app.api.routes.health import health_check

    paths = sorted(app.openapi().get("paths", {}).keys())
    print("Imported app OK. API routes:")
    for p in paths:
        print("   ", p)
    health_payload = health_check()
    assert health_payload["status"] == "ok"
    assert health_payload["capabilities"]["openaiBuildWeek"]["model"].startswith("gpt-5.6")
    assert health_payload["capabilities"]["openaiBuildWeek"]["api"] == "responses"

    # 2. JSON schema generation for every AI response model.
    from app.models.chat_import import ChatImportAIResult
    from app.models.coach import (
        GPT56CoachMissionAIResult,
        GPT56DecisionResponseMissionAIResult,
        GPT56GuidedSceneMissionAIResult,
        GPT56ListenRetellMissionAIResult,
        GPT56PictureStoryMissionAIResult,
        GPT56VocabularyInActionMissionAIResult,
    )
    from app.models.diagnostic import DiagnoseRequest, DiagnosticAIResult
    from app.models.plan import LearningPlanAIResult
    from app.models.practice import (
        PRACTICE_QUESTION_MAX_CHARS,
        PracticeExerciseAIResult,
        PracticeGradeAIResult,
    )

    for model in (
        DiagnosticAIResult,
        ChatImportAIResult,
        LearningPlanAIResult,
        PracticeExerciseAIResult,
        PracticeGradeAIResult,
        GPT56CoachMissionAIResult,
        GPT56GuidedSceneMissionAIResult,
        GPT56PictureStoryMissionAIResult,
        GPT56ListenRetellMissionAIResult,
        GPT56DecisionResponseMissionAIResult,
        GPT56VocabularyInActionMissionAIResult,
    ):
        schema = model.model_json_schema()
        assert "properties" in schema, model.__name__
        print(f"Schema OK: {model.__name__} ({len(json.dumps(schema))} bytes)")

    try:
        PracticeExerciseAIResult(
            type="fix_sentence",
            targetSkillCode="grammar.verb_tense",
            promptZh="Correct the sentence.",
            question="x" * (PRACTICE_QUESTION_MAX_CHARS + 1),
            answer="Yesterday I went to class.",
            explanationZh="Use the past tense after yesterday.",
        )
        raise AssertionError("Oversized practice question was accepted.")
    except ValidationError:
        pass
    print("Practice generation output-size validation OK.")

    # 3. Validate a realistic diagnostic payload (what DeepSeek should return).
    sample = {
        "cefrEstimate": "B1",
        "overallScore": 72,
        "summaryZh": "整体不错，但动词时态和用词需要加强。",
        "strengthsZh": ["表达积极", "句子基本通顺"],
        "weaknessesZh": ["动词时态错误", "词汇重复"],
        "correctedText": "Yesterday I went to my university and met my friend.",
        "errors": [
            {
                "code": "grammar.verb_tense",
                "category": "Verb tense",
                "severity": "high",
                "originalText": "Yesterday I go to my university",
                "correctedText": "Yesterday I went to my university",
                "explanationZh": "过去的事情要用一般过去时，go 应改为 went。",
                "microLessonZh": "一般过去时：规则动词加 -ed，不规则动词用过去式。",
                "practiceGoal": "用一般过去时改写 5 个句子。",
            }
        ],
        "skillUpdates": [
            {
                "skillCode": "grammar.verb_tense",
                "label": "Verb tense",
                "zhLabel": "动词时态",
                "masteryDelta": -12,
                "evidenceZh": "go 应为 went",
            }
        ],
        "recommendedNextActionsZh": ["完成 3 道一般过去时练习"],
    }
    result = DiagnosticAIResult.model_validate(sample)
    assert result.errors[0].code == "grammar.verb_tense"
    print("Sample DiagnosticAIResult validated OK.")

    # The writing UI and API both use a five-word minimum. This short valid
    # example deliberately has fewer than the previous 20-character minimum.
    assert DiagnoseRequest(userId="u1", text="I am at a TV.").text == "I am at a TV."
    for too_short in ("Only four words here", "... !!!"):
        try:
            DiagnoseRequest(userId="u1", text=too_short)
            raise AssertionError(f"Short diagnostic input was accepted: {too_short!r}")
        except ValidationError:
            pass
    print("Diagnose word-count validation OK (minimum 5 meaningful words).")

    from app.config import Settings
    from app.services.ai_client import LLMProviderConfig, _provider_connection, _uses_model_studio_qwen
    from app.services.model_catalog import catalog_payload, server_model_by_id, server_model_pair

    qwen_settings = Settings(
        qwen_model_studio_api_key="test-qwen-key",
        deepseek_api_key="",
        openai_compat_api_key="",
    )
    assert qwen_settings.default_llm_model == "qwen3.7-max"
    assert qwen_settings.default_llm_fast_model == "qwen3.7-plus"
    assert _uses_model_studio_qwen(qwen_settings.default_llm_model, qwen_settings.default_llm_base_url)
    qwen_catalog = catalog_payload(qwen_settings)
    assert [entry["id"] for entry in qwen_catalog["models"]] == ["default", "qwen-deep", "qwen-fast"]
    assert all("apiKey" not in entry and "baseUrl" not in entry for entry in qwen_catalog["models"])
    selected_qwen = server_model_by_id("qwen-deep", qwen_settings)
    assert selected_qwen and selected_qwen.config.model == "qwen3.7-max"
    assert selected_qwen.config.fast_model == "qwen3.7-max"
    assert server_model_by_id("deepseek-deep", qwen_settings) is None
    mixed_settings = Settings(
        qwen_model_studio_api_key="test-qwen-key",
        deepseek_api_key="test-deepseek-key",
    )
    mixed_provider = server_model_pair("qwen-deep", "deepseek-fast", mixed_settings)
    assert mixed_provider is not None
    assert mixed_provider.model == "qwen3.7-max"
    assert mixed_provider.fast_model == "deepseek-v4-flash"
    assert mixed_provider.server_deep_model_id == "qwen-deep"
    assert mixed_provider.server_fast_model_id == "deepseek-fast"
    assert _provider_connection(mixed_provider, mixed_provider.model) == (
        "test-qwen-key",
        mixed_settings.qwen_model_studio_base_url,
    )
    assert _provider_connection(mixed_provider, mixed_provider.fast_model) == (
        "test-deepseek-key",
        mixed_settings.deepseek_base_url,
    )
    embedding_only_settings = Settings(
        qwen_embedding_api_key="test-embedding-key",
        qwen_embedding_base_url="https://embedding.example/v1",
        deepseek_api_key="test-deepseek-key",
    )
    assert embedding_only_settings.uses_qwen_model_studio is False
    assert embedding_only_settings.default_llm_model == "deepseek-v4-pro"
    assert embedding_only_settings.embedding_api_key == "test-embedding-key"
    assert embedding_only_settings.embedding_base_url == "https://embedding.example/v1"
    print("Qwen Model Studio defaults + safe model catalog + JSON routing OK.")

    # Model routing is part of the product contract: bounded, interactive work
    # uses Fast without high reasoning, while generative or durable learning
    # analysis uses Deep.
    from app.models.coach import CoachMissionRequest
    from app.services.chat_import_service import select_chat_import_model
    from app.services.coach_service import selected_coach_model
    from app.services.diagnose_service import select_diagnose_model
    from app.services.input_learning_service import select_input_learning_model
    from app.services.model_routing import reasoning_effort_for_tier
    from app.services.plan_service import select_plan_generation_model
    from app.services.practice_service import (
        generate_practice_exercise,
        grade_practice,
        select_practice_generation_model,
        select_practice_grading_model,
    )
    from app.services.session_analysis_service import select_session_analysis_model
    from app.services import practice_service
    from app.services.fake_ai import fake_for

    routing_provider = LLMProviderConfig(
        api_key="deep-key",
        base_url="https://deep.example/v1",
        model="deep-model",
        fast_model="fast-model",
        fast_api_key="fast-key",
        fast_base_url="https://fast.example/v1",
    )
    assert select_practice_generation_model(routing_provider) == "deep-model"
    assert select_practice_grading_model(routing_provider) == "fast-model"
    assert select_plan_generation_model(routing_provider) == "deep-model"
    assert select_session_analysis_model(routing_provider) == "deep-model"
    assert select_input_learning_model(routing_provider) == "deep-model"
    assert select_diagnose_model("fast", routing_provider) == "fast-model"
    assert select_diagnose_model("deep", routing_provider) == "deep-model"
    assert select_chat_import_model("fast", routing_provider) == "fast-model"
    assert select_chat_import_model("deep", routing_provider) == "deep-model"
    assert CoachMissionRequest().generationMode == "deep"
    assert selected_coach_model(CoachMissionRequest(), routing_provider) == "deep-model"
    assert selected_coach_model(
        CoachMissionRequest(generationMode="fast"), routing_provider
    ) == "fast-model"
    assert reasoning_effort_for_tier("fast") is None
    assert reasoning_effort_for_tier("deep") == "high"

    practice_calls = []
    original_practice_parse = practice_service.parse_with_model

    def capture_practice_call(**kwargs):
        practice_calls.append(kwargs)
        return fake_for(kwargs["response_model"])

    practice_service.parse_with_model = capture_practice_call
    try:
        generate_practice_exercise(
            "grammar.verb_tense",
            "Verb tense",
            "B1",
            [],
            llm_provider=routing_provider,
        )
        grade_practice(
            "Correct: Yesterday I go home.",
            "Yesterday I went home.",
            "Yesterday I went home.",
            "grammar.verb_tense",
            llm_provider=routing_provider,
        )
    finally:
        practice_service.parse_with_model = original_practice_parse

    assert practice_calls[0]["model"] == "deep-model"
    assert practice_calls[0]["reasoning_effort"] == "high"
    assert practice_calls[1]["model"] == "fast-model"
    assert practice_calls[1]["reasoning_effort"] is None
    assert practice_calls[1]["max_tokens"] == 2_048
    print("Task-aware Deep/Fast routing + Practice grading latency policy OK.")

    from app.core.mastery import update_skill_from_error
    from app.db.serialization import clean, to_dynamo

    skill = update_skill_from_error(
        existing=None,
        user_id="u1",
        skill_code="grammar.verb_tense",
        label="Verb tense",
        zh_label="动词时态",
        severity="high",
        now="2026-06-16T00:00:00+00:00",
    )
    assert skill["mastery"] == 58, skill["mastery"]  # 70 - 12
    dyn = to_dynamo(skill)
    assert isinstance(dyn["mastery"], Decimal), type(dyn["mastery"])
    assert clean(dyn)["mastery"] == 58
    print("Mastery scoring + Decimal round-trip OK.")

    print("\nALL SMOKE CHECKS PASSED ✅")


if __name__ == "__main__":
    main()
