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

Common production `.env` values are: at least one text-model provider profile
(`QWEN_MODEL_STUDIO_*`, `OPENAI_COMPAT_*`, or the backwards-compatible
`DEEPSEEK_*` variables), AWS credentials/role + `DYNAMODB_TABLE`, and
`CORS_ORIGINS` (include your Vercel URL). Add `OPENAI_API_KEY` only when realtime
voice is enabled, and add OAuth/session values when login is enabled. See
`.env.example`.

Managing dependencies: `uv add <pkg>` / `uv remove <pkg>` (updates the lockfile);
`uv lock --upgrade` to bump. Need a `requirements.txt`? `uv export -o requirements.txt`.

## Verify without secrets (offline)

```bash
uv run python -m scripts.smoke_test          # imports + schemas + validation
uv run python -m scripts.integration_test    # full loop end-to-end (moto + fake AI)
uv run python -m scripts.memory_agent_test   # lifecycle/graduation/relapse/API/decision
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
POST /diagnose                 # writing diagnosis, notes, mastery, and memory
GET  /profile/{user_id}
POST /plan
GET  /plan/{user_id}
POST /practice/generate
POST /practice/submit
POST /practice/grade           # ad-hoc grading for plan exercises
GET  /history/{user_id}
DELETE /history/{submission_id}
GET  /notes
DELETE /notes/{note_id}
GET  /stats/daily/{user_id}?timezone=<IANA timezone>&days=7

POST /chat/sessions
GET  /chat/sessions
GET  /chat/sessions/{session_id}/messages
POST /chat/send
POST /chat/predict
POST /chat/sessions/{session_id}/analyze
POST /chat/sessions/{session_id}/transcript
POST /chat/realtime/session
POST /chat/realtime/{session_id}/sideband
GET  /chat/realtime/{session_id}/audit
POST /chat/realtime/{session_id}/kick
POST /chat-import/analyze

GET  /memory?status=active|resolved|superseded|expired|forgotten|all
POST /memory
PATCH /memory/{memory_id}
DELETE /memory/{memory_id}
POST /memory/retrieve
GET  /memory/traces
GET  /memory/next-action

GET  /auth/github/login
GET  /auth/github/callback
GET  /auth/google/login
GET  /auth/google/callback
GET  /auth/me
POST /auth/logout

GET  /admin/access-roles                   # owner only
GET  /admin/access-roles/{identifier}      # owner only
POST /admin/access-roles                   # owner only
DELETE /admin/access-roles/{identifier}    # owner only
```

Treat this as a route index, not a substitute for the generated OpenAPI docs.
Run the backend and open `http://localhost:8000/docs` for exact request schemas.

Weakness memories use evidence-based graduation rather than a one-answer
delete rule. Five attempts across at least three days and 14 days, stable recent
scores, mastery >= 85, two successful exercise formats, and 14 recurrence-free
days are all required. The row then becomes `resolved` and stops being recalled;
fresh evidence for the same weakness reactivates the same row.

## Deploy (Linux)

```bash
docker compose up -d --build
curl http://localhost:8000/api/v1/health
```

Then put Nginx in front and issue HTTPS with Certbot (see `DEPLOY.md` and
[`../../docs/ALIBABA_QWEN_DEPLOYMENT.md`](../../docs/ALIBABA_QWEN_DEPLOYMENT.md)).
The frontend's `NEXT_PUBLIC_API_BASE_URL` must point at
the HTTPS backend domain, and that domain must be listed in `CORS_ORIGINS`.

## AI client note (OpenAI-compatible / BYOK)

The backend uses the OpenAI Python SDK against an OpenAI-compatible chat
completions API. The primary production deployment uses Qwen Model Studio;
provider-neutral and backwards-compatible DeepSeek settings remain available.
Provider-neutral deployments can use:

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
returns a safe catalog of selectable IDs, modes, and display labels. The
browser can independently select one deep model and one fast model, for
example:

```text
X-LLM-Server-Deep-Model: qwen-deep
X-LLM-Server-Fast-Model: deepseek-fast
```

The server resolves that ID to its matching key, endpoint, and exact model. No
provider credentials or base URLs are returned to the browser. Qwen Max for
deep work plus Qwen Plus for fast work is the default. Each slot can instead
use its matching DeepSeek model, including mixed Qwen/DeepSeek combinations.
The built-in selector applies to text features (diagnosis, plans, practice,
imports, and new text chats). Text-chat sessions retain their chosen pair so a
later browser selection does not change an existing session. The legacy
`X-LLM-Server-Model` single-model header remains supported for older clients.

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

Text chat and prediction use the saved fast slot. End-of-session analysis uses
the saved deep slot. Users can choose both before starting a new text chat.

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
