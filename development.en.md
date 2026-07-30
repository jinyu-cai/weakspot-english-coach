# WeakSpot English Coach: A From-Zero Development Guide

> Audience: a first-year computer-science student who knows little or no Python, FastAPI, React, cloud deployment, or production Web engineering.
>
> Last source audit: 2026-07-29 (`main` at `b884aec`).
>
> Chinese edition: [`development.md`](development.md). Both editions use the same 0–23 chapter structure and the same source paths, commands, and implementation boundaries.

## 0. How to use this guide

This is a guide to the code that exists, not an early product specification. Read it with the repository open. For each feature, follow the same path:

```text
user action
  -> frontend page/component
  -> lib/api-client.ts
  -> HTTP request and Pydantic model
  -> FastAPI route and dependencies
  -> service/business rules
  -> repository/external provider
  -> JSON response
  -> React state and rendered UI
```

The main documents have different jobs:

| Document | Purpose |
| --- | --- |
| `README.md` | Product and stack overview |
| `development.md` | Full Chinese learning guide |
| `development.en.md` | This English learning guide |
| `apps/api/README.md` | Backend commands, endpoints, and configuration |
| `apps/web/README.md` | Frontend setup and backend connection |
| `LOCAL_TESTING.md` | Test and release checklist |
| `docs/ARCHITECTURE.md` | Production architecture and data flow |
| `docs/MEMORY_AGENT_DESIGN.md` | Memory lifecycle and retrieval design |

Do not try to memorize every file. Choose one user action and trace it end to end.

## 1. The project in one sentence

WeakSpot turns authentic learner output into a long-lived, explainable learning state:

```text
writing / conversation / imported history / practice / Coach mission
  -> structured AI output
  -> validated evidence, errors, notes, mastery, and memories
  -> bounded retrieval
  -> a better next plan, exercise, or conversation
```

The trust boundary is:

```text
Browser
  -> Next.js UI
  -> HTTPS + JSON
  -> FastAPI
  -> OpenAI / Qwen / DeepSeek
  -> DynamoDB
```

Provider, AWS, OAuth, and session secrets stay on the server. A browser can inspect every `NEXT_PUBLIC_*` value.

## 2. Minimum Web foundations

### 2.1 Client, server, and API

A client sends a request. A server validates it, performs work, and returns a response. An API is the contract between them.

```http
POST /api/v1/diagnose
Content-Type: application/json

{
  "userId": "demo-user-001",
  "text": "Yesterday I go to school.",
  "diagnosisMode": "fast",
  "outputLanguage": "en"
}
```

- `POST` is the HTTP method.
- `/api/v1/diagnose` is the path.
- Headers carry metadata.
- The body is JSON.
- A `2xx` status means success; `4xx` means the request or authorization is wrong; `5xx` means the server/provider path failed.

### 2.2 JSON and typed objects

JSON uses `true`, `false`, and `null`; Python uses `True`, `False`, and `None`.

```json
{"score": 88, "errors": [], "duplicate": false}
```

Pydantic converts validated JSON into Python objects. TypeScript types describe the same shape in the frontend, but browser types disappear at runtime; the server must still validate.

### 2.3 Origin, cookies, and CORS

The production origins differ:

```text
https://englearning.jinxxx.de
https://enapi.jinxxx.de
```

`CORSMiddleware` in `apps/api/app/main.py` allows approved browser origins and credentials. CORS is a browser read policy, not authentication. Authentication comes from the signed HttpOnly `session` cookie or the guest identity created by the backend.

## 3. Repository map

```text
weakspot-english-coach/
├── apps/
│   ├── api/
│   │   ├── app/
│   │   │   ├── main.py
│   │   │   ├── config.py
│   │   │   ├── api/deps.py
│   │   │   ├── api/routes/
│   │   │   ├── models/
│   │   │   ├── services/
│   │   │   ├── db/
│   │   │   └── core/
│   │   ├── scripts/
│   │   ├── pyproject.toml
│   │   └── Dockerfile
│   └── web/
│       ├── app/
│       ├── components/
│       └── lib/
├── docs/
├── README.md
├── LOCAL_TESTING.md
├── development.md
└── development.en.md
```

