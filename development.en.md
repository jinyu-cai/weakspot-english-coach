# WeakSpot English Coach: A From-Zero Development Guide

> Audience: a first-year student with no prior development experience. You may never have used a terminal or written
> a program.
>
> Last source audit: 2026-07-30.
>
> Chinese edition: [`development.md`](development.md). Both editions use the same 0–25 chapter structure and the same
> source paths, commands, and implementation boundaries.

## 0. How to use this guide

This is a guide to the code that exists, not an early product specification. Read it with the repository open. For
each feature, follow the same path:

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
| `docs/PROJECT_CODE_WALKTHROUGH_ZH.md` | Current custom-function and source-navigation index |
| `apps/api/README.md` | Backend commands, endpoints, and configuration |
| `apps/web/README.md` | Frontend setup and backend connection |
| `LOCAL_TESTING.md` | Test and release checklist |
| `docs/ARCHITECTURE.md` | Production architecture and data flow |
| `docs/MEMORY_AGENT_DESIGN.md` | Memory lifecycle and retrieval design |

Do not try to memorize every file. Choose one user action and trace it end to end.

This guide treats a knowledge point as adequately explained only when it answers four questions:

1. **What is it?** Start with a plain-language definition.
2. **Why does this project need it?** Name the failure, cost, or security boundary it addresses.
3. **Where is it in the code?** Point to the current file, function, or data flow.
4. **How can I verify it?** Give an input/output example, numerical calculation, failure counterexample, or runnable
   experiment.

When reading an example, cover its result and predict the status code, returned value, or state transition first.
Then run it. A wrong prediction tells you whether you missed the concept, a boundary, or a deployment-specific
configuration.

Code blocks follow one convention:

- “complete file,” “run from,” or “runnable” means it can be copied and executed;
- “source excerpt” or a block containing `...` omits imports, fixtures, or surrounding implementation;
- “conceptual fragment,” “pseudocode,” or “paper data” expresses a relationship and cannot run alone; and
- unless a block is explicitly complete, treat it as a teaching excerpt. Chapters 14 and 23 state cwd, full commands,
  and expected results for runnable labs.

**True beginner fast path:** read Chapters 0–3, especially 2.4–2.7, then complete 14.1–14.3 immediately. First obtain a
visible page, Network 200, and backend log in no-key mode; then return to Chapter 4 for Python, FastAPI, database, and
React. Do not force yourself through every advanced algorithm before running the product once.

### 0.1 Observable learning outcomes

Finishing pages is not the goal. By the end, you should be able to:

1. verify Git, Node.js, pnpm, and uv on your computer;
2. explain the browser, Next.js, FastAPI, model providers, and DynamoDB in plain language;
3. start the no-key environment in two terminals and stop it safely;
4. trace a button through HTTP, route, service, repository, response, and React render;
5. diagnose 4xx, 5xx, CORS, connection, and timeout failures with evidence;
6. make one change on a learning branch, inspect its diff, test it, and avoid committing secrets; and
7. rebuild Chapter 23 from an empty directory.

Use four levels to judge yourself:

| Level | Evidence |
| --- | --- |
| Recognize | You know the term when you see it |
| Explain | You can describe its input, output, and boundary |
| Verify | You can predict and observe one success and one failure |
| Apply | You can change it safely and prove the result |

### 0.2 The read-run-draw-change-test loop

For every topic:

```text
read one small section
  -> run the smallest example
  -> draw where the data goes
  -> change one boundary
  -> run the smallest relevant test
```

For Diagnose, first draw:

```text
textarea -> POST /api/v1/diagnose -> DiagnoseRequest
  -> service -> repository -> DiagnoseResponse -> report
```

Then replace a valid five-word input with two words. Predict 422 before running it. This one experiment verifies HTTP,
Pydantic, and the layer at which failure occurs.

## 1. The project in one sentence

Put simply: a learner writes, speaks, or imports English; the app checks it with AI, records the
actual mistakes and successes with evidence, and later uses that record to decide what to practice
next. Decisions come from accumulated history, not from one session.

More formally, WeakSpot turns authentic learner output into a long-lived, explainable learning state:

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

A client sends a request. A server validates it, performs work, and returns a response. An API is the contract between
them.

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
- A `2xx` status means success; `4xx` means the request or authorization is wrong; `5xx` means the server/provider path
  failed.

### 2.2 JSON and typed objects

JSON uses `true`, `false`, and `null`; Python uses `True`, `False`, and `None`.

```json
{"score": 88, "errors": [], "duplicate": false}
```

Pydantic converts validated JSON into Python objects. TypeScript types describe the same shape in the frontend, but
browser types disappear at runtime; the server must still validate.

### 2.3 Origin, cookies, and CORS

An **origin is scheme + host + effective port**; path and query do not participate. Therefore
`http://localhost:3000` and `http://localhost:8000` are different origins. The production origins differ too:

```text
https://englearning.jinxxx.de
https://enapi.jinxxx.de
```

Middleware is shared processing around routes. `CORSMiddleware` in `apps/api/app/main.py` allows approved browser
origins and credentials. CORS is a browser read policy, not authentication, and curl does not enforce it.
Authentication comes from the signed HttpOnly `session` cookie or the guest identity created by the backend. The
actual registration (`apps/api/app/main.py`):

```py
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_origin_regex=r"https://weakspot-english-coach.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

`cors_origin_list` is the explicit allowlist; the regex additionally permits Vercel preview deployments so each PR
preview can call the API without reconfiguring the backend.

### 2.4 Terminal, path, process, and port

A terminal is a window for text commands; a shell reads them. In:

```text
student@laptop weakspot-english-coach %
```

`%` or `$` is the prompt, not part of the command. Learn these first:

```bash
pwd
ls
cd apps/api
cd ../web
```

`pwd` prints the current directory, `ls` lists it, and `..` means the parent directory. A relative path such as
`apps/web/app/page.tsx` starts from your current directory.

`uv run python -m scripts.dev_server` starts a process that keeps the terminal occupied. It listens on
`127.0.0.1:8000`; `localhost` means this computer and 8000 is the service's port. The frontend uses 3000, so you need a
second terminal. Press `Ctrl+C` in each terminal to request a clean stop.

### 2.5 URL, DNS, and one HTTP round trip

```text
https://enapi.jinxxx.de/api/v1/health
scheme  host                path
```

DNS resolves the host to a server. HTTPS uses TLS to encrypt the connection. The default HTTPS port is 443; a local
8000 must be written explicitly. A query string follows `?`, such as `?limit=20`.

```text
browser connects
  -> sends method/path/headers/body
  -> middleware and route run
  -> server returns status/headers/body
  -> React updates state and renders
```

| Status | Meaning here |
| --- | --- |
| 200/201 | Request succeeded; still inspect the business body |
| 400 | Route rejected request semantics |
| 401/403 | Missing identity / known identity lacks permission |
| 404 | Wrong path or unregistered router |
| 409 | Concurrent idempotency claim |
| 422 | Pydantic rejected fields, types, or lengths |
| 429 | Quota/rate limit |
| 500 | Unhandled server error |
| 502/503/504 | Upstream failure, unavailable dependency, or timeout |

### 2.6 Cookies, environment variables, and secrets

A browser sends eligible cookies automatically. A cookie can survive a React rerender or page refresh; component state
does not. HttpOnly prevents ordinary browser JavaScript from reading the session token.

Environment variables configure a process from outside the code:

```text
QWEN_TTS_API_KEY=...
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

Backend keys belong only in the backend environment. Every `NEXT_PUBLIC_*` value enters the browser bundle and is
public. `.env.example` documents names; a real `.env` may contain secrets and must not be committed. Restart a backend
after changing its environment; rebuild/redeploy a frontend after changing `NEXT_PUBLIC_*`.

### 2.7 DevTools Network: observe instead of guess

Open browser developer tools (`F12` on many systems), select Network, preserve the log, and repeat the failure. Inspect:

1. request URL and method;
2. status and duration;
3. request payload;
4. response body; and
5. the backend log at the same time.

`ERR_CONNECTION_REFUSED` means no process accepted that host/port. A 422 means connection succeeded but the JSON
contract failed. A fixed-duration abort means inspect the browser, proxy, and provider timeout budgets. These are
different failures even if the UI shows the same “send failed” toast.

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

That is the simplified form. `apps/api/app/core/mastery.py` has a real `clamp` with the same name and a shorter body:

```py
def clamp(value: float, min_value: float = 0, max_value: float = 100) -> float:
    return max(min_value, min(max_value, value))
```

`update_skill_from_error` calls it to keep `mastery` (each skill's 0–100 score) in range after a penalty, as in `clamp(old_mastery + severity_penalty(severity))` — subtract the severity penalty, then clamp back into 0–100.

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

Two annotations that appear repeatedly are `Literal` and `Optional`:

```py
from typing import Literal

MemoryKind = Literal["preference", "goal", "strategy", "weakness", "episode"]

def display_name(nickname: str | None = None) -> str:
    return nickname if nickname is not None else "Anonymous"
```

`Literal` narrows an arbitrary string to a fixed set. `str | None` means the value may be a string or `None`.
It does **not** make a parameter optional by itself; the `= None` default is what lets the caller omit it. Python does not reject a bad `Literal` at runtime by itself, so external JSON still needs Pydantic validation.

#### 4.2.1 Assignment, comparison, loops, and return

`=` assigns a value; `==` compares values:

```py
score = 80
score = score + 5

if score >= 80:
    status = "ready"
else:
    status = "practice"
```

The same "several `if` + a final fallback `return`" shape is `apps/api/app/core/mastery.py`'s `severity_penalty`, which returns a different penalty by error severity:

```py
def severity_penalty(severity: str) -> float:
    if severity == "low":
        return -3.0
    if severity == "medium":
        return -7.0
    return -12.0
```

It returns numbers rather than strings, but the skeleton is identical to `status` above.

`False`, `None`, zero, and empty strings/lists/dicts are false-like. A `for` loop visits each item:

```py
for index, error in enumerate(errors, start=1):
    print(index, error["code"])
```

`return` ends the current function and gives a value to its caller. `print(value)` only displays it; a function that
prints but does not return gives its caller `None`.

#### 4.2.2 Lists, dictionaries, attributes, and methods

```py
codes = ["grammar.article", "grammar.verb_tense"]
first = codes[0]
last = codes[-1]

profile = {"level": "B1"}
required = profile["level"]
optional = profile.get("nickname")
```

An out-of-range list index raises `IndexError`. A missing `dict[key]` raises `KeyError`; `.get()` returns `None` or a provided default. Do not use `.get()` for every required field merely to hide errors.

The textbook `.get(key, default)` is at `apps/api/app/core/mastery.py:34`:

```py
old_mastery = float(existing.get("mastery", DEFAULT_MASTERY)) if existing else DEFAULT_MASTERY
```

`DEFAULT_MASTERY = 70.0` sits at the top of the same file. A skill record with no `mastery` yet starts at 70 — a genuinely optional field with a safe default, not a hidden bug.

```py
request.text          # attribute
result.model_dump()   # method call
settings.api_key      # attribute on a configuration object
```

When a name is unfamiliar, ask where it was imported/assigned, what type is left of the dot, what arguments enter,
what returns, and who handles exceptions.

#### 4.2.3 A complete first Python program

On a disposable learning branch, save this complete file as `apps/api/python_basics_lab.py`:

```py
skills = [
    {"code": "grammar.article", "mastery": 42},
    {"code": "grammar.verb_tense", "mastery": 67},
]


def weakest_skill(rows: list[dict]) -> dict:
    if not rows:
        raise ValueError("At least one skill is required.")
    weakest = rows[0]
    for row in rows[1:]:
        if row["mastery"] < weakest["mastery"]:
            weakest = row
    return weakest


try:
    result = weakest_skill(skills)
    print(f'Practice {result["code"]}: mastery={result["mastery"]}')
    weakest_skill([])
except ValueError as error:
    print(f"Expected failure: {error}")
```

From `apps/api`, run `uv run python python_basics_lab.py`. Expected output:

```text
Practice grammar.article: mastery=42
Expected failure: At least one skill is required.
```

Predict what changes when 42 becomes 80, then test it. Delete the lab file or commit it separately after the exercise.
This one program uses assignment, list/dict access, a function, type hints, a loop, comparison, return, exception,
f-string, and visible output.

### 4.3 Comprehensions, unpacking, and f-strings

```py
active_ids = [item["id"] for item in memories if item["status"] == "active"]
public = {**stored, "evidence": stored.get("evidence", "")}
pk = f"USER#{user_id}"
```

`*items` unpacks a sequence; `**mapping` unpacks keyword fields or merges dictionaries.

Expand the shorthand before trying to memorize it:

```py
skills = [
    {"skillCode": "grammar.article", "mastery": 40},
    {"skillCode": "vocabulary.travel", "mastery": 75},
]

by_code = {item["skillCode"]: item for item in skills}
```

The comprehension is equivalent to:

```py
by_code = {}
for item in skills:
    by_code[item["skillCode"]] = item
```

Dictionary merge order is left to right:

```py
defaults = {"mode": "fast", "language": "en"}
selected = {**defaults, "mode": "deep"}
# {"mode": "deep", "language": "en"}
```

The later `mode` wins, while `defaults` remains unchanged.

`apps/api/app/core/mastery.py`'s `reverse_skill_from_error` is a real "keep most fields, change a few" merge. It undoes an error penalty when a submission is deleted:

```py
return {
    **existing,
    "mastery": clamp(old_mastery - severity_penalty(severity)),
    "errorCount": max(0, old_error_count - 1),
    "updatedAt": now,
}
```

`**existing` spreads the old skill record (`userId`, `skillCode`, `label`, `correctCount`, …) as-is; only `mastery`, `errorCount`, and `updatedAt` are overwritten. `update_skill_from_practice` uses the same pattern.

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

For example, this body is rejected with 422 before Coach generation:

```json
{"durationMinutes": 12, "energy": "extreme", "outputLanguage": "en"}
```

Both values violate a `Literal`. By contrast, a structurally valid model can still make an unsupported factual claim.
That requires a separate evidence check.

Use a frozen dataclass for trusted internal configuration:

```py
from dataclasses import dataclass

@dataclass(frozen=True)
class LLMProviderConfig:
    api_key: str
    base_url: str
    model: str
```

This object organizes data inside the process; it is not an HTTP schema and must never be serialized back to a browser. This is a security rule, not just a dataclass convention.

### 4.5 Synchronous and asynchronous work

`def` is synchronous. `async def` can `await` non-blocking work. A synchronous boto3 or model SDK call does not become non-blocking merely because its route is `async`; the project uses worker threads for long blocking operations where needed.

```py
try:
    result = risky_call()
except ValueError as exc:
    raise HTTPException(status_code=502, detail=str(exc)) from exc
```

Catch only errors you can translate or recover from. Preserve a trace/request ID for unexpected failures.

An `async` function can still block the event loop:

```py
async def bad_route():
    time.sleep(5)  # blocks the event-loop thread
```

The diagnosis route isolates synchronous provider/database work in exactly this way
(`apps/api/app/api/routes/diagnose.py`; there is no function named `blocking_diagnose` — the real code passes lambdas
into `run_in_executor`):

```py
loop = asyncio.get_running_loop()

# --- Fast pre-checks (profile + dedup) run in threadpool ---
pre = await loop.run_in_executor(
    None,
    lambda: _pre_check(
        req.userId, req.text, req.outputLanguage, request_id,
        req.analysisContext,
        req.learningContext.model_dump(mode="json") if req.learningContext else None,
    ),
)

# Start the worker before returning the StreamingResponse...
future = loop.run_in_executor(
    None,
    lambda: _run_diagnosis_job(
        req, profile, text_hash, request_id, started,
        diagnosis_mode, identity, llm_provider, pre["claim"],
    ),
)
```

`_pre_check` and `_run_diagnosis_job` are ordinary synchronous functions. Their boto3/provider calls would block the
event loop, so the route hands each of them to a worker thread with `run_in_executor(None, ...)` and either `await`s
the result or polls `future.done()`.

`await` does not make the provider faster. It lets the event loop serve another request while a worker thread waits.
As an experiment, send a slow diagnosis and a health request at the same time. If health also freezes, a blocking call probably escaped worker isolation.

### 4.6 Mutation, copies, and side effects

Lists and dictionaries are mutable. Two names may point at the same object:

```py
original = {"status": "active"}
alias = original
alias["status"] = "forgotten"
assert original["status"] == "forgotten"
```

`{**original}` makes a shallow outer copy; nested containers can still be shared. Chapter 23 uses `deepcopy` so callers
cannot mutate repository state accidentally.

A side effect changes the outside world: database writes, provider calls, logs, or mutation. Pure functions depend only
on inputs and return outputs, so mastery calculations belong in `core/` while persistence belongs in repositories.

### 4.7 Decorators and context managers

```py
@router.get("/health")
def health() -> dict:
    return {"status": "ok"}
```

The decorator registers or wraps the function. It is not a comment; HTTP reachability still requires the router to be included by `main.py`.

```py
with open("example.txt", encoding="utf-8") as file:
    content = file.read()
```

A context manager performs paired enter/exit work and closes the resource even after an exception. You need not implement one yet, but you must recognize the shape.

## 5. FastAPI from zero

### 5.1 FastAPI and Uvicorn: the app and the server that runs it

Two different programs work together to serve the API. Keep them separate in your head:

- **FastAPI** is the Python library you *write against*. It turns a decorated function such as
  `@router.get("/health")` into an endpoint, validates request/response JSON with Pydantic models,
  resolves dependencies, and auto-generates the OpenAPI/Swagger page at `/docs` (Section 5.4).
  FastAPI itself never listens on a port and never touches the network.
- **Uvicorn** is a *different* program, installed separately as `uvicorn[standard]` in
  `apps/api/pyproject.toml`. It is the web server: it waits on a port (8000), reads the raw HTTP
  request, hands it to your FastAPI app, and writes the response back to the browser.

Think of a restaurant. FastAPI is the menu and the kitchen: it knows every dish (route) and how to
prepare it (the Python function). Uvicorn is the front-door waiter: it stands at the door (the port),
takes the customer's order (an HTTP request), calls the kitchen, and carries the finished dish out.
Neither is useful alone. A menu without a waiter never receives an order; a waiter without a kitchen
has nothing to serve.

You can prove that. `app/main.py` only *creates* the FastAPI object and registers routers; it contains no code that listens on a port. Try to run it as an ordinary script:

```bash
cd apps/api
uv run python app/main.py
```

It fails immediately with `ModuleNotFoundError: No module named 'app'`. The reason is instructive:
when Python runs a *file* as a script, it puts that file's folder on the import path, so
`from app.config import settings` cannot find the `app` package. The file is designed to be loaded as
the *module* `app.main` — exactly the left half of the `app.main:app` string that Uvicorn uses. Even
if it imported cleanly, all it would do is create the `app` object and exit; no process listens on a
port, so no browser can reach it. The API becomes reachable only when Uvicorn runs that object:

```bash
cd apps/api
uv run uvicorn app.main:app --reload --port 8000
```

Read the command piece by piece:

| Piece          | Meaning                                                                                                                                                                                                       |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cd apps/api`  | Move into the backend folder so Python can find the `app` package (Section 4.1).                                                                                                                              |
| `uv`           | The tool that manages this project's Python environment (Section 14.1).                                                                                                                                       |
| `run`          | “Run the next command inside the project's virtualenv,” with every dependency from `pyproject.toml` available. Uvicorn is not installed globally, so `uv run` is what makes the bare word `uvicorn` work.     |
| `uvicorn`      | The web server program described above.                                                                                                                                                                       |
| `app.main:app` | *What* to run: import the module `app.main` (the file `app/main.py`) and use the object named `app` — the `FastAPI(...)` instance created in that file. The colon separates “module path” from “object name.” |
| `--reload`     | Watch source files and restart the server automatically after each edit. Convenient while learning, never for production.                                                                                     |
| `--port 8000`  | Which port to listen on. The frontend uses 3000, so the backend uses 8000 to stay separate (Section 2.4).                                                                                                     |

**When do you use which command?**

- `uv run uvicorn app.main:app ...` runs the real backend with whatever configuration your `.env` provides. The mini project in Chapter 23.9 uses exactly this command.
- The no-key environment in Section 14.2 instead runs `uv run python -m scripts.dev_server`. That script does extra setup first — it starts an in-process fake AWS (moto), creates a temporary DynamoDB table, and turns on fake AI — and only then starts Uvicorn internally (`scripts/dev_server.py` calls `uvicorn.run("app.main:app", ...)`). Use this when you want a backend that works without any API keys. The whole extra setup is:

```py
os.environ.setdefault("USE_FAKE_AI", "true")
os.environ.setdefault("CORS_ORIGINS", "http://localhost:3000")
mock = moto.mock_aws()
mock.start()
try:
    create_table()                      # scripts/create_table.py
    # reload=False is REQUIRED: reload spawns a subprocess where moto is not active.
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=False, log_level="info")
finally:
    mock.stop()
