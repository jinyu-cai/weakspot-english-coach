"""Small reproducible benchmark for Track 1 MemoryAgent claims.

Default is deterministic lexical fallback (no external calls):

    DYNAMODB_ENDPOINT_URL= uv run python -m scripts.memory_benchmark

To exercise live Qwen text-embedding-v4 retrieval, set
MEMORY_BENCHMARK_LIVE=1 and configure QWEN_MODEL_STUDIO_API_KEY.
"""

import json
import os
from datetime import datetime, timedelta, timezone
import uuid


def main() -> int:
    live = os.getenv("MEMORY_BENCHMARK_LIVE", "0") == "1"
    os.environ["AWS_ACCESS_KEY_ID"] = "testing"
    os.environ["AWS_SECRET_ACCESS_KEY"] = "testing"
    os.environ["AWS_REGION"] = "us-east-1"
    os.environ["AWS_DEFAULT_REGION"] = "us-east-1"
    os.environ["DYNAMODB_ENDPOINT_URL"] = ""
    os.environ["USE_FAKE_AI"] = "false" if live else "true"

    import moto

    mock = moto.mock_aws()
    mock.start()
    try:
        from app.config import settings
        from app.db.repositories import save_memory
        from app.models.memory import MemoryCandidate
        from app.services.memory_service import estimate_tokens, remember_candidates, retrieve_memory_pack
        from scripts.create_table import create_table

        create_table()
        user_id = f"benchmark-{uuid.uuid4().hex[:8]}"
        fixtures = [
            MemoryCandidate(
                kind="goal",
                canonicalKey="goal.exam.ielts",
                content="The learner's goal is IELTS writing band 7, with special focus on Task 2 arguments.",
                evidence="I want band 7 in IELTS writing.",
                confidence=0.98,
                importance=0.98,
            ),
            MemoryCandidate(
                kind="preference",
                canonicalKey="preference.feedback_style",
                content="The learner prefers concise feedback with one example per correction.",
                evidence="Keep feedback brief and show one example.",
                confidence=0.97,
                importance=0.92,
            ),
            MemoryCandidate(
                kind="preference",
                canonicalKey="preference.learning_focus",
                content="The learner wants business English for meetings, negotiation, and stakeholder updates.",
                evidence="I need business English for work meetings.",
                confidence=0.94,
                importance=0.86,
            ),
            MemoryCandidate(
                kind="weakness",
                canonicalKey="weakness.grammar.article",
                content="The learner repeatedly omits English articles before singular countable nouns.",
                evidence="I bought new laptop → I bought a new laptop.",
                confidence=0.9,
                importance=0.84,
            ),
            MemoryCandidate(
                kind="strategy",
                canonicalKey="strategy.practice.sentence.structure.rewrite_sentence",
                content="Rewrite-sentence practice for sentence structure stays near the productive 74-point difficulty range.",
                evidence="Five attempts averaged 74/100.",
                confidence=0.86,
                importance=0.78,
            ),
        ]
        fixtures.extend(
            MemoryCandidate(
                kind="episode",
                canonicalKey=f"episode.decoy.{index}",
                content=(
                    f"Routine learning event {index}: the learner completed a general vocabulary activity "
                    "with ordinary results and no durable change in stated preferences or goals."
                ),
                evidence=f"Synthetic decoy {index}.",
                confidence=0.8,
                importance=0.25,
                expiresInDays=30,
            )
            for index in range(30)
        )
        remember_candidates(
            user_id,
            fixtures,
            source_type="system",
            source_id="benchmark-fixtures",
        )

        past = datetime.now(timezone.utc) - timedelta(days=2)
        for memory_id, status in (("mem_stale_expired", "active"), ("mem_stale_superseded", "superseded")):
            save_memory({
                "id": memory_id,
                "userId": user_id,
                "kind": "goal",
                "canonicalKey": f"goal.stale.{status}",
                "content": "Stale IELTS writing memory that must never be recalled.",
                "evidence": "Synthetic stale item.",
                "confidence": 1.0,
                "importance": 1.0,
                "status": status,
                "pinned": False,
                "sourceType": "system",
                "sourceId": "benchmark",
                "observationCount": 1,
                "accessCount": 0,
                "createdAt": past.isoformat().replace("+00:00", "Z"),
                "updatedAt": past.isoformat().replace("+00:00", "Z"),
                "expiresAt": past.isoformat().replace("+00:00", "Z") if status == "active" else None,
                "ttl": int((past + timedelta(days=30)).timestamp()),
            })

        cases = [
            ("Build an IELTS Task 2 writing plan for band 7", "goal.exam.ielts"),
            ("How should the coach format correction feedback?", "preference.feedback_style"),
            ("Practice business meetings and stakeholder updates", "preference.learning_focus"),
            ("I keep missing a and the before singular nouns", "weakness.grammar.article"),
            ("Choose a sentence structure rewrite exercise using past performance", "strategy.practice.sentence.structure.rewrite_sentence"),
        ]
        hits = 0
        packs = []
        stale_ids = {"mem_stale_expired", "mem_stale_superseded"}
        stale_selected: set[str] = set()
        for query, expected_key in cases:
            pack = retrieve_memory_pack(
                user_id,
                query,
                token_budget=220,
                limit=6,
                purpose="benchmark",
            )
            packs.append(pack)
            selected_keys = {item.get("canonicalKey") for item in pack["items"]}
            selected_ids = {item.get("id") for item in pack["items"]}
            hits += int(expected_key in selected_keys)
            stale_selected.update(stale_ids & selected_ids)

        raw_context = "\n".join(candidate.content for candidate in fixtures)
        raw_tokens = estimate_tokens(raw_context)
        average_pack_tokens = round(sum(pack["estimatedTokens"] for pack in packs) / len(packs), 1)
        recall_at_6 = round(hits / len(cases), 3)
        context_reduction = round(1 - average_pack_tokens / raw_tokens, 3)
        budget_compliance = all(pack["estimatedTokens"] <= pack["tokenBudget"] for pack in packs)
        stale_suppression = not stale_selected

        result = {
            "mode": "qwen-text-embedding-v4" if live and settings.qwen_model_studio_api_key else "lexical-fallback",
            "cases": len(cases),
            "recallAt6": recall_at_6,
            "staleSuppression": stale_suppression,
            "budgetCompliance": budget_compliance,
            "rawHistoryEstimatedTokens": raw_tokens,
            "averageMemoryPackTokens": average_pack_tokens,
            "contextReduction": context_reduction,
            "tokenBudget": 220,
        }
        print(json.dumps(result, indent=2))

        assert recall_at_6 >= 0.8, result
        assert stale_suppression, result
        assert budget_compliance, result
        assert context_reduction >= 0.5, result
        print("\nMEMORY BENCHMARK PASSED ✅")
        return 0
    finally:
        mock.stop()


if __name__ == "__main__":
    raise SystemExit(main())