Keep this backend direction in mind:

```text
models -> routes -> services -> repositories -> DynamoDB
```

It is a responsibility map, not a rule that every operation must use every layer.

## 4. Python used by this project

### 4.1 Modules and imports

`apps/api/app/services/memory_service.py` is the module `app.services.memory_service`:

```py
from app.services.memory_service import retrieve_memory_pack
```

Run backend commands from `apps/api` so Python can find the top-level `app` package.

### 4.2 Types, functions, and control flow

```py
def clamp(value: float, low: float = 0, high: float = 100) -> float:
    if value < low:
        return low
    return min(value, high)
```

Indentation is syntax. Type hints help editors, tests, and validation, but plain Python does not compile them like Java types.

Common project types:

```py
name: str = "grammar.article"
score: int = 88
mastery: float = 73.5
enabled: bool = True
missing: str | None = None
errors: list[dict] = []
counts: dict[str, int] = {}
```

### 4.3 Comprehensions, unpacking, and f-strings

```py
active_ids = [item["id"] for item in memories if item["status"] == "active"]
public = {**stored, "evidence": stored.get("evidence", "")}
pk = f"USER#{user_id}"
```

`*items` unpacks a sequence; `**mapping` unpacks keyword fields or merges dictionaries.

### 4.4 Pydantic models

```py
from typing import Literal
from pydantic import BaseModel, Field

class CoachMissionRequest(BaseModel):
    durationMinutes: Literal[5, 10, 15] = 10
    energy: Literal["light", "normal", "challenge"] = "normal"
    outputLanguage: Literal["en", "zh-CN"] = "en"
```

Pydantic rejects invalid JSON before business logic runs and generates OpenAPI schemas. It validates structure, not factual truth.

### 4.5 Synchronous and asynchronous work

`def` is synchronous. `async def` can `await` non-blocking work. A synchronous boto3 or model SDK call does not become non-blocking merely because its route is `async`; the project uses worker threads for long blocking operations where needed.

```py
try:
    result = risky_call()
except ValueError as exc:
    raise HTTPException(status_code=502, detail=str(exc)) from exc
```

Catch only errors you can translate or recover from. Preserve a trace/request ID for unexpected failures.

## 5. FastAPI from zero

### 5.1 FastAPI and Uvicorn

FastAPI declares routes, validation, dependencies, and OpenAPI. Uvicorn is the ASGI server that listens on a port.

```bash
cd apps/api
uv run uvicorn app.main:app --reload --port 8000
```

`app.main:app` means “import `app/main.py` and use the object named `app`.”

### 5.2 Application startup and routers

The entry point creates the app, adds CORS, registers exception handlers, and includes routers:

```py
app = FastAPI(title=settings.app_name)
app.add_middleware(CORSMiddleware, ...)
app.include_router(coach.router, prefix="/api/v1", tags=["coach"])
app.include_router(chat.router, prefix="/api/v1", tags=["chat"])
```

A router can add its own prefix:

```py
router = APIRouter(prefix="/memory")

@router.get("/traces")
def traces(...):
    ...
```

The final endpoint is `GET /api/v1/memory/traces`.

### 5.3 Validation and dependency injection

```py
@router.post("/retrieve")
def retrieve(
    req: RetrieveMemoryRequest,
    identity: Identity = Depends(rate_limited("memory")),
):
    req.userId = identity.user_id
```

FastAPI first parses JSON, validates `RetrieveMemoryRequest`, resolves identity, checks quota, and then calls the route. The server overwrites body `userId`; a client is never allowed to impersonate another user by editing JSON.

### 5.4 Streaming and generated docs

Deep diagnosis can stream whitespace keepalives while a worker performs the long model/database path. The final bytes still form valid JSON. When replacing a dependency-created response with `StreamingResponse`, guest cookies must be copied to the actual response.

Open `http://localhost:8000/docs` after startup. Swagger shows every path, schema, and response and is the best first debugging client.

## 6. Why the code is layered