```

**Verify it yourself.** With the server running:

```bash
curl -i http://localhost:8000/api/v1/health
```

Expect `HTTP/1.1 200` and a JSON body beginning `{"status":"ok", ...}`. Now stop the server with `Ctrl+C` and repeat the curl: the connection is refused. The route function still exists, but nothing listens on the port — that is the proof that Uvicorn is the process making the API reachable.

**Failure counterexamples.** Type the object name wrong on purpose:

```bash
cd apps/api
uv run uvicorn app.main:does_not_exist --reload --port 8000
```

Uvicorn fails to start with an `AttributeError: module 'app.main' has no attribute 'does_not_exist'`:
it refuses to serve an API that was never defined. Run the same command from the repository root
instead of `apps/api`, and you get `ModuleNotFoundError: No module named 'app'` — Python cannot find
the package at all. Both errors point back to the same rule: the colon string is “find this module,
then find this object inside it.”

### 5.2 Application startup and routers

The entry point creates the app, adds CORS, registers exception handlers, and includes routers:

```py
app = FastAPI(title=settings.app_name)
app.add_middleware(CORSMiddleware, ...)
app.include_router(coach.router, prefix="/api/v1", tags=["coach"])
app.include_router(chat.router, prefix="/api/v1", tags=["chat"])
```

A router is a group of related endpoints, usually one per file (`diagnose.py`, `chat.py`,
`memory.py`). That is why `main.py` stays short: it attaches whole routers rather than listing every
endpoint. A router can add its own prefix:

```py
router = APIRouter(prefix="/memory")

@router.get("/traces")
def traces(...):
    ...
```

The final endpoint is `GET /api/v1/memory/traces`.

A missing `include_router` is a useful counterexample:

```text
routes/debug.py exists
  + @router.get("/hello") exists
  + main.py never includes debug.router
  = GET /api/v1/debug/hello returns 404
```

Writing a module and registering an HTTP route are separate actions.

### 5.3 Validation and dependency injection

Dependency injection is FastAPI's name for “run some setup for me before my route body runs.” Here FastAPI calls `rate_limited("memory")` first — it checks the caller's quota and returns the signed-in identity — and only then calls `retrieve` with the resolved `identity`.

```py
@router.post("/retrieve")
def retrieve(req: RetrieveMemoryRequest, identity: Identity = Depends(rate_limited("memory"))):
    pack = retrieve_memory_pack(
        identity.user_id,
        req.query,
        token_budget=req.tokenBudget,
        limit=req.limit,
        purpose="preview",
    )
    return {"memoryPack": pack}
```

FastAPI first parses JSON, validates `RetrieveMemoryRequest`, resolves identity, checks quota, and then calls the route.
This is `apps/api/app/api/routes/memory.py` verbatim, and it is worth reading closely: the route never reads
`req.userId` and never writes `identity.user_id` into the body — it simply uses the server-resolved `identity.user_id`
directly. (`RetrieveMemoryRequest` carries an optional `userId` field for client compatibility, and the route ignores
it.) A client is never allowed to impersonate another user by editing JSON, because the server never consults
body-supplied identity. Routes that *do* need the resolved ID further downstream, like Diagnose, assign it explicitly
with `req.userId = identity.user_id` (Section 7.2).

### 5.4 Streaming and generated docs

Streaming means the server sends the first bytes of the response before the whole result is ready, so the connection stays open while a slow model call finishes. A keepalive is a tiny harmless byte sent on schedule so an idle connection is not killed by a proxy or timeout.

Deep diagnosis can stream whitespace keepalives while a worker performs the long model/database path. The final bytes still form valid JSON. When replacing a dependency-created response with `StreamingResponse`, guest cookies must be copied to the actual response. The whole mechanism is one small block in `apps/api/app/api/routes/diagnose.py`:

```py
future = loop.run_in_executor(None, lambda: _run_diagnosis_job(...))

async def generate():
    # Immediate keepalive flushes HTTP headers through Cloudflare.
    yield b" "
    while not future.done():
        await asyncio.sleep(10)
        if not future.done():
            yield b" "
    try:
        result = future.result()
    except ValueError as e:
        result = {"error": True, "detail": f"AI error [{request_id}]: {e}"}
    yield json.dumps(result, ensure_ascii=False, default=_json_default).encode()

stream = StreamingResponse(generate(), media_type="application/json", headers=resp_headers)
# Dependencies attach a first-visit guest cookie to FastAPI's injected
# Response. Copy it to the explicit streaming response...
for name, value in response.raw_headers:
    if name.lower() == b"set-cookie":
        stream.raw_headers.append((name, value))
```

Open `http://localhost:8000/docs` after startup. Swagger shows every path, schema, and response and is the best first debugging client.

The wire body of a long diagnosis is approximately:

```text
second 0  -> " "
second 10 -> " "
second 20 -> " "
finish    -> {"submissionId":"sub_123", ...}
```

Combined, the leading spaces plus JSON are still valid. Sending a word such as `processing` would corrupt the final JSON body. The streaming response must also copy a guest cookie created by a dependency; otherwise the next request would appear to come from a different guest.

Once 200 headers have been flushed, a later model/storage failure cannot change the HTTP status. Diagnose/Import then finish with an HTTP 200 body such as `{"error":true,"code":"...","detail":"..."}`. `apiFetch` therefore checks both
`response.ok` and `payload.error`:

```text
failure before stream headers -> real 4xx/5xx
failure after stream headers  -> HTTP 200 + error body
success                       -> HTTP 200 + normal typed body
```

Keepalive prevents an idle proxy timeout; it does not reset the browser's 20/110/610-second total deadline (ordinary
API work 20 s, most model work 110 s, streaming Diagnose 610 s — Section 13.2).

## 6. Why the code is layered

| Layer                | Owns                                       | Must not own           |
| -------------------- | ------------------------------------------ | ---------------------- |
| `models/`            | Input/output shape and validation          | Database calls         |
| `api/routes/`        | HTTP, auth, status codes, orchestration    | All algorithms         |
| `services/`          | Prompts, memory, decisions, business rules | UI rendering           |
| `db/repositories.py` | DynamoDB reads, writes, conditions, pages  | Mission design         |
| `core/`              | Pure mastery/taxonomy rules                | Network calls          |
| `config.py`          | Environment-backed configuration           | Real committed secrets |

This separation lets tests replace AI and DynamoDB without rewriting routes.

## 7. Diagnose: a complete request trace

This chapter follows one Diagnose button click from the browser to the database and back, giving every layer from Chapter 6 a concrete job.

Use one example throughout this chapter:

```text
Learner text: "Yesterday I went to library."
Grounded error: "to library" is missing an article.
Grounded success: "Yesterday I went" uses past tense correctly.
Unsupported quote: "at school" does not occur in the learner text.
```

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

1. **resolves model configuration and identity** — FastAPI runs the two `Depends(...)` before the function body:

```py
@router.post("/diagnose")
async def diagnose(
    req: DiagnoseRequest,
    response: Response,
    llm_provider: LLMProviderConfig | None = Depends(get_llm_provider),
    identity: Identity = Depends(rate_limited("diagnose")),
):
```

`get_llm_provider` (in `app/api/deps.py`) parses the `X-LLM-*` headers into a provider choice; `rate_limited("diagnose")` resolves the cookie/header identity and raises 429 before any model call once the daily quota is spent.

2. **replaces `req.userId`** — the first line of the body:

```py
    req.userId = identity.user_id
```

The client-sent `userId` is a compatibility field, not authorization. A guest cookie resolves to e.g. `guest_abc`; whatever the body claimed is overwritten before anything else reads it.

3. **hashes normalized text, language, context, and learning metadata** — `_pre_check` calls `_language_text_hash`:

```py
def _language_text_hash(text, output_language, analysis_context=None, learning_context=None) -> str:
    context_hash = (
        f":context:{normalized_text_hash(analysis_context)}"
        if analysis_context
        else ""
    )
    learning_hash = (
        f":learning:{normalized_text_hash(json.dumps(learning_context, sort_keys=True))}"
        if learning_context
        else ""
    )
    return f"{output_language}:{normalized_text_hash(text)}{context_hash}{learning_hash}"
```

`normalized_text_hash` (`app/core/text_hash.py`) lowercases the text and collapses whitespace, so "Yesterday I went to library." and "yesterday  i  went to library" share one hash — but two different sentences that merely contain the same grammar mistake hash differently, which is what lets a recurring weakness be counted twice.

4. **claims a diagnosis request so concurrent retries do not double-write** — `_pre_check` asks the repository for a conditional claim keyed by user + hash:

```py
request_id = uuid4().hex[:10]
...
claim = claim_diagnosis_request(user_id, text_hash, request_id)
if claim.get("claimState") == "complete":
    return _pre_check(user_id, text, output_language, request_id, analysis_context, learning_context)
if claim.get("claimState") != "acquired":
    raise DiagnosisInProgressError("This identical diagnosis is already being processed.")
```

Inside `db/repositories.py`, the first acquire is an atomic `put_item` guarded by `ConditionExpression="attribute_not_exists(PK)"`, so two concurrent identical requests cannot both win. `"complete"` means someone else finished while we were checking — `_pre_check` re-runs and now returns their saved result as a duplicate. Anything else (`"busy"`) becomes the 409:

```py
except DiagnosisInProgressError as e:
    raise HTTPException(
        status_code=409,
        detail={"code": "diagnosis_in_progress", "message": str(e)},
    ) from e
```

The takeover path uses a conditional update that only succeeds when `#status = :failed OR attribute_not_exists(processingClaimId) OR processingClaimedAtEpoch < :stale` (stale defaults to 900 s) — that is the "failed, ownerless, or stale" rule in code.

5. **returns a completed draft for a duplicate** — before claiming, `_pre_check` reads the saved hash row:

```py
existing_hash = get_submission_hash(user_id, text_hash)
if existing_hash and (
    existing_hash.get("status") == "complete"
    or not existing_hash.get("status")
):
    prior = get_submission(
        user_id,
        existing_hash.get("submissionCreatedAt", ""),
        existing_hash.get("submissionId", ""),
    )
    if prior:
        prior_errors = list_errors_for_submission(
            user_id,
            existing_hash.get("submissionCreatedAt", ""),
            existing_hash.get("submissionId", ""),
        )
        ...
        return {"duplicate": True, "response": {"submission": prior, ...}}
```

and the route returns that reconstructed response without any model call:

```py
if pre.get("duplicate"):
    return pre["response"]
```

6. **retrieves a bounded Memory Pack** — in the worker (`_llm_and_persist`), before the model call:

```py
memory_pack = retrieve_memory_pack(
    req.userId,
    f"Diagnose this learner's writing and personalize useful feedback: {req.text[:1200]}",
    purpose="diagnosis",
)
```

A retrieval failure only logs and continues with an empty pack — Memory is an enhancement, not a reason to fail the diagnose:

```py
except Exception:
    logger.exception("diagnose[%s] memory_retrieval_error", request_id)
    memory_pack = {"text": "", "items": [], "estimatedTokens": 0, "traceId": None}
```

7. **calls the structured diagnosis service** — reuse a draft saved by a previous attempt of the same claim, or pay for the model call and save the draft:

```py
if isinstance(claim.get("diagnosticDraft"), dict):
    diagnostic = DiagnosticAIResult.model_validate(claim["diagnosticDraft"])
else:
    diagnostic = diagnose_english_text(
        req.text,
        diagnosis_mode=diagnosis_mode,
        output_language=req.outputLanguage,
        llm_provider=llm_provider,
        max_output_tokens=None if identity.has_unlimited_llm_quota else identity.max_output_tokens,
        trace_id=request_id,
        memory_context=memory_pack.get("text"),
        analysis_context=req.analysisContext,
        learning_context=req.learningContext,
    )
    save_diagnosis_draft(req.userId, text_hash, request_id, diagnostic.model_dump(mode="json"))
```

8. **persists the submission, errors, notes, evidence, profile, and memories** — each artifact is written in turn, and only at the very end does the hash row flip to `complete`:

```py
save_submission(submission)                                              # original/corrected text, score, CEFR
save_error(error)                                                        # one row per grounded error
put_skill(skill)                                                         # mastery moved down by severity
save_note(note)                                                          # micro-lessons
save_profile(profile)                                                    # totalSubmissions, estimatedLevel
saved_memories = remember_candidates(req.userId, memory_candidates, ...)  # MemoryAgent
learning_evidence.append(record_evidence(req.userId, ...))                # EvidenceEvent
put_submission_hash(req.userId, text_hash, submission_id, now, request_id)
```

`put_submission_hash` is itself a conditional update guarded by `processingClaimId = :claim AND #status = :processing` — it is the write that marks the claim complete. If the worker dies mid-way instead, `_run_diagnosis_job` catches the failure and calls `release_diagnosis_request`, which sets `status = "failed"` so a later retry can take the claim over instead of being 409'd forever.

The central lesson is that HTTP retries are normal. A request ID/hash plus conditional repository claim makes expensive side effects idempotent.

For example:

```text
first identical request  -> model call + submission/error/note writes
concurrent active retry  -> 409 diagnosis_in_progress
later identical request  -> duplicate=true, no second mastery update
```

The hash includes normalized learner text, output language, analysis context, and learning metadata. The same sentence under a different audience/register context may therefore produce a new transfer observation.
Only a failed, ownerless, or stale claim can be acquired by another request; an already saved diagnostic draft can then avoid a second model call.

### 7.3 Structured AI boundary

`diagnose_service.py` prepares system/user messages. `ai_client.py`:

```text
Pydantic JSON schema
  -> provider request in JSON mode
  -> raw model text
  -> model_validate_json
  -> one repair retry for malformed structure
```

The server then checks evidence grounding. An error quote or positive-evidence quote must come from learner text.
Absence of an error is not automatically a success. The check itself is deliberately strict substring matching after
case/normalization (`_grounded_quote` in `apps/api/app/api/routes/diagnose.py`):

```py
def _grounded_quote(student_text: str, quote: str) -> bool:
    normalized_text = " ".join(student_text.casefold().split())
    normalized_quote = " ".join((quote or "").casefold().split())
    return bool(normalized_quote and normalized_quote in normalized_text)
```

Two failures illustrate the two validation layers:

```text
overallScore = "great"
  -> schema/type validation fails

originalText = "at school" with an otherwise valid object
  -> schema passes
  -> grounding check fails because the quote is absent
```

Structured output constrains shape. Grounding constrains whether a claim has observable support. The one-repair-retry
step from the diagram above is literal — `ai_client.py` appends the validation error to the messages and asks for
valid JSON only once:

```py
try:
    parsed = response_model.model_validate_json(content)
    return parsed
except ValidationError as e:
    messages.append({
        "role": "user",
        "content": f"Your previous json was invalid: {e}. "
        "Return corrected valid json only.",
    })
    # ... one retry, then the error propagates as an AI error
```

### 7.4 Persistence and learning evidence

Accepted grounded diagnostic errors become submission/error/note rows and failure evidence. This does not mean the
corresponding long-term weakness Memory is already in its `confirmed` verification state. Explicit, exact learner
quotes may become positive evidence. Evidence updates mastery and recent risk, while memory candidates pass through
validation, merge, conflict, expiry, and capacity rules.

The response includes diagnosis, notes, saved memories, recall IDs, and trace metadata. The UI renders the report and a
Session Win without creating another backend record.

