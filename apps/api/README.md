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
`CORS_ORIGINS` (include your Vercel URL). Add `OPENAI_API_KEY` when realtime
voice or Coach AI speech is enabled, and add OAuth/session values when login is enabled. See
`.env.example`.

Managing dependencies: `uv add <pkg>` / `uv remove <pkg>` (updates the lockfile);
`uv lock --upgrade` to bump. Need a `requirements.txt`? `uv export -o requirements.txt`.

## Verify without secrets (offline)

```bash
uv run python -m scripts.smoke_test          # imports + schemas + validation
uv run python -m scripts.integration_test    # full loop end-to-end (moto + fake AI)
uv run python -m scripts.memory_agent_test   # lifecycle/graduation/relapse/API/decision
uv run python -m scripts.stealth_input_test  # stealth retention + grounded input + identity
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
GET  /chat/sessions                    # cursor-paged; pageSize is not a total cap
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

POST /coach/missions                  # generationMode=fast|deep (fast default)
POST /coach/speech                    # server-side OpenAI Speech API MP3
POST /coach/input-lab-2/transcript-missions # owner-only supplied transcript

GET  /memory?status=active|resolved|superseded|expired|forgotten|all
POST /memory
PATCH /memory/{memory_id}
DELETE /memory/{memory_id}
POST /memory/retrieve
GET  /memory/traces
GET  /memory/next-action
GET  /memory/stealth-next?modality=text_chat&topic=... # owner-only due-target QA preview

POST /input-learning/analyze       # grounded capture or pre-consumption attention mission
GET  /input-learning               # cursor-paged; pageSize is not a total cap
GET  /input-learning/{source_id}   # capture, grounded items, and optional mission
DELETE /input-learning/{source_id} # remove the learner-owned capture and derivatives

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

## History API

`GET /api/v1/history/{user_id}` returns every submission, correction, and note
owned by the server-resolved learner identity. There is no 20-item display cap:
submission and error repositories follow DynamoDB `LastEvaluatedKey` across all
query pages, while notes use the same unbounded pagination behavior documented
below. Other services may deliberately request a bounded recent subset for AI
context or dashboard summaries; that does not limit the learner-facing History.

Chat-session and Input Learning history use bounded cursor pages instead of one
ever-growing response. Their list responses include `nextCursor`; clients keep
following it until it is `null`. `pageSize` is only the per-request batch size
(maximum 100), not a lifetime or display limit. Invalid or cross-user cursors
are rejected, and browsing chat history does not consume a generative-chat
quota event. Chat pages use the `messageCount` maintained atomically on each
session; listing sessions never rescans `CHATMSG#`, `CHATBATCH#`, or
`CHATSTAGE#` transcript rows. A missing or invalid stored count is returned as
zero rather than triggering an archive scan.

For compatibility, `GET /input-learning?limit=N` still supports the legacy
one-page request with `N` from 1 through 200 and returns at most that explicit
number. New clients should use `pageSize` plus `nextCursor` for an archive with
no total limit. `limit` cannot be combined with `cursor` or `pageSize`; mixed
pagination modes return `400 ambiguous_pagination`.

## Notebook API and lifecycle

Notebook notes are generated by diagnoses, end-of-session chat analysis, and
ChatGPT imports. Their types are `expression`, `vocabulary`, and `grammar`.
Each row keeps its source in `submissionId` and is stored under
`NOTE#<createdAt>#<noteId>`, newest first.

`GET /api/v1/notes` returns all notes owned by the resolved server identity. It
has no item-count cap: the repository follows DynamoDB `LastEvaluatedKey` until
all query pages have been read. The normal account request-rate policy still
applies. In addition to the stored note fields, the response includes:

- `learningState`: `current` or `previous`;
- `relatedWeaknesses`: active/resolved weaknesses linked through the same
  diagnosis, import, or conversation source.

`previous` is a reversible view, not a destructive archive. It means the source
has at least one resolved weakness and no active weakness. Fresh error evidence
can reopen a weakness and move the same note back to `current` without rewriting
the note row.

There are two explicit deletion paths:

- `DELETE /notes/{note_id}?createdAt=...` permanently deletes that learner-owned
  note.
- `DELETE /history/{submission_id}?createdAt=...` is a confirmed manual action.
  It permanently deletes the submission, associated error rows, and associated
  Notebook notes; retracts the source from Memory; and returns both
  `removedErrors` and `removedNotes`.

Automatic weakness graduation only changes the weakness Memory to `resolved`;
it never calls either deletion path. Resolved notes remain reviewable because
the model can be wrong. Physical cleanup of old resolved notes is a possible
future retention policy and is not currently enabled.