| Layer | Owns | Must not own |
| --- | --- | --- |
| `models/` | Input/output shape and validation | Database calls |
| `api/routes/` | HTTP, auth, status codes, orchestration | All algorithms |
| `services/` | Prompts, memory, decisions, business rules | UI rendering |
| `db/repositories.py` | DynamoDB reads, writes, conditions, pages | Mission design |
| `core/` | Pure mastery/taxonomy rules | Network calls |
| `config.py` | Environment-backed configuration | Real committed secrets |

This separation lets tests replace AI and DynamoDB without rewriting routes.

## 7. Diagnose: a complete request trace

### 7.1 Frontend and request

`apps/web/app/page.tsx` gathers text. `apps/web/lib/api-client.ts` adds the base URL, cookies, language, model-selection headers, timeout, and error parsing:

```ts
return apiFetch<DiagnoseResponse>("/diagnose", {
  method: "POST",
  body: JSON.stringify({
    userId,
    text,
    diagnosisMode,
    outputLanguage,
  }),
})
```

### 7.2 Route, idempotency, and memory

`apps/api/app/api/routes/diagnose.py`:

1. resolves model configuration and identity;
2. replaces `req.userId`;
3. hashes normalized text, language, context, and learning metadata;
4. claims a diagnosis request so concurrent retries do not double-write;
5. returns a completed draft for a duplicate;
6. retrieves a bounded Memory Pack;
7. calls the structured diagnosis service;
8. persists the submission, errors, notes, evidence, profile, and memories.

The central lesson is that HTTP retries are normal. A request ID/hash plus conditional repository claim makes expensive side effects idempotent.

### 7.3 Structured AI boundary

`diagnose_service.py` prepares system/user messages. `ai_client.py`:

```text
Pydantic JSON schema
  -> provider request in JSON mode
  -> raw model text
  -> model_validate_json
  -> one repair retry for malformed structure
```

The server then checks evidence grounding. An error quote or positive-evidence quote must come from learner text. Absence of an error is not automatically a success.

### 7.4 Persistence and learning evidence

Confirmed errors become submission/error/note rows and failure evidence. Explicit, exact learner quotes may become positive evidence. Evidence updates mastery and recent risk, while memory candidates pass through validation, merge, conflict, expiry, and capacity rules.

The response includes diagnosis, notes, saved memories, recall IDs, and trace metadata. The UI renders the report and a Session Win without creating another backend record.

## 8. AI providers and model routing

### 8.1 Server model catalog and BYOK

The server may expose Qwen, DeepSeek, or a provider-neutral OpenAI-compatible configuration. `GET /api/v1/llm/models` returns safe IDs and names, never keys or internal base URLs.

The browser normally sends two allowlisted IDs:

```http
X-LLM-Server-Deep-Model: deepseek-deep
X-LLM-Server-Fast-Model: deepseek-fast
```

`get_llm_provider` resolves them against the server catalog. BYOK is a separate path that requires a browser-provided API key and model and cannot be mixed with server selection.

### 8.2 Text, Realtime, and Speech are different systems

- Text diagnosis/chat uses an OpenAI-compatible Chat Completions adapter.
- Voice chat uses OpenAI Realtime and an ephemeral client secret plus a server sideband.
- Coach listening uses Qwen3-TTS-Flash and returns private, no-store provider audio.
- Browser speech recognition and `speechSynthesis` are local browser fallbacks.

The configured TTS defaults are `qwen3-tts-flash`, `Cherry`, and `English`. A dedicated `QWEN_TTS_API_KEY` takes priority; otherwise the backend reuses the configured Model Studio text or embedding key. A TTS failure returns 503/502 and must not block text practice.

### 8.3 GPT-5.6 Adaptive Mission Planner

Coach has two truthful runtime paths:

```text
adaptive_planner
  -> official OpenAI Responses API
  -> gpt-5.6-sol Structured Outputs
  -> mission + plannerInsight + generation

selected_provider
  -> selected server pair or BYOK
  -> OpenAI-compatible Chat Completions
  -> mission
```