A simplified result is:

```json
{
  "diagnostic": {
    "overallScore": 78,
    "errors": [{"code": "grammar.article", "originalText": "to library"}]
  },
  "duplicate": false,
  "memoriesSaved": [{"id": "mem_article", "kind": "weakness"}],
  "memoryRecall": {
    "traceId": "mtr_abc",
    "memoryIds": [],
    "estimatedTokens": 0
  }
}
```

The UI must render typed fields and HTTP status, not infer the error count from free-form summary prose.

### 7.5 One sentence is evidence, not proof

Diagnosis, skill evidence, and durable Memory verification are different layers:

```text
"to library"
  -> exact learner quote + allowed taxonomy code
  -> one grammar.article failure observation
  -> weakness verification starts as candidate

"Yesterday I went"
  -> explicit opportunityPresent=true + outcome=success
  -> confidence >= 0.55 + exact quote
  -> one grammar.verb_tense success observation

no preposition error returned
  -> no success is inferred
```

Weakness verification follows a conservative policy:

| Independent evidence | State |
| --- | --- |
| One source | `candidate` |
| At least two sources and confidence ≥ 0.7 | `observed` |
| At least three sources, at least two days, confidence ≥ 0.7 | `confirmed` |
| Learner creates it manually | immediately `confirmed` |

Sources are deduplicated by `(sourceType, sourceId)`. Repeating the same claim three times inside one submission does
not make three independent observations. The table is computed, not hand-maintained — `_verification_snapshot` in
`apps/api/app/services/memory_service.py`:

```py
refs = list(source_refs)
independent_sources = {
    (str(ref.get("sourceType") or ""), str(ref.get("sourceId") or ""))
    for ref in refs
    if ref.get("sourceId")
}
independent_days = {
    str(ref.get("createdAt") or "")[:10]
    for ref in refs
    if str(ref.get("createdAt") or "")[:10]
}
if source_type == "manual":
    state, reason = "confirmed", "learner_confirmed"
elif memory_kind == "weakness":
    if (len(independent_sources) >= 3 and len(independent_days) >= 2
            and confidence >= 0.7):
        state, reason = "confirmed", "repeated_across_days"
    elif len(independent_sources) >= 2 and confidence >= 0.7:
        state, reason = "observed", "repeated_independent_observations"
    else:
        state, reason = "candidate", "needs_repeated_weakness_evidence"
# non-weakness memories: 2+ sources -> confirmed, 1 strong -> observed, else candidate
```

Skill state keeps lifetime counters and a bounded recent window. If 25 opportunities contain five failures, while the
last 20 contain four:

```text
opportunityCount = 25
failureCount = 5
recentOpportunityCount = 20
recentFailureCount = 4
recentErrorRate = 4 / 20 = 0.20
```

Run the contract example:

```bash
cd apps/api
uv run python -m scripts.single_sentence_evidence_test
```

It verifies taxonomy rejection, quote grounding, explicit positive evidence, cross-source/cross-day weakness states,
and the 20-observation window.

### 7.6 The unified learning loop: ActivityRun → EvidenceEvent → LearningState

The project must answer three different questions, so it does not collapse them into one mutable score:

| Record | Plain meaning | Typical fields | Mutation |
| --- | --- | --- | --- |
| `ActivityRun` | What learning activity was assigned and completed? | type, targets, status, hint/play/attempt counts | advances through a state machine |
| `EvidenceEvent` | What was actually observed at one moment? | outcome, opportunity, support, difficulty, quote | retained as an event |
| `LearningState` | What is the current projection for one skill? | ability, uncertainty, recent risk, review time | recomputed after evidence |

The real flow is:

```text
Diagnose / Practice / Coach / Chat / Input
  -> create or reuse an ActivityRun
  -> observe one EvidenceEvent
  -> atomically write the event and update LearningState
  -> Dashboard / Coach scheduler reads state for the next action
```

One run can yield evidence for several skills; one skill state aggregates evidence from many runs. Keeping only a
final mastery number would lose which activity, learner quote, and hint level caused the change.

#### ActivityRun is a constrained state machine

A state machine is a value allowed to move only through a fixed set of states. A run may move forward,
never backward:

```text
assigned -> started / completed / abandoned / skipped
started  -> completed / abandoned / skipped
terminal -> may only remain in the same terminal state
```

`completed`, `abandoned`, and `skipped` are terminal. Updates set the matching timestamp and increment `version`.
Moving a completed run back to started returns 409 instead of rewriting history. Version-checked writes also stop two
requests based on stale state from silently overwriting each other.

#### Five outcomes are not just “right/wrong”

| Outcome | Meaning | Ability update |
| --- | --- | --- |
| `success` | independent success when an opportunity existed | strong positive |
| `hinted_success` | success with help | smaller positive plus some risk |
| `failure` | opportunity existed and failed | negative |
| `avoided` | opportunity existed but the target form was avoided | smaller negative |
| `no_opportunity` | nothing valid could be assessed | no ability update; records a coverage gap |

Even if a caller sends `success`, `supportLevel > 0` normalizes it to `hinted_success`; assisted work cannot masquerade
as independent mastery. `no_opportunity` requires `opportunityPresent=false`; the other outcomes require `true`.
Invalid combinations return 422 at the Pydantic boundary. The normalization is explicit in `_apply_evidence`
(`apps/api/app/services/learning_service.py`):

```py
outcome = request.outcome
if outcome == "success" and request.supportLevel > 0:
    outcome = "hinted_success"
```

#### How one event changes the numbers

```text
weight = evaluatorConfidence * (0.75 + 0.5 * taskDifficulty)
if delayed:      weight *= 1.25
if novelContext: weight *= 1.15
clamp to 0.05–1.75

success         -> alpha += 1.20 * weight
hinted_success  -> alpha += 0.45 * weight; beta += 0.15 * weight
failure         -> beta  += 1.00 * weight
avoided         -> beta  += 0.35 * weight
no_opportunity  -> alpha/beta unchanged

abilityMean = alpha / (alpha + beta) * 100
```

For a new state at `alpha=1, beta=1`, an ordinary-difficulty `.5`, confidence `1`, immediate independent success has
weight `1`. The result is `alpha=2.2`, `beta=1`, and `abilityMean=68.75`. This is a current projection, not proof of
68.75% “true ability.” Uncertainty falls as weighted evidence accumulates. A legacy learner may start with a bounded
prior derived from old Skill evidence rather than 1/1. The two functions behind the formula
(`apps/api/app/services/learning_service.py`):

```py
def _evidence_weight(request: RecordEvidenceRequest) -> float:
    weight = request.evaluatorConfidence * (0.75 + 0.5 * request.taskDifficulty)
    if request.delayed:
        weight *= 1.25
    if request.novelContext:
        weight *= 1.15
    return _clamp(weight, 0.05, 1.75)


def _update_beta_state(alpha: float, beta: float, outcome: str, weight: float):
    if outcome == "success":
        alpha += 1.2 * weight
    elif outcome == "hinted_success":
        alpha += 0.45 * weight
        beta += 0.15 * weight
    elif outcome == "failure":
        beta += weight
    elif outcome == "avoided":
        beta += 0.35 * weight
    return alpha, beta
```

`LearningState` retains lifetime counters plus only the latest 20 `recentEvidence` items for current rates. Coverage
moves from `unassessed`, to `exploring`, to `enough_evidence` after at least five opportunities with variety across
context, task type, or day. Independent success lengthens retention stability; delayed success lengthens it more;
hinted success increases it modestly; failure and avoidance shorten it. `dueAt = now + stability` is a review
recommendation, not a guaranteed forgetting date. Modality-specific alpha/beta prevents writing success from silently
becoming speaking mastery.

#### Idempotency and concurrency

The event ID is a hash of `userId + clientEventId`. An exact retry returns the original event with `duplicate=true`
and does not increment state again. The first write conditionally commits EvidenceEvent and LearningState together.
If another request changed the state version first, the service rereads and recomputes up to six times. This prevents
both a half-written “event without state” and a lost update. The whole loop is `record_evidence`
(`apps/api/app/services/learning_service.py`):

```py
event_id = "ev_" + hashlib.sha256(
    f"{user_id}\0{request.clientEventId}".encode("utf-8")
).hexdigest()[:24]
existing_event = get_evidence_event(user_id, event_id)
if existing_event:
    return {"event": existing_event, "state": ..., "duplicate": True}

for _attempt in range(6):
    state = get_learning_state(user_id, request.skillCode)      # reread
    ...
    try:
        created = save_evidence_with_learning_state(
            event, updated_state, expected_state_version=expected_version,
        )
        if created:
            return {"event": event, "state": updated_state, "duplicate": False}
        ...
    except LearningStateConflictError:
        continue   # someone else changed the version first: reread and recompute
raise RuntimeError("Learning state remained busy; retry this evidence event.")
```

#### Runnable Swagger lab

Keep the Chapter 14 moto/fake backend running with one browser cookie.

1. Send this to `POST /api/v1/learning/runs`:

```json
{
  "activityType": "practice",
  "title": "Learning-state lab",
  "taskType": "fix_sentence",
  "targetSkills": ["grammar.verb_tense"],
  "modality": "writing",
  "estimatedMinutes": 5
}
```

Copy `run.id`; expect `assigned` and `version=1`. Patch
`/api/v1/learning/runs/{run_id}` with `{"status":"started","attemptCount":1}`.

2. Send this to `POST /api/v1/learning/evidence`, replacing the run ID:

```json
{
  "clientEventId": "lab-evidence-0001",
  "runId": "replace-with-the-real-run-id",
  "sourceId": "learning-state-lab",
  "skillCode": "grammar.verb_tense",
  "outcome": "success",
  "opportunityPresent": true,
  "supportLevel": 1,
  "modality": "writing",
  "taskType": "fix_sentence",
  "taskDifficulty": 0.5,
  "evaluatorConfidence": 1.0,
  "contextKey": "past-trip",
  "novelContext": false,
  "delayed": false,
  "evidenceQuote": "Yesterday I went to school."
}
```

Because `supportLevel=1`, expect the stored event outcome to be `hinted_success`. Repeat the identical body: expect
`duplicate=true` with no extra count or state version. Open `GET /api/v1/learning/overview` and explain the changed
skill fields.

3. Patch the run to `{"status":"completed"}`, then deliberately patch it back to `{"status":"started"}`: expect 409.
As a paper prediction, combine `outcome:"no_opportunity"` with `opportunityPresent:true`: expect 422.

Run the repeatable contract:

```bash
cd apps/api
uv run python -m scripts.learning_loop_test
```

You understand this loop only when you can explain why hinted work is not independent success, why one retried event
does not count twice, and why a terminal run cannot move backward.

## 8. AI providers and model routing

### 8.1 Provider, model, API, SDK, prompt, token, and embedding

| Term | Plain meaning |
| --- | --- |
| provider | Company/service hosting and billing the capability |
| model | The specific learned system being called |
| API | Network contract used by software |
| SDK | Code library that constructs API calls |
| prompt | Instructions and bounded context for a text model |
| token | Model text unit used for context/usage/pricing |
| embedding | Numeric vector used for semantic similarity, not text generation |

Using the OpenAI Python SDK does not prove a request went to OpenAI; an OpenAI-compatible base URL may target another
provider. Text, embedding, Realtime, and TTS can also be separate APIs, keys, prices, and failure paths under one
provider name.

Models can hallucinate or return valid JSON with unsupported evidence. The project therefore layers:

```text
prompt -> structured/Pydantic shape -> deterministic grounding -> tests/traces
```

Shape validation does not prove truth. An embedding likewise supplies one retrieval signal; cosine similarity does not
prove a fact.

### 8.2 Server model catalog and BYOK

The server may expose OpenRouter, Qwen, DeepSeek, or a provider-neutral OpenAI-compatible configuration.
`GET /api/v1/llm/models` returns safe IDs and names, never keys or internal base URLs.

The current default pair is `openai/gpt-5.6-luna-pro` through OpenRouter for Deep and `ds-v4-flash-0731` through the
official DeepSeek API for Fast. OpenRouter Luna remains a selectable Fast alternative. Deep requests use `max`
reasoning; Fast requests use `medium` reasoning.

The browser normally sends two allowlisted IDs:

```http
X-LLM-Server-Deep-Model: openrouter-deep
X-LLM-Server-Fast-Model: deepseek-fast
```

`get_llm_provider` (`apps/api/app/api/deps.py`) resolves them against the server catalog. BYOK is a separate path that
requires a browser-provided API key and model and cannot be mixed with server selection — mixing is a 400, not a silent
preference:

```py
if requested_server_deep_model or requested_server_fast_model:
    if has_byok_values or requested_server_model:
        raise HTTPException(status_code=400,
            detail="Choose either a server model pair, a legacy server model, or a custom LLM provider.")
```

The deployment's default pair is resolved in `apps/api/app/services/model_catalog.py`:

```py
def default_server_model_ids(config: Settings = settings) -> tuple[str, str] | None:
    if config.uses_openrouter:
        fast_id = "deepseek-fast" if config.uses_deepseek else "openrouter-fast"
        return "openrouter-deep", fast_id
    if config.uses_qwen_model_studio:
        return "qwen-deep", "qwen-fast"
    ...
```

For example, a session created with `openrouter-deep` keeps its stored provider/model even if the global selector changes
tomorrow. New sessions use the new choice. Mixing server-selection headers with BYOK is rejected rather than choosing
one silently.

`services/model_routing.py` keeps quality policy provider-neutral:
`select_text_model("fast"|"deep", provider)` resolves the concrete model, while
`reasoning_effort_for_tier` selects `medium` for Fast and `max` for Deep. OpenRouter receives this through its unified
`reasoning.effort` object.

### 8.3 Text, Realtime, and Speech are different systems

- Text diagnosis/chat uses an OpenAI-compatible Chat Completions adapter.
- Voice chat uses OpenAI Realtime and an ephemeral client secret plus a server sideband.
- Coach listening uses Qwen3-TTS-Flash and returns private, no-store provider audio.
- Browser speech recognition and `speechSynthesis` are local browser fallbacks.

The configured TTS defaults are `qwen3-tts-flash`, `Cherry`, and `English`. A dedicated `QWEN_TTS_API_KEY` takes
priority; otherwise the backend reuses the configured Model Studio text or embedding key. A TTS failure returns
503/502 and must not block text practice.

Concrete data flows:

```text
Text: learner JSON -> one Chat Completions response -> structured result
Realtime: microphone frames <-> ongoing low-latency conversation + transcript
TTS: existing "Hold on a second." -> one request -> complete `audio/*` (currently often WAV)
ASR: learner voice -> browser-generated editable text
```

Selecting Qwen or DeepSeek for text does not switch OpenAI Realtime. `style` remains a stable public TTS field, but
Qwen3-TTS-Flash currently ignores instruction-style speed control.

### 8.4 GPT-5.6 Adaptive Mission Planner

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

The Responses path uses `store=False`, a hashed safety identifier, a server-only key, and fails closed
when enabled without a key or with a model not beginning with `gpt-5.6` — it refuses to run rather
than risk running without the right setup. The UI shows the evidence panel only when the response
itself reports OpenAI generation metadata.

For example, `runtimeMode="selected_provider"` may generate a valid guided scene, but the UI must not label its
selection rationale as GPT-5.6 evidence. Only a response containing both OpenAI generation metadata and
`plannerInsight` earns that panel.

## 9. DynamoDB single-table storage

Start with database vocabulary:

| General idea | DynamoDB term |
| --- | --- |
| one record | item |
| one value in a record | attribute |
| unique locator | partition key + sort key |
| targeted key-based read | Query |
| broad table inspection | Scan |

The process starts with an access pattern—“given a user, list Memory items”—and designs keys for it. Query targets one
partition; Scan reads unrelated items and becomes expensive as data grows. A Query response can be paginated, so
`LastEvaluatedKey` means “continue,” not “the archive ends here.” A complete History UI may follow every page while a
model prompt still applies an explicit business limit.

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
| Error | `ERROR#<time>#<id>` |
| Note | `NOTE#<time>#<id>` |
| Plan | `PLAN#ACTIVE` |
| Exercise | `EXERCISE#<id>` |
| Attempt | `ATTEMPT#<time>#<id>` |
| Chat session | `CHAT#<id>` |
| Chat message (v2) | `CHATMSG#<session-id>#<time>#<id>` |
| Memory | `MEMORY#<id>` |
| Recall trace | `MEMTRACE#<time>#<id>` |
| Activity run / timeline | `RUN#<id>` / `RUN_TIME#<time>#<id>` |
| Evidence / timeline | `EVIDENCE#<id>` / `EVIDENCE_TIME#<time>#<id>` |
| Unified learning state | `LEARNING#<skill-code>` |

Paper check:

```text
USER#abc / PROFILE
USER#abc / MEMORY#001
USER#abc / MEMORY#002
USER#abc / NOTE#001
USER#xyz / MEMORY#003
```

`PK=USER#abc AND begins_with(SK, "MEMORY#")` returns only 001 and 002.

Repositories hide boto3 details:

```py
list_recent_errors(user_id, limit=20)
save_memory(memory)
get_chat_session(user_id, session_id)
```

`db/serialization.py` converts Python floats to DynamoDB `Decimal` and converts them back on reads. The two functions
(`apps/api/app/db/serialization.py`) are the whole boundary:

```py
def to_dynamo(value):
    if isinstance(value, float):
        return Decimal(str(value))   # str() avoids binary-float drift in Decimal
    if isinstance(value, list):
        return [to_dynamo(v) for v in value]
    if isinstance(value, dict):
        return {k: to_dynamo(v) for k, v in value.items()}
    return value

def clean(value):
    if isinstance(value, Decimal):
        return int(value) if value % 1 == 0 else float(value)
    ...
```

List functions must follow `LastEvaluatedKey` when the user-facing result is unbounded.

For example:

```py
{"mastery": 73.5}             # public Python/API value
{"mastery": Decimal("73.5")}  # DynamoDB write value
```

Trying to send the raw float through boto3 can fail serialization. Returning the raw `Decimal` can in turn fail JSON
encoding, so the conversion belongs at the repository boundary.

TTL is eventual physical deletion. The application must immediately filter an expired or forgotten memory by business
state and cannot wait for DynamoDB cleanup.

If `expiresAt` was 12:00 and it is now 12:01, retrieval must exclude the item even when the DynamoDB console still shows
the row. That visible row is expected until the asynchronous TTL worker removes it.

## 10. Core product loops and Coach

### 10.1 Profile, plan, and practice

Profile stores level and counts. `SKILL#...` rows store mastery and evidence history. Plan reads profile, weak skills,
bounded errors, and memory, then saves a seven-day plan.

One learner can simultaneously have:

```json
{
  "profile": {"cefrLevel": "B1", "submissionCount": 12},
  "skill": {"skillCode": "grammar.article", "mastery": 58, "errorCount": 7},
  "memory": {"kind": "goal", "content": "Prepare for an interview in September."}
}
```

Profile answers “who/overall activity,” Skill answers “how one measurable ability is changing,” and Memory answers
“which semantic cross-skill fact may matter later.” An interview date does not belong inside article mastery.

Practice supports:

```text
fix_sentence
fill_blank
rewrite_sentence
```

Mixed sessions pass `sessionSlot` and `sessionSize`. The decision service rotates skills and
replay/variation/transfer stages so four parallel questions do not collapse into the same sentence shell.

Submission uses `clientAttemptId`. The browser keeps the ID after a failed response and changes it only when the learner
changes the answer or exercise. Repository claims and immutable grade drafts prevent a retry from grading or updating
mastery twice — `_claim_practice_request` in `apps/api/app/api/routes/practice.py`:

```py
stable_client_id = client_attempt_id or f"server_{uuid4().hex}"
claim = claim_practice_attempt_request(
    user_id, stable_client_id,
    _practice_request_hash(endpoint, payload),   # endpoint + answer + exercise ID
    claim_id,
)
if claim.get("claimState") == "complete":
    return stable_client_id, claim_id, claim     # replay: stored result, no new grade
if claim.get("claimState") != "acquired":
    raise HTTPException(status_code=409, detail={
        "code": "practice_attempt_in_progress",
        "message": "This practice attempt is already being processed."})
```

Reusing the same ID with a **different** answer fails the payload-hash check instead of silently regrading; the saved
`gradeDraft` lets a retried worker skip a second model call.

A plan request can say:

```json
{
  "userId": "overwritten-by-server-identity",
  "errorScope": "weekly",
  "outputLanguage": "en"
}
```

`weekly` bounds generation context; it does not delete older errors — `create_plan` in
`apps/api/app/api/routes/plan.py` picks the window explicitly:

```py
if req.errorScope == "weekly":
    recent_errors = list_weekly_errors(req.userId)
else:
    recent_errors = list_recent_errors(req.userId, limit=50)
skills = sorted(..., key=lambda skill: float(skill.get("mastery", 50)))[:20]
```

The validated output has exactly seven days, two tasks per day, three exercises per task, and 15 minutes per task —
enforced by `apps/api/app/models/plan.py`, not by asking the model nicely:

```py
PLAN_TASKS_PER_DAY = 2
PLAN_EXERCISES_PER_TASK = 3
# LearningPlanAIResult:
days: List[LearningPlanDayAI] = Field(min_length=7, max_length=7)
# LearningPlanDayAI.tasks:
Field(min_length=PLAN_TASKS_PER_DAY, max_length=PLAN_TASKS_PER_DAY)
```

A four-question mixed session sends a shared session plus distinct slots:

```json
{"sessionId":"mix_20260729","sessionSlot":0,"sessionSize":4}
{"sessionId":"mix_20260729","sessionSlot":1,"sessionSize":4}
{"sessionId":"mix_20260729","sessionSlot":2,"sessionSize":4}
{"sessionId":"mix_20260729","sessionSlot":3,"sessionSize":4}
```

The backend can replay an article error in slot 0, vary tense in slot 1, transfer article use in slot 2, and rotate
format in slot 3. Four unrelated top-one calls would often clone the same error shell.

### 10.2 History, Notebook, and Daily Wins

History and Notebook are learner archives, so their repositories read all DynamoDB pages. Internal prompt summaries
may use explicit limits, but those limits must not leak into user-facing archives.

Manual History deletion removes the submission, errors, source notes, hash, and source contribution to legacy
mastery/Memory. It does **not yet** retract the newer `RUN#`, `EVIDENCE#`, and recomputed `LEARNING#` records, so
Learning Overview may retain that source until a concurrency-safe evidence-rebuild path is implemented. Automatic
weakness resolution does not delete Notebook notes; it changes their reversible Current/Previous classification.
The cascade is explicit in `delete_history_entry` (`apps/api/app/api/routes/history.py`):

```py
for err in errors:
    reverted = reverse_skill_from_error(skill, err.get("severity", "medium"), now)
    if int(reverted.get("errorCount", 0)) <= 0 and int(reverted.get("correctCount", 0)) <= 0:
        delete_skill(user_id, code)          # skill is back to pristine: drop the row
    else:
        put_skill(reverted)
    delete_error(user_id, err.get("createdAt", createdAt), err["id"])
for note in notes:
    delete_note(user_id, note.get("createdAt", createdAt), note["id"])
delete_submission(user_id, createdAt, submission_id)
delete_submission_hash(user_id, submission.get("textHash") or ...)
updated_memories = forget_memories_from_source(user_id, submission_id)
profile["totalSubmissions"] = max(0, int(profile.get("totalSubmissions", 0)) - 1)
```

Daily Wins aggregates server events by the learner's timezone. Session Win is different: it is a frontend-only,
per-completion card stored in localStorage for a welcome-back hint.

Deletion example:

```text
sub_123 has 2 errors and 1 note
  -> confirmed manual deletion
  -> submission + 2 errors + 1 source note removed
  -> legacy Skill mastery contribution and Memory source refs reversed
  -> RUN/EVIDENCE/LEARNING may still remain in Learning Overview
  -> response reports removedErrors=2, removedNotes=1
```

Deleting only the submission row would leave a weakness pointing to a nonexistent source.

Timezone example: `2026-07-29 23:30 PDT` is already `2026-07-30 06:30Z`. A Los Angeles learner's event belongs
to July 29. Slicing the UTC date would move the streak to the wrong day. The rule is one function in
`apps/api/app/services/stats_service.py`:

```py
def local_date_for(created_at: str, tz_name: str | None) -> str:
    tz = resolve_timezone(tz_name)
    return parse_iso_datetime(created_at).astimezone(tz).date().isoformat()
```

An unknown timezone name falls back to UTC (`resolve_timezone`), so a typo in a stored timezone degrades to UTC
counting rather than crashing the stats page.

### 10.3 Text chat and imported history

Text chat stores a session and messages. Each reply uses only recent messages and a bounded Memory Pack. End-of-session
analysis produces corrections, natural expressions, notes, and evidence. Imported ChatGPT history is chunked and
bounded before analysis.

For example, when a session contains 80 stored messages and `memory_chat_recent_messages=12`, the 81st reply prompt
uses the latest 12 plus bounded Memory. DynamoDB still keeps all 80. Bounded model context is not deletion of the
learner's archive — `apps/api/app/services/chat_service.py` slices only the model-facing list:

```py
for msg in history[-settings.memory_chat_recent_messages:]:
    role = msg.get("role", "user")
    content = msg.get("content", "")
    if role in ("user", "assistant") and content:
        messages.append({"role": role, "content": content})
```

Chat Import batching belongs to the **frontend**, not one backend service call. `selectImportConversations` ranks
conversations for English-learning relevance and keeps the latest 80 messages from each selected conversation.
`chunkChatImportConversations` then keeps every conversation segment at or below the ordinary backend tier's
120-message limit, every request at or below 20 conversations, and the serialized UTF-8 payload near 200 KB. The
limits live as named constants in `apps/web/lib/chatgpt-import.ts`:

```ts
const CHAT_IMPORT_BATCH_MAX_BYTES = 200_000
const CHAT_IMPORT_BATCH_MAX_CONVERSATIONS = 20
const CHAT_IMPORT_CONVERSATION_MAX_MESSAGES = 120
// selectImportConversations keeps the latest 80 per conversation:
messages: conversation.messages.slice(-80)
// conversationSegments enforces the message boundary independently:
if (segmentMessages.length >= CHAT_IMPORT_CONVERSATION_MAX_MESSAGES
    || conversationPayloadBytes([candidate]) > maxBytes - 512)
```

The Import page sends those requests sequentially and merges their responses; the backend analyzes only the batch it
receives.

Therefore a file containing 300 messages is not one 300-message prompt. Messages spread across selected conversations
may produce several bounded requests; if all 300 belong to one conversation, the current product selection layer
analyzes its latest 80. The batch helper still independently enforces 120 so a future caller that bypasses selection
cannot create a request rejected with 400 for the ordinary access tier. Learner turns can provide error evidence;
assistant corrections can provide confirmed correction context. An assistant's own language must not be stored as a
learner error.

### 10.4 Identity and quotas

```text
owner -> member -> signed-in user -> guest
```

GitHub/Google OAuth creates an HttpOnly session cookie. A guest receives a long-lived guest cookie. The backend derives
the identity and quota and always ignores a body-supplied user ID for authorization. In `apps/api/app/api/deps.py`,
`resolve_identity` builds the guest identity — note that the rate key is the **IP**, not the spoofable guest cookie:

```py
guest_id = request.cookies.get(GUEST_COOKIE)
if not guest_id:
    guest_id = uuid.uuid4().hex
    response.set_cookie(GUEST_COOKIE, guest_id, max_age=365 * 86400, **cookie_kwargs())
return Identity(
    user_id=f"guest_{guest_id}",
    kind="guest",
    rate_key=f"ip_{_client_ip(request)}",
    daily_limit=settings.guest_daily_limit,   # config.py: guest_daily_limit = 3
    ...
)
```

If a guest edits JSON to `"userId":"owner"`, the route still replaces it with the guest identity. If the quota is
already exhausted, the `rate_limited(feature)` dependency returns 429 before the provider call or DynamoDB writes:

```py
def rate_limited(feature: str):
    def _dep(request: Request, response: Response) -> Identity:
        identity = resolve_identity(request, response)
        if identity.is_unlimited:
            return identity
        count = incr_rate_counter(identity.rate_key, feature, day, ttl)
        if count > identity.daily_limit:
            raise HTTPException(status_code=429, detail={
                "code": "rate_limited", "feature": feature,
                "limit": identity.daily_limit, "kind": identity.kind, ...})
        return identity
    return _dep
```

### 10.5 Coach mission types

The five mission variants are a Pydantic discriminated union:

| `type` | Specific payload |
| --- | --- |
| `guided_scene` | Roles, setting, goal, starter, scenario prompt/family/key |
| `picture_story` | Allowlisted first-party asset key |
| `listen_retell` | Original script and play limit |
| `decision_response` | Situation, audience, goal, constraints |
| `vocabulary_in_action` | Word data, situation, concepts, audience, tone |

Shared fields include title, briefing, target skills, task prompt, criteria, and progressive hints. In code, the five
variants select their schema through `_response_model_for_request` (`apps/api/app/services/coach_service.py`), so
Pydantic only accepts output matching the chosen variant:

```py
def _response_model_for_request(req: CoachMissionRequest) -> Type[BaseModel]:
    if req.preferredType == "guided_scene":
        return GuidedSceneMissionAIResult
    if req.preferredType == "picture_story":
        return PictureStoryMissionAIResult
    if req.preferredType == "listen_retell":
        return ListenRetellMissionAIResult
    if req.preferredType == "decision_response":
        return DecisionResponseMissionAIResult
    if req.preferredType == "vocabulary_in_action":
        return VocabularyInActionMissionAIResult
    return CoachMissionAIResult
```

The frontend state machine is:

```text
setup -> briefing -> active -> feedback
                         +-> chat_feedback
```

Timer completion must never dismiss already-produced feedback.

For example, a learner finishes a five-minute writing mission at 04:40. Submission transitions `active -> feedback`
and permanently freezes the timer. A timeout callback at 05:00 must not send the page back to setup or erase the report.

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

Model output can exceed a downstream contract even when the upstream mission validates. `CoachScene` therefore bounds
`scenarioPrompt` deterministically, preserving the role/setup head and behavioral-rules tail
(`apps/api/app/models/coach.py`):

```py
@field_validator("scenarioPrompt", mode="before")
@classmethod
def bound_scenario_prompt(cls, value: object) -> object:
    normalized = value.strip()
    if len(normalized) <= COACH_SCENARIO_PROMPT_MAX_CHARACTERS:
        return normalized
    # head + tail beat rejecting the whole mission and paying for another call
    return (normalized[:head_characters].rstrip() + "\n\n"
            + normalized[-800:].lstrip())
```

A Chat request permits a 300-character topic while ActivityRun title permits 240. Current Coach titles are already
bounded to 160, but ordinary clients and future upstream contracts need the route's own protection. Session creation
projects the topic into narrower metadata:

```py
CreateActivityRunRequest(
    title=req.topic[:240] if req.topic else "English conversation",
    goal=req.topic or "Practice meaningful English conversation.",
)
```

Repository item-size failures become a specific `413 payload_too_large`; unknown faults remain 500 with a trace ID.
Debug each Network request separately and correlate its trace ID with backend logs.

### 10.7 Input Learning and owner-only Input Lab 2

`/input` either extracts source-grounded language items from supplied material or creates an attention mission when
material is absent. Source evidence must be an exact substring; pasted content is untrusted data.

The owner-only Input Lab 2 lives behind `POST /api/v1/coach/input-lab-2/transcript-missions`
(`apps/api/app/api/routes/coach.py`). It accepts an explicitly supplied transcript and rights basis, forbids extra URL
fields, performs no URL fetching, bounds the transcript deterministically, and does not treat the rights assertion as
an automated legal decision:

```py
@router.post("/input-lab-2/transcript-missions", response_model=CoachMissionResponse)
def create_input_lab_2_transcript_mission(
    req: InputLab2TranscriptMissionRequest,
    identity: Identity = Depends(require_owner),
    llm_provider: LLMProviderConfig | None = Depends(get_llm_provider),
):
```

The request model (`apps/api/app/models/coach.py`) has no URL field at all, and rejects any extra key:

```py
class InputLab2TranscriptMissionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str = Field(min_length=1, max_length=240)
    transcript: str = Field(min_length=40, max_length=12000)
    rightsBasis: str = Field(min_length=3, max_length=500)
    ...
```

For example, a direct request from a non-owner must return 403 even if the person manually opens the hidden URL. Hiding
navigation without `require_owner` on the endpoint would be a security bug.

### 10.8 Coach tasks reuse the existing evidence chain

Coach does not create a second weakness database:

```text
picture/listen/decision/vocabulary answer
  -> POST /diagnose
  -> grounded errors + explicit successes + notes + skill evidence + Memory

guided_scene conversation
  -> POST /chat/sessions
  -> messages
  -> session analysis
  -> corrections + notes + evidence + Memory
```

Situation, audience, constraints, and vocabulary concepts travel as **untrusted analysis context**. An error
`originalText` must still quote learner text. If context says “use a formal register,” those words are not evidence that
the learner actually attempted or failed formal language.

The dedup hash includes context:

```text
same answer + same context -> duplicate
same answer + different audience/context -> new transfer observation is allowed
```

In `_language_text_hash` (`apps/api/app/api/routes/diagnose.py`) the context enters the hash as its own normalized
segment, so it can never collide with learner text:

```py
context_hash = f":context:{normalized_text_hash(analysis_context)}" if analysis_context else ""
learning_hash = f":learning:{normalized_text_hash(json.dumps(learning_context, sort_keys=True))}" \
    if learning_context else ""
return f"{output_language}:{normalized_text_hash(text)}{context_hash}{learning_hash}"
```

### 10.9 Contextual vocabulary stays provisional

Suppose the task is “politely decline a last-minute meeting with your manager” and the learner writes:

```text
I don't want it.
```

One diagnosis may record a `vocab.word_choice` or register mismatch, but the UI should say “observation to confirm,”
not “you do not know this word.” Repetition across independent situations and days moves a weakness from
`candidate -> observed -> confirmed`.

### 10.10 Dynamic Chat and model choice

The Chat “AI new scene” card first generates a `guided_scene` mission and then creates a durable session. Fast/deep
controls only the new scaffold. Existing sessions keep their stored provider/model. “Another scene” uses recent
`scenarioFamily` values to avoid immediate repetition while assigning a unique `scenarioKey`.

For example:

```text
recent families = travel_disruption, workplace_alignment
new mission      = service_recovery with scenarioKey scene_<unique>
```

The allowlist controls the family, while the generated key distinguishes two different scenes within that family.

## 11. MemoryAgent in detail

### 11.1 Why mastery is not enough

`grammar.article = 52` cannot represent “the learner wants business English,” “short feedback works better,” or “last
week's interview was important.” Memory stores semantic, cross-session context in five kinds:

```text
preference  goal  strategy  weakness  episode
```

A candidate passes through validation, canonical-key creation, merge/conflict handling, embedding, kind-specific
expiry, capacity pruning, and only then a `MEMORY#` write. That pipeline is the body of `remember_candidates` in
`apps/api/app/services/memory_service.py`, guarded by a memory-write lease:

```py
@memory_write_locked
def remember_candidates(
    user_id: str,
    candidates: Iterable[MemoryCandidate | dict],
    *,
    source_type: str,
    source_id: str,
    ...
) -> list[dict]:
    validated = [...]          # drop sub-threshold confidence (non-manual sources)
    coalesced = {...}          # one analyzer response -> one canonical fact
    embeddings = embed_texts([...])   # batch embedding before the merge loop
    for candidate in validated:       # merge, supersede (_mark_archived), or create
        ...
    _enforce_capacity(user_id)        # prune unpinned lowest-priority items
```

A memory-write lease protects the multi-step operation; a lost claim becomes retryable 409 instead of an invisible
overwrite — `apps/api/app/main.py` maps `MemoryWriteBusyError`/`MemoryWriteClaimLostError` to one contract:

```py
return JSONResponse(status_code=409, content={
    "detail": {"code": "memory_write_retry", "message": str(exc)}})
```

| Kind | Example | Default lifetime |
| --- | --- | --- |
| `preference` | “Prefer concise feedback.” | no automatic expiry |
| `goal` | “Reach IELTS 7 by December.” | 365 days |
| `strategy` | “Sentence rewrites help with articles.” | 180 days |
| `weakness` | repeated article omission | 60 days |
| `episode` | last week's interview practice | 30 days |

`canonicalKey` gives equivalent facts a stable identity. If
`preference.feedback_style = concise` is followed by the learner explicitly asking for detailed feedback, the new
fact supersedes the old one. The system should not retrieve two contradictory preferences.

### 11.2 Retrieval and forgetting

Retrieval combines semantic similarity, lexical overlap, confidence, importance, recency, and pinned state. The pack
is intentionally bounded:

```text
at most 6 memories
under 700 estimated tokens
with a 15% safety reserve
```

Each retrieval writes an explainable trace of selected IDs, component scores, reasons, and token estimate. Forgetting
removes an item from retrieval immediately; DynamoDB TTL performs physical cleanup later.

A weakness resolves only after adequate independent, spaced, varied evidence. A later failure may reopen it. Notebook
notes remain stored during both states.

The simplified ranking score is:

```text
0.50 * semantic
+ 0.15 * lexical
+ 0.15 * importance
+ 0.10 * recency
+ 0.05 * access frequency
+ 0.05 * critical kind
```

Numerical example:

```text
semantic=.80, lexical=.50, importance=.90
recency=.70, frequency=.20, critical=1

score = .40 + .075 + .135 + .07 + .01 + .05 = .74
pinned score = .74 + .15 = .89
```

Candidate weaknesses receive a lower verification factor. If embedding is unavailable, semantic uses lexical fallback
instead of becoming zero, so core retrieval continues with reduced quality. The executable loop is in
`retrieve_memory_pack` (`apps/api/app/services/memory_service.py`):

```py
lexical = lexical_similarity(query, searchable)
semantic_value = cosine_similarity(query_vector, memory.get("embedding"))
semantic = semantic_value if semantic_value is not None else lexical   # fallback, not zero
...
verification_factor = 0.75 if verification_state == "candidate" else 1.0
score = (
    0.50 * semantic + 0.15 * lexical + 0.15 * importance
    + 0.10 * recency + 0.05 * frequency + 0.05 * critical
) * verification_factor
if memory.get("pinned"):
    score += 0.15
```

The pinned `+0.15` is added after the verification factor, so pinning also protects a candidate from being starved by
its own unverified state.

### 11.3 Critical slots and the bounded two-layer pack

Pure similarity can miss a durable goal merely because today's sentence does not say “IELTS.” The ranker reserves up
to two slots for high-importance preferences/goals, then fills normal top-scoring items.

The pack has two layers:

```text
compact overview of all active weaknesses
  + at most 6 detailed relevant memories
  + total under the caller's estimated-token budget
```

The overview records whether it is complete. If the budget is too small even for every skill code, it emits an explicit
`+N omitted` marker and `complete=false`; it must not silently imply complete coverage. `_build_weakness_overview` in
`apps/api/app/services/memory_service.py` degrades through three formats — metrics, plain index, then partial index —
instead of dropping weaknesses silently:

```py
partial_header = "Active weaknesses (compact index; ?=tentative; +N=omitted by context budget):"
...
suffix = f"; +{remaining_count} more" if remaining_count else ""
proposed = f"{partial_header}\n- {'; '.join(proposed_entries)}{suffix}"
if estimate_tokens(proposed) > token_budget:
    break
...
metadata = {"includedCount": len(included_rows), "complete": not omitted, ...}
```

Even the all-omitted case writes an explicit “overview omitted by context budget” notice instead of pretending the
learner has no weaknesses.

For example, a learner may have 40 active weaknesses but only these detailed items:

```text
overview: all 40 skill codes and risk/due summaries
details: 3 relevant weaknesses + 1 goal + 1 preference + 1 strategy
```

Current input always outranks historical Memory instructions.

### 11.4 Recall traces make ranking debuggable

Example trace:

```json
{
  "id": "mtr_abc",
  "purpose": "diagnose",
  "totalCandidates": 18,
  "selectedMemoryIds": ["mem_goal", "mem_article"],
  "estimatedTokens": 164,
  "tokenBudget": 700,
  "selected": [{
    "id": "mem_article",
    "score": 0.73,
    "scoreBreakdown": {
      "semantic": 0.82,
      "lexical": 0.40,
      "verification": "observed",
      "verificationFactor": 1.0
    }
  }]
}
```

If a learner asks why IELTS appeared again, inspect whether `mem_goal` was selected through a critical slot. Do not
guess from the final prompt alone. The example above mirrors the real builder at the end of `retrieve_memory_pack`
(`apps/api/app/services/memory_service.py`), which writes one `MEMTRACE#` row per recall:

```py
trace_id = f"mtr_{uuid4().hex[:12]}"
trace = {
    "id": trace_id,
    "userId": user_id,
    "purpose": purpose,
    "selectedMemoryIds": [memory["id"] for memory in selected],
    "selected": [
        {"id": memory["id"], "kind": memory.get("kind"),
         "content": str(memory.get("content") or "")[:200],
         "score": memory.get("retrievalScore"),
         "scoreBreakdown": memory.get("scoreBreakdown")}
        for memory in selected
    ],
    "totalCandidates": len(memories),
    "estimatedTokens": estimated,
    "budgetCompliant": estimated <= effective_budget,
}
save_memory_trace(trace)
```

### 11.5 Weakness verification is not weakness resolution

Verification asks “Do repeated sources support this weakness?” Resolution asks “Has later practice shown stable
improvement?” They are different state machines.

```text
one grounded diagnosis                 -> candidate
two independent grounded diagnoses     -> observed
three sources across at least two days -> confirmed
later adequate practice                -> resolved
new grounded failure                   -> active/reopened
```

A learner-created manual memory is immediately confirmed because the learner is the source of truth for that
self-report. Model-generated weakness claims require corroboration. The executable state machine is
`_verification_snapshot` in `apps/api/app/services/memory_service.py` (see Section 7.5 for the code). The
“reopened” transition is also visible in `remember_candidates`:

```py
resolved_weakness = bool(
    candidate.kind == "weakness"
    and existing
    and existing.get("status") == "resolved"
)
if existing and (resolved_weakness or (...):
    memory = _reactivate_weakness(existing, now) if resolved_weakness else dict(existing)
```

A new grounded failure flips a `resolved` weakness back to `active` through `_reactivate_weakness` instead of creating
a parallel duplicate memory.

### 11.6 Graduating a weakness requires spaced, varied evidence

Practice stores the most recent 20 evidence items for the same weakness. Resolution requires all current thresholds:

| Condition | Threshold |
| --- | --- |
| total attempts | at least 5 |
| distinct practice days | at least 3 |
| first-to-last span | at least 14 days |
| last-five success rate | at least 80% |
| last-three average score | at least 85 |
| skill mastery | at least 85 |
| successful formats | at least 2 |
| days since same-skill error | at least 14 |

These rows come directly from `WEAKNESS_GRADUATION_THRESHOLDS` in `apps/api/app/services/memory_service.py`:

```py
WEAKNESS_GRADUATION_THRESHOLDS = {
    "minAttempts": 5, "minDistinctDays": 3, "minSpanDays": 14,
    "recentWindow": 5, "minRecentSuccessRate": 0.80,
    "recentAverageWindow": 3, "minRecentAverageScore": 85,
    "minMastery": 85, "minExerciseTypes": 2, "recurrenceFreeDays": 14,
}
```

`_weakness_graduation_snapshot` is the executable form of the table. One success definition matters: a “successful”
attempt is `isCorrect` **and** `score >= 80` — a correct answer with a low score does not count toward graduation:

```py
successful = [row for row in evidence
              if bool(row.get("isCorrect")) and float(row.get("score", 0)) >= 80]
```

Example: five 90-point answers completed in one afternoon fail the day-count and 14-day-span gates. The learner did
well, but the evidence cannot yet show retention. A new grounded failure after resolution reopens the weakness and
increments its reopen history.

These numbers are conservative product thresholds, not universal learning-science constants. They should later be
calibrated with real data.

### 11.7 Status and physical deletion are separate

```text
active      -> participates in retrieval
resolved    -> hidden from active weakness retrieval, retained for audit/reopen
superseded  -> replaced by a newer fact
expired     -> past business lifetime
forgotten   -> explicitly removed by the learner
pinned      -> protected from automatic expiry
ttl         -> eventual physical DynamoDB cleanup
```

For example, after `forget`, a retrieval request must exclude the item immediately even if the DynamoDB row remains
visible for hours.

### 11.8 Memory Center is a control and explanation surface

`/memory` lets a learner create/edit/pin/forget Memory, preview a retrieval pack, inspect score breakdowns and traces,
see verification, and follow weakness graduation progress.

Try this sequence in fake mode:

```text
create "Prefer concise feedback"
  -> retrieve with a feedback-style query
  -> inspect selected ID and trace score
  -> pin it
  -> forget it
  -> retrieve again and confirm it is absent
```

That experiment covers writing, retrieval, explanation, pin semantics, and immediate business forgetting without a
real provider key.

## 12. Adaptive next-action decisions

The scheduler does not simply pick the lowest mastery. A skill score combines need, error density, due/spacing state,
weakness confidence, goal relevance, and exploration. A format score includes previous results, productive difficulty,
and variety. The response exposes its breakdown and reason.

The current base skill formula is:

```text
0.45 * mastery gap
+ 0.25 * recent error density
+ 0.20 * historical failure need
+ 0.10 * staleness
```

If the normalized components are `.80, .60, .50, .90`:

```text
.45*.80 + .25*.60 + .20*.50 + .10*.90 = .70
```

All components must share the same 0–1 scale. Adding a 0–100 mastery number directly to a 0–1 recency number would
make the weights meaningless. The real computation is `_skill_scores` in
`apps/api/app/services/decision_service.py`:

```py
mastery_need = max(0.0, min(1.0, 1 - mastery / 100))
error_need = min(1.0, error_counts.get(code, 0) / 5)
failure_need = max(0.0, min(1.0, 1 - average / 100)) if skill_attempts else 0.55
staleness = min(1.0, _days_since(skill.get("lastPracticedAt")) / 21)
score = 0.45 * mastery_need + 0.25 * error_need + 0.20 * failure_need + 0.10 * staleness
```

Note the cold-start `failure_need = 0.55` for a skill with no attempt history, and that staleness saturates after 21
days. Format scores come from `_type_scores` in the same file:

```py
need = max(0.0, min(1.0, 1 - average / 100)) if attempts else 0.55
productive_difficulty = max(0.0, 1 - abs(average - 75) / 75) if attempts else 0.7
exploration = 1 / math.sqrt(attempts + 1)
reliability = min(1.0, attempts / 5)
score = 0.45 * need + 0.25 * productive_difficulty + 0.20 * exploration + 0.10 * reliability
```

Exploration starts at 1 with zero attempts and decays; reliability starts at 0 and reaches 1 after five attempts — an
untried format is not punished as “unreliable,” and a heavily practiced one no longer earns novelty points.

An example response can expose:

```json
{
  "decision": {
    "targetSkillCode": "grammar.article",
    "practiceType": "rewrite_sentence",
    "supportingMemoryIds": ["mem_article"],
    "skillScores": [{
      "skillCode": "grammar.article",
      "breakdown": {
        "masteryNeed": 0.8,
        "errorNeed": 0.6,
        "failureNeed": 0.5,
        "staleness": 0.9
      }
    }],
    "practiceTypeScores": [{
      "practiceType": "rewrite_sentence",
      "breakdown": {
        "learningNeed": 0.55,
        "productiveDifficulty": 0.93,
        "exploration": 0.71,
        "reliability": 0.2
      }
    }]
  }
}
```

This distinguishes intentional exploration from a ranking bug.

Mixed sessions use:

```py
skill = _pick_session_skill(ranked_skills, session_slot, session_size)
stage = _session_progression(state, session_slot)
```

The client sends slot/size for each parallel generation. Slot zero may replay a known fingerprint; later slots change
context and surface form. Several individually correct top-one choices do not automatically make a diverse batch.

## 13. Reading the frontend

### 13.1 JavaScript and TypeScript essentials

Browsers execute JavaScript. TypeScript adds build-time types; `.tsx` also permits React JSX.

```ts
const language = "en"
let attempts = 0
const profile = { level: "B1", streak: 3 }

type Skill = {
  code: string
  mastery: number
  status?: "active" | "resolved"
}

function weakSkills(skills: Skill[]): Skill[] {
  return skills.filter((skill) => skill.mastery < 60)
}
```

Prefer `const`; an object's contents can still mutate, but React state should be replaced immutably. `?` marks an
optional property and `|` is a union. TypeScript disappears at runtime, so unknown server JSON still needs a reliable
contract.

The teaching `Skill` above is not the real type. The frontend actually uses `SkillState` in `apps/web/lib/types.ts`:

```ts
export interface SkillState {
  userId: string
  skillCode: string
  label: string
  zhLabel: string
  mastery: number
  errorCount: number
  correctCount: number
  lastSeenAt?: string | null
  lastPracticedAt?: string | null
  updatedAt: string
}
```

The real field is `skillCode` (not `code`), `mastery` is a 0–100 number, and optional fields use `?`. It mirrors the dict returned by `core/mastery.py`'s `update_skill_from_error` — `skillCode`, `mastery`, `errorCount`, `correctCount` are the same names. This frontend type is the "manual" for the backend's JSON.

### 13.2 Promises, async/await, and fetch

```ts
async function loadProfile() {
  // The compatibility path is ignored; the cookie-derived identity wins.
  const response = await fetch("http://localhost:8000/api/v1/profile/ignored-by-server", {
    credentials: "include",
  })
  if (!response.ok) {
    throw new Error(`Profile failed (${response.status})`)
  }
  return response.json()
}
```

A Promise eventually succeeds with a value or rejects with an error. `fetch` normally does not throw for HTTP 404/500,
so check `response.ok`; connection/DNS failures reject directly.

`lib/api-client.ts` centralizes base URL, cookies, language/model headers, 429 handling, and error parsing. The three
total-timeout budgets are defined in one place (`apps/web/lib/api-client.ts`):

```ts
const DEFAULT_API_TIMEOUT_MS = 20_000
const LLM_OPERATION_TIMEOUT_MS = 110_000
const DIAGNOSE_OPERATION_TIMEOUT_MS = 610_000
```

Ordinary API calls use 20 seconds. Model operations use 110 seconds, below Nginx's 120-second read timeout. Diagnose is
a separate streaming case: it uses 610 seconds so a healthy keepalive stream is not aborted at the 110-second deadline
while the backend's 600-second upstream call is still running — `diagnose()` passes
`DIAGNOSE_OPERATION_TIMEOUT_MS` to `apiFetch` at the call site. Ten-second StreamingResponse whitespace keepalives do
not reset the browser's total deadline, and receiving headers does not clear it before the JSON/audio body is consumed.
`pnpm test:timeouts` protects the call sites and a runtime “headers now, body later” response.

### 13.3 JSX, components, props, events, and state

```tsx
type ScoreProps = { value: number; label: string }

function Score({ value, label }: ScoreProps) {
  return <p>{label}: {value}</p>
}
```

JSX resembles HTML, but expressions use `{}`, CSS classes use `className`, and events receive a function:
`onClick={submit}`, not `onClick={submit()}`.

```tsx
const [text, setText] = useState("")
const [loading, setLoading] = useState(false)

<textarea
  value={text}
  onChange={(event) => setText(event.target.value)}
/>
```

State setters schedule another render. A normal local variable does not. The textarea is controlled because state is
both its value source and event destination. Replace object/array state:

```ts
setMessages((current) => [...current, newMessage])
```

Do not mutate the old array and pass the same reference.

### 13.4 Effects and async UI states

```tsx
useEffect(() => {
  let cancelled = false
  getServerLLMModels()
    .then((models) => { if (!cancelled) setModels(models) })
    .catch((value) => { if (!cancelled) setError(String(value)) })
  return () => { cancelled = true }
}, [])
```

`[]` means run after first mount; `[userId]` reruns when `userId` changes. Cleanup prevents a late result from updating
an unmounted screen. Direct calculations and click handlers do not need an effect.

Every async screen should distinguish idle, loading, success, valid-empty, and error-with-retry. A catalog 500 must not
be disguised as one fabricated default option.

### 13.5 App Router and the complete page map

`app/<path>/page.tsx` maps to a URL. Components are server components by default — they render on the
server and cannot use browser features. `"use client"` marks a component (and its children) to run in
the browser, which state, effects, events, localStorage, and microphone APIs require; everything in
that bundle is public.

| URL | Purpose |
| --- | --- |
| `/` | Diagnose and report |
| `/dashboard` | Profile and skills |
| `/history` | Complete diagnosis archive/delete |
| `/notebook` | Filter/export/delete notes |
| `/plan`, `/plan/practice` | Seven-day plan and task runner |
| `/practice` | Adaptive practice |
| `/chat` | Text and Realtime conversation |
| `/coach` | Five mission types and Today's Mission |
| `/vocabulary` | Contextual vocabulary evidence |
| `/memory` | Memory CRUD, retrieval, traces, decision |
| `/input`, `/input/experimental` | Input Learning and owner pilot |
| `/import` | ChatGPT export import |
| `/stats` | Daily Wins |
| `/login`, `/admin` | OAuth entry and owner access management |

`components/` holds reusable UI/business components. `lib/api-client.ts` is the HTTP boundary. `lib/types.ts` is the
typed subset that the current UI consumes; it must stay compatible with the corresponding Pydantic fields but need not
repeat unused response fields. `i18n.ts` contains copy, `llm-settings.ts` manages server IDs/BYOK, and `session-win.ts`
derives browser-local completion feedback. Its only storage is one localStorage key
(`apps/web/lib/session-win.ts`):

```ts
const LAST_WIN_KEY = "weakspot-last-session-win"

export function markSessionWin(source: SessionWinSource) {
  window.localStorage.setItem(LAST_WIN_KEY, JSON.stringify({ source, at: Date.now() }))
}
```

A Session Win never writes a backend record; `getRecentSessionWin()`/`getWelcomeBackMessage()` read the same key for
the welcome-back hint, so it is per-browser, not cross-device progress.

Trace one completion:

```text
DiagnosticInput submit -> DiagnoseProvider -> api-client.diagnose
  -> response -> DiagnosticReport -> sessionWinFromDiagnose -> SessionWin
```

### 13.6 Environment timing and a first modification lab

`NEXT_PUBLIC_API_BASE_URL` is compiled into the browser bundle during `next build`; changing it in Vercel requires a new
deployment. Never put provider keys or owner bypass tokens in `NEXT_PUBLIC_*`. Backend `.env` is read at process start,
so change it and restart the process.

On a disposable learning branch:

1. change one Diagnose button label;
2. display `text.length`;
3. point the local API at port 8999 and identify `ERR_CONNECTION_REFUSED` in Network;
4. restore 8000 and distinguish a client-disabled short submission from a server 422; and
5. use `git diff` to prove only intended changes remain.

## 14. Recommended local learning environment

### 14.1 Verify tools and create a safe branch

Commands assume macOS/Linux/WSL. From the repository root:

```bash
pwd
git --version
node --version
pnpm --version
uv --version
```

The reproducible baseline is Node 24, pnpm 9.6.0, and Python 3.11 managed by uv. Use the official
[Git](https://git-scm.com/downloads/), [Node.js](https://nodejs.org/en/download),
[pnpm](https://pnpm.io/installation), [uv](https://docs.astral.sh/uv/getting-started/installation/), and
[Visual Studio Code](https://code.visualstudio.com/download) pages. Another plain-text code editor is fine.
Use “Open Folder” on the repository root; create folders/files in its file tree and preserve exact extensions such as
`.py` and `.tsx`. A word processor does not save source code safely.

If you do not have the repository yet:

```bash
git clone https://github.com/jinyu-cai/weakspot-english-coach.git
cd weakspot-english-coach
git status --short --branch
```

```bash
corepack enable
corepack prepare pnpm@9.6.0 --activate
git status --short --branch
```

If the working tree is clean, create `learning/first-lab`. If `M` or `??` lines already exist, preserve that work and
practice in a fresh clone instead of using destructive reset/restore commands.

```bash
git switch -c learning/first-lab
git status --short --branch
```

The branch line should begin with `## learning/first-lab`. Make one Markdown edit, inspect `git diff`, and stage only
named files with `git add path/to/file`. Local learning does not require push.

Git's minimum model:

```text
working tree -> selected stage -> local commit -> pushed branch -> reviewed PR -> merge
```

Inspect `git diff`, stage only named files, inspect `git diff --staged`, and never include `.env` or unrelated changes.

### 14.2 Start the no-key backend and frontend

Terminal A:

```bash
cd apps/api
uv sync
DYNAMODB_ENDPOINT_URL= OPENAI_API_KEY= QWEN_TTS_API_KEY= \
QWEN_MODEL_STUDIO_API_KEY= QWEN_EMBEDDING_API_KEY= \
uv run python -m scripts.dev_server
```

This starts in-process moto, creates a temporary table, uses fake AI, and listens on 8000. Keep it running. Terminal B:

```bash
cd apps/web
pnpm install --frozen-lockfile
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 pnpm dev
```

Open frontend `http://localhost:3000`, health `http://localhost:8000/api/v1/health`, and Swagger
`http://localhost:8000/docs`. Diagnose at least five words. Require a visible result, a Network 200, and a backend log.
Press `Ctrl+C` in both terminals to stop; moto data then disappears.

### 14.3 Swagger and a cookie-preserving curl lab

Swagger is the interactive API page at `http://localhost:8000/docs`. In Swagger, predict then run
health, model catalog, Diagnose, profile, and one Coach mission. Expand the Memory
create/retrieve/traces/next-action schemas, but do not execute them yet: Section 14.3.1 needs the
guest's three daily Memory operations for two creates and one retrieval.

curl is a terminal program that sends one HTTP request and prints the response — a fast way to test
the backend without a browser. Unlike a browser, curl does not persist cookies, so these commands use
`-c` to write the guest cookie to a file and `-b` to read it back, keeping one guest identity:

```bash
curl -i -sS \
  -c /tmp/weakspot-cookie.txt \
  -b /tmp/weakspot-cookie.txt \
  http://localhost:8000/api/v1/auth/me

curl -i -sS \
  -c /tmp/weakspot-cookie.txt \
  -b /tmp/weakspot-cookie.txt \
  -X POST http://localhost:8000/api/v1/diagnose \
  -H 'Content-Type: application/json' \
  -d '{
    "userId":"demo-user-001",
    "text":"Yesterday I go to the library.",
    "diagnosisMode":"fast",
    "outputLanguage":"en"
  }'
```

The body `userId` is required by the compatibility schema, but the route replaces it with the cookie-derived identity.
Use the same `-c/-b` jar for profile/history so you observe one learner. `-i` exposes status and headers.

```bash
curl -i -sS \
  -c /tmp/weakspot-cookie.txt \
  -b /tmp/weakspot-cookie.txt \
  http://localhost:8000/api/v1/profile/ignored-by-server

curl -i -sS \
  -c /tmp/weakspot-cookie.txt \
  -b /tmp/weakspot-cookie.txt \
  http://localhost:8000/api/v1/history/ignored-by-server
```

Both compatibility path parameters are overwritten by cookie identity. Expect Profile to reflect the Diagnose and
History to contain that submission; changing the path word must not expose another learner.

Predict these results before clicking Swagger's Execute button:

| Experiment | Expected boundary |
| --- | --- |
| `GET /api/v1/health` | 200 and `status="ok"` |
| Diagnose text shorter than the schema minimum | 422, no model call |
| Guest over quota | 429 |
| Non-owner calls Input Lab 2 | 403 |
| Qwen TTS is not configured | 503 and browser fallback |

Generate a specific mission with the same cookie options:

```bash
curl -i -sS \
  -c /tmp/weakspot-cookie.txt \
  -b /tmp/weakspot-cookie.txt \
  -X POST http://localhost:8000/api/v1/coach/missions \
  -H 'Content-Type: application/json' \
  -d '{
    "durationMinutes": 5,
    "modality": "text",
    "energy": "normal",
    "generationMode": "deep",
    "preferredType": "vocabulary_in_action",
    "outputLanguage": "en"
  }'
```

#### 14.3.1 Four vertical labs: Memory, Plan, Practice, and Chat

Use Swagger so its browser session keeps one guest cookie; with curl, retain the same `-c/-b` jar. Predict each result
and copy generated IDs into the next request.
If you already executed Memory writes/retrieval, stop Terminal A and restart
`uv run python -m scripts.dev_server` to create a fresh moto table before this lab. The curl and browser cookie jars
represent different guest identities and do not consume each other's quota.

**Memory.** `POST /api/v1/memory`:

```json
{
  "kind": "preference",
  "canonicalKey": "preference.feedback_style",
  "content": "The learner prefers concise feedback with one example.",
  "evidence": "Please keep feedback short and show one example.",
  "confidence": 0.95,
  "importance": 0.85,
  "pinned": false
}
```

Expect active manual memory and an ID. Create a contrasting second item through the same endpoint:

```json
{
  "kind": "goal",
  "canonicalKey": "goal.ielts_speaking",
  "content": "The learner wants to improve IELTS speaking fluency.",
  "evidence": "I am preparing for IELTS speaking.",
  "confidence": 0.95,
  "importance": 0.9,
  "pinned": false
}
```

Now retrieve with
`{"query":"How should feedback be formatted?","tokenBudget":700,"limit":6}` at
`POST /api/v1/memory/retrieve`. Compare both IDs, rank, slot, and score breakdown in `memoryPack.items` and
`/memory/traces`: the feedback preference should be more relevant, although a critical slot may still retain the goal.
Verify `estimatedTokens <= effectiveTokenBudget <= tokenBudget`, then inspect `/memory/next-action`. A budget of 20
returns 422 because the minimum is 100.

**Plan.** Send `{"userId":"ignored","errorScope":"weekly","outputLanguage":"en"}` to `POST /api/v1/plan`.
Expect exactly 7 days × 2 tasks × 3 exercises and initial progress 0/14. `errorScope:"forever"` returns 422; `"all"`
still means a recent bounded sample across all time, not unlimited history.

**Practice.** Generate with:

```json
{
  "userId": "ignored",
  "targetSkillCode": "grammar.verb_tense",
  "practiceType": "fix_sentence",
  "outputLanguage": "en"
}
```

Copy `exercise.id` into `/practice/submit` with an answer and
`"clientAttemptId":"lab-attempt-0001"`. Expect `grade`, `attempt`, `updatedSkill`, and `learningEvidence`. Exact replay
returns the stored result without another mastery change; reusing the ID with a different answer returns 409. An
unknown exercise ID returns 404.

**Chat.** Create `/chat/sessions` with
`{"userId":"ignored","topic":"Ordering coffee politely","textModelMode":"fast"}`. Copy `session.id`; send:

```json
{
  "userId": "ignored",
  "sessionId": "replace-with-session-id",
  "text": "Could I have a coffee, please?",
  "clientMessageId": "lab-message-0001"
}
```

Expect atomic `userMessage`/`assistantMessage`, recall metadata, and `duplicate=false`; the messages endpoint then shows
the pair. Exact replay returns `duplicate=true`. If the guest quota returns 429 first, restart the moto learning server
or clear the cookie and run only this lab; 429 is not a Chat-contract failure.

### 14.4 A fixed failure-time debugging tree

```text
no Network request             -> frontend event/validation
immediate connection refused   -> service/URL/port
4xx response                   -> contract, identity, permission, quota
ordinary API abort near 20 s   -> default browser total timeout
model API abort near 110 s     -> LLM browser total timeout
Diagnose abort near 610 s      -> Diagnose streaming total timeout (600 s upstream + margin)
earlier 502/503/504            -> backend/provider/proxy
backend completed after abort  -> timeout budgets disagree
```

Keepalive whitespace does not reset a browser total timeout. Record path, status, duration, and request ID before
calling a failure “the network.”

Read Python tracebacks from the bottom exception upward to the first repository file/line. Repeat the same input after a
fix and add a regression test.

### 14.5 Real services come last

Only after fake mode is understood should real services become a separate cloud-operations lab. `.env.example` contains
placeholders, and `create_table` can change the current AWS account and incur cost. First confirm there is no
`your_*`/placeholder value, choose real AWS or local DynamoDB (not both), identify account/region/table/IAM permissions,
set provider spend limits, and know cleanup/rollback. Beginners should remain on moto/fake. Read
`docs/ALIBABA_QWEN_DEPLOYMENT.md` and `apps/api/README.md` before any real-resource command. Never commit `.env`.

To combine fake text AI with real Qwen TTS, keep `USE_FAKE_AI=true` and configure only a backend
`QWEN_TTS_API_KEY`, or intentionally reuse the backend Model Studio/embedding key. Never create a
`NEXT_PUBLIC_QWEN_*_KEY`.

## 15. Understanding the tests

Test levels prove different things:

| Level | Proves | Does not prove |
| --- | --- | --- |
| unit | One formula/branch | HTTP or external systems |
| contract | Two layers agree on shape/bounds | Complete user journey |
| integration | Route/service/repository with fake/moto | Live provider/public network |
| browser end-to-end | Rendered user path | Every failure combination |
| live probe | One provider/configuration works now | Long-term reliability |

A fixture is prepared test state; a fake implements the same boundary with deterministic data; a mock controls or
records calls; moto simulates AWS/DynamoDB in process.

This is a **conceptual fragment**, not a standalone test: the real module creates `client` and fake/moto fixtures.

```py
# Arrange
payload = {
    "userId": "demo-user-001",
    "text": "Yesterday I go to school.",
    "outputLanguage": "en",
}

# Act
response = client.post("/api/v1/diagnose", json=payload)

# Assert both transport and business contract
assert response.status_code == 200
assert response.json()["diagnostic"]["errors"][0]["code"] == "grammar.verb_tense"
```

A 200-only assertion does not prove evidence or persistence. A service-only unit test does not prove auth, HTTP, or
JSON.

| Command | What it proves |
| --- | --- |
| `uv run python -m scripts.smoke_test` | Imports, routes, schemas, pure rules |
| `uv run python -m scripts.integration_test` | Main end-to-end business loop |
| `uv run python -m scripts.coach_contract_test` | Mission variants and boundaries |
| `uv run python -m scripts.contract_boundary_test` | Narrow downstream contracts and deterministic bounds |
| `uv run python -m scripts.storage_contract_test` | DynamoDB size/error mapping and storage boundaries |
| `uv run python -m scripts.dedup_test` | Idempotency and deletion rollback |
| `uv run python -m scripts.diagnosis_claim_test` | Concurrent/retried diagnosis claims |
| `uv run python -m scripts.single_sentence_evidence_test` | Grounded quotes, explicit success, verification states, recent window |
| `uv run python -m scripts.learning_loop_test` | Evidence updates and learning-state transitions |
| `uv run python -m scripts.plan_lifecycle_test` | Plan generation/task lifecycle and limits |
| `uv run python -m scripts.memory_agent_test` | Memory lifecycle and decisions |
| `uv run python -m scripts.stealth_input_test` | Opportunity gates, concurrency, Input pages |
| `uv run python -m scripts.input_output_test` | Retell, required reuse, delayed retrieval, retry dedupe |
| `uv run python -m scripts.memory_benchmark` | Recall, stale suppression, token budget |
| `pnpm lint` | ESLint rules |
| `pnpm exec tsc --noEmit` | Frontend type correctness |
| `pnpm test:chat-import` | Ordered Chat Import splitting stays within message, conversation, and UTF-8 byte limits |
| `pnpm test:timeouts` | 20/110-second call sites and the total deadline through slow response bodies |
| `pnpm build` | Next.js production compilation |

Fake AI and moto prove contracts and business logic, not live provider availability. Production still needs a small
health/model/feature probe. Run `tsc` separately; do not treat a successful Next build as sufficient type checking.

The frontend currently has no Vitest/Jest/Playwright browser suite. Lint, types, the Import/timeout regressions, and
build do not prove click behavior, hook cleanup, localStorage resume, accessibility, or Network error rendering. Run
the manual Chapter 13.6 lab before release.

Read a failure from the bottom: find the repository file/line, compare expected with actual, and inspect the response
body. `assert 422 == 200` should lead you to Pydantic `detail`; do not change the expectation merely to make it green.
Use Red → Green → Refactor: first observe the new test fail, make the smallest fix, then clean structure without
changing behavior.

## 16. Deployment architecture

Deployment means turning source files into a repeatable public service:

| Term | Plain meaning | Current project |
| --- | --- | --- |
| build | Produce checked, runnable output from source | Next.js production bundle or Docker image |
| image | Immutable filesystem/runtime recipe | Backend image built from `apps/api/Dockerfile` |
| container | One running instance of an image | FastAPI process bound to localhost:8000 |
| reverse proxy | Public entry that forwards requests | Nginx terminates HTTPS and forwards API traffic |
| DNS | Maps a host name to an IP/origin | Stable API hostname points to the active origin |
| TLS/HTTPS | Encrypts and authenticates the connection | Certificate is handled before FastAPI |
| Git SHA | Exact source revision identity | Proves which code should be running |
| rollback | Return to the last known-good revision/config | Retained backup/image plus a tested procedure |

```text
merge main -> Vercel builds apps/web

Nginx :443
  -> Docker FastAPI on localhost:8000
  -> provider APIs and DynamoDB
```

`apps/api/deploy/start_backend.sh` builds the image, creates/configures the table idempotently, replaces the container,
and checks health:

```bash
set -euo pipefail
cd "$(dirname "$0")/.."          # repo-relative: works from any working directory

docker compose build
docker compose run --rm api python -m scripts.create_table
docker compose up -d
# then poll http://127.0.0.1:8000/api/v1/health up to 30 times, 2 s apart,
# and exit non-zero if the container never becomes healthy
```

Secrets live only in the backend environment. “Idempotent table setup” means re-running setup converges on the required
table/index configuration instead of blindly creating duplicate resources.

The stable API hostname is separate from its origin. Before switching traffic, both origins must run the intended Git
SHA and compatible configuration. CORS and cookies care about the public origin (`scheme://host:port`), while Nginx
cares about the private upstream; confusing those two produces failures that look like “the network.”

The deployment configuration audited on **2026-07-30** exposes DeepSeek deep/fast for text, Qwen
`text-embedding-v4` for semantic retrieval, Qwen3-TTS-Flash for Coach speech, and OpenAI for Realtime plus the opt-in
adaptive planner. This is a dated configuration snapshot, not an eternal product guarantee: verify the safe model
catalog and one bounded feature probe after every deploy. These are separate configuration paths; a single “AI
provider” label would be misleading.

A minimum rollback-capable deployment proof is:

```text
record target Git SHA
  -> back up existing code without printing .env
  -> deploy the exact SHA
  -> rebuild container + idempotent table setup
  -> local /api/v1/health = 200
  -> public health = 200
  -> safe model catalog matches expectation
  -> one bounded feature probe
  -> retain rollback package
```

`docker compose up` returning success is not enough; the container may still restart, Nginx may point elsewhere, or the
public hostname may still serve an older origin. Likewise, public health 200 proves reachability, not the Git SHA,
model routing, database permissions, TTS format, or a complete learner flow.

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

- **Concurrency:** two requests read `observationCount=4`, both write 5, and lose the expected value 6. Conditions,
  leases, optimistic versioning, or transactions protect different multi-step cases.
- **Token estimates:** an estimate of 680 is not guaranteed to equal the provider tokenizer's 680. The 0.85 safety
  ratio leaves room for tokenizer drift.
- **Benchmark scope:** the current secret-free lexical fixture hits four of five cases (Recall@6=0.80). It is a
  regression floor, not proof of overall recall for real users; even a future 1.00 on five fixtures would not prove
  production quality.
- **Forgetting:** retrieval must exclude an item immediately; physical TTL deletion may happen later.
- **Sync SDKs:** a 20 ms boto3 call may not justify an async rewrite. A 60-second provider wait saturating workers
  should be measured before selecting async clients, queues, or larger pools.
- **Coach persistence:** mission scaffolds are often temporary; resulting diagnosis/chat evidence is durable.
- **Picture limits:** the current text path diagnoses English, not visual factual correctness.
- **Vocabulary limits:** one word-choice error is provisional evidence, not proof of a permanent weakness.
- **Session Win limits:** localStorage improves one browser's return experience; it is not cross-device progress.
- **Idempotency strength:** Diagnose, Practice, Chat, and Input source analysis use conditional claims with busy 409
  behavior. Input production attempts only deduplicate serial retries through `clientAttemptId`/evidence ID; two truly
  concurrent requests may still create duplicate ActivityRuns. Do not promise stronger behavior until an attempt claim
  exists.

## 19. Eight-stage path for a true beginner

A “stage” is a suggested 4–8 hours, not a calendar deadline. If classes are busy, spend two weeks on one stage. Do not
advance until you can produce the acceptance evidence.

### Stage 1: computer, terminal, Git, and HTTP

Prerequisite: none. Study Chapters 0–3 and 14.1.

Tasks:

1. use `pwd`, `ls`, and `cd` to locate the repository root, `apps/api`, and `apps/web`;
2. explain localhost, ports 3000/8000, a URL, and status 200/422/500; and
3. change one Markdown line on a disposable branch, inspect it with `git diff`, then either commit it intentionally or
   discard the practice clone safely.

Acceptance: without looking, draw browser → frontend → backend → provider/database and explain why a secret must never
enter `NEXT_PUBLIC_*`.

### Stage 2: run the first no-key loop

Prerequisite: Stage 1. Study 14.2–14.4. Leave real services in 14.5 for later.

Tasks:

1. start fake/moto backend and frontend in two terminals;
2. complete one Diagnose and find its method, status, payload, and response in Network;
3. call Diagnose then Profile with one curl cookie jar; and
4. deliberately create connection-refused and 422 failures, then recover.

Acceptance: use request existence, status, duration, and backend log—not a guess—to locate the failing layer.

### Stage 3: Python, Pydantic, and FastAPI

Prerequisite: a running project. Study Chapters 4–6.

Run the complete `python_basics_lab.py` in 4.2.3, predict its two lines, change 42 to 80, and restore/delete it. Trace
the health route. Then add a temporary `GET /api/v1/debug/hello`: predict 404 before router registration, register it,
confirm 200, and remove or isolate the experiment.

Acceptance: explain what model, route, service, and repository each should and should not do, and provide one concrete
422 input.

### Stage 4: Diagnose, repository, and database

Prerequisite: Stage 3. Study Chapters 7, 9, and 10.

Trace one Diagnose request and list every item it writes. Calculate one mastery update on paper. Given five PK/SK rows,
predict a `begins_with` Query. Run
`DYNAMODB_ENDPOINT_URL= uv run python -m scripts.diagnosis_claim_test` from `apps/api` to observe controlled concurrent
`[200, 409]`; then repeat a completed request serially and observe `duplicate=true`. Ordinary repeated clicks may not
overlap, so absence of 409 there is not a failure.

Acceptance: explain why a complete learner archive and a bounded model context must not share one hidden limit.

### Stage 5: TypeScript, React, and the frontend/backend boundary

Prerequisite: Stage 2. Study Chapter 13.

Trace DiagnosticInput click → state → API client → response → report. Change the button copy and character count. Show
idle, loading, success, valid-empty, and error states. Verify with `pnpm lint`, standalone `tsc`, and build.

Acceptance: explain props versus state versus effect, and locate an API error from the Network response instead of only
reading a toast.

### Stage 6: AI, Memory, and adaptive decisions

Prerequisite: the basic data flow. Study Chapters 8, 11, and 12.

Explain provider/model/API/SDK and structured output versus grounding. Create two Memory items, retrieve them, calculate
score components, and inspect the trace. Explain why lexical fallback still works when embedding fails. Follow the
`CoachMissionAI` union and explain why task context is not learner evidence.

Acceptance: on a disposable branch, change one retrieval weight, run the benchmark, observe ordering, and use the diff
to restore it. Never describe the current five-case Recall@6=0.80—or a future 1.00 on the same tiny fixture—as overall
recall for real learners.

### Stage 7: tests, debugging, and a safe change

Prerequisite: one small frontend/backend change. Study Chapters 15, 17, and 18.

Choose one boundary, observe a failing test first, implement the smallest fix, then refactor and run the smallest
relevant suite plus full checks. Keep this evidence:

```text
files changed
one success input and one failure input
commands run
expected and actual result
what these checks still cannot prove
```

### Stage 8: deployment concepts and capstone

Prerequisite: Stages 1–7. Study Chapters 16 and 22–24.

Build Chapter 23 from an empty directory and obtain `2 passed`, an intentional browser/API 200, and an intentional 422.
Explain image/container, Nginx, TLS, DNS, Git SHA, and rollback. Write a read-only production verification checklist; do
not change a real origin without explicit authority and safe secret handling.

Final acceptance: demonstrate “run → modify → create a failure → locate → fix → test → explain the whole path” to a
classmate without consulting the answer key. That is application; reading advanced vocabulary is not.

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
| boto3 | Official Python library for AWS services such as DynamoDB |
| moto | Library that simulates AWS/DynamoDB in-process for tests |
| OpenAPI / Swagger | Machine-readable route description, shown as the interactive `/docs` page |
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

For each cross-layer feature, verify this checklist:

1. Both development guides, README, backend reference, frontend reference, and local test guide name the same behavior.
2. Pydantic and TypeScript unions contain the same variants.
3. Fake AI, mocks, i18n, and tests cover the new branch.
4. Task/context text remains untrusted; learner evidence remains grounded.
5. Retryable writes are idempotent and concurrent claims cannot double-apply effects.
6. User-facing archives paginate fully while model contexts stay explicitly bounded.
7. Every upstream length is compatible with every narrower downstream model and DynamoDB item limit.
8. The learning explanation contains a concrete success example and at least one failure/edge case.

## 23. Rebuild a minimal WeakSpot from an empty directory

This capstone does not copy the production repository. It reduces its most important boundaries to one actually
runnable vertical slice. Code blocks with an explicit file path are complete files. Blocks marked **conceptual
fragment** explain a later extension and cannot run alone.

When finished, you will have:

- one React/Next.js input page;
- one FastAPI `/diagnose` endpoint;
- Pydantic request/response validation;
- one replaceable diagnosis service;
- one in-memory repository that can later become DynamoDB;
- two automated tests with a known result; and
- a browser-button-to-storage flow that you can trace end to end.

### 23.1 Initialize the backend and frontend

First verify the four tools:

```bash
git --version
node --version
pnpm --version
uv --version
```

Run the following in a learning directory outside this repository. `pnpm create` and first-time dependency installation
need network access:

```bash
mkdir mini-english-coach
cd mini-english-coach
git init
mkdir -p api/app
cd api
uv init --bare --python 3.11
uv add fastapi "uvicorn[standard]" pydantic
uv add --dev pytest httpx
cd ..
pnpm create next-app@16.2.6 web --ts --eslint --tailwind --app --use-pnpm \
  --no-src-dir --import-alias "@/*" --disable-git --yes
mkdir -p web/lib
touch .gitignore
pwd
git status --short
```

Record the absolute `pwd` output for Section 23.9. `git status --short` should show both `api/` and `web/` under the
root repository. Open `mini-english-coach` in the editor and create an empty `api/app/__init__.py`; it explicitly makes
`app` a Python package. Save this complete root `.gitignore` so environments, dependencies, caches, and secrets cannot
be staged as source:

```gitignore
api/.venv/
**/__pycache__/
**/.pytest_cache/
*.py[cod]
.coverage
htmlcov/

