"""Concurrency contract for diagnosis claims and deterministic retry state."""

from __future__ import annotations

import os
import time
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch

os.environ.setdefault("DYNAMODB_ENDPOINT_URL", "")
os.environ.setdefault("USE_FAKE_AI", "true")
os.environ.setdefault("OWNER_BYPASS_TOKEN", "diagnosis-claim-owner")

from moto import mock_aws


TEXT = (
    "Yesterday I go to the office and explain my idea, but the manager did not understand it clearly."
)


def main() -> int:
    with mock_aws():
        from fastapi.testclient import TestClient

        from app.api.routes import diagnose as diagnose_route
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

    print("DIAGNOSIS CLAIM TESTS PASSED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
