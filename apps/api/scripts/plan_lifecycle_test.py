"""Server-owned Plan progress and just-in-time child exercise contract."""

from __future__ import annotations

import os

os.environ.setdefault("DYNAMODB_ENDPOINT_URL", "")
os.environ.setdefault("USE_FAKE_AI", "true")
os.environ.setdefault("OWNER_BYPASS_TOKEN", "plan-lifecycle-owner")

from moto import mock_aws


def main() -> int:
    with mock_aws():
        from fastapi.testclient import TestClient

        from app.db.repositories import get_activity_run
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

        completed = client.patch(
            f"/api/v1/plan/tasks/{task['id']}",
            json={"status": "completed", "score": 88},
        )
        assert completed.status_code == 200, completed.text
        completed_plan = completed.json()["plan"]
        assert completed_plan["progress"]["completedTasks"] == 1
        assert get_activity_run("owner", run_id)["status"] == "completed"

        reopened = client.patch(f"/api/v1/plan/tasks/{task['id']}", json={"status": "assigned"})
        assert reopened.status_code == 200, reopened.text
        reopened_task = reopened.json()["task"]
        assert reopened_task["activityRunId"] != run_id
        assert reopened_task["completed"] is False

    print("PLAN LIFECYCLE TESTS PASSED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