The core branch in `coach_service.py` is:

```py
if uses_adaptive_mission_planner(req):
    result, generation = parse_gpt56_mission(
        messages=messages,
        response_model=_gpt56_response_model_for_request(req),
        user_id=user_id,
        max_output_tokens=max_tokens,
        trace_id=trace_id,
    )
    planner_insight = result.plannerInsight
else:
    result = parse_with_model(
        messages=messages,
        response_model=_response_model_for_request(req),
        model=selected_coach_model(req, llm_provider),
        provider=llm_provider,
    )
```

The Responses path uses `store=False`, a hashed safety identifier, a server-only key, and fails closed when enabled without a key or with a model not beginning with `gpt-5.6`. The UI shows the evidence panel only when the response itself reports OpenAI generation metadata.

## 9. DynamoDB single-table storage

Most user records share:

```text
PK = USER#{userId}
```

The sort-key prefix identifies the entity:

| Entity | Example SK |
| --- | --- |
| Profile | `PROFILE` |
| Skill | `SKILL#grammar.article` |
| Submission | `SUBMISSION#<time>#<id>` |
| Note | `NOTE#<time>#<id>` |
| Plan | `PLAN#ACTIVE` |
| Chat session | `CHAT#<id>` |
| Chat message | `CHATMSG#<time>#<id>` |
| Memory | `MEMORY#<id>` |
| Recall trace | `MEMTRACE#<time>#<id>` |

Repositories hide boto3 details:

```py
list_recent_errors(user_id, limit=20)
save_memory(memory)
get_chat_session(user_id, session_id)
```

`db/serialization.py` converts Python floats to DynamoDB `Decimal` and converts them back on reads. List functions must follow `LastEvaluatedKey` when the user-facing result is unbounded.

TTL is eventual physical deletion. The application must immediately filter an expired or forgotten memory by business state and cannot wait for DynamoDB cleanup.

## 10. Core product loops and Coach

### 10.1 Profile, plan, and practice

Profile stores level and counts. `SKILL#...` rows store mastery and evidence history. Plan reads profile, weak skills, bounded errors, and memory, then saves a seven-day plan.

Practice supports:

```text
fix_sentence
fill_blank
rewrite_sentence
```

Mixed sessions pass `sessionSlot` and `sessionSize`. The decision service rotates skills and replay/variation/transfer stages so four parallel questions do not collapse into the same sentence shell.

Submission uses `clientAttemptId`. The browser keeps the ID after a failed response and changes it only when the learner changes the answer or exercise. Repository claims and immutable grade drafts prevent a retry from grading or updating mastery twice.

### 10.2 History, Notebook, and Daily Wins

History and Notebook are learner archives, so their repositories read all DynamoDB pages. Internal prompt summaries may use explicit limits, but those limits must not leak into user-facing archives.

Manual History deletion removes the submission, errors, source notes, hash, and source contribution to derived mastery/memory. Automatic weakness resolution does not delete Notebook notes; it changes their reversible Current/Previous classification.

Daily Wins aggregates server events by the learner's timezone. Session Win is different: it is a frontend-only, per-completion card stored in localStorage for a welcome-back hint.

### 10.3 Text chat and imported history

Text chat stores a session and messages. Each reply uses only recent messages and a bounded Memory Pack. End-of-session analysis produces corrections, natural expressions, notes, and evidence. Imported ChatGPT history is chunked and bounded before analysis.

### 10.4 Identity and quotas

```text
owner -> member -> signed-in user -> guest
```

GitHub/Google OAuth creates an HttpOnly session cookie. A guest receives a long-lived guest cookie. The backend derives the identity and quota and always ignores a body-supplied user ID for authorization.

### 10.5 Coach mission types

The five mission variants are a Pydantic discriminated union:

| `type` | Specific payload |
| --- | --- |
| `guided_scene` | Roles, setting, goal, starter, scenario prompt/family/key |
| `picture_story` | Allowlisted first-party asset key |
| `listen_retell` | Original script and play limit |
| `decision_response` | Situation, audience, goal, constraints |
| `vocabulary_in_action` | Word data, situation, concepts, audience, tone |