Weakness memories use evidence-based graduation rather than a one-answer
delete rule. Five attempts across at least three days and 14 days, stable recent
scores, mastery >= 85, two successful exercise formats, and 14 recurrence-free
days are all required. The row then becomes `resolved` and stops being recalled;
fresh evidence for the same weakness reactivates the same row.

MemoryAgent also tracks retention and modality-specific evidence from stealth
missions. Text chat excludes weakness/strategy rows and low-relevance memories
from ordinary reply personalization. Text probes are event-driven rather than
assigned to fixed turn numbers: the current learner message must contain enough
spontaneous English, fit the selected skill, and respect a minimum cooldown
from the last confirmed opportunity. Translation, word-meaning, pronunciation,
and similar meta-language requests are answered directly without adding a
hidden check. Up to three *confirmed opportunities* may use different skills
and interaction moves in one session; this is a conversation-fatigue guardrail,
not the size of the skill pool. If the model skips an optional move because it
would sound unnatural, the candidate is not scored and consumes no confirmed
opportunity slot. A bounded private attempt record still applies the minimum
cooldown and rotates away from that skill and interaction move, preventing a
conservative model report from causing an immediate repeat.
When no unused due weakness fits the live message, the scheduler may instead
sample an under-observed skill family neutrally. A neutral sample is explicitly
not a known weakness: it records bounded modality coverage and interaction-move
statistics, but never changes mastery or creates a weakness by itself. A later
correction or weakness still needs exact learner evidence from end-session
analysis. A due weakness can be woven into normal chat, but an outcome is
recorded only after an opportunity gate establishes that the target was fairly
elicited and observable. Supported outcomes are `success`, `hinted_success`,
`failure`, `avoided`, and `no_opportunity`; the last outcome never changes attempts,
mastery, stability, or failure counts. Delayed unprompted success has the
strongest scheduling effect, while hinted success schedules a nearer cold
check. A no-op audit adds a 12-hour selection cooldown so the same unsuitable
target is not injected into every conversation. A fresh error after resolution reopens
the same weakness and advances
its next due check. See
[`../../docs/MEMORY_AGENT_DESIGN.md`](../../docs/MEMORY_AGENT_DESIGN.md) for the
full lifecycle and field semantics.

Stealth probes progress from `replay` to `variation` to `transfer` only after
independent cold success; visible exercises count as hinted evidence and cannot
advance that ladder. Memories separately track `candidate`, `observed`,
`confirmed`, and `contradicted` verification states. Candidate facts are
discounted in retrieval and explicitly marked for natural confirmation instead
of being asserted as known truth.

Same-batch memory candidates are coalesced by normalized canonical key. Each
text-chat target is assessed only against learner turns after its activation
and before the next target takes over. When a chat's ordinary correction
matches a scored stealth target, its evidence may
still merge but retention and modality counters are not decremented twice.
End-session analysis first persists an immutable model draft, then atomically
commits errors, notes, skill updates, and the final session result. A failed
finalization can retry without calling the model again or applying a
partial/double mastery penalty. Stealth and durable-memory write failures also
leave that draft retryable instead of finalizing with missing MemoryAgent
evidence. Text sends and realtime transcript uploads are rejected when their
session modality does not match. Realtime turns carry stable client message IDs
so upload retries are idempotent without collapsing two legitimate identical
utterances. A text send owns a short-lived session turn claim; its user and
assistant messages plus summary commit in one transaction. End-session analysis
claims the session before reading its snapshot, so it cannot omit a reply that
is still being generated or leave a lone user message after an AI failure.
Realtime transcript uploads use the same turn claim. Large uploads are packed
below DynamoDB item and 4 MB transaction budgets, staged with a 24-hour cleanup
TTL, and made visible only when one final transaction removes those TTLs,
publishes the commit marker, updates the session, and releases the claim.

Canonical Memory read-modify-write operations use a learner-scoped, re-entrant
`MEMORY_WRITE` lease with stale-writer fencing. Independent sources therefore
merge serially from the latest row instead of overwriting one another's source
references or verification evidence. Input Learning memory writes check both
the source-processing claim and the Memory lease in the same transaction.

`POST /practice/submit` and `POST /practice/grade` accept `clientAttemptId`.
The browser reuses it after a failed network response. The server stores a
stable attempt ID, processing claim, immutable grade draft, and final response;
attempt, error, skill, profile, strategy, weakness, and guided-retention effects
are idempotent, so a retry neither re-grades nor rewards/penalizes twice.

