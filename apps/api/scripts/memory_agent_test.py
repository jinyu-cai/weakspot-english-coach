"""Deterministic MemoryAgent tests: lifecycle, recall, API, and adaptation.

Run from apps/api:

    DYNAMODB_ENDPOINT_URL= uv run python -m scripts.memory_agent_test
"""

import os
from datetime import datetime, timedelta, timezone
import uuid


def main() -> int:
    os.environ["AWS_ACCESS_KEY_ID"] = "testing"
    os.environ["AWS_SECRET_ACCESS_KEY"] = "testing"
    os.environ["AWS_REGION"] = "us-east-1"
    os.environ["AWS_DEFAULT_REGION"] = "us-east-1"
    os.environ["DYNAMODB_ENDPOINT_URL"] = ""
    os.environ["USE_FAKE_AI"] = "true"
    os.environ["OWNER_BYPASS_TOKEN"] = "memory-test-owner-token"
    os.environ["SESSION_SECRET"] = "memory-agent-test-secret-at-least-32-bytes"

    import moto

    mock = moto.mock_aws()
    mock.start()
    try:
        from fastapi.testclient import TestClient

        from app.db.repositories import get_memory, list_memories, list_memory_traces, save_memory
        from app.main import app
        from app.models.memory import MemoryCandidate
        from app.services.decision_service import recommend_next_action
        from app.services.memory_service import (
            estimate_tokens,
            forget_memories_from_source,
            record_practice_outcome_memory,
            remember_candidates,
            retrieve_memory_pack,
        )
        from scripts.create_table import create_table

        create_table()
        user_id = f"memory-test-{uuid.uuid4().hex[:8]}"

        # 1. Same fact merges evidence instead of creating duplicates.
        first = remember_candidates(
            user_id,
            [MemoryCandidate(
                kind="preference",
                canonicalKey="preference.feedback_style",
                content="The learner prefers concise feedback.",
                evidence="Please keep feedback concise.",
                confidence=0.9,
                importance=0.8,
            )],
            source_type="chat",
            source_id="chat-1",
        )[0]
        merged = remember_candidates(
            user_id,
            [MemoryCandidate(
                kind="preference",
                canonicalKey="preference.feedback_style",
                content="The learner prefers concise feedback.",
                evidence="Brief feedback works best for me.",
                confidence=0.9,
                importance=0.82,
            )],
            source_type="chat",
            source_id="chat-2",
        )[0]
        assert first["id"] == merged["id"]
        assert merged["observationCount"] == 2
        print("1. repeated evidence       -> merged, observationCount=2")

        # 2. Contradiction replaces the active fact and archives the old one.
        replacement = remember_candidates(
            user_id,
            [MemoryCandidate(
                kind="preference",
                canonicalKey="preference.feedback_style",
                content="The learner now prefers detailed feedback.",
                evidence="I want detailed feedback from now on.",
                confidence=0.98,
                importance=0.9,
            )],
            source_type="chat",
            source_id="chat-3",
        )[0]
        old = get_memory(user_id, first["id"])
        assert old and old["status"] == "superseded"
        assert old["supersededBy"] == replacement["id"]
        print("2. conflicting preference -> old memory superseded")

        # 3. Expired memory is immediately filtered and marked, independent of
        # DynamoDB's eventually-consistent physical TTL deletion.
        yesterday = datetime.now(timezone.utc) - timedelta(days=1)
        expired_id = f"mem_{uuid.uuid4().hex[:12]}"
        save_memory({
            "id": expired_id,
            "userId": user_id,
            "kind": "episode",
            "canonicalKey": "episode.expired-test",
            "content": "This event should no longer be recalled.",
            "evidence": "Synthetic expiration test.",
            "confidence": 1.0,
            "importance": 1.0,
            "status": "active",
            "pinned": False,
            "sourceType": "system",
            "sourceId": "test",
            "observationCount": 1,
            "accessCount": 0,
            "createdAt": yesterday.isoformat().replace("+00:00", "Z"),
            "updatedAt": yesterday.isoformat().replace("+00:00", "Z"),
            "expiresAt": yesterday.isoformat().replace("+00:00", "Z"),
            "ttl": int((yesterday + timedelta(days=30)).timestamp()),
        })
        pack = retrieve_memory_pack(
            user_id,
            "expired event feedback preference",
            token_budget=120,
            limit=4,
            purpose="test_expiry",
        )
        assert expired_id not in [item["id"] for item in pack["items"]]
        assert get_memory(user_id, expired_id)["status"] == "expired"
        assert pack["estimatedTokens"] <= 120
        assert estimate_tokens(pack["text"]) <= 120
        print("3. timely forgetting      -> expired suppressed; pack <= 120 tokens")

        # 4. Practice outcomes accumulate into strategy memory and alter the
        # next-exercise policy away from its cold-start choice.
        now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        for exercise_type, scores in {
            "fix_sentence": [96, 94, 95],
            "fill_blank": [68, 72, 74],
            "rewrite_sentence": [97, 96, 98],
        }.items():
            for score in scores:
                attempt_id = f"att_{uuid.uuid4().hex[:10]}"
                record_practice_outcome_memory(
                    user_id=user_id,
                    skill_code="grammar.verb_tense",
                    exercise_type=exercise_type,
                    score=score,
                    is_correct=score >= 70,
                    attempt_id=attempt_id,
                    created_at=now,
                )
        decision = recommend_next_action(user_id)
        assert decision["targetSkillCode"] == "grammar.verb_tense"
        assert decision["practiceType"] == "fill_blank", decision
        assert decision["supportingMemoryIds"]
        print("4. adaptive decision      -> fill_blank selected from outcome history")

        # Source deletion retracts only that source's evidence. A corroborated
        # memory survives until its final independent source is removed.
        shared_candidate = MemoryCandidate(
            kind="weakness",
            canonicalKey="weakness.grammar.preposition",
            content="The learner needs recurring practice with English prepositions.",
            evidence="in Monday → on Monday",
            confidence=0.85,
            importance=0.75,
        )
        shared = remember_candidates(
            user_id, [shared_candidate], source_type="diagnosis", source_id="source-a"
        )[0]
        remember_candidates(
            user_id, [shared_candidate], source_type="diagnosis", source_id="source-b"
        )
        forget_memories_from_source(user_id, "source-a")
        assert get_memory(user_id, shared["id"])["status"] == "active"
        forget_memories_from_source(user_id, "source-b")
        assert get_memory(user_id, shared["id"])["status"] == "forgotten"
        print("5. source retraction      -> corroborated memory survives, final source forgets")

        # 6. API surface supports learner-owned create/edit/retrieve/forget and
        # emits an explainable retrieval trace.
        client = TestClient(app, headers={"X-Owner-Token": "memory-test-owner-token"})
        response = client.post("/api/v1/memory", json={
            "kind": "goal",
            "canonicalKey": "goal.exam.ielts",
            "content": "The learner is preparing for IELTS writing.",
            "pinned": True,
        })
        assert response.status_code == 200, response.text
        api_memory = response.json()["memory"]
        response = client.patch(f"/api/v1/memory/{api_memory['id']}", json={"importance": 0.95})
        assert response.status_code == 200 and response.json()["memory"]["importance"] == 0.95
        response = client.post("/api/v1/memory/retrieve", json={
            "query": "IELTS writing goal",
            "tokenBudget": 140,
            "limit": 4,
        })
        assert response.status_code == 200, response.text
        api_pack = response.json()["memoryPack"]
        assert api_pack["estimatedTokens"] <= 140
        assert api_pack["items"] and api_pack["items"][0].get("scoreBreakdown")
        response = client.delete(f"/api/v1/memory/{api_memory['id']}")
        assert response.status_code == 200 and response.json()["forgotten"] is True
        print("6. Memory API             -> create/edit/retrieve/trace/forget passed")

        traces = list_memory_traces(user_id, limit=10)
        assert traces and traces[0].get("selected") is not None
        active_count = sum(m.get("status") == "active" for m in list_memories(user_id, limit=300))
        print(f"\nMEMORYAGENT TESTS PASSED ✅  ({active_count} active memories, {len(traces)} traces)")
        return 0
    finally:
        mock.stop()


if __name__ == "__main__":
    raise SystemExit(main())
