# WeakSpot English Coach — Backend (FastAPI)

FastAPI service that owns AI calls, DynamoDB access, the learner
profile, plan generation, and practice grading. Deployed on a Linux server
behind Nginx/HTTPS. The Vercel frontend talks to it over `/api/v1`.

Dependencies are managed with [uv](https://docs.astral.sh/uv/) via
`pyproject.toml` + `uv.lock`. Python is pinned to 3.11 (`.python-version`).

## Local setup

```bash
cd apps/api
uv sync                       # creates .venv (Python 3.11) + installs from the lockfile
cp .env.example .env          # then fill in real keys
```

Required `.env` values: text-model provider config (`DEEPSEEK_API_KEY` or
`OPENAI_COMPAT_*`), `OPENAI_API_KEY` for realtime voice, AWS creds +
`DYNAMODB_TABLE`, and `CORS_ORIGINS` (include your Vercel URL). See
`.env.example`.

Managing dependencies: `uv add <pkg>` / `uv remove <pkg>` (updates the lockfile);
`uv lock --upgrade` to bump. Need a `requirements.txt`? `uv export -o requirements.txt`.

## Verify without secrets (offline)

```bash
uv run python -m scripts.smoke_test          # imports + schemas + validation
uv run python -m scripts.integration_test    # full loop end-to-end (moto + fake AI)
```

The integration test drives diagnose → profile → plan → practice → history in-process
with a mock AWS (moto) and canned AI — no Docker, no AWS, no DeepSeek key. See the
repo-root **`LOCAL_TESTING.md`** for the full tier-by-tier local + front/back guide.

## Create the DynamoDB table (needs AWS creds)

```bash
uv run python -m scripts.create_table   # idempotent; single table, PK + SK string keys
```

## Run

```bash
uv run uvicorn app.main:app --reload --port 8000
curl http://localhost:8000/api/v1/health      # -> {"status":"ok"}
```

Interactive docs at `http://localhost:8000/docs`.

## Endpoints (`/api/v1`)

```
GET  /health
POST /diagnose                 { userId, text }
GET  /profile/{user_id}
POST /plan                     { userId }
GET  /plan/{user_id}
POST /practice/generate        { userId, targetSkillCode? }
POST /practice/submit          { userId, exerciseId, userAnswer }
GET  /history/{user_id}
GET  /stats/daily/{user_id}?timezone=<IANA timezone>&days=7
POST /chat/sessions
POST /chat/send
POST /chat/predict
POST /chat/sessions/{session_id}/analyze
POST /chat/realtime/session
```

## Deploy (Linux)

```bash
docker compose up -d --build
curl http://localhost:8000/api/v1/health
```

Then put Nginx in front and issue HTTPS with Certbot (see root project docs /
`development.md` §19). The frontend's `NEXT_PUBLIC_API_BASE_URL` must point at
the HTTPS backend domain, and that domain must be listed in `CORS_ORIGINS`.

## AI client note (OpenAI-compatible / BYOK)

The backend uses the OpenAI Python SDK against an OpenAI-compatible chat
completions API. DeepSeek is the default deployment provider, but new
deployments can also use provider-neutral env vars:

```bash
OPENAI_COMPAT_API_KEY=...
OPENAI_COMPAT_BASE_URL=https://api.openai.com/v1
OPENAI_COMPAT_MODEL=your_chat_model
OPENAI_COMPAT_FAST_MODEL=your_fast_chat_model
```

The app also supports per-request BYOK for OpenAI-compatible providers. Send:

```text
X-LLM-API-Key: ...
X-LLM-Base-URL: https://api.openai.com/v1
X-LLM-Model: your_chat_model
X-LLM-Fast-Model: your_fast_chat_model  # optional
```

The request-scoped key is used only for that API call and is not stored in
DynamoDB. The client uses JSON mode (`response_format={"type":"json_object"}`) +
Pydantic validation + one retry, which works across providers that support the
OpenAI-compatible chat completions shape.

Realtime voice is separate from the text provider. Configure
`OPENAI_API_KEY` and optionally `OPENAI_REALTIME_MODEL`; the backend exchanges
the server key for short-lived Realtime client secrets so the browser never sees
the real OpenAI key.

## Diagnose request debugging

`POST /api/v1/diagnose` accepts `diagnosisMode: "fast" | "deep"`. Fast mode uses
`OPENAI_COMPAT_FAST_MODEL` / `LLM_MODEL_FAST` when the server default provider is
used, and falls back to the deep model if no fast model is configured.

```bash
curl -v -X POST http://localhost:8000/api/v1/diagnose \
  -H 'content-type: application/json' \
  -d '{"userId":"demo-user-001","diagnosisMode":"fast","text":"Yesterday I go to school and I meet my friend. I always use simple words."}'
```

The response includes `X-Request-ID`, `X-Diagnose-Mode`, and `X-LLM-Model`.
Search the backend logs for `diagnose[REQUEST_ID]` or `llm[REQUEST_ID]` to see
profile-load time, upstream LLM time, JSON validation status, persistence time,
provider status codes, and retry failures.

If the provider returns malformed JSON and you need to inspect a short preview,
set `LLM_DEBUG_LOG_CONTENT=true` temporarily. Leave it off in normal use because
the preview can contain user-submitted writing.
