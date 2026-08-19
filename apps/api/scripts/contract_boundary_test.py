"""Offline regression checks for API/storage contract boundaries.

Run from ``apps/api``:

    python -m scripts.contract_boundary_test

No network, database, or model-provider call is made.
"""

import asyncio
import json
from unittest.mock import patch

from fastapi import HTTPException, Response
from pydantic import ValidationError

from app.api.deps import Identity
from app.api.routes import chat as chat_routes
from app.api.routes import coach as coach_routes
from app.api.routes import diagnose as diagnose_routes
from app.config import settings
from app.core.taxonomy import ERROR_TAXONOMY
from app.db.repositories import ItemTooLargeError
from app.models.chat import (
    CHAT_MESSAGE_MAX_CHARACTERS,
    ChatCreateSessionRequest,
    ChatPredictRequest,
    ChatReplyAI,
    ChatSendRequest,
    SessionCorrectionAI,
    SessionWeaknessAI,
    StealthProbeAssessmentAI,
)
from app.models.chat_import import ChatWeaknessAI
from app.models.coach import CoachMissionRequest, CoachMissionResponse
from app.models.diagnostic import (
    DIAGNOSE_TEXT_MAX_CHARACTERS,
    DiagnosticErrorAI,
    DiagnoseRequest,
    SkillUpdateAI,
    TargetEvidenceAI,
)
from app.models.learning import (
    EVIDENCE_QUOTE_MAX_CHARACTERS,
    RecordEvidenceRequest,
    saturate_activity_attempt_count,
)
from app.models.memory import CreateMemoryRequest
from app.models.plan import LearningPlanDayAI
from app.models.practice import (
    GeneratePracticeRequest,
    GradePracticeRequest,
    PracticeExerciseAIResult,
)
from app.services.coach_service import generate_coach_mission
from app.services import decision_service


def _identity(user_id: str = "contract-user") -> Identity:
    return Identity(
        user_id=user_id,
        kind="owner",
        is_owner=True,
        is_member=False,
        rate_key=user_id,
        daily_limit=10**9,
        max_output_tokens=None,
        max_realtime_seconds=None,
        login="contract@example.com",
    )


def _expect_validation_error(factory) -> None:
    try:
        factory()
    except ValidationError:
        return
    raise AssertionError("Expected Pydantic validation to fail.")


def _plan_task() -> dict:
    exercises = [
        {
            "promptZh": f"Prompt {index}",
            "question": f"Question {index}",
            "answer": f"Answer {index}",
            "explanationZh": f"Explanation {index}",
        }
        for index in range(3)
    ]
    return {
        "titleZh": "Task",
        "descriptionZh": "Description",
        "practiceType": "fix_sentence",
        "estimatedMinutes": 15,
        "exercises": exercises,
    }


def _coach_response_with_long_prompt() -> CoachMissionResponse:
    previous_fake_ai = settings.use_fake_ai
    settings.use_fake_ai = True
    try:
        response = generate_coach_mission(
            CoachMissionRequest(runtimeMode="selected_provider")
        )
    finally:
        settings.use_fake_ai = previous_fake_ai
    payload = response.model_dump(mode="json")
    payload["mission"]["taskPrompt"] = "T" * 1200
    return CoachMissionResponse.model_validate(payload)