Shared fields include title, briefing, target skills, task prompt, criteria, and progressive hints. The frontend state machine is:

```text
setup -> briefing -> active -> feedback
                         +-> chat_feedback
```

Timer completion must never dismiss already-produced feedback.

### 10.6 Random conversation: two requests, two failure boundaries

The Chat card does not call one “random conversation function.” It performs:

```text
POST /coach/missions
  -> guided_scene mission
POST /chat/sessions
  -> durable chat session
```

The frontend code is:

```tsx
const mission = await generateCoachMission({
  durationMinutes: isLongForm ? 15 : 10,
  modality: "text",
  energy: "normal",
  generationMode: sceneGenerationMode,
  runtimeMode: "selected_provider",
  preferredType: "guided_scene",
})

const session = await createChatSession(
  DEMO_USER_ID,
  mission.title,
  undefined,
  mission.scene?.scenarioPrompt,
  mission.scene?.starterMessage,
  mission.scene?.scenarioFamily,
  mission.scene?.scenarioKey,
)
```

Model output can exceed a downstream contract even when the upstream mission validates. `CoachScene` therefore bounds `scenarioPrompt` deterministically, preserving the role/setup head and behavioral-rules tail. A Chat request permits a 300-character topic while ActivityRun title permits 240. Current Coach titles are already bounded to 160, but ordinary clients and future upstream contracts need the route's own protection. Session creation projects the topic into narrower metadata:

```py
CreateActivityRunRequest(
    title=req.topic[:240] if req.topic else "English conversation",
    goal=req.topic or "Practice meaningful English conversation.",
)
```

Repository item-size failures become a specific `413 payload_too_large`; unknown faults remain 500 with a trace ID. Debug each Network request separately and correlate its trace ID with backend logs.

### 10.7 Input Learning and owner-only Input Lab 2

`/input` either extracts source-grounded language items from supplied material or creates an attention mission when material is absent. Source evidence must be an exact substring; pasted content is untrusted data.

`/input/experimental` is owner-only in both UI and backend. It accepts an explicitly supplied transcript and rights basis, forbids extra URL fields, performs no URL fetching, bounds the excerpt by duration, and does not treat the rights assertion as an automated legal decision.

## 11. MemoryAgent in detail

### 11.1 Why mastery is not enough

`grammar.article = 52` cannot represent “the learner wants business English,” “short feedback works better,” or “last week's interview was important.” Memory stores semantic, cross-session context in five kinds:

```text
preference  goal  strategy  weakness  episode
```

A candidate passes through validation, canonical-key creation, merge/conflict handling, embedding, kind-specific expiry, capacity pruning, and only then a `MEMORY#` write. A memory-write lease protects the multi-step operation; a lost claim becomes retryable 409 instead of an invisible overwrite.

### 11.2 Retrieval and forgetting

Retrieval combines semantic similarity, lexical overlap, confidence, importance, recency, and pinned state. The pack is intentionally bounded:

```text
at most 6 memories
under 700 estimated tokens
with a 15% safety reserve
```

Each retrieval writes an explainable trace of selected IDs, component scores, reasons, and token estimate. Forgetting removes an item from retrieval immediately; DynamoDB TTL performs physical cleanup later.

A weakness resolves only after adequate independent, spaced, varied evidence. A later failure may reopen it. Notebook notes remain stored during both states.

## 12. Adaptive next-action decisions

The scheduler does not simply pick the lowest mastery. A skill score combines need, error density, due/spacing state, weakness confidence, goal relevance, and exploration. A format score includes previous results, productive difficulty, and variety. The response exposes its breakdown and reason.

Mixed sessions use:

```py
skill = _pick_session_skill(ranked_skills, session_slot, session_size)
stage = _session_progression(state, session_slot)
```

The client sends slot/size for each parallel generation. Slot zero may replay a known fingerprint; later slots change context and surface form. Several individually correct top-one choices do not automatically make a diverse batch.

## 13. Reading the frontend

### 13.1 Routes and libraries

