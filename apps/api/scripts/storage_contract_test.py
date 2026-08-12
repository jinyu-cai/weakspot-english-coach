"""Focused DynamoDB item and realtime transcript capacity contracts."""

from __future__ import annotations

import os

os.environ.setdefault("DYNAMODB_ENDPOINT_URL", "")
os.environ.setdefault("USE_FAKE_AI", "true")
os.environ.setdefault("OWNER_BYPASS_TOKEN", "storage-contract-owner")

from moto import mock_aws
from pydantic import ValidationError


def _expect_validation_error(factory) -> None:
    try:
        factory()
    except ValidationError:
        return
    raise AssertionError("Expected request validation to reject the payload.")


@mock_aws
def main() -> int:
    from fastapi.testclient import TestClient

    from app.api.routes.realtime import (
        RealtimeSessionRequest,
        SaveTranscriptRequest,
        TRANSCRIPT_REQUEST_MAX_MESSAGES,
        TranscriptMessage,
    )
    from app.db.repositories import (
        CHAT_TRANSCRIPT_MAX_MESSAGES,
        DYNAMODB_SAFE_ITEM_BYTES,
        ItemTooLargeError,
        TranscriptCapacityError,
        _build_chat_transcript_stage_items,
        _serialized_dynamo_item_size,
        ensure_dynamodb_item_fits,
    )
    from app.db.repositories import (
        finalize_chat_session_turn,
        get_chat_session,
        get_submission,
        list_chat_messages,
        save_chat_session,
        save_submission,
    )
    from app.main import app
    from scripts.create_table import create_table

    create_table()

    small_messages = [
        {"role": "user", "content": "Hello"}
    ] * TRANSCRIPT_REQUEST_MAX_MESSAGES
    accepted = SaveTranscriptRequest(userId="ignored", messages=small_messages)
    assert len(accepted.messages) == TRANSCRIPT_REQUEST_MAX_MESSAGES
    _expect_validation_error(
        lambda: SaveTranscriptRequest(
            userId="ignored",
            messages=[*small_messages, {"role": "assistant", "content": "Hi"}],
        )
    )
    worst_case_request = SaveTranscriptRequest(
        userId="u" * 200,
        messages=[
            {
                "role": "assistant",
                # JSON escapes each control character as six wire bytes.
                "content": "\x00" * 16_000,
                "clientMessageId": "c" * 160,
                "createdAt": "2" * 64,
            }
        ] * TRANSCRIPT_REQUEST_MAX_MESSAGES,
    )
    assert len(worst_case_request.model_dump_json().encode("utf-8")) < 800_000

    realtime_session = {
        "id": "cs_capacity_api",
        "userId": "owner",
        "mode": "voice",
        "topic": "Transcript capacity",
        "messageCount": 0,
        "summary": None,
        "createdAt": "2026-07-29T03:06:10Z",
        "updatedAt": "2026-07-29T03:06:10Z",
    }
    save_chat_session(realtime_session)
    client = TestClient(
        app,
        headers={"X-Owner-Token": "storage-contract-owner"},
    )
    api_messages = [
        {
            "role": "user" if index % 2 == 0 else "assistant",
            "content": f"Capacity message {index}",
            "clientMessageId": f"capacity-{index}",
        }
        for index in range(TRANSCRIPT_REQUEST_MAX_MESSAGES)
    ]
    accepted_response = client.post(
        "/api/v1/chat/sessions/cs_capacity_api/transcript",
        json={"userId": "ignored", "messages": api_messages},
    )
    assert accepted_response.status_code == 200, accepted_response.text
    assert accepted_response.json()["saved"] == TRANSCRIPT_REQUEST_MAX_MESSAGES
    assert len(list_chat_messages("owner", "cs_capacity_api", limit=None)) == (
        TRANSCRIPT_REQUEST_MAX_MESSAGES
    )
    rejected_response = client.post(
        "/api/v1/chat/sessions/cs_capacity_api/transcript",
        json={
            "userId": "ignored",
            "messages": [
                *api_messages,
                {
                    "role": "user",
                    "content": "One message too many",
                    "clientMessageId": "capacity-overflow",
                },
            ],
        },
    )
    assert rejected_response.status_code == 422, rejected_response.text
    _expect_validation_error(
        lambda: TranscriptMessage(
            role="user",
            content="Hello",
            createdAt="x" * 65,
        )
    )
    _expect_validation_error(
        lambda: RealtimeSessionRequest(
            userId="ignored",
            topic="x" * 301,
        )
    )
    _expect_validation_error(
        lambda: RealtimeSessionRequest(
            userId="ignored",
            missionTargetSkills=["not.a.real.skill"],
        )
    )
    coach_realtime_request = RealtimeSessionRequest(
        userId="ignored",
        scenarioPrompt="A daily Coach roleplay.",
        starterMessage="Welcome to the roleplay.",
        scenarioFamily="community_event",
        missionRunId="lr_coach_voice",
        missionType="guided_scene",
        missionTargetSkills=["grammar.verb_tense", "grammar.verb_tense"],
    )
    assert coach_realtime_request.missionTargetSkills == ["grammar.verb_tense"]

    # At the repository capacity, 490 four-byte UTF-8 messages pack into
    # exactly 98 chunks. The commit then uses the DynamoDB maximum of 100
    # actions: 98 chunk updates, one marker, and one session update.
    max_content = "😀" * 16_000
    storage_messages = [
        {
            "id": f"cm_{index:012d}",
            "userId": "owner",
            "sessionId": "cs_capacity",
            "role": "assistant",
            "content": max_content,
            "clientMessageId": f"voice-{index:04d}-" + ("x" * 149),
            "corrections": None,
            "betterExpression": None,
            "source": "client_transcript",
            "createdAt": "2026-07-29T03:06:10.123456Z",
        }
        for index in range(CHAT_TRANSCRIPT_MAX_MESSAGES)
    ]
    chunks = _build_chat_transcript_stage_items(
        "owner",
        "cs_capacity",
        "tb_capacity",
        storage_messages,
    )
    assert len(chunks) == 98, len(chunks)
    assert all(
        _serialized_dynamo_item_size(chunk) < DYNAMODB_SAFE_ITEM_BYTES
        for chunk in chunks
    )
    try:
        _build_chat_transcript_stage_items(
            "owner",
            "cs_capacity",
            "tb_over_capacity",
            [*storage_messages, storage_messages[0]],
        )
    except TranscriptCapacityError:
        pass
    else:
        raise AssertionError("Repository accepted an over-capacity transcript batch.")

    assert ensure_dynamodb_item_fits(
        {"entityType": "SMALL_TEST", "payload": "safe"}
    ) < DYNAMODB_SAFE_ITEM_BYTES
    try:
        ensure_dynamodb_item_fits(
            {"entityType": "OVERSIZED_TEST", "payload": "😀" * 100_000}
        )
    except ItemTooLargeError as exc:
        assert exc.entity_type == "OVERSIZED_TEST"
        assert exc.size_bytes >= DYNAMODB_SAFE_ITEM_BYTES
    else:
        raise AssertionError("Oversized DynamoDB item passed the repository preflight.")

    try:
        finalize_chat_session_turn(
            "owner",
            "cs_oversized_turn",
            "claim_oversized_turn",
            {
                "id": "cm_small_user",
                "userId": "owner",
                "sessionId": "cs_oversized_turn",
                "role": "user",
                "content": "Hello",
                "createdAt": "2026-07-29T03:06:10Z",
            },
            {
                "id": "cm_oversized_assistant",
                "userId": "owner",
                "sessionId": "cs_oversized_turn",
                "role": "assistant",
                "content": "😀" * 100_000,
                "createdAt": "2026-07-29T03:06:11Z",
            },
            "Hello",
            2,
        )
    except ItemTooLargeError as exc:
        assert exc.entity_type == "CHAT_MESSAGE"
    else:
        raise AssertionError("Oversized Chat turn reached the transaction writer.")

    # Verify normal repository save helpers share the same preflight instead
    # of relying on a boto ValidationException after persistence is attempted.
    oversized_session = {
        "id": "cs_oversized",
        "userId": "owner",
        "mode": "text",
        "scenarioPrompt": "😀" * 100_000,
        "createdAt": "2026-07-29T03:06:10Z",
        "updatedAt": "2026-07-29T03:06:10Z",
    }
    try:
        save_chat_session(oversized_session)
    except ItemTooLargeError:
        pass
    else:
        raise AssertionError("Oversized Chat session reached DynamoDB.")
    assert get_chat_session("owner", "cs_oversized") is None

    oversized_submission = {
        "id": "sub_oversized",
        "userId": "owner",
        "originalText": "😀" * 100_000,
        "createdAt": "2026-07-29T03:06:10Z",
    }
    try:
        save_submission(oversized_submission)
    except ItemTooLargeError:
        pass
    else:
        raise AssertionError("Oversized diagnosis submission reached DynamoDB.")
    assert get_submission(
        "owner",
        oversized_submission["createdAt"],
        oversized_submission["id"],
    ) is None

    print("STORAGE CONTRACT TESTS PASSED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