web/node_modules/
web/.next/

.env
.env.local
.env.*.local
.DS_Store
```

Run `git status --short --ignored`; `.venv`, `node_modules`, and `.next` should appear with `!!`, while source remains
`??`. The final layout is:

```text
mini-english-coach/
├── .gitignore
├── api/
│   ├── pyproject.toml
│   ├── uv.lock
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── models.py
│   │   ├── service.py
│   │   └── repository.py
│   └── test_api.py
└── web/
    ├── package.json
    ├── pnpm-lock.yaml
    ├── app/layout.tsx
    ├── app/page.tsx
    └── lib/api.ts
```

`uv init --bare` creates project configuration without another example `main.py` that could be confused with
`app/main.py`. Root `git init` keeps API and Web in one repository; `--disable-git` prevents the scaffold from creating
a nested `web/.git`. Build only one vertical feature before adding many tables or pages.

### 23.2 Define the contract

Save this complete file as `api/app/models.py`:

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

Start with models because browser, route, service, and tests must agree on valid input and complete output. `Literal`
prevents an AI or caller from silently inventing unlimited category names.

### 23.3 Isolate storage behind a repository

Save as `api/app/repository.py`:

```py
from copy import deepcopy

_submissions: dict[str, dict] = {}


def save_submission(item: dict) -> None:
    _submissions[item["submissionId"]] = deepcopy(item)


