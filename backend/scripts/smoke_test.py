"""Offline smoke test — NO network calls (no DeepSeek, no AWS).

Verifies the whole backend imports, every AI response model produces a valid
JSON schema, a realistic diagnostic payload validates, and the mastery +
Decimal round-trip works.

Run from the backend/ directory:

    python -m scripts.smoke_test
"""

import json
from decimal import Decimal


def main() -> None:
    # 1. Import the FastAPI app (exercises config, routes, services, db, models)
    #    and build the OpenAPI schema (exercises every route + request model).
    from app.main import app

    paths = sorted(app.openapi().get("paths", {}).keys())
    print("Imported app OK. API routes:")
    for p in paths:
        print("   ", p)

    # 2. JSON schema generation for every AI response model.
    from app.models.chat_import import ChatImportAIResult
    from app.models.diagnostic import DiagnosticAIResult
    from app.models.plan import LearningPlanAIResult
    from app.models.practice import PracticeExerciseAIResult, PracticeGradeAIResult

    for model in (
        DiagnosticAIResult,
        ChatImportAIResult,
        LearningPlanAIResult,
        PracticeExerciseAIResult,
        PracticeGradeAIResult,
    ):
        schema = model.model_json_schema()
        assert "properties" in schema, model.__name__
        print(f"Schema OK: {model.__name__} ({len(json.dumps(schema))} bytes)")

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

    # 4. Mastery scoring + Decimal round-trip.
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