def main() -> None:
    identity = _identity()

    # Full Chat topics stay on the session while compact ActivityRun metadata
    # conforms to its separate 240-character title contract.
    topic = "t" * 300
    captured_chat_runs = []
    saved_sessions = []
    with (
        patch.object(
            chat_routes,
            "_new_session_model",
            return_value=("fake-model", "fast", None, None, None),
        ),
        patch.object(
            chat_routes,
            "create_activity_run",
            side_effect=lambda _user, request: (
                captured_chat_runs.append(request) or {"id": "run_chat"}
            ),
        ),
        patch.object(
            chat_routes,
            "save_chat_session",
            side_effect=lambda session: saved_sessions.append(session),
        ),
    ):
        result = chat_routes.create_session(
            ChatCreateSessionRequest(userId="ignored", topic=topic),
            llm_provider=None,
            identity=identity,
        )
    assert result["session"]["topic"] == topic
    assert saved_sessions[0]["topic"] == topic
    assert captured_chat_runs[0].title == topic[:240]
    assert captured_chat_runs[0].goal == topic

    # Coach retains its complete task while only its ActivityRun goal is
    # compacted to that model's 800-character storage contract.
    coach_response = _coach_response_with_long_prompt()
    captured_coach_runs = []
    decision = {
        "recommendedType": "guided_scene",
        "targetSkills": ["grammar.verb_tense"],
        "goalContext": "none",
        "preferenceContext": "none",
        "strategyContext": "none",
        "reason": "contract test",
        "skillScores": [],
        "missionTypeScores": {},
        "policy": "contract-test",
        "generatedAt": "2026-01-01T00:00:00Z",
    }
    with (
        patch.object(coach_routes, "recommend_coach_mission", return_value=decision),
        patch.object(coach_routes, "list_skills", return_value=[]),
        patch.object(coach_routes, "list_chat_sessions_page", return_value=([], None)),
        patch.object(
            coach_routes,
            "generate_coach_mission",
            return_value=coach_response,
        ),
        patch.object(
            coach_routes,
            "create_activity_run",
            side_effect=lambda _user, request: (
                captured_coach_runs.append(request) or {"id": "run_coach"}
            ),
        ),
    ):
        result = coach_routes.create_coach_mission(
            CoachMissionRequest(preferredType="guided_scene"),
            llm_provider=None,
            identity=identity,
        )
    assert result.mission.taskPrompt == "T" * 1200
    assert captured_coach_runs[0].goal == "T" * 800

    # Skill codes are rejected at both generated-output and incoming-request
    # boundaries, before persistence can fail after a paid model call.
    expected_skill_codes = list(ERROR_TAXONOMY)
    for model, field_name in (
        (DiagnosticErrorAI, "code"),
        (SkillUpdateAI, "skillCode"),
        (TargetEvidenceAI, "skillCode"),
    ):
        field_schema = model.model_json_schema()["properties"][field_name]
        assert field_schema["enum"] == expected_skill_codes, (model.__name__, field_schema)

    invalid_skill = "invented.skill"
    _expect_validation_error(
        lambda: LearningPlanDayAI(
            day=1,
            goalZh="Goal",
            targetSkillCodes=[invalid_skill],
            tasks=[_plan_task(), _plan_task()],
        )
    )
    _expect_validation_error(
        lambda: GeneratePracticeRequest(
            userId="user",
            targetSkillCode=invalid_skill,
        )
    )
    previous_skills = GeneratePracticeRequest(
        userId="user",
        previousSkillCodes=[invalid_skill, "grammar.article", "grammar.article"],
    )
    assert previous_skills.previousSkillCodes == ["grammar.article"]
    _expect_validation_error(
        lambda: PracticeExerciseAIResult(
            type="fix_sentence",
            targetSkillCode=invalid_skill,
            promptZh="Prompt",
            question="Question",
            answer="Answer",
            explanationZh="Explanation",
        )
    )
    _expect_validation_error(
        lambda: GradePracticeRequest(
            userId="user",
            targetSkillCode=invalid_skill,
            question="Question",
            userAnswer="Answer",
        )
    )
    _expect_validation_error(
        lambda: DiagnosticErrorAI(
            code=invalid_skill,
            category="Grammar",
            severity="medium",
            originalText="Original",
            correctedText="Corrected",
            explanationZh="Explanation",
            microLessonZh="Lesson",
            practiceGoal="Goal",
        )
    )
    _expect_validation_error(
        lambda: SessionCorrectionAI(
            code=invalid_skill,
            category="Grammar",
            severity="medium",
            original="Original",
            corrected="Corrected",
            explanationZh="Explanation",
            microLessonZh="Lesson",
            practiceGoal="Goal",
        )
    )
    _expect_validation_error(
        lambda: SessionWeaknessAI(
            code=invalid_skill,
            category="Grammar",
            severity="medium",
            evidenceQuote="Evidence",
            explanationZh="Explanation",
            practiceGoal="Goal",
        )
    )
    _expect_validation_error(
        lambda: ChatWeaknessAI(
            code=invalid_skill,
            category="Grammar",
            severity="medium",
            evidenceType="user_error",
            evidenceQuote="Evidence",
            suggestedBetterEnglish="Better",
            explanationZh="Explanation",
            microLessonZh="Lesson",
            practiceGoal="Goal",
            confidence=0.9,
        )
    )

    # Legacy rows remain readable for history, but adaptive Practice must not
    # choose a code that the current request contract rejects.
    with (
        patch.object(
            decision_service,
            "list_skills",
            return_value=[
                {"skillCode": invalid_skill, "mastery": 5},
                {"skillCode": "grammar.article", "mastery": 45},
            ],
        ),
        patch.object(
            decision_service,
            "list_recent_errors",
            return_value=[
                {"code": invalid_skill},
                {"code": "grammar.article"},
            ],
        ),
        patch.object(
            decision_service,
            "list_recent_practice_attempts",
            return_value=[
                {"targetSkillCode": invalid_skill, "score": 0},
                {"targetSkillCode": "grammar.article", "score": 70},
            ],
        ),
    ):
        ranked_skills = decision_service._skill_scores("contract-user")
    assert [row["skillCode"] for row in ranked_skills] == ["grammar.article"]

    # AI-authored/source evidence is compact metadata. Long quotes are bounded
    # deterministically while their full source messages remain untouched.
    long_quote = "e" * 601
    evidence = RecordEvidenceRequest(
        clientEventId="contract:evidence",
        skillCode="grammar.verb_tense",
        outcome="failure",
        opportunityPresent=True,
        evidenceQuote=long_quote,
    )
    assert evidence.evidenceQuote == long_quote[:EVIDENCE_QUOTE_MAX_CHARACTERS]
    weakness = SessionWeaknessAI(
        code="grammar.verb_tense",
        category="Grammar",
        severity="medium",
        evidenceQuote=long_quote,
        explanationZh="Explanation",
        practiceGoal="Goal",
    )
    stealth = StealthProbeAssessmentAI(
        opportunityPresent=True,
        outcome="failure",
        evidenceQuote=long_quote,
    )
    target = TargetEvidenceAI(
        skillCode="grammar.verb_tense",
        opportunityPresent=True,
        outcome="failure",
        evidenceQuote=long_quote,
    )
    assert len(weakness.evidenceQuote) == EVIDENCE_QUOTE_MAX_CHARACTERS
    assert len(stealth.evidenceQuote) == EVIDENCE_QUOTE_MAX_CHARACTERS
    assert len(target.evidenceQuote) == EVIDENCE_QUOTE_MAX_CHARACTERS

    assert saturate_activity_attempt_count(101) == 100
    assert saturate_activity_attempt_count(10_000) == 100
    assert saturate_activity_attempt_count(-1) == 0

    assert CreateMemoryRequest(
        kind="goal",
        content="Improve English",
        canonicalKey=None,
    ).canonicalKey is None
    _expect_validation_error(
        lambda: CreateMemoryRequest(
            kind="goal",
            content="Improve English",
            canonicalKey="ab",
        )
    )

    _expect_validation_error(
        lambda: ChatSendRequest(
            userId="user",
            sessionId="session",
            text="x" * (CHAT_MESSAGE_MAX_CHARACTERS + 1),
        )
    )
    _expect_validation_error(
        lambda: ChatPredictRequest(
            userId="user",
            sessionId="session",
            partialText="x" * (CHAT_MESSAGE_MAX_CHARACTERS + 1),
        )
    )
    _expect_validation_error(
        lambda: DiagnoseRequest(
            userId="user",
            text=("word " * 3000)[: DIAGNOSE_TEXT_MAX_CHARACTERS + 1],
        )
    )

    # A stable client message id produces stable persisted ids, and a retry
    # replays the complete atomic pair without invoking the model or claim.
    req = ChatSendRequest(
        userId="ignored",
        sessionId="cs_contract",
        text="Yesterday I visit the museum.",
        clientMessageId="client-turn-0001",
    )
    session = {
        "id": req.sessionId,
        "userId": identity.user_id,
        "mode": "text",
        "textModel": "fake-model",
        "messageCount": 0,
        "createdAt": "2026-01-01T00:00:00Z",
        "updatedAt": "2026-01-01T00:00:00Z",
    }
    committed = {}

    def capture_turn(
        _user_id,
        _session_id,
        _claim_id,
        user_message,
        assistant_message,
        _summary,
        _message_count,
        **_kwargs,
    ):
        committed["messages"] = [user_message, assistant_message]

    ai_reply = ChatReplyAI(
        reply="What did you see there?",
        corrections=[],
        betterExpression=None,
        memoryCandidates=[],
        practiceOpportunityCreated=False,
    )
    with (
        patch.object(chat_routes, "get_chat_session", return_value=session),
        patch.object(chat_routes, "_session_provider", return_value=None),
        patch.object(chat_routes, "_session_text_model", return_value="fake-model"),
        patch.object(chat_routes, "claim_chat_session_turn", return_value=True),
        patch.object(chat_routes, "release_chat_session_turn_claim"),
        patch.object(chat_routes, "list_chat_messages", return_value=[]),
        patch.object(chat_routes, "text_probe_turn_is_ready", return_value=False),
        patch.object(
            chat_routes,
            "retrieve_memory_pack",
            return_value={"text": "", "items": [], "estimatedTokens": 0, "traceId": None},
        ),
        patch.object(chat_routes, "chat_reply", return_value=ai_reply),
        patch.object(chat_routes, "finalize_chat_session_turn", side_effect=capture_turn),
        patch.object(chat_routes, "remember_candidates", return_value=[]),
    ):
        first = chat_routes.send_message(req, llm_provider=None, identity=identity)
    assert first["duplicate"] is False
    assert committed["messages"][0]["clientMessageId"] == req.clientMessageId
    assert committed["messages"][1]["replyToClientMessageId"] == req.clientMessageId
    assert committed["messages"][0]["id"] == chat_routes._stable_chat_message_id(
        identity.user_id, req.sessionId, req.clientMessageId, "user"
    )

    with (
        patch.object(chat_routes, "get_chat_session", return_value=session),
        patch.object(
            chat_routes,
            "list_chat_messages",
            return_value=committed["messages"],
        ),
        patch.object(
            chat_routes,
            "claim_chat_session_turn",
            side_effect=AssertionError("a completed retry must not claim or regenerate"),
        ),
        patch.object(
            chat_routes,
            "chat_reply",
            side_effect=AssertionError("a completed retry must not call the model"),
        ),
    ):
        replay = chat_routes.send_message(req, llm_provider=None, identity=identity)
    assert replay["duplicate"] is True
    assert replay["userMessage"]["id"] == first["userMessage"]["id"]
    assert replay["assistantMessage"]["id"] == first["assistantMessage"]["id"]

    conflicting = req.model_copy(update={"text": "Different text."})
    try:
        with (
            patch.object(chat_routes, "get_chat_session", return_value=session),
            patch.object(
                chat_routes,
                "list_chat_messages",
                return_value=committed["messages"],
            ),
        ):
            chat_routes.send_message(
                conflicting,
                llm_provider=None,
                identity=identity,
            )
    except HTTPException as exc:
        assert exc.status_code == 409
        assert exc.detail["code"] == "client_message_conflict"
    else:
        raise AssertionError("Reusing a clientMessageId for new text must conflict.")

    # Diagnose has already flushed streaming headers when persistence finishes,
    # so an item-size failure uses a stable structured body instead of a raw
    # traceback or incorrectly labelling the storage failure as an AI error.
    async def streamed_storage_failure() -> dict:
        with (
            patch.object(
                diagnose_routes,
                "_pre_check",
                return_value={
                    "profile": {},
                    "text_hash": "contract-hash",
                    "claim": {"claimId": "claim"},
                },
            ),
            patch.object(
                diagnose_routes,
                "_llm_and_persist",
                side_effect=ItemTooLargeError("SUBMISSION", 400_001),
            ),
            patch.object(diagnose_routes, "release_diagnosis_request"),
        ):
            stream = await diagnose_routes.diagnose(
                DiagnoseRequest(
                    userId="ignored",
                    text="These five words form valid input.",
                ),
                Response(),
                llm_provider=None,
                identity=identity,
            )
            chunks = []
            async for chunk in stream.body_iterator:
                chunks.append(chunk)
        return json.loads(b"".join(chunks))

    storage_error = asyncio.run(streamed_storage_failure())
    assert storage_error == {
        "error": True,
        "code": "payload_too_large",
        "detail": "The diagnosis result is too large to store.",
    }

    print("Contract boundary checks passed.")


if __name__ == "__main__":
    main()