def get_submission(submission_id: str) -> dict | None:
    item = _submissions.get(submission_id)
    return deepcopy(item) if item else None
```

This is not a production database, but the route does not need to know whether the item lives in a dictionary or
DynamoDB. A later repository implementation can replace the internals while preserving its public functions.

### 23.4 Write a replaceable service

Save as `api/app/service.py`:

```py
from app.models import DiagnoseResponse, ErrorItem


def diagnose_text(text: str) -> DiagnoseResponse:
    errors: list[ErrorItem] = []
    corrected = text

    # Use a deterministic rule while learning; replace this function's
    # internals with structured AI only after the vertical slice works.
    if "Yesterday I go" in text:
        corrected = text.replace("Yesterday I go", "Yesterday I went")
        errors.append(ErrorItem(
            code="grammar.verb_tense",
            original="Yesterday I go",
            corrected="Yesterday I went",
            explanation="A finished past event needs the past-tense verb.",
        ))

    return DiagnoseResponse(
        submissionId="",  # The route owns system ID generation.
        score=max(0, 100 - len(errors) * 12),
        correctedText=corrected,
        errors=errors,
    )
```

The service answers “how do we diagnose?” It does not read HTTP cookies or render buttons. When AI replaces the rule,
it must still return `DiagnoseResponse`.

This is a **conceptual fragment** because `client`, `messages`, key, timeout, and provider adapter are not defined:

```py
result = client.chat.completions.parse(
    model="your-model",
    messages=messages,
    response_format=DiagnoseResponse,
)
return result.choices[0].message.parsed
```

The production project then revalidates evidence quotes, taxonomy, and lengths. Structurally valid output is not
automatically grounded in the learner's text.

### 23.5 Expose it through FastAPI

Save as `api/app/main.py`:

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

Do not start it yet. Complete the test and frontend first; Section 23.9 gives the exact two-terminal run.

### 23.6 Write the frontend request boundary

Save this complete file as `web/lib/api.ts`; do not copy `fetch` into every button:

```ts
export type ErrorItem = {
  code: string
  original: string
  corrected: string
  explanation: string
}