```text
app/page.tsx          -> /
app/chat/page.tsx     -> /chat
app/coach/page.tsx    -> /coach
app/practice/page.tsx -> /practice
app/memory/page.tsx   -> /memory
app/input/page.tsx    -> /input
```

`"use client"` permits browser state, effects, storage, and event handlers.

- `components/` contains reusable UI/business components.
- `lib/api-client.ts` is the HTTP boundary.
- `lib/types.ts` mirrors public API contracts.
- `lib/i18n.ts` contains English/Chinese UI copy.
- `lib/llm-settings.ts` stores safe model IDs and optional BYOK settings.
- `lib/session-win.ts` derives local completion feedback.

### 13.2 State and effects

```tsx
const [models, setModels] = useState<ServerLLMModel[]>([])
const [error, setError] = useState("")

useEffect(() => {
  getServerLLMModels().then(setModels).catch((value) => {
    setError(value instanceof Error ? value.message : "Load failed")
  })
}, [])
```

Production UI must represent idle, loading, success, empty, and error states. A failed model-catalog request should show retry instead of pretending that only a default exists.

`NEXT_PUBLIC_API_BASE_URL` is compiled into the browser bundle during `next build`. Changing it in Vercel requires redeployment. Never put provider keys or owner bypass tokens in `NEXT_PUBLIC_*`.

## 14. Recommended local learning environment

Run a no-key backend:

```bash
cd apps/api
uv sync
DYNAMODB_ENDPOINT_URL= OPENAI_API_KEY= QWEN_TTS_API_KEY= \
QWEN_MODEL_STUDIO_API_KEY= QWEN_EMBEDDING_API_KEY= \
uv run python -m scripts.dev_server
```

This starts in-process moto, creates the table, uses fake AI, and serves port 8000. In another terminal:

```bash
cd apps/web
pnpm install
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 pnpm dev
```

Use Swagger in this order: health, model catalog, diagnose, profile, memory create/retrieve, then Coach mission. Example:

```bash
curl -sS -X POST http://localhost:8000/api/v1/diagnose \
  -H 'Content-Type: application/json' \
  -d '{
    "userId":"demo-user-001",
    "text":"Yesterday I go to the library.",
    "diagnosisMode":"fast",
    "outputLanguage":"en"
  }'
```

Only after understanding fake mode should you configure real services and run Uvicorn. Never commit `.env`.

## 15. Understanding the tests

| Command | What it proves |
| --- | --- |
| `uv run python -m scripts.smoke_test` | Imports, routes, schemas, pure rules |
| `uv run python -m scripts.integration_test` | Main end-to-end business loop |
| `uv run python -m scripts.coach_contract_test` | Mission variants and boundaries |
| `uv run python -m scripts.dedup_test` | Idempotency and deletion rollback |
| `uv run python -m scripts.memory_agent_test` | Memory lifecycle and decisions |
| `uv run python -m scripts.stealth_input_test` | Opportunity gates, concurrency, Input pages |
| `uv run python -m scripts.memory_benchmark` | Recall, stale suppression, token budget |
| `pnpm exec tsc --noEmit` | Frontend type correctness |
| `pnpm build` | Next.js production compilation |

Fake AI and moto prove contracts and business logic, not live provider availability. Production still needs a small health/model/feature probe. Run `tsc` separately; do not treat a successful Next build as sufficient type checking.

## 16. Deployment architecture

```text
merge main -> Vercel builds apps/web

Nginx :443
  -> Docker FastAPI on localhost:8000
  -> provider APIs and DynamoDB
```

`deploy/start_backend.sh` builds the image, creates/configures the table idempotently, replaces the container, and checks health. Secrets live only in the backend environment.

The stable API hostname is separate from its origin. Before switching traffic, both origins must run the intended Git SHA and compatible configuration.

## 17. Where to start when changing a feature

