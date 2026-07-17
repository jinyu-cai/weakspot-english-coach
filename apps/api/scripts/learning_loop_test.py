"""Deterministic contract test for unified activity and evidence state."""

from __future__ import annotations

import os
from uuid import uuid4

os.environ.setdefault("DYNAMODB_ENDPOINT_URL", "")

from moto import mock_aws

from app.models.learning import (
    CreateActivityRunRequest,
    RecordEvidenceRequest,
    UpdateActivityRunRequest,
)
from app.services.learning_service import (
    create_activity_run,
    learning_overview,
    record_evidence,
    update_activity_run,
)
from scripts.create_table import create_table


def main() -> int:
    with mock_aws():
        create_table()
        user_id = f"learning-loop-{uuid4().hex[:8]}"
        run = create_activity_run(
            user_id,
            CreateActivityRunRequest(
                activityType="coach",
                sourceId="mission-test",
                title="A test mission",
                taskType="decision_response",
                targetSkills=["grammar.article"],
                modality="text",
                difficulty="normal",
                estimatedMinutes=5,
            ),
        )
        assert run["status"] == "assigned"
        started = update_activity_run(
            user_id,
            run["id"],
            UpdateActivityRunRequest(status="started", hintLevel=1),
        )
        assert started["status"] == "started" and started["startedAt"]

        no_opportunity = record_evidence(
            user_id,
            RecordEvidenceRequest(
                clientEventId="event-no-opportunity",
                runId=run["id"],
                skillCode="grammar.article",
                outcome="no_opportunity",
                opportunityPresent=False,
                modality="text",
                taskType="decision_response",
            ),
        )
        assert no_opportunity["state"]["coverageStatus"] == "unassessed"
        assert no_opportunity["state"]["abilityMean"] is None
        assert no_opportunity["state"]["noOpportunityCount"] == 1

        first = record_evidence(
            user_id,
            RecordEvidenceRequest(
                clientEventId="event-assisted-success",
                runId=run["id"],
                skillCode="grammar.article",
                outcome="success",
                opportunityPresent=True,
                supportLevel=2,
                modality="text",
                taskType="decision_response",
                contextKey="workplace",
                evidenceQuote="I sent the updated agenda.",
            ),
        )
        assert first["event"]["outcome"] == "hinted_success"
        assert first["state"]["hintedSuccessCount"] == 1
        assert first["state"]["independentSuccessCount"] == 0
        duplicate = record_evidence(
            user_id,
            RecordEvidenceRequest(
                clientEventId="event-assisted-success",
                runId=run["id"],
                skillCode="grammar.article",
                outcome="success",
                opportunityPresent=True,
                supportLevel=2,
                modality="text",
                taskType="decision_response",
                contextKey="workplace",
            ),
        )
        assert duplicate["duplicate"] is True
        assert duplicate["state"]["opportunityCount"] == 1

        for index, outcome in enumerate(("success", "failure", "success", "success"), start=1):
            result = record_evidence(
                user_id,
                RecordEvidenceRequest(
                    clientEventId=f"event-more-{index}",
                    runId=run["id"],
                    skillCode="grammar.article",
                    outcome=outcome,
                    opportunityPresent=True,
                    supportLevel=0,
                    modality="text" if index < 3 else "voice",
                    taskType="guided_scene" if index % 2 else "picture_story",
                    contextKey="travel" if index > 1 else "workplace",
                    delayed=index == 4,
                    novelContext=index == 4,
                ),
            )

        state = result["state"]
        assert state["coverageStatus"] == "enough_evidence"
        assert state["opportunityCount"] == 5
        assert state["delayedIndependentTransferCount"] == 1
        assert state["abilityMean"] is not None
        assert state["abilityUncertainty"] < 1

        completed = update_activity_run(
            user_id,
            run["id"],
            UpdateActivityRunRequest(
                status="completed",
                hintLevel=2,
                attemptCount=2,
                completedCriteria=[0, 1],
            ),
        )
        assert completed["completedAt"] and completed["hintLevel"] == 2
        overview = learning_overview(user_id)
        article = next(row for row in overview["states"] if row["skillCode"] == "grammar.article")
        unassessed = next(row for row in overview["states"] if row["skillCode"] == "style.register")
        assert article["coverageStatus"] == "enough_evidence"
        assert unassessed["coverageStatus"] == "unassessed" and unassessed["abilityMean"] is None

    print("LEARNING LOOP TESTS PASSED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