export type DiagnoseResponse = {
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
  if (!response.ok) {
    const message = await response.text()
    throw new Error(`Diagnose failed (${response.status}): ${message}`)
  }
  return response.json()
}
```

The production `apiFetch` adds base URL, cookies, language/model headers, timeout, and structured error handling.

### 23.7 Build the smallest React page

The default layout may download Google Fonts during build, which makes a first offline build fail for an unrelated
network reason. Replace `web/app/layout.tsx` with this complete local-font-independent file:

```tsx
import type { Metadata } from "next"
import type { ReactNode } from "react"
import "./globals.css"

export const metadata: Metadata = {
  title: "Mini English Coach",
  description: "A from-zero full-stack learning project",
}

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
```

Replace `web/app/page.tsx` with:

```tsx
"use client"

import { useState } from "react"
import { diagnose, type DiagnoseResponse } from "@/lib/api"

export default function HomePage() {
  const [text, setText] = useState("")
  const [result, setResult] = useState<DiagnoseResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function submit() {
    setLoading(true)
    setError("")
    try {
      setResult(await diagnose(text))
    } catch (value) {
      setError(value instanceof Error ? value.message : "Unknown error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: "40px auto", padding: 24 }}>
      <h1>Mini English Coach</h1>
      <textarea
        aria-label="English text"
        rows={6}
        style={{ display: "block", width: "100%", marginBlock: 16 }}
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      <p>{text.length} characters</p>
      <button
        disabled={loading || text.trim().length < 10}
        onClick={submit}
      >
        {loading ? "Analyzing..." : "Analyze"}
      </button>
      {error ? <p role="alert">{error}</p> : null}
      {result ? (
        <section>
          <h2>Score: {result.score}</h2>
          <p>{result.correctedText}</p>
          {result.errors.map((item) => (
            <article key={`${item.code}-${item.original}`}>
              <strong>{item.original} → {item.corrected}</strong>
              <p>{item.explanation}</p>
            </article>
          ))}
        </section>
      ) : null}
    </main>
  )
}
```

This already contains an async state machine: idle, loading, success, and error. The production UI adds navigation,
resume state, internationalization, and richer result components.

### 23.8 Write the first automated test

Save as `api/test_api.py`:

```py
from fastapi.testclient import TestClient
from app.main import app
from app.repository import get_submission

client = TestClient(app)


def test_diagnose_past_tense() -> None:
    response = client.post(
        "/diagnose",
        json={"text": "Yesterday I go to school.", "outputLanguage": "en"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["correctedText"] == "Yesterday I went to school."
    assert payload["errors"][0]["code"] == "grammar.verb_tense"
    assert get_submission(payload["submissionId"]) == payload


def test_rejects_short_text() -> None:
    response = client.post("/diagnose", json={"text": "Hi"})
    assert response.status_code == 422
```

From `mini-english-coach/api`, run:

```bash
uv run pytest -q
```

The important expected output is:

```text
2 passed
```

The first test proves the response and repository side effect; the second proves Pydantic rejects short input before
the service. If you see an import error, run `pwd` and confirm the current path ends in `/mini-english-coach/api`.

As layers are added, add tests at the same time:

```text
identity      -> body userId cannot impersonate another learner
AI            -> fake AI contract + malformed JSON
DynamoDB      -> moto repository/integration test
idempotency   -> same clientAttemptId does not write twice
pagination    -> more than one page still returns the complete user view
```

### 23.9 Run it in two terminals and prove success and failure

Terminal A:

```bash
cd /replace/this/with/the/absolute/path/from-23.1/api
uv run uvicorn app.main:app --reload --port 8000
```

This is the same command Section 5.1 decodes piece by piece. Open `http://localhost:8000/docs`, then
verify:

```bash
curl -i http://localhost:8000/health
curl -i -X POST http://localhost:8000/diagnose \
  -H 'Content-Type: application/json' \
  -d '{"text":"Yesterday I go to school.","outputLanguage":"en"}'
```

Expect a 200 `{"ok":true}`, then a 200 containing score 88, `Yesterday I went`, and one
`grammar.verb_tense` error. Deliberately verify the boundary:

```bash
curl -i -X POST http://localhost:8000/diagnose \
  -H 'Content-Type: application/json' \
  -d '{"text":"Hi","outputLanguage":"en"}'
```

Expect 422 with a `detail` entry for text length. That is validation, not a server crash.

Terminal B:

```bash
cd /replace/this/with/the/absolute/path/from-23.1/web
pnpm dev --port 3000
```

The teaching API allows only `http://localhost:3000`. Confirm the startup log also says 3000. If that port is busy,
stop the old frontend rather than accepting 3001, whose different origin would be blocked by CORS. If you intentionally
change the port, update `allow_origins` and restart the API as well.

Open `http://localhost:3000`, enter the same sentence, and find `/diagnose` 200 in Network. The page should show score,
rewrite, and error. Stop Terminal A with `Ctrl+C`, click again, observe the connection error, and restart the backend.

Finally, from `web`, run:

```bash
pnpm lint
pnpm exec tsc --noEmit
pnpm build
```

After all three pass, stop both terminals with `Ctrl+C`. Keep the directory for practice or move it to Trash through
the file manager; do not use a recursive delete command when unsure of the path.

### 23.10 Expand one boundary at a time

Recommended order:

1. Diagnose plus in-memory repository.
2. Replace storage with DynamoDB and learn PK/SK.
3. Add profile and skill mastery.
4. Add practice generation/submission with `clientAttemptId` retry idempotency.
5. Add bounded text chat with persisted sessions/messages.
6. Add OAuth cookie identity and rate limits.
7. Add Memory retrieval with fixed item/token budgets.
8. Add the Coach scheduler, then structured generation.
9. Add Realtime/TTS, cloud deployment, and multiple providers last.

At every stage require:

```text
Swagger/curl invocation works
browser shows loading/success/error
automated tests cover success and at least one failure boundary
no secret enters browser code or Git
```

At this point you are not merely “reading WeakSpot.” You can split a product requirement into contract, business logic,
storage, UI, and verification, then grow a similar application safely.

## 24. Knowledge checks and answer key

Use this chapter to test transferable understanding, not memorization. Cover the answers and write predictions first.
A knowledge point is usable when you can:

```text
explain it in plain language
+ locate the current code boundary
+ predict one success and one failure case
+ name the test, status code, or trace that verifies it
```

### 24.1 Questions

Exercise format: write “prediction → reason → code entry point → verification method” before checking the answers.

1. A `POST /api/v1/diagnose` body omits required text. Should it return 400, 401, 422, or 500? Is the model called?
2. Does `nickname: str | None` let a caller omit `nickname` entirely? What does?
3. `routes/debug.py` and its decorator exist, but `include_router` is missing. What does the request return?
4. A guest changes body `userId` to the owner. Which identity writes to DynamoDB?
5. How does a concurrent retry of the same diagnosis avoid a second model charge and mastery update?
6. AI returns valid JSON, but an error `originalText` is absent from learner text. Will Pydantic catch it? What must
   happen?
7. Does one grounded article error immediately confirm a weakness? What do two same-day sources and three cross-day
   sources mean?
8. The model reports no preposition error. May the system automatically record preposition success?
9. What do text Chat, OpenAI Realtime, Qwen TTS, and browser ASR each consume and produce?
10. Why convert `73.5` to `Decimal("73.5")` for DynamoDB? Should business behavior wait for TTL deletion?
11. There are 25 lifetime opportunities with five failures; the last 20 contain four. How should lifetime and recent
    rates be represented?
12. Using section 11.2 weights, what score comes from `.80/.50/.90/.70/.20/1.0`? What if pinned?
13. Why can four individually correct top-one practice calls still make a poor mixed session without slot/size?
14. Why does a browser still call the old API after a Vercel variable changes without redeployment?
15. Does public health 200 prove the new release is live? What other evidence is minimally required?
16. From an unfamiliar terminal, `cd apps/api` says “No such file or directory.” What should you run first, and how do
    you identify the repository root?
17. Before creating a learning branch, `git status --short` already shows someone else's `M` and `??`. Why must you not
    reset/restore them, and what is the safe alternative?
18. After Analyze is clicked in Chapter 23, how should `loading/result/error` represent idle, loading, success, and
    error?
19. How does “no Network request” differ from a 422 response, and what evidence should you record before debugging?
20. Ordinary API work has 20 seconds, most model work 110, and streaming Diagnose 610. Why is clearing the timer when
    `fetch()` returns headers still a bug, and which test proves the body is covered?
21. Evidence sends `outcome="success"` and `supportLevel=2`. What outcome is stored, and why must an exact
    `clientEventId` replay not increment state?
22. The Chapter 23 frontend starts on 3001; health and curl work, but the browser reports CORS. Why, and what is the
    smallest fix?
23. After Chapter 23 shows `2 passed`, lint, tsc, build, browser 200, and intentional 422, what has been proved—and what
    remains unproved?

### 24.2 Answers and verification entry points

The answers name observable boundaries; do not memorize only the final status code or number.

1. **422**. Pydantic rejects it before business logic, so no model call should occur. Verify in Swagger.
2. No; it permits `None`. `nickname: str | None = None` lets the caller omit it.
3. **404**. A module is not an HTTP route until `app/main.py` registers its router.
4. The server-derived guest identity. The route overwrites body `userId`.
5. A normalized input hash, conditional claim, and completed draft let retries share one result. Run
   `scripts.diagnosis_claim_test`.
6. Pydantic validates shape, not substring grounding. The grounding gate must drop the claim. Run
   `scripts.single_sentence_evidence_test`.
7. One source is `candidate`; two independent, sufficiently confident sources are `observed`; at least three sources
   across at least two days are `confirmed`. Repetition inside one source does not count.
8. No. Absence of error is not explicit success; success needs an opportunity, success outcome, sufficient confidence,
   and an exact learner quote.
9. Text exchanges JSON; Realtime continuously exchanges audio and produces transcript; TTS turns existing text into a
   complete audio file; ASR turns learner voice into editable text.
10. boto3's DynamoDB number contract uses Decimal. Business filtering is immediate; TTL is eventual physical cleanup.
11. Keep `failureCount=5 / opportunityCount=25` for lifetime audit and
    `recentFailureCount=4 / recentOpportunityCount=20 = .20` for current risk.
12. `.50*.80 + .15*.50 + .15*.90 + .10*.70 + .05*.20 + .05*1 = .74`; pinned becomes `.89`, before any
    verification factor.
13. All four can choose the same skill, stage, and fingerprint. Slot/size lets policy rotate skill, format, and
    replay/variation/transfer across the batch.
14. `NEXT_PUBLIC_*` is compiled into the bundle at build time. A new build/deployment is required.
15. No. Verify deployment Git SHA, container health, the safe model catalog, intended file/image version, at least one
    bounded feature probe, and a rollback artifact.
16. Run `pwd`, then `ls`; find the root containing `apps/api`, `apps/web`, and the root README before changing
    directories. Do not keep guessing path fragments.
17. `M` means modified and `??` untracked; they may be another person's work. Preserve and report them. Create the
    learning branch only from a clean tree, or use a fresh clone; stage named files instead of destructively clearing.
18. Idle has `loading=false`; click clears the old error and sets `loading=true`; success writes result, failure writes
    error; `finally` restores `loading=false` either way. Without `finally`, an exception can leave the button stuck.
19. No request points first to the click handler, disabled validation, or Console. A 422 reached FastAPI and points to
    the request contract/body; inspect response `detail`. Record method/path, status, duration, payload, response, and
    whether a backend log exists.
20. Native `fetch()` resolves when headers arrive while JSON/audio may still stream. Clearing then can wait forever on
    the body. `pnpm test:timeouts` uses a fake response with immediate headers and delayed body, and also checks the
    real call sites: Diagnose passes the 610-second budget, other model operations the 110-second one
    (`apps/web/lib/api-client.ts`):

```ts
const DIAGNOSE_OPERATION_TIMEOUT_MS = 610_000   // 600 s backend upstream + margin

return apiFetch<DiagnoseResponse>("/diagnose", { ... }, DIAGNOSE_OPERATION_TIMEOUT_MS)
```
21. It is normalized to `hinted_success`. The event ID derives from `userId + clientEventId`; an exact replay returns
    the event with `duplicate=true`, so the conditional transaction must not add alpha/beta, counters, or a version.
    Both rules are visible in `apps/api/app/services/learning_service.py`:

```py
event_id = "ev_" + hashlib.sha256(
    f"{user_id}\0{request.clientEventId}".encode("utf-8")
).hexdigest()[:24]
existing_event = get_evidence_event(user_id, event_id)
if existing_event:
    return {"event": existing_event, "state": ..., "duplicate": True}
...
normalized_outcome = (
    "hinted_success"
    if request.outcome == "success" and request.supportLevel > 0
    else request.outcome
)
```
22. Origin includes scheme, host, and port, so 3000 and 3001 differ; curl does not enforce browser CORS. Stop the old
    3000 process and bind to 3000, or intentionally update `allow_origins` and restart the API.
23. These prove the mini contract, service, in-memory repository, React state, type/static rules, and local vertical
    path for those inputs. They do not prove OAuth, DynamoDB, live AI, concurrency/pagination, accessibility, production
    networking, or every browser; add matching contracts and failure tests as each layer is introduced.

If you can repeat an answer but cannot locate its code or verification entry point, retrace the corresponding chapter.
If this guide and current code disagree, treat code plus contract tests as authoritative and update the guide.

## 25. ChatGPT Q&A Notes: Pydantic, Coupling, and Dependency Injection

> Source: ChatGPT shared conversation <https://chatgpt.com/share/6a823e83-4f94-83e8-9533-1ccbbfd8769c>
>
> Study notes from a tutoring Q&A, organized into three questions:
> **Q1** What are Model, dict→Model, payload, `app = FastAPI()`, and metadata?
> **Q2** What is the difference between coupling, tight coupling, decoupling, and dependency injection — and what are the advantages of DI?
> **Q3** Does the `value: Any` annotation actually mean anything?
>
> Related chapters: 4.4 (Pydantic models), 5.3 (validation and dependency injection), 7.2 (dependencies in a request).

### 25.1 Q1: Model, dict→Model, payload, app = FastAPI(), metadata

#### 25.1.1 What is a Model in the Pydantic sense

One-sentence answer: **A Model is not "any Python data type" — in the Pydantic context it specifically means a Python class that inherits from `pydantic.BaseModel`.**

```python
from pydantic import BaseModel

class DiagnosisRequest(BaseModel):
    user_id: str
    text: str
```

- `DiagnosisRequest` is a **Pydantic model class**.
- `request = DiagnosisRequest(user_id="123", text="hello")` creates a **model instance**.
- `int` / `str` / `float` / `list` / `dict` are just Python **types**; they are not usually called models.
- **A model describes its fields using Python types.**

#### 25.1.2 Why we say dict → Model

External data usually arrives as a plain dict; Pydantic validates it field by field with `model_validate()` and turns it into a model:

```python
data = {"user_id": "123", "text": "hello"}
request = DiagnosisRequest.model_validate(data)
```

The process is roughly: plain dict → read `user_id` → check it is a `str` → read `text` → check it is a `str` → create `DiagnosisRequest`. (In default mode Pydantic may also apply reasonable coercion — see 25.1.6.)

#### 25.1.3 What is payload

- `payload` is **not a Python keyword and not a FastAPI keyword**. It is an ordinary variable name programmers use, roughly meaning "**the data this transfer actually carries**".
- The formal HTTP term is **request body**; `payload` is more generic. JWT also uses the word in Header / Payload / Signature.
- Conclusion: **read the context.** Do not treat `payload` as something special.

#### 25.1.4 What app = FastAPI() does

- `FastAPI` is a **class**; `FastAPI()` creates an instance (the application object); `app` is the variable pointing to that object.
- `@app.get("/users")` registers a path operation on that application.
- Analogy in plain Python: `class Dog: pass` → `dog = Dog()` — `Dog` is the class, `Dog()` creates the object, `dog` is the variable.

Keep the two worlds separate:

```
FastAPI  → HTTP / API layer
  app = FastAPI()
  @app.get(...)  @app.post(...)

Pydantic → data schema / validation layer
  BaseModel  str / int  list[]  dict[]  Literal  Field()
  model_validate()  model_dump()
```

**FastAPI uses Pydantic, but FastAPI and Pydantic are not the same thing.** This matters for understanding request body, dependency, and service/model layering.

#### 25.1.5 What is metadata

- In `metadata: dict[str, str] | None = None`, `metadata` has **no special Pydantic meaning**; it is just a field name you can rename to `extra_info` / `details`.
- The English meaning is **data about data** — information that describes the primary data. For a photo, the primary data is pixels and the metadata is shot time, camera model, GPS; for a file, the primary data is content and the metadata is filename, creation time, type, size.

#### 25.1.6 Does Pydantic validate every type hint?

Precisely: **when a type annotation is used by Pydantic to build a model/schema, Pydantic validates according to the types and rules it supports.** Do not memorize "every type hint is validated".

| Situation | Behavior |
| --- | --- |
| Plain Python `def f(age: int)` | Just a hint for programmers / IDE / mypy / pyright; not enforced at runtime — `f("abc")` does not fail |
| Pydantic `age: int` | Reads the annotation to build a validation schema; `User(age="abc")` raises `ValidationError` |

- `list[str]`: validates it is a list and that each element is a `str` (hints are hierarchical: container type + item type).
- `dict[str, int]`: keys are `str`, values are `int`.
- `Literal["fast", "deep"]`: only those two values are accepted.
- `str | None`: either `str` or `None`.
- `Field()`: adds extra constraints on top of the type hint, e.g. `ge=18, le=100`, `min_length=3, max_length=20`.

Important exceptions:

```python
from typing import Any

class Data(BaseModel):
    value: Any       # any type; essentially no restriction
```

- Pydantic also provides `SkipValidation` to explicitly skip validation inside a field.
- **Validation ≠ strict rejection**: default is lax mode, which performs **coercion / data conversion** — e.g. `User(age="24")` may convert `"24"` to `24`. Pydantic guarantees "the resulting model matches your schema", not that the input was already the perfect Python type.

#### 25.1.7 Complete example tying Q1 together

```python
from typing import Literal
from pydantic import BaseModel, Field

class DiagnosisRequest(BaseModel):
    text: str = Field(min_length=1)
    mode: Literal["fast", "deep"]
    metadata: dict[str, str] | None = None

payload = {
    "text": "Yesterday I go to school.",
    "mode": "fast",
    "metadata": {"language": "en"},
}

request = DiagnosisRequest.model_validate(payload)
```

Checks in order: is `text` a `str`? is its length ≥ 1? is `mode` fast/deep? is `metadata` a dict? are its keys and values `str`? All pass → you get a `DiagnosisRequest` object.

### 25.2 Q2: coupling, tight coupling, decoupling, and dependency injection

#### 25.2.1 What is coupling

One-sentence answer: **coupling = how tightly two modules are bound to each other.** Coupling is not bad — modules are supposed to cooperate. The real question is **how strong the coupling is**.

```python
class UserService:
    def get_user(self, user_id):
        ...
```

`UserService` needs a database to look up users, so `UserService ↓ Database` — there is a dependency, hence coupling.

#### 25.2.2 What is tight coupling

```python
class UserService:
    def __init__(self):
        self.db = DynamoDB()      # hard-coded implementation

    def get_user(self, user_id):
        return self.db.get_user(user_id)
```

`UserService` is not just saying "I need a database"; it is saying "**I must have DynamoDB, and I create it myself**". That is relatively strong coupling.

Two typical problems:

1. **Changing the implementation forces changes in business logic**: switching to PostgreSQL later means editing `UserService` itself (database changes → business logic changes).
2. **Tests drag in the real dependency**: running `get_user()` actually creates DynamoDB → connects to AWS → needs credentials → may read a real database. You only wanted to test business logic, but you are pushed into connecting to a real database.

#### 25.2.3 How dependency injection fixes it

```python
class UserService:
    def __init__(self, db):
        self.db = db              # no longer creates it; receives it

    def get_user(self, user_id):
        return self.db.get_user(user_id)

db = DynamoDB()
service = UserService(db)         # the dependency is "injected"
```

That is **Dependency Injection**.

The real difference between the two styles (separation of concerns):

| Creating the dependency yourself | Dependency Injection |
| --- | --- |
| `UserService` decides which database, creates it, and uses it | `UserService` only "uses" the database |
| Many responsibilities | What it is, how to create it, when to close it → handled externally |

#### 25.2.4 What decoupling means

**Decoupling does not mean the two modules have nothing to do with each other; it means reducing their dependence on each other's concrete implementation.**

After DI, `UserService` only asks for "something that can `get_user()`":

```python
service = UserService(DynamoDB())
service = UserService(PostgreSQL())
service = UserService(FakeDatabase())
```

`UserService` does not change at all — that is decoupling.

Everyday analogy: a coffee machine with a built-in, welded "Brand A water bottle" is tight coupling — if Brand A is discontinued, the machine must change too. A "standard water inlet" accepts any compliant water source — that lowers coupling.

#### 25.2.5 What DI is good for

1. **Swapping implementations is easy**: `DynamoDBRepository` → `PostgreSQLRepository` → `FakeDB`, `UserService` does not change.

```python
class UserService:
    def __init__(self, repository):
        self.repository = repository
```

2. **Testing is easy**: replace the real database with a fake one; testing business logic requires no AWS.

```python
class FakeDatabase:
    def get_user(self, user_id):
        return User(age=24)

service = UserService(FakeDatabase())
result = service.can_buy_alcohol("123")   # touches no real database
```

3. **Lifecycle management**: if the route creates the DB itself and a line raises, `db.close()` never runs (unless you write try/finally), and writing that in 30 routes is painful. FastAPI's `Depends` + `yield` closes it for you:

```python
def get_db():
    db = Database()
    try:
        yield db
    finally:
        db.close()

@app.get("/users")
def get_users(db: Database = Depends(get_db)):
    return db.get_users()
```

Flow: request starts → create Database → inject db → run route → route ends or raises → run `finally` → `db.close()`.

4. **Cross-cutting logic is written once**: many routes need the "current user"; instead of repeating `get_token(request)` + `verify_token(token)` in every route:

```python
@app.get("/profile")
def profile(user = Depends(get_current_user)):
    return user
```

Authentication logic lives in one place and FastAPI injects it into each route.

#### 25.2.6 When NOT to use DI

**Not everything needs DI.** For a simple function, do not invent `TaxRateProvider` / `TaxService` / `TaxDependencyFactory` just for "decoupling" — that is overengineering.

DI fits dependencies that **may change, have a lifecycle, should be replaceable in tests, or are shared across modules** — Database, Repository, Service, Authentication, HTTP client, Configuration, Cache, Logger, External API client.

#### 25.2.7 Glossary

| Term | Meaning |
| --- | --- |
| Dependency | Something else I need to get my work done (`UserService` needs `Database`; the database is the dependency) |
| Coupling | How tightly bound I am to that thing |
| Strong / tight coupling | I not only need you — I hard-code who you are and how you are created (`self.db = DynamoDB()`) |
| Loose coupling | I need a capability but do not force a concrete implementation (`def __init__(self, db)`) |
| Decoupling | Loosening two modules that were tightly bound |
| Dependency Injection | The external side provides the dependency to the object/function that needs it (`UserService(db)`; in FastAPI, `Depends(get_db)` does the injection automatically) |

#### 25.2.8 The comparison worth remembering

Tight coupling:

```python
class UserService:
    def __init__(self):
        self.db = DynamoDB()
```

→ "I want DynamoDB, and I build it myself."

Dependency Injection:

```python
class UserService:
    def __init__(self, db):
        self.db = db
```

→ "I need a DB; you provide it."

The advantages of DI in one line: **easier to swap implementations, easier to test, less duplicated code, easier to manage resource lifetimes, and clearer module responsibilities.**

### 25.3 Q3: Does the value: Any annotation actually mean anything

#### 25.3.1 In plain Python: you can omit it

If you do not care about types at all, `value: Any` in plain Python adds little:

```python
value = 123
value = "hello"
value = [1, 2, 3]
value = {"a": 1}
```

Python does not stop you. `Any` itself means "do not let type checkers restrict this value".

#### 25.3.2 Inside a Pydantic BaseModel it is different

```python
from typing import Any
from pydantic import BaseModel

class Data(BaseModel):
    value: Any
```

Here `value: Any` is telling Pydantic:

> `value` is a **model field** that can accept any type.

So the colon is not only about restricting types — it also has another job: **declaring that this is a field of the Pydantic model.**

```python
Data(value=123)
Data(value="hello")
Data(value=[1, 2])
Data(value={"name": "Jinyu"})     # all fine
```

- Removing `: Any` and writing just `value` is not even a normal field declaration in Python.
- Writing `value = None` is yet another story: Pydantic v2 defines model fields through **annotated attributes**; an unannotated class attribute cannot simply be treated as a normal Pydantic field.

#### 25.3.3 Conclusion

**Plain Python: you may omit the annotation. In a Pydantic model, the annotation also serves as the "field declaration".** In plain words:

> `value: Any` = "The Data model has a field named `value`, and I put no restriction on its concrete type."

Not: "`Any` adds strong validation to `value`." Quite the opposite — `Any` essentially means **no concrete type restriction here**.