## Input Learning API

`POST /api/v1/input-learning/analyze` accepts authentic material the learner
encountered or a topic they plan to consume:

```json
{
  "sourceType": "series",
  "title": "A scene from a workplace comedy",
  "content": "I wanted to run that by you before we commit.",
  "notes": "I want useful meeting English.",
  "goal": "Use natural phrases in project updates.",
  "targetItemCount": 6,
  "outputLanguage": "en"
}
```

`content` or `transcript` creates `mode: "grounded_capture"`. Extracted items
have kind `word`, `phrase`, `collocation`, `grammar_pattern`, `pronunciation`,
or `culture`. A grounded item includes `sourceEvidence`, which must be an exact
substring of the submitted material; the service drops unsupported evidence
instead of presenting an invented quotation as sourced fact. Source text is
handled as untrusted data and cannot override the analysis instruction.
`notes` and `goal` personalize either mode but are context only: they are never
presented as verified source quotations.

When neither content nor transcript is supplied, the request creates
`mode: "attention_mission"`: an optional `attentionMission` guides what to
notice before, during, and after watching, listening, or reading. This supports
shows and films, but also videos, podcasts, articles, books, meetings, messages,
games, travel, and real-life encounters.

`sourceType` is one of `series`, `movie`, `video`, `podcast`, `article`, `book`,
`work`, `conversation`, or `other`. `targetItemCount` is 3–12 (default 6), and
`outputLanguage` is `en` or `zh-CN`. The response includes:

```text
source metadata + summary + itemCount
  + items[] with personalization and source grounding
  + attentionMission when applicable
  + memoryRecall and savedMemoryIds for auditability
```

The validated request has a learner-scoped deterministic capture ID. Retrying
the same request returns the completed capture without adding another memory
observation. A conditional processing claim makes concurrent identical requests
return `409 input_learning_in_progress` instead of mixing items. If persistence
was interrupted, the processing row is used to retract partial derivatives
before the request resumes.

`GET /api/v1/input-learning` lists only the authenticated learner's sources;
`GET` and `DELETE /api/v1/input-learning/{source_id}` return 404 for another
learner's ID. Any client-supplied user identity is ignored: the account or guest
session resolved by the server owns every capture and derivative. Deleting a
capture removes its dependent items and prevents them from later memory recall.

## Deploy (Linux)

```bash
docker compose up -d --build
curl http://localhost:8000/api/v1/health
```

Then put Nginx in front and issue HTTPS with Certbot (see `DEPLOY.md` and
[`../../docs/ALIBABA_QWEN_DEPLOYMENT.md`](../../docs/ALIBABA_QWEN_DEPLOYMENT.md)).
The frontend's `NEXT_PUBLIC_API_BASE_URL` must point at
the HTTPS backend domain, and that domain must be listed in `CORS_ORIGINS`.
Production uses one stable API hostname: Cloudflare normally sends it to the
Oracle/DeepSeek deployment and sends it to the release-matched Alibaba/Qwen
deployment only for the final submission demo. Deploy and health-check the same
commit on both servers before changing the Cloudflare origin.

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

Coach listening also uses the server-side `OPENAI_API_KEY`, through the OpenAI
Speech API rather than an OpenAI-compatible text provider. Configure
`OPENAI_TTS_BASE_URL`, `OPENAI_TTS_MODEL`, and `OPENAI_TTS_VOICE` as needed;
defaults are the official `/v1` endpoint, `tts-1-hd`, and `nova`. The service
also rejects model/voice combinations that the configured `tts-1` family does
not support before making a provider request. The speech
endpoint accepts only bounded text plus a small style enum, returns no-store
MP3, and the frontend falls back to browser speech when it is unavailable.

Text chat and prediction use the saved fast slot. End-of-session analysis uses
the saved deep slot. Users can choose both before starting a new text chat.

## Diagnose request debugging

`POST /api/v1/diagnose` accepts `diagnosisMode: "fast" | "deep"`. Fast mode uses
`OPENAI_COMPAT_FAST_MODEL` / `LLM_MODEL_FAST` when the server default provider is
used, and falls back to the deep model if no fast model is configured.

Contextual Coach tasks may also send optional `analysisContext` (maximum 2,400
characters). It is serialized as untrusted task data in the user prompt and may
help judge word choice, collocation, audience, and register. It is never a
source of learner error spans: every saved correction must still be supported
by the learner's `text`. Contextual submissions include the context in their
deduplication hash, so the same wording can be tested honestly in two different
situations.

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
