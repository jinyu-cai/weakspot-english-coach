# WeakSpot English Coach — Backend (FastAPI)

FastAPI service that owns AI calls, DynamoDB access, the learner
profile, persistent MemoryAgent, plan generation, and practice grading. Deployed on a Linux server
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
uv run python -m scripts.memory_agent_test   # memory merge/conflict/expiry/API/decision
uv run python -m scripts.memory_benchmark    # recall, stale suppression, context budget
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
GET  /llm/models               # public model labels/IDs; never returns keys or base URLs
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
GET  /memory?status=active|all
POST /memory
PATCH /memory/{memory_id}
DELETE /memory/{memory_id}
POST /memory/retrieve
GET  /memory/traces
GET  /memory/next-action
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

For Alibaba Cloud Model Studio, set the Qwen 3.7 profile instead. The backend
uses `qwen3.7-max` for deep analysis and `qwen3.7-plus` for fast paths:

```bash
QWEN_MODEL_STUDIO_API_KEY=...
QWEN_MODEL_STUDIO_BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1
QWEN_MODEL_STUDIO_MODEL=qwen3.7-max
QWEN_MODEL_STUDIO_FAST_MODEL=qwen3.7-plus
QWEN_EMBEDDING_MODEL=text-embedding-v4
QWEN_EMBEDDING_DIMENSIONS=256
```

The MemoryAgent uses the embedding model for hybrid semantic/lexical retrieval
and automatically falls back to lexical scoring when embeddings are
unavailable. Its default Memory Pack is bounded to six memories and 700
estimated tokens. See
[`../../docs/MEMORY_AGENT_DESIGN.md`](../../docs/MEMORY_AGENT_DESIGN.md).

Use the base URL that matches the Model Studio workspace and API key. See
[`../../docs/ALIBABA_QWEN_DEPLOYMENT.md`](../../docs/ALIBABA_QWEN_DEPLOYMENT.md)
for the Alibaba Cloud deployment runbook and regional endpoints.

### Server-managed model selection

When one or more server providers are configured, `GET /api/v1/llm/models`
returns a safe catalog of selectable IDs and display labels. The browser sends
only an ID, for example:

```text
X-LLM-Server-Model: qwen-deep
```

The server resolves that ID to its matching key, endpoint, and exact model. No
provider credentials or base URLs are returned to the browser. The built-in
selector applies to text features (diagnosis, plans, practice, imports, and
new text chats). `default` keeps adaptive fast/deep routing; an explicit choice
uses that exact model for the request. Text-chat sessions retain their chosen
server model so a later browser selection does not change an existing session.

With both DeepSeek and Qwen configured, the catalog exposes each configured
model. Removing a provider removes its choices; old chat sessions safely fall
back to the current server default instead of sending a model name to the wrong
provider.

The app also supports per-request BYOK for OpenAI-compatible providers. Send:

```text
X-LLM-API-Key: ...
X-LLM-Base-URL: https://api.openai.com/v1
X-LLM-Model: your_chat_model
X-LLM-Fast-Model: your_fast_chat_model  # optional
```

The request-scoped key is used only for that API call and is not stored in
DynamoDB. BYOK endpoints must use HTTPS and remain subject to the normal
account rate and size limits. The client uses JSON mode
(`response_format={"type":"json_object"}`) + Pydantic validation + one retry,
which works across providers that support the OpenAI-compatible chat
completions shape.

Realtime voice is separate from the text provider. Configure
`OPENAI_API_KEY`, optionally `OPENAI_REALTIME_MODEL`, and
`OPENAI_REALTIME_MODELS` for the allowed voice-model selector; the backend
exchanges the server key for short-lived Realtime client secrets so the browser
never sees the real OpenAI key.

Text chat uses the server fast model by default. A user can choose an available
server model before starting a new text chat; prediction and end-of-session
analysis stay with that saved model.

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
