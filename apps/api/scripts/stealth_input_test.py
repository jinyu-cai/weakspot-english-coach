"""PostgreSQL release contracts for memory, transcript, and Input Learning.

Run from ``apps/api`` after starting the local PostgreSQL container:

    uv run python -m scripts.stealth_input_test
"""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
import os
import uuid


def _iso(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def main() -> int:
    os.environ.setdefault("USE_FAKE_AI", "true")
    os.environ.setdefault("OWNER_BYPASS_TOKEN", "stealth-input-owner-token")
    os.environ.setdefault(
        "SESSION_SECRET", "stealth-input-test-secret-at-least-32-bytes"
    )
    os.environ.setdefault("GUEST_DAILY_LIMIT", "100")
    os.environ.setdefault("USER_DAILY_LIMIT", "100")

    from fastapi.testclient import TestClient
    from sqlalchemy import update

    from scripts.postgres_test import reset_test_database

    from app.db import schema
    from app.db.database import session_scope
    from app.db.repositories import (
        MemoryWriteClaimLostError,
        claim_memory_write_lease,
        get_chat_session,
        get_memory,
        list_chat_messages,
        list_input_learning_sources,
        release_memory_write_lease,
        save_chat_session,
        save_input_learning_source,
        save_memory_with_memory_write_lease,
    )
    from app.main import app

    reset_test_database()
    now = datetime.now(timezone.utc).replace(microsecond=0)

    # A unique PostgreSQL lease row serializes concurrent memory writers.
    lease_user = f"memory-lease-{uuid.uuid4().hex[:8]}"
    claim_ids = [f"claim-{uuid.uuid4().hex}" for _ in range(4)]
    with ThreadPoolExecutor(max_workers=4) as executor:
        results = list(
            executor.map(
                lambda claim_id: claim_memory_write_lease(lease_user, claim_id),
                claim_ids,
            )
        )
    assert results.count(True) == 1, results
    winning_claim = claim_ids[results.index(True)]

    # Expiring the row permits takeover, while the previous holder is fenced
    # from committing data in the same transaction.
    with session_scope() as session:
        session.execute(
            update(schema.memory_leases)
            .where(schema.memory_leases.c.user_id == lease_user)
            .values(claimed_at_epoch=0)
        )
    replacement_claim = f"replacement-{uuid.uuid4().hex}"
    assert claim_memory_write_lease(
        lease_user, replacement_claim, stale_after_seconds=30
    )
    memory = {
        "id": f"mem_{uuid.uuid4().hex[:12]}",
        "userId": lease_user,
        "kind": "episode",
        "canonicalKey": "episode.postgresql.lease-fencing",
        "content": "Only the current lease holder can save this memory.",
        "evidence": "PostgreSQL release contract.",
        "confidence": 1.0,
        "importance": 0.7,
        "status": "active",
        "pinned": False,
        "createdAt": _iso(now),
        "updatedAt": _iso(now),
    }
    try:
        save_memory_with_memory_write_lease(memory, winning_claim)
    except MemoryWriteClaimLostError:
        pass
    else:
        raise AssertionError("A stale memory writer committed after lease takeover.")
    save_memory_with_memory_write_lease(memory, replacement_claim)
    release_memory_write_lease(lease_user, replacement_claim)
    assert get_memory(lease_user, memory["id"]) is not None
    print("1. memory lease            -> concurrency and stale-writer fencing passed")

    # Voice transcript publishing is one SQL transaction. Duplicate client
    # message IDs are skipped cleanly by the API on retry.
    client = TestClient(app, headers={"X-Owner-Token": "stealth-input-owner-token"})
    session_id = f"cs_voice_{uuid.uuid4().hex[:8]}"
    save_chat_session(
        {
            "id": session_id,
            "userId": "owner",
            "mode": "voice",
            "topic": "PostgreSQL transcript transaction",
            "messageCount": 0,
            "summary": None,
            "createdAt": _iso(now),
            "updatedAt": _iso(now),
        }
    )
    transcript = {
        "messages": [
            {
                "role": "user",
                "content": "Yesterday I go to the office.",
                "clientMessageId": "postgres-voice-user-1",
            },
            {
                "role": "assistant",
                "content": "Try: Yesterday I went to the office.",
                "clientMessageId": "postgres-voice-assistant-1",
            },
        ]
    }
    response = client.post(
        f"/api/v1/chat/sessions/{session_id}/transcript", json=transcript
    )
    assert response.status_code == 200, response.text
    assert response.json()["saved"] == 2, response.text
    retry = client.post(
        f"/api/v1/chat/sessions/{session_id}/transcript", json=transcript
    )
    assert retry.status_code == 200, retry.text
    assert retry.json()["saved"] == 0, retry.text
    assert retry.json()["skippedDuplicates"] == 2, retry.text
    messages = list_chat_messages("owner", session_id, limit=None)
    assert [message["role"] for message in messages] == ["user", "assistant"]
    stored_session = get_chat_session("owner", session_id)
    assert stored_session and stored_session["messageCount"] == 2
    print("2. transcript transaction  -> atomic publish and idempotent retry passed")

    # Input Learning is grounded in source text and uses server-owned identity.
    content = (
        "Maya said, 'Let me run that by you before we commit.' "
        "Her manager raised a concern about the timeline. "
        "It turns out that the client had approved the earlier plan."
    )
    request = {
        "userId": "client-supplied-id-is-ignored",
        "sourceType": "series",
        "title": "Workplace scene",
        "content": content,
        "notes": "I want natural phrases for meetings.",
        "goal": "Use tactful project English.",
        "targetItemCount": 3,
        "outputLanguage": "en",
    }
    response = client.post("/api/v1/input-learning/analyze", json=request)
    assert response.status_code == 200, response.text
    source = response.json()["source"]
    assert source["userId"] == "owner"
    assert source["status"] == "complete"
    assert source["items"]
    assert all(item.get("sourceEvidence") in content for item in source["items"])
    duplicate = client.post("/api/v1/input-learning/analyze", json=request)
    assert duplicate.status_code == 200, duplicate.text
    assert duplicate.json()["source"]["id"] == source["id"]
    print("3. Input Learning          -> grounded, identity-bound, duplicate-safe")

    # Keyset pagination has no hidden 200-row storage ceiling.
    expected_ids: set[str] = set()
    for index in range(205):
        source_id = f"input_pagination_{index:03d}"
        expected_ids.add(source_id)
        created_at = _iso(now + timedelta(seconds=index + 1))
        save_input_learning_source(
            {
                "id": source_id,
                "userId": "owner",
                "sourceType": "article",
                "title": f"Input pagination source {index}",
                "mode": "attention_mission",
                "status": "complete",
                "contentProvided": False,
                "itemCount": 0,
                "createdAt": created_at,
                "updatedAt": created_at,
            }
        )

    seen: set[str] = set()
    cursor: str | None = None
    first_cursor: str | None = None
    while True:
        params = {"pageSize": 37}
        if cursor:
            params["cursor"] = cursor
        page_response = client.get("/api/v1/input-learning", params=params)
        assert page_response.status_code == 200, page_response.text
        page = page_response.json()
        assert len(page["sources"]) <= 37
        seen.update(item["id"] for item in page["sources"])
        cursor = page.get("nextCursor")
        first_cursor = first_cursor or cursor
        if not cursor:
            break
    assert expected_ids <= seen
    assert len(list_input_learning_sources("owner")) >= 206

    tampered = f"{first_cursor[:-1]}A" if first_cursor else "invalid"
    invalid = client.get(
        "/api/v1/input-learning", params={"pageSize": 37, "cursor": tampered}
    )
    assert invalid.status_code == 400, invalid.text
    print("4. keyset pagination       -> all rows returned; tampering rejected")

    print("\nPOSTGRESQL STEALTH + INPUT TESTS PASSED ✅")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
