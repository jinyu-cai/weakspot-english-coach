"""Local end-to-end integration test — drives the FULL learner loop in-process.

diagnose -> profile -> plan -> practice/generate -> practice/submit -> history,
asserting the learner profile actually accumulates across calls.

Default (zero external services): in-process mock AWS (moto) + fake AI.
No Docker, no AWS, no DeepSeek key:

    uv run python -m scripts.integration_test

Against your real/local DynamoDB instead of moto (set USE_MOTO=0; AI then follows
USE_FAKE_AI / your DeepSeek key):

    USE_MOTO=0 DYNAMODB_ENDPOINT_URL=http://localhost:8001 \
      AWS_ACCESS_KEY_ID=local AWS_SECRET_ACCESS_KEY=local USE_FAKE_AI=true \
      uv run python -m scripts.integration_test
"""

import os
import sys
import uuid

SAMPLE = (
    "Yesterday I go to my university and I meet my friend. We talk about our project, "
    "but I feel my English is not very good. I always use simple words and I cannot "
    "explain my idea clearly."
)


def main() -> int:
    use_moto = os.getenv("USE_MOTO", "1") != "0" and not os.getenv("DYNAMODB_ENDPOINT_URL")

    mock = None
    if use_moto:
        os.environ.setdefault("AWS_ACCESS_KEY_ID", "testing")
        os.environ.setdefault("AWS_SECRET_ACCESS_KEY", "testing")
        os.environ.setdefault("AWS_REGION", "us-east-1")
        os.environ.setdefault("AWS_DEFAULT_REGION", "us-east-1")
        os.environ.setdefault("USE_FAKE_AI", "true")
        try:
            import moto
        except ImportError:
            print(
                "moto is not installed. Run `uv sync` (it's a dev dependency), "
                "or use USE_MOTO=0 against a real/local DynamoDB.",
                file=sys.stderr,
            )
            return 1
        mock = moto.mock_aws()
        mock.start()
        print("Mode: in-process moto (mock AWS) + fake AI — no external services.")
    else:
        print("Mode: real/local DynamoDB (USE_MOTO=0).")

    try:
        # Import AFTER env + moto are active (the module-level boto3 resource binds here).
        from fastapi.testclient import TestClient

        from app.config import settings
        from app.main import app
        from scripts.create_table import create_table

        print(
            f"  endpoint_url={settings.dynamodb_endpoint_url or '(default AWS)'}  "
            f"table={settings.dynamodb_table}  use_fake_ai={settings.use_fake_ai}\n"
        )

        create_table()  # idempotent

        client = TestClient(app)
        user = f"test-{uuid.uuid4().hex[:8]}"

        # 1. diagnose
        r = client.post("/api/v1/diagnose", json={"userId": user, "text": SAMPLE})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["diagnostic"]["errors"], "expected at least one error"
        assert d["updatedSkills"], "expected skill updates"
        assert d["profile"]["totalSubmissions"] == 1, d["profile"]
        print(
            f"1. POST /diagnose          -> {len(d['diagnostic']['errors'])} errors, "
            f"CEFR {d['diagnostic']['cefrEstimate']}, score {d['diagnostic']['overallScore']}"
        )

        # 2. profile
        r = client.get(f"/api/v1/profile/{user}")
        assert r.status_code == 200, r.text
        p = r.json()
        assert p["skills"], "expected skills"
        weakest = min(p["skills"], key=lambda s: s["mastery"])
        print(
            f"2. GET  /profile           -> {len(p['skills'])} skills, "
            f"weakest = {weakest['skillCode']} (mastery {weakest['mastery']})"
        )

        # 3. plan
        r = client.post("/api/v1/plan", json={"userId": user})
        assert r.status_code == 200, r.text
        plan = r.json()["plan"]
        assert plan["days"], "expected plan days"
        print(f"3. POST /plan              -> '{plan['title']}', {len(plan['days'])} days")

        r = client.get(f"/api/v1/plan/{user}")
        assert r.json()["plan"], "expected active plan"
        print("   GET  /plan/{user}       -> active plan present")

        # 4. practice generate
        r = client.post("/api/v1/practice/generate", json={"userId": user})
        assert r.status_code == 200, r.text
        ex = r.json()["exercise"]
        assert ex["question"], "expected a question"
        print(f"4. POST /practice/generate -> skill {ex['targetSkillCode']}, type {ex['type']}")

        # 5. practice submit
        r = client.post(
            "/api/v1/practice/submit",
            json={"userId": user, "exerciseId": ex["id"], "userAnswer": ex.get("answer") or "test"},
        )
        assert r.status_code == 200, r.text
        g = r.json()
        assert "grade" in g and "updatedSkill" in g, g
        print(
            f"5. POST /practice/submit   -> score {g['grade']['score']}, "
            f"mastery {ex['targetSkillCode']} now {g['updatedSkill']['mastery']}"
        )

        # 6. history
        r = client.get(f"/api/v1/history/{user}")
        assert r.status_code == 200, r.text
        h = r.json()
        assert h["submissions"] and h["errors"], h
        print(
            f"6. GET  /history           -> {len(h['submissions'])} submissions, "
            f"{len(h['errors'])} errors"
        )

        print(f"\nFULL LOOP PASSED ✅  (test user {user})")
        return 0
    finally:
        if mock is not None:
            mock.stop()


if __name__ == "__main__":
    raise SystemExit(main())