| Goal | Start with |
| --- | --- |
| Add an API | model, `api/routes/`, `main.py` |
| Change diagnosis | `diagnose_service.py`, diagnostic model/route |
| Change model routing | `model_catalog.py`, `api/deps.py`, `llm-settings.ts` |
| Change Memory | `memory_service.py`, repositories, models |
| Change next practice | `decision_service.py`, practice route/page |
| Change DynamoDB access | `db/keys.py`, `db/repositories.py` |
| Change frontend requests | `lib/api-client.ts`, `lib/types.ts` |
| Change Coach | coach models/service and coach/chat pages |
| Change auth/quota | `api/deps.py`, auth routes/components |

Preferred order:

```text
contract/pure rule -> service/repository -> route -> frontend -> tests -> docs
```

## 18. Engineering trade-offs and study topics

- Multi-step state changes may need conditions, leases, or transactions; plain read-modify-put can lose updates.
- Memory token counts are conservative estimates, not the provider's private tokenizer.
- Deterministic benchmarks prevent regressions but are not large real-user studies.
- Forgetting is immediate in business behavior and eventual in physical TTL deletion.
- Synchronous SDK calls need worker isolation inside an async server.
- Coach scaffolds are often temporary; resulting evidence is durable.
- Picture missions diagnose English, not visual factual correctness.
- One word-choice error is provisional evidence, not proof of a permanent weakness.
- Session Win is localStorage enhancement, not cross-device progress.

## 19. Four-week learning path

### Week 1: Python and FastAPI

Run `scripts.dev_server`, learn functions/types/Pydantic, and trace health, models, and memory in Swagger.

### Week 2: repositories and a full loop

Read keys/repositories, trace Diagnose end to end, and inspect profile/skills/history before and after.

### Week 3: structured AI and Memory

Read AI response models, `parse_with_model`, consolidation, retrieval traces, and Coach unions.

### Week 4: frontend, tests, and deployment

Trace one API call into a page, follow Coach's state machine, run all tests, and understand Docker/Nginx/CORS/Vercel environment behavior.

## 20. Common misconceptions

- `async def` does not make a blocking SDK asynchronous.
- Pydantic-valid AI output is not automatically factually grounded.
- A body `userId` is not authorization.
- DynamoDB TTL is not immediate deletion.
- A successful build is not a substitute for `tsc`.
- “Server default” can be a deep/fast pair.
- More memory is not always better; bounded relevance is better.
- A hidden owner link is not authorization; the API must enforce 403.
- Realtime, TTS, speech recognition, and browser synthesis are different paths.
- Prompt instructions do not replace deterministic length/item-size limits.

## 21. Glossary

| Term | Plain meaning |
| --- | --- |
| ASGI | Interface between async Python apps and servers |
| Uvicorn | Server that runs FastAPI |
| Route | Method + path handler |
| Middleware | Shared processing around routes |
| Dependency injection | FastAPI resolves prerequisites before a route |
| Pydantic | Runtime validation and schema library |
| Repository | Database-access boundary |
| Structured Output | Model output constrained to a schema |
| Embedding | Text represented as a numeric vector |
| TTL | Timestamp for eventual database cleanup |
| CORS | Browser cross-origin read policy |
| OAuth | Third-party sign-in protocol |
| BYOK | Bring Your Own Key |
| Idempotent | Safe to retry without duplicate effects |
| Evidence gate | State changes only with observable evidence |
| Discriminated union | One field selects the schema variant |

## 22. Maintaining this guide

For each cross-layer feature, review both development guides, README, backend reference, frontend reference, local tests, Pydantic/TypeScript unions, fake AI/mocks/i18n, evidence grounding, idempotency, pagination, and downstream size contracts.

## 23. Rebuild a minimal WeakSpot from an empty directory

Build one complete vertical slice first:

```text
mini-english-coach/
├── api/app/{main.py,models.py,service.py,repository.py}
├── api/test_api.py
└── web/app/page.tsx
```

### 23.1 Contract

```py
from typing import Literal
from pydantic import BaseModel, Field

class DiagnoseRequest(BaseModel):
    text: str = Field(min_length=10, max_length=5000)
    outputLanguage: Literal["en", "zh-CN"] = "en"

class ErrorItem(BaseModel):
    code: Literal["grammar.verb_tense", "grammar.article", "clarity.expression"]
    original: str
    corrected: str
    explanation: str

class DiagnoseResponse(BaseModel):
    submissionId: str
    score: int = Field(ge=0, le=100)
    correctedText: str
    errors: list[ErrorItem]
```

