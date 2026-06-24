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
import time
import asyncio
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
        os.environ.setdefault("OWNER_BYPASS_TOKEN", "itest-owner-token")
        os.environ.setdefault("GUEST_DAILY_LIMIT", "3")
        os.environ.setdefault("USER_DAILY_LIMIT", "20")
        os.environ.setdefault("SESSION_SECRET", "itest-session-secret")
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
        from starlette.requests import Request

        from app.api.deps import _client_ip, make_session_jwt
        from app.config import settings
        from app.db.repositories import list_chat_messages, update_chat_session_fields
        from app.main import app
        from app.services.realtime_sideband import RealtimeSidebandState, _handle_realtime_event
        from scripts.create_table import create_table

        print(
            f"  endpoint_url={settings.dynamodb_endpoint_url or '(default AWS)'}  "
            f"table={settings.dynamodb_table}  use_fake_ai={settings.use_fake_ai}\n"
        )

        create_table()  # idempotent

        client = TestClient(app, headers={"X-Owner-Token": "itest-owner-token"})
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

        # 7. daily stats
        r = client.get(f"/api/v1/stats/daily/{user}?timezone=America/Los_Angeles&days=7")
        assert r.status_code == 200, r.text
        stats = r.json()
        assert stats["timezone"] == "America/Los_Angeles", stats
        assert len(stats["weekly"]) == 7, stats
        assert stats["summary"]["totalCheckins"] >= 1, stats
        assert stats["summary"]["totalPracticeAttempts"] >= 1, stats
        assert stats["achievements"], stats
        print(
            "7. GET  /stats/daily       -> "
            f"{stats['summary']['activeDays']} active days, streak {stats['summary']['streakDays']}"
        )

        from app.services.stats_service import local_date_for

        assert local_date_for("2026-06-20T06:30:00+00:00", "America/Los_Angeles") == "2026-06-19"
        assert local_date_for("2026-06-20T06:30:00+00:00", "UTC") == "2026-06-20"
        print("   timezone day boundary    -> UTC evening maps to prior LA day")

        # 8. ChatGPT conversation import analysis
        r = client.post(
            "/api/v1/chat-import/analyze",
            json={
                "userId": user,
                "sourceName": "integration-conversations.json",
                "analysisMode": "fast",
                "conversations": [
                    {
                        "id": "chat-1",
                        "title": "English practice",
                        "messages": [
                            {"role": "user", "text": "Yesterday I go to school. 这个怎么自然表达？"},
                            {"role": "assistant", "text": "You should say: Yesterday I went to school."},
                            {"role": "user", "text": "How can I say 我的表达不自然 in English?"},
                            {"role": "assistant", "text": "You can say: My phrasing sounds unnatural."},
                        ],
                    }
                ],
            },
        )
        assert r.status_code == 200, r.text
        imported = r.json()
        assert imported["analysis"]["weaknesses"], imported
        assert imported["savedErrors"], imported
        assert imported["updatedSkills"], imported
        assert imported["importStats"]["conversationCount"] == 1, imported["importStats"]
        print(
            "8. POST /chat-import/analyze -> "
            f"{len(imported['analysis']['weaknesses'])} weaknesses, "
            f"{len(imported['updatedSkills'])} skills updated"
        )

        # 9. Text and voice model selection
        from app.api.routes import chat as chat_routes
        from app.api.routes import realtime as realtime_routes
        from app.models.chat import ChatReplyAI

        original_chat_reply = chat_routes.chat_reply
        selected_text_models = []

        def fake_chat_reply(*, model=None, **kwargs):
            selected_text_models.append(model)
            return ChatReplyAI(reply="Model routing test reply.", corrections=[], betterExpression=None)

        chat_routes.chat_reply = fake_chat_reply
        try:
            r = client.post("/api/v1/chat/sessions", json={"userId": user, "topic": "Default text model"})
            assert r.status_code == 200, r.text
            default_model_session = r.json()["session"]
            assert default_model_session["textModel"] == "deepseek-v4-flash", default_model_session
            r = client.post(
                "/api/v1/chat/send",
                json={"userId": user, "sessionId": default_model_session["id"], "text": "Hello from Flash."},
            )
            assert r.status_code == 200, r.text
            assert selected_text_models[-1] == "deepseek-v4-flash", selected_text_models

            r = client.post(
                "/api/v1/chat/sessions",
                json={"userId": user, "topic": "Pro text model", "textModel": "deepseek-v4-pro"},
            )
            assert r.status_code == 200, r.text
            pro_model_session = r.json()["session"]
            assert pro_model_session["textModel"] == "deepseek-v4-pro", pro_model_session
            r = client.post(
                "/api/v1/chat/send",
                json={"userId": user, "sessionId": pro_model_session["id"], "text": "Hello from Pro."},
            )
            assert r.status_code == 200, r.text
            assert selected_text_models[-1] == "deepseek-v4-pro", selected_text_models

            r = client.post(
                "/api/v1/chat/sessions",
                json={"userId": user, "topic": "Bad model", "textModel": "deepseek-v4-bad"},
            )
            assert r.status_code == 400, r.text
        finally:
            chat_routes.chat_reply = original_chat_reply

        original_openai_key = settings.openai_api_key
        original_realtime_post = realtime_routes.httpx.post
        original_start_sideband = realtime_routes.start_realtime_sideband
        original_kick_realtime = realtime_routes.kick_realtime_session
        selected_voice_models = []
        session_expires_at = []
        owner_voice_session_id = None
        sideband_calls = []
        kick_calls = []

        class FakeRealtimeResponse:
            def raise_for_status(self):
                return None

            def json(self):
                return {"value": "ephemeral-test-secret"}

        def fake_realtime_post(url, *, headers, json, timeout):
            selected_voice_models.append(json["session"]["model"])
            session_expires_at.append(json["session"].get("expires_at"))
            return FakeRealtimeResponse()

        async def fake_start_sideband(*, user_id, session_id, call_id, max_duration_seconds):
            sideband_calls.append((user_id, session_id, call_id, max_duration_seconds))
            update_chat_session_fields(
                user_id,
                session_id,
                {
                    "realtimeCallId": call_id,
                    "realtimeStatus": "monitoring",
                    "realtimeEventCount": 2,
                    "realtimeResponseCount": 1,
                    "realtimeUsageEventCount": 1,
                    "realtimeUsage": {
                        "totalTokens": 42,
                        "inputTokens": 30,
                        "outputTokens": 12,
                        "inputTextTokens": 8,
                        "inputAudioTokens": 22,
                        "inputCachedTokens": 0,
                        "outputTextTokens": 5,
                        "outputAudioTokens": 7,
                        "responses": 1,
                    },
                },
            )
            return {"sidebandStatus": "starting", "activeSideband": True}

        async def fake_kick_realtime(*, user_id, session_id, reason="manual"):
            kick_calls.append((user_id, session_id, reason))
            update_chat_session_fields(
                user_id,
                session_id,
                {
                    "realtimeStatus": "kick_sent",
                    "realtimeKickReason": reason,
                },
            )
            return {"kickRequested": True, "activeSideband": True, "kickSent": True}

        settings.openai_api_key = "test-openai-key"
        realtime_routes.httpx.post = fake_realtime_post
        realtime_routes.start_realtime_sideband = fake_start_sideband
        realtime_routes.kick_realtime_session = fake_kick_realtime
        try:
            for voice_model in ["gpt-realtime-mini-2025-12-15", "gpt-realtime-2"]:
                r = client.post(
                    "/api/v1/chat/realtime/session",
                    json={"userId": user, "topic": "Voice model test", "model": voice_model},
                )
                assert r.status_code == 200, r.text
                realtime_session = r.json()
                assert realtime_session["clientSecret"] == "ephemeral-test-secret", realtime_session
                assert realtime_session["model"] == voice_model, realtime_session
                assert realtime_session["maxDurationSeconds"] is None, realtime_session
                owner_voice_session_id = realtime_session["sessionId"]

            r = client.post(
                f"/api/v1/chat/realtime/{owner_voice_session_id}/sideband",
                json={"callId": "rtc_integration_test"},
            )
            assert r.status_code == 200, r.text
            sideband_attached = r.json()
            assert sideband_attached["sidebandStatus"] == "starting", sideband_attached

            r = client.get(f"/api/v1/chat/realtime/{owner_voice_session_id}/audit")
            assert r.status_code == 200, r.text
            audit = r.json()
            assert audit["audit"]["realtimeCallId"] == "rtc_integration_test", audit
            assert audit["audit"]["realtimeUsage"]["totalTokens"] == 42, audit

            transcript_state = RealtimeSidebandState(
                user_id="owner",
                session_id=owner_voice_session_id,
                call_id="rtc_integration_test",
                max_duration_seconds=None,
            )
            asyncio.run(
                _handle_realtime_event(
                    transcript_state,
                    {
                        "type": "conversation.item.input_audio_transcription.completed",
                        "item_id": "input_item_1",
                        "transcript": "I go to school yesterday.",
                    },
                )
            )
            asyncio.run(
                _handle_realtime_event(
                    transcript_state,
                    {
                        "type": "response.audio_transcript.delta",
                        "response_id": "resp_1",
                        "item_id": "output_item_1",
                        "delta": "You went",
                    },
                )
            )
            asyncio.run(
                _handle_realtime_event(
                    transcript_state,
                    {
                        "type": "response.audio_transcript.delta",
                        "response_id": "resp_1",
                        "item_id": "output_item_1",
                        "delta": " to school yesterday.",
                    },
                )
            )
            asyncio.run(
                _handle_realtime_event(
                    transcript_state,
                    {
                        "type": "response.audio_transcript.done",
                        "response_id": "resp_1",
                        "item_id": "output_item_1",
                    },
                )
            )
            voice_messages = list_chat_messages("owner", owner_voice_session_id)
            assert [msg["role"] for msg in voice_messages] == ["user", "assistant"], voice_messages
            assert voice_messages[0]["content"] == "I go to school yesterday.", voice_messages
            assert voice_messages[1]["content"] == "You went to school yesterday.", voice_messages

            r = client.post(
                f"/api/v1/chat/sessions/{owner_voice_session_id}/transcript",
                json={
                    "userId": "owner",
                    "messages": [
                        {"role": "user", "content": "I go to school yesterday."},
                        {"role": "assistant", "content": "You went to school yesterday."},
                    ],
                },
            )
            assert r.status_code == 200, r.text
            transcript_save = r.json()
            assert transcript_save["saved"] == 0 and transcript_save["skippedDuplicates"] == 2, transcript_save

            r = client.post(
                f"/api/v1/chat/realtime/{owner_voice_session_id}/kick",
                json={"reason": "integration_test"},
            )
            assert r.status_code == 200, r.text
            kicked = r.json()
            assert kicked["kickRequested"] is True and kicked["kickSent"] is True, kicked

            guest_voice = TestClient(app)
            before_guest_voice = int(time.time())
            r = guest_voice.post(
                "/api/v1/chat/realtime/session",
                json={"userId": "guest-voice", "topic": "Guest voice model test"},
            )
            assert r.status_code == 200, r.text
            guest_voice_session = r.json()
            assert guest_voice_session["maxDurationSeconds"] == settings.guest_realtime_max_seconds
            assert before_guest_voice < guest_voice_session["expiresAt"] <= int(time.time()) + settings.guest_realtime_max_seconds + 2

            r = client.post(
                "/api/v1/chat/realtime/session",
                json={"userId": user, "topic": "Bad voice model", "model": "gpt-realtime-bad"},
            )
            assert r.status_code == 400, r.text
        finally:
            settings.openai_api_key = original_openai_key
            realtime_routes.httpx.post = original_realtime_post
            realtime_routes.start_realtime_sideband = original_start_sideband
            realtime_routes.kick_realtime_session = original_kick_realtime

        assert selected_voice_models == [
            "gpt-realtime-mini-2025-12-15",
            "gpt-realtime-2",
            "gpt-realtime-mini-2025-12-15",
        ], selected_voice_models
        assert session_expires_at[0:2] == [None, None], session_expires_at
        assert isinstance(session_expires_at[2], int), session_expires_at
        assert sideband_calls and sideband_calls[0][2] == "rtc_integration_test", sideband_calls
        assert kick_calls and kick_calls[0][2] == "integration_test", kick_calls
        print(
            "9. POST /chat model routing -> text/pro + realtime expiry + sideband transcript/audit/kick validated"
        )

        # 10. End-of-session chat analysis
        r = client.post("/api/v1/chat/sessions", json={"userId": user, "topic": "Free conversation"})
        assert r.status_code == 200, r.text
        chat_session = r.json()["session"]
        for text in [
            "I go to the park yesterday and the weather was very good.",
            "I want explain my idea more natural.",
        ]:
            r = client.post(
                "/api/v1/chat/send",
                json={"userId": user, "sessionId": chat_session["id"], "text": text},
            )
            assert r.status_code == 200, r.text

        r = client.post(f"/api/v1/chat/sessions/{chat_session['id']}/analyze")
        assert r.status_code == 200, r.text
        chat_analysis = r.json()
        assert chat_analysis["analysis"]["corrections"], chat_analysis
        assert chat_analysis["savedErrors"], chat_analysis
        assert chat_analysis["savedNotes"], chat_analysis
        assert chat_analysis["updatedSkills"], chat_analysis

        r = client.get(f"/api/v1/history/{user}")
        assert r.status_code == 200, r.text
        errors_after_first_analysis = len(r.json()["errors"])

        r = client.post(f"/api/v1/chat/sessions/{chat_session['id']}/analyze")
        assert r.status_code == 200, r.text
        duplicate_analysis = r.json()
        assert duplicate_analysis.get("duplicate") is True, duplicate_analysis

        r = client.get(f"/api/v1/history/{user}")
        assert r.status_code == 200, r.text
        assert len(r.json()["errors"]) == errors_after_first_analysis, "duplicate analysis should not add errors"
        print(
            "10. POST /chat/sessions/{id}/analyze -> "
            f"{len(chat_analysis['savedErrors'])} errors, "
            f"{len(chat_analysis['savedNotes'])} notes, duplicate-safe"
        )

        print(f"\nFULL LOOP PASSED ✅  (test user {user})")
        if use_moto:
            print("\n--- auth + rate limiting ---")
            guest = TestClient(app)
            me = guest.get("/api/v1/auth/me")
            assert me.status_code == 200 and me.json().get("authenticated") is False, me.text
            print("10. GET /auth/me (no cookie)   -> authenticated: false")
            spoofed_scope = {
                "type": "http",
                "method": "GET",
                "path": "/",
                "headers": [
                    (b"x-forwarded-for", b"1.2.3.4, 203.0.113.8"),
                    (b"x-real-ip", b"203.0.113.8"),
                ],
                "client": ("127.0.0.1", 12345),
                "server": ("testserver", 80),
                "scheme": "http",
                "query_string": b"",
            }
            assert _client_ip(Request(spoofed_scope)) == "203.0.113.8"
            print("11. proxy IP resolution      -> X-Real-IP wins over spoofed XFF")
            gtext = "I has many problem with my english grammar and I want to improve it very fast."
            codes = [guest.post("/api/v1/diagnose", json={"userId": "g", "text": gtext}).status_code for _ in range(4)]
            assert codes == [200, 200, 200, 429], codes
            blocked = guest.post("/api/v1/diagnose", json={"userId": "g", "text": gtext})
            assert blocked.json()["detail"]["code"] == "rate_limited", blocked.text
            print(f"12. guest diagnose x4         -> {codes}  (4th = 429: login required)")
            ocodes = [client.post("/api/v1/diagnose", json={"userId": "o", "text": gtext}).status_code for _ in range(5)]
            assert all(c == 200 for c in ocodes), ocodes
            print(f"13. owner diagnose x5 (bypass)-> {ocodes}  (never blocked)")

            denied = guest.post("/api/v1/admin/access-roles", json={"identifier": "member@example.com", "role": "member"})
            assert denied.status_code == 403, denied.text

            grant = client.post(
                "/api/v1/admin/access-roles",
                json={"identifier": "member@example.com", "role": "member"},
            )
            assert grant.status_code == 200, grant.text
            assert grant.json()["accessRole"]["role"] == "member", grant.text

            member = TestClient(app)
            member.cookies.set(
                "session",
                make_session_jwt({"sub": "google_member", "login": "member@example.com"}),
            )
            member_me = member.get("/api/v1/auth/me")
            assert member_me.status_code == 200 and member_me.json()["accessTier"] == "member", member_me.text
            mcodes = [member.post("/api/v1/diagnose", json={"userId": "m", "text": gtext}).status_code for _ in range(5)]
            assert all(c == 200 for c in mcodes), mcodes
            print("14. DB member role          -> accessTier=member, never blocked")

        return 0
    finally:
        if mock is not None:
            mock.stop()


if __name__ == "__main__":
    raise SystemExit(main())
