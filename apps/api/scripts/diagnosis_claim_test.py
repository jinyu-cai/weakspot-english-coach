"""Concurrency contract for diagnosis claims and deterministic retry state."""

from __future__ import annotations

import os
import time
from concurrent.futures import ThreadPoolExecutor
from types import SimpleNamespace
from unittest.mock import patch

os.environ.setdefault("USE_FAKE_AI", "true")
os.environ.setdefault("OWNER_BYPASS_TOKEN", "diagnosis-claim-owner")

from scripts.postgres_test import mock_postgres


TEXT = (
    "Yesterday I go to the office and explain my idea, but the manager did not understand it clearly."
)


def main() -> int:
    with mock_postgres():
        from fastapi.testclient import TestClient

        from app.api.routes import diagnose as diagnose_route
        from app.db.repositories import (
            claim_diagnosis_request,
            get_submission_hash,
        )
        from app.main import app
        from scripts.create_table import create_table

        create_table()
        client = TestClient(app, headers={"X-Owner-Token": "diagnosis-claim-owner"})
        original = diagnose_route.diagnose_english_text

        def slow_diagnosis(*args, **kwargs):
            time.sleep(0.2)
            return original(*args, **kwargs)

        def submit():
            return client.post("/api/v1/diagnose", json={"userId": "ignored", "text": TEXT})

        with patch.object(diagnose_route, "diagnose_english_text", side_effect=slow_diagnosis):
            with ThreadPoolExecutor(max_workers=2) as pool:
                responses = list(pool.map(lambda _index: submit(), range(2)))

        statuses = sorted(response.status_code for response in responses)
        assert statuses == [200, 409], statuses
        completed = next(response for response in responses if response.status_code == 200).json()
        assert completed["profile"]["totalSubmissions"] == 1

        retry = submit()
        assert retry.status_code == 200, retry.text
        assert retry.json()["duplicate"] is True
        assert retry.json()["profile"]["totalSubmissions"] == 1

        # Claim cleanup belongs to the background worker, not to the streaming
        # response consumer. A browser may disconnect before future.result()
        # is read; the next request must still be able to acquire immediately
        # after a worker failure instead of waiting for the stale-claim window.
        failed_user = "diagnosis-disconnect-user"
        failed_hash = "en:diagnosis-disconnect-hash"
        failed_claim_id = "failed-worker-claim"
        failed_claim = claim_diagnosis_request(
            failed_user,
            failed_hash,
            failed_claim_id,
        )
        assert failed_claim["claimState"] == "acquired"
        with patch.object(
            diagnose_route,
            "_llm_and_persist",
            side_effect=RuntimeError("simulated disconnected worker failure"),
        ):
            try:
                diagnose_route._run_diagnosis_job(
                    SimpleNamespace(userId=failed_user),
                    {},
                    failed_hash,
                    failed_claim_id,
                    0.0,
                    "deep",
                    None,
                    None,
                    failed_claim,
                )
            except RuntimeError as exc:
                assert "simulated disconnected" in str(exc)
            else:
                raise AssertionError("the simulated worker failure must propagate")

        failed_marker = get_submission_hash(failed_user, failed_hash)
        assert failed_marker["status"] == "failed", failed_marker
        recovered_claim = claim_diagnosis_request(
            failed_user,
            failed_hash,
            "recovered-worker-claim",
        )
        assert recovered_claim["claimState"] == "acquired", recovered_claim

    print("DIAGNOSIS CLAIM TESTS PASSED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