### 23.2 Repository and service

```py
from copy import deepcopy

_submissions: dict[str, dict] = {}

def save_submission(item: dict) -> None:
    _submissions[item["submissionId"]] = deepcopy(item)
```

```py
from app.models import DiagnoseResponse, ErrorItem

def diagnose_text(text: str) -> DiagnoseResponse:
    errors: list[ErrorItem] = []
    corrected = text
    if "Yesterday I go" in text:
        corrected = text.replace("Yesterday I go", "Yesterday I went")
        errors.append(ErrorItem(
            code="grammar.verb_tense",
            original="Yesterday I go",
            corrected="Yesterday I went",
            explanation="A finished past event needs a past-tense verb.",
        ))
    return DiagnoseResponse(
        submissionId="",
        score=max(0, 100 - len(errors) * 12),
        correctedText=corrected,
        errors=errors,
    )
```

Use a deterministic service first. Replace its internals with structured AI only after the full slice works.

### 23.3 FastAPI

```py
from uuid import uuid4
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.models import DiagnoseRequest, DiagnoseResponse
from app.repository import save_submission
from app.service import diagnose_text

app = FastAPI(title="Mini English Coach")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health() -> dict:
    return {"ok": True}

@app.post("/diagnose", response_model=DiagnoseResponse)
def diagnose(request: DiagnoseRequest) -> DiagnoseResponse:
    result = diagnose_text(request.text)
    result.submissionId = f"sub_{uuid4().hex[:12]}"
    save_submission(result.model_dump())
    return result
```

```bash
cd api
uv init
uv add fastapi "uvicorn[standard]" pydantic pytest httpx
uv run uvicorn app.main:app --reload --port 8000
```

### 23.4 Frontend

```ts
type ErrorItem = {
  code: string
  original: string
  corrected: string
  explanation: string
}

type DiagnoseResponse = {
  submissionId: string
  score: number
  correctedText: string
  errors: ErrorItem[]
}

export async function diagnose(text: string): Promise<DiagnoseResponse> {
  const response = await fetch("http://localhost:8000/diagnose", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, outputLanguage: "en" }),
  })
  if (!response.ok) throw new Error(`Diagnose failed: ${await response.text()}`)
  return response.json()
}
```

```tsx
"use client"
import { useState } from "react"
import { diagnose } from "../lib/api"

export default function HomePage() {
  const [text, setText] = useState("")
  const [result, setResult] = useState<Awaited<ReturnType<typeof diagnose>> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function submit() {
    setLoading(true)
    setError("")
    try { setResult(await diagnose(text)) }
    catch (value) { setError(value instanceof Error ? value.message : "Unknown error") }
    finally { setLoading(false) }
  }

  return <main>
    <h1>Mini English Coach</h1>
    <textarea value={text} onChange={(event) => setText(event.target.value)} />
    <button disabled={loading || text.trim().length < 10} onClick={submit}>
      {loading ? "Analyzing..." : "Analyze"}
    </button>
    {error ? <p role="alert">{error}</p> : null}
    {result ? <p>Score: {result.score} — {result.correctedText}</p> : null}
  </main>
}
```

### 23.5 Test and expand

```py
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_diagnose_past_tense() -> None:
    response = client.post(
        "/diagnose",
        json={"text": "Yesterday I go to school.", "outputLanguage": "en"},
    )
    assert response.status_code == 200
    assert response.json()["correctedText"] == "Yesterday I went to school."

def test_rejects_short_text() -> None:
    assert client.post("/diagnose", json={"text": "Hi"}).status_code == 422
```

Then add DynamoDB, profile/mastery, idempotent practice, bounded chat, cookie identity, memory retrieval, Coach scheduling, and finally voice/deployment. At every stage require Swagger/curl success, visible browser loading/success/error, tests for success and one failure boundary, and no secret in Git or browser code.
