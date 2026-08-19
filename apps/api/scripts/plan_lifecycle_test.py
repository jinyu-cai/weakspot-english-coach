"""Server-owned Plan progress and just-in-time child exercise contract."""

from __future__ import annotations

import os
from copy import deepcopy
from unittest.mock import patch

os.environ.setdefault("USE_FAKE_AI", "true")
os.environ.setdefault("OWNER_BYPASS_TOKEN", "plan-lifecycle-owner")

from scripts.postgres_test import mock_postgres


def main() -> int:
    with mock_postgres():
        from fastapi.testclient import TestClient

        from app.db.repositories import (
            PlanProgressConflictError,
            get_active_plan,
            get_activity_run,
            list_activity_runs,
            save_active_plan,
            save_plan_with_activity_run,
        )
        from app.models.learning import CreateActivityRunRequest
        from app.services.learning_service import build_activity_run
        from app.main import app
        from scripts.create_table import create_table

        create_table()
        client = TestClient(app, headers={"X-Owner-Token": "plan-lifecycle-owner"})
        generated = client.post("/api/v1/plan", json={"userId": "ignored"})
        assert generated.status_code == 200, generated.text
        plan = generated.json()["plan"]
        task = plan["days"][0]["tasks"][0]
        run_id = task["activityRunId"]
        assert task["status"] == "assigned"

        started = client.patch(f"/api/v1/plan/tasks/{task['id']}", json={"status": "started"})
        assert started.status_code == 200, started.text
        assert started.json()["task"]["status"] == "started"

        child = client.post(
            "/api/v1/practice/generate",
            json={
                "userId": "ignored",
                "targetSkillCode": plan["days"][0]["targetSkillCodes"][0],
                "practiceType": task["practiceType"],
                "sessionId": "plan-session-001",
                "sequenceIndex": 0,
                "parentRunId": run_id,
            },
        )
        assert child.status_code == 200, child.text
        child_run = get_activity_run("owner", child.json()["exercise"]["activityRunId"])
        assert child_run and child_run["parentRunId"] == run_id

        # Resetting a started task is a fresh attempt. The Plan and replacement
        # run must land atomically, while the historical run is closed.
        reset = client.patch(
            f"/api/v1/plan/tasks/{task['id']}",
            json={"status": "assigned"},
        )
        assert reset.status_code == 200, reset.text
        reset_task = reset.json()["task"]
        reset_run_id = reset_task["activityRunId"]
        assert reset_run_id != run_id
        assert reset_task["status"] == "assigned"
        assert get_activity_run("owner", reset_run_id)["status"] == "assigned"
        assert get_activity_run("owner", run_id)["status"] == "abandoned"
        assert get_activity_run("owner", run_id)["abandonReason"] == (
            "Plan task reset for a new attempt."
        )

        restarted = client.patch(
            f"/api/v1/plan/tasks/{task['id']}",
            json={"status": "started"},
        )
        assert restarted.status_code == 200, restarted.text
        assert restarted.json()["task"]["activityRunId"] == reset_run_id
        assert get_activity_run("owner", reset_run_id)["status"] == "started"

        skipped = client.patch(
            f"/api/v1/plan/tasks/{task['id']}",
            json={"status": "skipped"},
        )
        assert skipped.status_code == 200, skipped.text
        assert skipped.json()["task"]["status"] == "skipped"
        assert get_activity_run("owner", reset_run_id)["status"] == "skipped"

        # Terminal attempts reopen on a new run. This used to save the Plan
        # first and then fail the immutable skipped/completed run transition.
        reopened_from_skip = client.patch(
            f"/api/v1/plan/tasks/{task['id']}",
            json={"status": "started"},
        )
        assert reopened_from_skip.status_code == 200, reopened_from_skip.text
        reopened_from_skip_task = reopened_from_skip.json()["task"]
        skip_replacement_id = reopened_from_skip_task["activityRunId"]
        assert skip_replacement_id != reset_run_id
        assert reopened_from_skip_task["status"] == "started"
        assert get_activity_run("owner", skip_replacement_id)["status"] == "started"
        assert get_activity_run("owner", reset_run_id)["status"] == "skipped"

        completed = client.patch(
            f"/api/v1/plan/tasks/{task['id']}",
            json={"status": "completed", "score": 88},
        )
        assert completed.status_code == 200, completed.text
        completed_plan = completed.json()["plan"]
        assert completed_plan["progress"]["completedTasks"] == 1
        assert get_activity_run("owner", skip_replacement_id)["status"] == "completed"

        reopened = client.patch(f"/api/v1/plan/tasks/{task['id']}", json={"status": "assigned"})
        assert reopened.status_code == 200, reopened.text
        reopened_task = reopened.json()["task"]
        assigned_after_completion_id = reopened_task["activityRunId"]
        assert assigned_after_completion_id != skip_replacement_id
        assert reopened_task["completed"] is False
        assert get_activity_run("owner", assigned_after_completion_id)["status"] == "assigned"
        assert get_activity_run("owner", skip_replacement_id)["status"] == "completed"

        completed_again = client.patch(
            f"/api/v1/plan/tasks/{task['id']}",
            json={"status": "completed", "score": 91},
        )
        assert completed_again.status_code == 200, completed_again.text
        assert get_activity_run("owner", assigned_after_completion_id)["status"] == "completed"

        reopened_started = client.patch(
            f"/api/v1/plan/tasks/{task['id']}",
            json={"status": "started"},
        )
        assert reopened_started.status_code == 200, reopened_started.text
        started_after_completion_id = reopened_started.json()["task"]["activityRunId"]
        assert started_after_completion_id != assigned_after_completion_id
        assert get_activity_run("owner", started_after_completion_id)["status"] == "started"

        completed_final = client.patch(
            f"/api/v1/plan/tasks/{task['id']}",
            json={"status": "completed"},
        )
        assert completed_final.status_code == 200, completed_final.text
        assert get_activity_run("owner", started_after_completion_id)["status"] == "completed"

        # Unsupported terminal-to-terminal rewrites are a controlled conflict
        # and cannot partially change the Plan.
        invalid = client.patch(
            f"/api/v1/plan/tasks/{task['id']}",
            json={"status": "skipped"},
        )
        assert invalid.status_code == 409, invalid.text
        persisted = get_active_plan("owner")
        persisted_task = persisted["days"][0]["tasks"][0]
        assert persisted_task["status"] == "completed"
        assert get_activity_run("owner", started_after_completion_id)["status"] == "completed"

        # A transaction conflict also leaves both aggregates untouched and
        # does not leak an unsaved replacement ActivityRun.
        before_plan = get_active_plan("owner")
        before_run_ids = {run["id"] for run in list_activity_runs("owner", limit=100)}
        with patch(
            "app.api.routes.plan.save_plan_with_activity_run",
            side_effect=PlanProgressConflictError("injected conflict"),
        ):
            conflicted = client.patch(
                f"/api/v1/plan/tasks/{task['id']}",
                json={"status": "assigned"},
            )
        assert conflicted.status_code == 409, conflicted.text
        assert get_active_plan("owner") == before_plan
        assert {run["id"] for run in list_activity_runs("owner", limit=100)} == before_run_ids

        # Exercise the repository's real optimistic-concurrency condition too:
        # a stale Plan version cancels the replacement run in the same write.
        expected_version = int(before_plan["version"])
        stale_candidate = deepcopy(before_plan)
        stale_replacement = build_activity_run(
            "owner",
            CreateActivityRunRequest(
                activityType="plan",
                sourceId=task["id"],
                title=task["titleZh"][:240],
                taskType=task["practiceType"],
                goal=plan["days"][0]["goalZh"],
                targetSkills=plan["days"][0]["targetSkillCodes"],
                modality="exercise",
                difficulty="day_1",
                estimatedMinutes=task["estimatedMinutes"],
            ),
        )
        stale_candidate["days"][0]["tasks"][0]["activityRunId"] = stale_replacement["id"]
        stale_candidate["days"][0]["tasks"][0]["status"] = "assigned"
        stale_candidate["days"][0]["tasks"][0]["completed"] = False
        stale_candidate["version"] = expected_version + 1

        concurrent_plan = deepcopy(before_plan)
        concurrent_plan["concurrencyMarker"] = "winner"
        concurrent_plan["version"] = expected_version + 1
        save_active_plan(concurrent_plan, expected_version=expected_version)
        try:
            save_plan_with_activity_run(
                stale_candidate,
                stale_replacement,
                expected_plan_version=expected_version,
                create_run=True,
            )
        except PlanProgressConflictError:
            pass
        else:
            raise AssertionError("Stale Plan update unexpectedly committed.")
        assert get_active_plan("owner")["concurrencyMarker"] == "winner"
        assert get_activity_run("owner", stale_replacement["id"]) is None

    print("PLAN LIFECYCLE TESTS PASSED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
