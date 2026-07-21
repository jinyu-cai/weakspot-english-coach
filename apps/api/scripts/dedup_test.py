"""Local test for de-dup + manual history deletion (with weakness-model reversal).

Runs in-process with moto (mock AWS) + fake AI — no Docker, AWS, or LLM key:

    uv run python -m scripts.dedup_test

Asserts:
  - Re-submitting the SAME text is detected as a duplicate and does NOT re-record
    errors or move skill mastery (so accidental resubmissions can't inflate it).
  - A DIFFERENT text is still recorded (a real, separately-counted data point).
  - Deleting a submission removes its errors and Notebook notes, then rolls
    back its skill penalties.
  - Deleting also clears the de-dup marker, so the text can be diagnosed fresh.
  - Contextual vocabulary uses context-aware hashes: the same answer in the same
    situation de-dups, while the same wording in a different situation is a new
    transfer observation.
"""

import os
import sys
import uuid

SAMPLE = (
    "Yesterday I go to my university and I meet my friend. We talk about our project, "
    "but I feel my English is not very good. I always use simple words."
)
DIFFERENT = "She walk to the store and she buyed three apple for her mother last week."


def _sum_error_count(skills: list) -> int:
    return sum(int(s.get("errorCount", 0)) for s in skills)


def main() -> int:
    os.environ.setdefault("AWS_ACCESS_KEY_ID", "testing")
    os.environ.setdefault("AWS_SECRET_ACCESS_KEY", "testing")
    os.environ.setdefault("AWS_REGION", "us-east-1")
    os.environ.setdefault("AWS_DEFAULT_REGION", "us-east-1")
    os.environ.setdefault("USE_FAKE_AI", "true")
    os.environ.setdefault("OWNER_BYPASS_TOKEN", "dedup-owner-token")
    os.environ.setdefault(
        "SESSION_SECRET", "dedup-test-session-secret-at-least-32-bytes"
    )

    try:
        import moto
    except ImportError:
        print("moto is not installed. Run `uv sync`.", file=sys.stderr)
        return 1

    mock = moto.mock_aws()
    mock.start()
    try:
        from fastapi.testclient import TestClient

        from app.main import app
        from scripts.create_table import create_table

        create_table()
        client = TestClient(app, headers={"X-Owner-Token": "dedup-owner-token"})
        user = f"dedup-{uuid.uuid4().hex[:8]}"

        # 1. First diagnosis of SAMPLE — recorded.
        r = client.post("/api/v1/diagnose", json={"userId": user, "text": SAMPLE})
        assert r.status_code == 200, r.text
        d1 = r.json()
        assert d1.get("duplicate") is False, "first submission must not be a duplicate"
        n1 = len(d1["diagnostic"]["errors"])
        note_count_1 = len(d1["notes"])
        assert note_count_1 > 0, "fake diagnosis should create Notebook notes"
        sub1_id = d1["submission"]["id"]
        sub1_created = d1["submission"]["createdAt"]
        ec_after_1 = _sum_error_count(client.get(f"/api/v1/profile/{user}").json()["skills"])
        print(f"1. diagnose SAMPLE          -> {n1} errors, totalSubmissions={d1['profile']['totalSubmissions']}, sum(errorCount)={ec_after_1}")
        assert d1["profile"]["totalSubmissions"] == 1

        # 2. Re-submit the SAME text — duplicate, nothing re-recorded.
        r = client.post("/api/v1/diagnose", json={"userId": user, "text": SAMPLE})
        assert r.status_code == 200, r.text
        d2 = r.json()
        assert d2.get("duplicate") is True, "identical resubmission must be flagged duplicate"
        assert d2["updatedSkills"] == [], "duplicate must not update skills"
        assert d2["duplicateOf"] == sub1_id
        assert d2["profile"]["totalSubmissions"] == 1, "duplicate must not bump totalSubmissions"
        ec_after_2 = _sum_error_count(client.get(f"/api/v1/profile/{user}").json()["skills"])
        assert ec_after_2 == ec_after_1, f"duplicate inflated error counts: {ec_after_1} -> {ec_after_2}"
        # whitespace/case variation also de-dups
        r = client.post("/api/v1/diagnose", json={"userId": user, "text": "  " + SAMPLE.upper() + "  "})
        assert r.json().get("duplicate") is True, "whitespace/case variant should still de-dup"
        print(f"2. resubmit SAME (x2)       -> duplicate=True, skills unchanged (sum still {ec_after_2}) ✅")

        # 3. A DIFFERENT text — recorded as its own data point.
        r = client.post("/api/v1/diagnose", json={"userId": user, "text": DIFFERENT})
        assert r.status_code == 200, r.text
        d3 = r.json()
        assert d3.get("duplicate") is False, "different text must be recorded"
        n3 = len(d3["diagnostic"]["errors"])
        ec_after_3 = _sum_error_count(client.get(f"/api/v1/profile/{user}").json()["skills"])
        assert d3["profile"]["totalSubmissions"] == 2
        assert ec_after_3 == ec_after_1 + n3, f"different text not counted: {ec_after_3} != {ec_after_1}+{n3}"
        print(f"3. diagnose DIFFERENT       -> duplicate=False, totalSubmissions=2, sum(errorCount)={ec_after_3} ✅")

        # 4. Delete submission #1 — removes its errors and reverses its skill penalties.
        r = client.delete(f"/api/v1/history/{sub1_id}", params={"createdAt": sub1_created})
        assert r.status_code == 200, r.text
        dele = r.json()
        assert dele["deleted"] is True and dele["removedErrors"] == n1, dele
        assert dele["removedNotes"] == note_count_1, dele
        ec_after_del = _sum_error_count(client.get(f"/api/v1/profile/{user}").json()["skills"])
        assert ec_after_del == ec_after_3 - n1, f"reversal wrong: {ec_after_del} != {ec_after_3}-{n1}"
        hist = client.get(f"/api/v1/history/{user}").json()
        assert all(s["id"] != sub1_id for s in hist["submissions"]), "deleted submission still in history"
        assert all(n.get("submissionId") != sub1_id for n in hist["notes"]), "deleted submission notes still exist"
        assert hist["profile"]["totalSubmissions"] == 1 if "profile" in hist else True
        print(
            "4. delete submission #1     -> "
            f"removedErrors={dele['removedErrors']}, removedNotes={dele['removedNotes']}, "
            f"sum(errorCount) {ec_after_3}->{ec_after_del}, gone from history ✅"
        )

        # 5. The deleted text is no longer a duplicate (marker cleared).
        r = client.post("/api/v1/diagnose", json={"userId": user, "text": SAMPLE})
        assert r.json().get("duplicate") is False, "after deletion the text should diagnose fresh"
        print("5. re-diagnose deleted text -> duplicate=False (marker cleared) ✅")

        # 6. Context is part of the hash for honest cross-situation transfer checks.
        contextual_text = "I will send the revised project file to you at three this afternoon."
        context_a = "Audience: teammate. Goal: explain a two-hour delay. Tone: accountable."
        context_b = "Audience: customer. Goal: confirm the final delivery time. Tone: formal."
        first_context = client.post(
            "/api/v1/diagnose",
            json={"userId": user, "text": contextual_text, "analysisContext": context_a},
        ).json()
        repeated_context = client.post(
            "/api/v1/diagnose",
            json={"userId": user, "text": contextual_text, "analysisContext": context_a},
        ).json()
        transferred_context = client.post(
            "/api/v1/diagnose",
            json={"userId": user, "text": contextual_text, "analysisContext": context_b},
        ).json()
        assert first_context.get("duplicate") is False
        assert repeated_context.get("duplicate") is True
        assert transferred_context.get("duplicate") is False
        assert transferred_context["submission"]["analysisContext"] == context_b
        print("6. contextual de-dup       -> same context dedups; new context records transfer ✅")

        print("\nDEDUP + DELETE TESTS PASSED ✅")
        return 0
    finally:
        mock.stop()


if __name__ == "__main__":
    raise SystemExit(main())
