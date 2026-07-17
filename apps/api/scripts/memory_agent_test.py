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

        # 5. A weakness graduates only after spaced, varied, successful
        # practice. It leaves active recall without being deleted, and the
        # same record reopens if fresh error evidence appears later.
        graduation_candidate = MemoryCandidate(
            kind="weakness",
            canonicalKey="weakness.grammar.article",
            content="The learner needs recurring practice with English articles.",
            evidence="The learner omitted an article before a singular noun.",
            confidence=0.9,
            importance=0.85,
        )
        graduating = remember_candidates(
            user_id,
            [graduation_candidate],
            source_type="diagnosis",
            source_id="graduation-source",
        )[0]
        observed_at = datetime.now(timezone.utc) - timedelta(days=20)
        stored = get_memory(user_id, graduating["id"])
        assert stored
        stored["lastObservedAt"] = observed_at.isoformat().replace("+00:00", "Z")
        save_memory(stored)

        practice_now = datetime.now(timezone.utc)
        for index, days_ago in enumerate((15, 10, 5, 1, 0)):
            attempt_at = practice_now - timedelta(days=days_ago)
            record_practice_outcome_memory(
                user_id=user_id,
                skill_code="grammar.article",
                exercise_type="fix_sentence" if index % 2 == 0 else "fill_blank",
                score=90 + index,
                is_correct=True,
                attempt_id=f"att_grad_{uuid.uuid4().hex[:10]}",
                created_at=attempt_at.isoformat().replace("+00:00", "Z"),
                mastery=90,
            )

        resolved = get_memory(user_id, graduating["id"])
        assert resolved and resolved["status"] == "resolved", resolved
        assert resolved["graduation"]["eligible"] is True
        assert all(resolved["graduation"]["criteria"].values())
        pack = retrieve_memory_pack(
            user_id,
            "article weakness singular noun",
            token_budget=200,
            limit=8,
            purpose="test_resolved_suppression",
        )
        assert graduating["id"] not in [item["id"] for item in pack["items"]]

        reopened = remember_candidates(
            user_id,
            [graduation_candidate],
            source_type="diagnosis",
            source_id="relapse-source",
        )[0]
        assert reopened["id"] == graduating["id"]
        assert reopened["status"] == "active"
        assert reopened["reopenedCount"] == 1
        assert reopened["graduation"]["eligible"] is False

        # Exercise the practice-error relapse path independently of diagnosis.
        stored = get_memory(user_id, graduating["id"])
        assert stored
        stored["status"] = "resolved"
        stored["resolvedAt"] = practice_now.isoformat().replace("+00:00", "Z")
        stored["resolutionReason"] = "spaced-evidence-v1"
        save_memory(stored)
        relapse_attempt = f"att_relapse_{uuid.uuid4().hex[:10]}"
        record_practice_outcome_memory(
            user_id=user_id,
            skill_code="grammar.article",
            exercise_type="rewrite_sentence",
            score=45,
            is_correct=False,
            attempt_id=relapse_attempt,
            created_at=datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            mastery=80,
        )
        practice_reopened = get_memory(user_id, graduating["id"])
        assert practice_reopened and practice_reopened["status"] == "active"
        assert practice_reopened["reopenedCount"] == 2
        assert practice_reopened["sourceId"] == relapse_attempt
        print("5. weakness graduation    -> resolved after spaced evidence; diagnosis/practice relapse reopens")

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
        print("6. source retraction      -> corroborated memory survives, final source forgets")

        # 7. Every active weakness gets a compact, auditable overview while
        # only a few query-relevant records spend tokens on detailed evidence.
        layered_user_id = f"memory-layered-{uuid.uuid4().hex[:8]}"
        weakness_codes = [
            "grammar.article",
            "grammar.verb_tense",
            "grammar.preposition",
            "grammar.subject_verb_agreement",
            "vocab.word_choice",
            "sentence.structure",
            "discourse.coherence",
            "clarity.expression",
        ]
        remember_candidates(
            layered_user_id,
            [
                MemoryCandidate(
                    kind="weakness",
                    canonicalKey=f"weakness.{code}",
                    content=f"The learner needs recurring practice with {code}.",
                    evidence=f"Original {index} → corrected {index}",
                    confidence=0.9,
                    importance=0.75 + index / 100,
                )
                for index, code in enumerate(weakness_codes)
            ],
            source_type="diagnosis",
            source_id="layered-retrieval-source",
        )
        layered_pack = retrieve_memory_pack(
            layered_user_id,
            "Plan practice for articles, verb tense, prepositions, and expression clarity.",
            token_budget=700,
            limit=6,
            purpose="diagnosis",
        )
        overview = layered_pack["weaknessOverview"]
        assert overview["totalActive"] == len(weakness_codes), overview
        assert overview["includedCount"] == len(weakness_codes), overview
        assert overview["complete"] is True, overview
        assert overview["format"] in {"metrics", "index"}, overview
        assert all(code in layered_pack["text"] for code in weakness_codes), layered_pack["text"]
        detailed_weaknesses = [
            item for item in layered_pack["items"] if item.get("kind") == "weakness"
        ]
        assert 1 <= len(detailed_weaknesses) <= 3, detailed_weaknesses
        assert layered_pack["text"].count(" Evidence: ") == len(detailed_weaknesses)
        assert layered_pack["estimatedTokens"] <= layered_pack["tokenBudget"]
        layered_trace = list_memory_traces(layered_user_id, limit=1)[0]
        assert layered_trace["weaknessOverview"]["complete"] is True
        assert len(layered_trace["weaknessOverview"]["memoryIds"]) == len(weakness_codes)

        tiny_pack = retrieve_memory_pack(
            layered_user_id,
            "weakness profile",
            token_budget=100,
            limit=1,
            purpose="diagnosis",
            record_trace=False,
        )
        assert tiny_pack["estimatedTokens"] <= 100
        assert tiny_pack["weaknessOverview"]["complete"] is False
        assert tiny_pack["weaknessOverview"]["includedCount"] < len(weakness_codes)
        assert "+" in tiny_pack["text"] and "more" in tiny_pack["text"]

        chat_pack = retrieve_memory_pack(
            layered_user_id,
            "Let's have a normal conversation about weekend plans.",
            token_budget=700,
            limit=6,
            purpose="chat",
        )
        assert chat_pack["weaknessOverview"]["suppressed"] is True
        assert chat_pack["weaknessOverview"]["includedCount"] == 0
        assert all(code not in chat_pack["text"] for code in weakness_codes)
        assert not any(item.get("kind") == "weakness" for item in chat_pack["items"])
        print("7. layered weakness recall -> all compactly indexed; <=3 detailed; chat suppressed")

        # 8. API surface supports learner-owned create/edit/retrieve/forget and
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
        print("8. Memory API             -> create/edit/retrieve/trace/forget passed")

        traces = list_memory_traces(user_id, limit=10)
        assert traces and traces[0].get("selected") is not None
        active_count = sum(m.get("status") == "active" for m in list_memories(user_id, limit=300))
        print(f"\nMEMORYAGENT TESTS PASSED ✅  ({active_count} active memories, {len(traces)} traces)")
        return 0
    finally:
        mock.stop()


if __name__ == "__main__":
    raise SystemExit(main())
