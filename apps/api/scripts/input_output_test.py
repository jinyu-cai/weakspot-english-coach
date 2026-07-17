"""Deterministic test for input-to-output and delayed retrieval evidence."""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from uuid import uuid4

os.environ.setdefault("DYNAMODB_ENDPOINT_URL", "")
os.environ.setdefault("USE_FAKE_AI", "true")

from moto import mock_aws

from app.db.repositories import get_input_learning_source, save_input_learning_source
from app.models.input_learning import AnalyzeInputLearningRequest, SubmitInputLearningAttemptRequest
from app.services.input_learning_service import analyze_input_learning, submit_input_learning_attempt
from app.services.learning_service import learning_overview
from scripts.create_table import create_table


def main() -> int:
    with mock_aws():
        create_table()
        user_id = f"input-output-{uuid4().hex[:8]}"
        source = analyze_input_learning(
            user_id,
            AnalyzeInputLearningRequest(
                sourceType="work",
                title="Team update",
                content=(
                    "The team decided to raise a concern about the timeline. "
                    "It turns out that the client needs a clearer proposal before Friday."
                ),
                targetItemCount=3,
            ),
        )
        assert source["productionAttemptCount"] == 0
        untouched = next(
            row for row in learning_overview(user_id)["states"]
            if row["skillCode"] == "vocab.word_choice"
        )
        assert untouched["coverageStatus"] == "unassessed"

        expressions = [item["expression"] for item in source["items"][:2]]
        retell_text = (
            f"The update explained that {expressions[0]} mattered to the team. "
            "They needed a clearer plan, so they discussed the deadline and agreed to respond before Friday with better details."
        )
        retell = submit_input_learning_attempt(
            user_id,
            source["id"],
            SubmitInputLearningAttemptRequest(
                kind="retell",
                responseText=retell_text,
                clientAttemptId="retell-attempt-001",
                hintUsed=True,
            ),
        )
        assert retell["passed"] is True
        assert retell["evidence"]["event"]["outcome"] == "hinted_success"

        reuse = submit_input_learning_attempt(
            user_id,
            source["id"],
            SubmitInputLearningAttemptRequest(
                kind="required_reuse",
                responseText=f"I can use {expressions[0]} and {expressions[1]} naturally in this new workplace message today.",
                targetItemIds=[item["id"] for item in source["items"][:2]],
                clientAttemptId="required-reuse-001",
                hintUsed=True,
            ),
        )
        assert reuse["passed"] is True
        assert reuse["countedAsDelayed"] is False

        stored = get_input_learning_source(user_id, source["id"])
        assert stored is not None
        stored["delayedReviewDueAt"] = (
            datetime.now(timezone.utc) - timedelta(minutes=1)
        ).isoformat().replace("+00:00", "Z")
        save_input_learning_source(stored)
        delayed_text = (
            f"Yesterday I remembered {expressions[0]} and {expressions[1]}, then used both in a different conversation with my manager."
        )
        delayed_request = SubmitInputLearningAttemptRequest(
            kind="delayed_retrieval",
            responseText=delayed_text,
            clientAttemptId="delayed-retrieval-001",
        )
        delayed = submit_input_learning_attempt(user_id, source["id"], delayed_request)
        assert delayed["passed"] is True and delayed["countedAsDelayed"] is True
        duplicate = submit_input_learning_attempt(user_id, source["id"], delayed_request)
        assert duplicate["duplicate"] is True
        vocab = next(
            row for row in learning_overview(user_id)["states"]
            if row["skillCode"] == "vocab.word_choice"
        )
        assert vocab["delayedIndependentTransferCount"] == 1

    print("INPUT OUTPUT TESTS PASSED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
