# Build WeakSpot English Coach from Zero: A Complete Beginner's Guide

[中文版](BEGINNER_GUIDE.zh-CN.md) · [Project home](../README.md)

For readers who are new to programming, terminals, frontend/backend development, and databases. Written against the **current workspace source on 2026-09-23**. The Chinese and English editions have matching chapters and exercises.

You will run the full project on your computer, build a smaller version from an empty directory, and learn how to extend it with a database, AI, learning memory, and deployment. The first pass needs no paid server, model-provider account, or API key. Downloading tools and dependencies still requires an internet connection.

This is the new starting point. Keep the longer [Chinese development notes](../development.md) and [English development notes](../development.en.md) for deeper reading; their older deployment sections do not replace current configuration. The active database is PostgreSQL. DynamoDB and RDS migration are not beginner setup steps.

<a id="contents"></a>
## Contents

1. [Understand what we are building](#step-1)
2. [Use a terminal for the first time](#step-2)
3. [Install tools on macOS, Windows, or Linux](#step-3)
4. [Download the project and understand its folders](#step-4)
5. [Run the full project without real AI keys](#step-5)
6. [Complete a diagnosis, stop, and restart](#step-6)
7. [Learn just enough programming](#step-7)
8. [Follow one request through the real source](#step-8)
9. [Build a smaller version from an empty directory](#step-9)
10. [Replace temporary records with database records](#step-10)
11. [Connect real AI and understand learning memory](#step-11)
12. [Change a feature, test it, and save a version](#step-12)
13. [Move from local development to deployment](#step-13)
14. [Troubleshoot errors](#step-14)
15. [Learning milestones, self-checks, and further reading](#step-15)

<a id="step-1"></a>
## 1. Understand what we are building

WeakSpot is an English-learning website. A learner writes some English, receives a diagnosis, and practices weaknesses supported by evidence. Future practice can use earlier learning records.

Start by thinking of the website as three programs working together, with an optional external AI service:

| Part | Plain-language meaning | Used in this project |
| --- | --- | --- |
| Frontend | The pages you see and interact with in your browser | React, Next.js, TypeScript |
| Backend | Receives requests, validates input, organizes diagnosis, and saves records | Python, FastAPI |
| Database | Keeps records after the application stops | PostgreSQL |
| AI service | An external model the backend asks to analyze text | Replaceable providers; fixed results for the first exercises |

In this guide's local environment, data moves like this:

```mermaid
flowchart LR
    A[Browser localhost:3000] --> B[Next.js frontend]
    B -->|/backend/api/v1/diagnose| C[Next.js proxy]
    C -->|127.0.0.1:8000/api/v1/diagnose| D[FastAPI backend]
    D --> E[Fixed fake AI result]
    D <--> F[(PostgreSQL in Docker)]
```

`localhost` and `127.0.0.1` usually mean your own computer. `3000`, `8000`, and `5432` are ports that distinguish services. The browser does not connect directly to the database. A Docker container has its own network environment, so `127.0.0.1` inside a container does not mean the host computer.

Your first complete loop is **enter English → click Analyze → receive a report → find the saved record in History**. Leave voice, ebooks, OAuth login, and cloud deployment until later.

<a id="step-2"></a>
## 2. Use a terminal for the first time

A terminal lets you operate your computer by typing commands. On macOS, open Terminal. On Windows, open Ubuntu after the setup in the next chapter. On Linux, open your terminal application.

The `bash` commands in this guide work in macOS zsh/bash, Linux bash, and Ubuntu under Windows WSL. **Do not paste them directly into Windows CMD or PowerShell.** The one PowerShell installation step is labeled separately.

```bash
pwd
ls
```

`pwd` prints the full path of your current folder. `ls` lists its contents. Learn these commands next:

| Command or symbol | Meaning |
| --- | --- |
| `cd apps/api` | Enter `apps/api` under your current folder |
| `cd ..` | Move to the parent folder |
| `cd ~/projects` | Enter `projects` under your home folder |
| `mkdir -p ~/projects` | Create the folder, or keep using it if it exists |
| `# An explanation` | A comment, not program output |
| `Ctrl+C` | Stop the foreground program running in this terminal |

Run commands one line at a time. Resolve an error before proceeding. Each command section tells you where to run it. Do not copy a `$` prompt, logs, or Markdown's triple backticks into the terminal. A trailing `\` continues one command onto the next line.

Later, use three terminal tabs: A for the backend, B for the frontend, and C for checks. A and B should keep displaying logs without returning to a command prompt while the servers run. Each terminal has its own current directory; run `cd` again in a new tab.

File contents and terminal commands are different. When instructed to create a file, use your editor to create it at the specified path, paste its contents, and save it. Do not execute Python, JSON, or TSX file contents as shell commands.

<a id="step-3"></a>
## 3. Install tools on macOS, Windows, or Linux

### 3.1 What you need

| Tool | Purpose | Version used by this guide |
| --- | --- | --- |
| An editor, such as VS Code | Open folders and edit files | Any working version |
| Git | Download code and record changes | A working Git installation |
| Node.js | Run frontend development tools | **24**, from [`.nvmrc`](../.nvmrc) |
| pnpm | Install frontend dependencies | **9.6.0**, from [`package.json`](../apps/web/package.json) |
| uv | Manage Python and backend dependencies | A current uv supporting the commands below |
| Python | Run the backend | This guide selects **3.11**; the project requires `>=3.11` |
| Docker Desktop / Docker Engine with Compose | Run PostgreSQL in a container | A version supporting `docker compose` |

Dependencies are existing libraries that the project uses. `uv.lock` and `pnpm-lock.yaml` record their exact versions. Keep those files when learning to run the existing project; do not begin by upgrading every package.

### 3.2 Prepare your operating system

**macOS:**

1. Install [VS Code](https://code.visualstudio.com/download). Use File → Open Folder to open the project later.
2. Run `git --version`. If macOS offers to install command-line developer tools, finish that installation. Other options are listed on the [official Git installation page](https://git-scm.com/install/).
3. Select a **24.x** installer on the [Node.js download page](https://nodejs.org/en/download). If you already use nvm, run the nvm commands below instead of adding a second Node installation.
4. Install and open [Docker Desktop for Mac](https://docs.docker.com/desktop/setup/install/mac-install/). Choose the Apple silicon or Intel installer for your computer and wait for the engine to start.

**Windows:**

1. Run this command in an administrator PowerShell window. Restart if requested, then open Ubuntu and create a Linux username and password:

   ```powershell
   wsl --install
   ```

2. Install Docker Desktop, use its WSL 2 backend, and enable Ubuntu under Settings → Resources → WSL Integration. Follow [Microsoft's WSL instructions](https://learn.microsoft.com/en-us/windows/wsl/install) and [Docker's WSL guide](https://docs.docker.com/desktop/features/wsl/).
3. **Run the remaining commands inside Ubuntu.** Install nvm there using the [official nvm instructions](https://github.com/nvm-sh/nvm#installing-and-updating), then run the Node commands below. A Windows Node installation is not a substitute for installing it inside Ubuntu.
4. Use VS Code's WSL extension to open the project inside Ubuntu. Keep the code under `~/projects`; this guide does not use `/mnt/c` paths.

**Linux / Ubuntu on Windows:** install the basic commands first. These commands are for Ubuntu/Debian; use your distribution's package manager otherwise:

```bash
sudo apt update
sudo apt install -y git curl ca-certificates
```

Native Linux also needs [Docker Desktop](https://docs.docker.com/desktop/setup/install/linux/) or [Docker Engine](https://docs.docker.com/engine/install/) with the Compose plugin. Windows WSL users should use the Docker Desktop integration above, without installing another Docker engine inside Ubuntu.

On native Linux, also install nvm using the [official nvm instructions](https://github.com/nvm-sh/nvm#installing-and-updating), then install Node 24 with the next commands.

If you installed nvm following its official instructions, run these commands in a new terminal:

```bash
nvm install 24
nvm use 24
nvm alias default 24
```

### 3.3 Install pnpm, uv, and Python

Run from any folder. First confirm that `node --version` reports `v24...`.

```bash
npm install --global pnpm@9.6.0
curl -LsSf https://astral.sh/uv/install.sh | sh
```

The first command installs the selected pnpm 9 version. Keep the version number instead of installing an unrelated latest release; see the [official pnpm compatibility information](https://pnpm.io/installation). The second uses the [official uv installer](https://docs.astral.sh/uv/getting-started/installation/). Close and reopen your terminal afterward so the commands become available on PATH, the list of locations your computer searches for commands.

```bash
uv python install 3.11
git --version
node --version
pnpm --version
uv --version
docker --version
docker compose version
docker info
```

pnpm should report `9.6.0`. `docker info` should show Server information; a successful `docker --version` alone does not prove that the engine is running. uv manages Python, so the system-wide `python` command need not exist for `uv run` to work. [Managing Python with uv](https://docs.astral.sh/uv/guides/install-python/)

**Checkpoint:** the version checks succeed and the Docker engine is available. If a command is not found, resolve it with Chapter 14 before continuing.

<a id="step-4"></a>
## 4. Download the project and understand its folders

Run from any folder. This guide consistently keeps the project under `~/projects`.

```bash
mkdir -p ~/projects
cd ~/projects
git clone https://github.com/jinyu-cai/weakspot-english-coach.git
cd weakspot-english-coach
pwd
git status
```

If you already downloaded the project, enter the existing folder instead of cloning inside it. If your location differs, replace subsequent `cd ~/projects/weakspot-english-coach/...` commands with your own path.

Open the entire `weakspot-english-coach` folder in your editor:

```text
weakspot-english-coach/       ← repository root
├── apps/
│   ├── api/                  ← backend: run uv here
│   │   ├── app/             ← application source
│   │   ├── alembic/         ← database schema migrations
│   │   ├── scripts/         ← tests and maintenance tools
│   │   ├── pyproject.toml   ← backend dependency declarations
│   │   └── uv.lock          ← locked dependency versions
│   └── web/                 ← frontend: run pnpm here
│       ├── app/             ← pages and layouts
│       ├── components/      ← reusable UI components
│       ├── lib/             ← requests, types, language helpers
│       └── package.json     ← frontend dependencies and commands
└── docs/                    ← documentation
```

`git clone` downloads source code; it does not automatically install every dependency. Install backend and frontend dependencies separately below.

<a id="step-5"></a>
## 5. Run the full project without real AI keys

### 5.1 Distinguish three modes

| Mode | Frontend API base | Backend and database | What it proves |
| --- | --- | --- | --- |
| Frontend preview | Empty | Not needed | Pages display mock data |
| This guide's main route | `/backend` | Both required; `USE_FAKE_AI=true` | Requests, storage, and learning flows work together |
| Real AI | `/backend` | Both required; `USE_FAKE_AI=false`, plus provider configuration | A model participates in analysis |

Fake AI returns predefined results; it does not understand every input you type. The main route retains the real database, so saved records remain available after refreshing the page or restarting the backend.

### 5.2 Terminal A: install backend dependencies

Run from `apps/api`.

```bash
cd ~/projects/weakspot-english-coach/apps/api
uv sync --frozen --python 3.11
uv run --frozen python --version
```

`uv sync` creates `.venv`, the Python dependency environment dedicated to this project. `--frozen` uses the existing lockfile without updating it. `uv run` executes a command inside that environment, without manual activation. [uv's synchronization rules](https://docs.astral.sh/uv/concepts/projects/sync/)

### 5.3 Create local configuration

In your editor, create **`apps/api/.env`** with the complete contents below. If it already exists, preserve it and review the relevant values individually; do not overwrite real configuration. The filename must be `.env`, not `.env.txt`.

```dotenv
APP_ENV=development
DATABASE_URL=postgresql+psycopg://weakspot:weakspot@127.0.0.1:5432/weakspot
USE_FAKE_AI=true
OPENAI_BUILD_WEEK_ENABLED=false
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
FRONTEND_URL=http://localhost:3000
SESSION_SECRET=local-learning-only-do-not-use-in-production
GUEST_DAILY_LIMIT=100
USER_DAILY_LIMIT=100
```

This is a minimal configuration for local learning. You do not need to configure every optional provider in [`.env.example`](../apps/api/.env.example).

| Setting | Why it is needed |
| --- | --- |
| `DATABASE_URL` | Connects the host-run backend to the local database port published by Docker |
| `USE_FAKE_AI=true` | Returns fixed text-model results instead of making real model calls |
| `OPENAI_BUILD_WEEK_ENABLED=false` | Leaves the separate specialized mission-planner path disabled |
| `CORS_ORIGINS` | Specifies which webpage origins may call the backend directly |
| `SESSION_SECRET` | An example local session-signing value; production needs a separate random secret |
| The two `DAILY_LIMIT` values | Allow repeated local exercises without quickly exhausting guest quotas |

Environment variables are configuration read when a program starts. Restart the backend after editing `.env`. Variables already exported in your shell take priority over `.env`; review your own settings if you previously configured them.

`.gitignore` excludes `.env`. Keep keys out of frontend code, screenshots, and Git commits. Frontend values beginning with `NEXT_PUBLIC_` are exposed to the browser.

### 5.4 Start PostgreSQL and create the database tables

Stay in Terminal A, in `apps/api`.

```bash
docker compose -f docker-compose.local.yml up -d --wait postgres
docker compose -f docker-compose.local.yml ps
uv run --frozen alembic upgrade head
```

The first command starts only `postgres`. `-d` runs it in the background; `--wait` waits for health checks. The local database username and password are both `weakspot`, matching this development Compose file. `weakspot` holds your manual learning data; `weakspot_test` is for automated tests.

Alembic manages database schema upgrades. `upgrade head` upgrades the schema to the repository's current version; it does not mean deleting and rebuilding business records.

**Checkpoint:** Compose reports PostgreSQL as healthy, and migrations finish without a traceback. Database data lives in a Docker volume and survives closing the terminal.

### 5.5 Start the backend

Run in Terminal A, from `apps/api`.

```bash
uv run --frozen uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

`uvicorn` runs the FastAPI server. `app.main:app` refers to the `app` object in `app/main.py`. `--reload` restarts the server when code changes. Leave the terminal open after `Application startup complete` appears.

The [API health endpoint](http://localhost:8000/api/v1/health) should include `"status":"ok"`. The [database readiness endpoint](http://localhost:8000/api/v1/health/ready) should return:

```json
{"status":"ready","database":"postgresql"}
```

The first proves that the API can respond. The second runs a database query, but does not by itself prove that every application table has been migrated. Do not skip Alembic.

### 5.6 Terminal B: configure and start the frontend

In a new Terminal B:

```bash
cd ~/projects/weakspot-english-coach/apps/web
pnpm install --frozen-lockfile
```

Create **`apps/web/.env.local`** in your editor:

```dotenv
NEXT_PUBLIC_API_BASE_URL=/backend
```

If the file exists, edit that value while preserving other configuration. Then run in Terminal B:

```bash
pnpm dev
```

Open the [local website](http://localhost:3000). `/backend` is the proxy entry configured in [`next.config.mjs`](../apps/web/next.config.mjs). It forwards `/backend/api/v1/...` to `127.0.0.1:8000/api/v1/...`. Do not set the base to `/backend/api/v1`: the request helper already appends `/api/v1`.

If port 3000 is occupied and the frontend switches to 3001, open the actual address printed in the terminal. The current proxy supports that case. Keep using the same hostname and browser to preserve your guest identity. Restart the frontend after changing `.env.local`.

### 5.7 Optional: preview only, or run the backend in Docker

If Docker is not available yet, preview the UI by running this in `apps/web`:

```bash
NEXT_PUBLIC_API_BASE_URL= pnpm dev
```

It temporarily overrides `.env.local` and uses frontend mock data. It does not test database persistence. Stop it with `Ctrl+C` before returning to the main route.

The repository also supports `docker compose -f docker-compose.local.yml up -d --build` from `apps/api`, placing both the API and database in containers. Its fake AI configuration is defined in Compose; **it does not automatically apply the `.env` settings you entered for a host-run backend**. Start with one launch method. If a containerized API already occupies port 8000, run `docker compose -f docker-compose.local.yml stop api` before section 5.5.

<a id="step-6"></a>
## 6. Complete a diagnosis, stop, and restart

### 6.1 Verify through the UI

1. Paste the English sample below into the writing field on the home page.
2. Select Fast and click **Analyze my English / 分析**. Basic diagnosis works as a guest; OAuth configuration is unnecessary for this exercise.
3. Confirm that a report appears. Fake mode returns a fixed example, which may not match arbitrary edits to your input.
4. Open `/history` and find the new record. Refresh and confirm it remains. Visit `/dashboard`, `/notebook`, and `/memory` to observe related learning data.
5. Submit the identical text again in the same browser and observe deduplication. A successful retry does not have to create another record.

```text
Yesterday I go to my university and I meet my friend. We talk about our project,
but I feel my English is not very good. I always use simple words and I cannot
explain my idea clearly.
```

The real project requires at least 5 words and at most 12,000 characters for diagnosis. Guest access does not unlock every feature: administration, some learning experiments, and real voice have additional access or service requirements.

### 6.2 Observe a real request

Press F12 or right-click → Inspect in your browser. Open Network, filter for `diagnose`, and submit again. You should see:

```text
POST /backend/api/v1/diagnose
HTTP 200
```

Response contains JSON, and Terminal A shows backend activity. If a report appears without a corresponding network request, check whether you accidentally enabled frontend mock mode.

Terminal C can check the API independently. Run from any folder. The cookie file lives in `/tmp`; the two learner requests share one guest identity:

```bash
curl --fail-with-body http://localhost:8000/api/v1/health/ready
curl --fail-with-body -c /tmp/weakspot-beginner-cookies.txt -b /tmp/weakspot-beginner-cookies.txt \
  -H 'Content-Type: application/json' \
  -d '{"userId":"beginner","text":"Yesterday I go to school with my friend.","diagnosisMode":"fast","outputLanguage":"en"}' \
  http://localhost:8000/api/v1/diagnose
curl --fail-with-body -c /tmp/weakspot-beginner-cookies.txt -b /tmp/weakspot-beginner-cookies.txt \
  http://localhost:8000/api/v1/profile/beginner
```

`curl` sends HTTP requests from your terminal. `-d` supplies a JSON body; `-c/-b` saves and sends cookies. The contract still requires `userId`, but the backend replaces the supplied ID with the identity resolved from the session/guest cookie. Writing `beginner` does not grant access to someone else's records. curl and your browser have different cookies, so they also have different guest histories.

You can also open the [interactive API documentation](http://localhost:8000/docs), expand `POST /api/v1/diagnose`, click Try it out, enter the same JSON, and click Execute.

### 6.3 Stop safely and start again

Press `Ctrl+C` in Terminals A and B. From `apps/api`, run:

```bash
docker compose -f docker-compose.local.yml stop postgres
```

Next time, you do not need to reinstall all dependencies or recreate `.env`:

```bash
# Terminal A: apps/api
docker compose -f docker-compose.local.yml up -d --wait postgres
uv run --frozen alembic upgrade head
uv run --frozen uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

```bash
# Terminal B: apps/web
pnpm dev
```

Do not use `docker compose down -v` for routine shutdown: `-v` deletes the database volume. Clearing cookies, switching browsers, or using private browsing creates a different guest identity. Missing history for that identity does not necessarily mean database records were lost.

<a id="step-7"></a>
## 7. Learn just enough programming

Learn these concepts before building Chapter 9. You do not need to memorize an entire language manual first.

### 7.1 Python: variables, functions, dictionaries, and types

This standalone teaching example can be saved as `hello.py` in a practice folder and run with `uv run python hello.py`:

```python
text = "Yesterday I go to school."

def count_words(value: str) -> int:
    return len(value.split())

report = {"originalText": text, "wordCount": count_words(text)}
print(report["wordCount"])
```

The result is `5`. `text` is a variable. `def` defines a reusable function. Indentation groups statements inside the function. A dictionary maps names to values. `str` and `int` are type hints; they do not automatically validate network input. The backend uses Pydantic models for that validation.

### 7.2 HTTP and JSON: communication between programs

An HTTP request includes a method, address, headers, and an optional body. `GET` commonly reads data; `POST` commonly submits it. JSON is a text format for structured data, with double-quoted field names and strings.

```json
{"text":"Yesterday I go to school."}
```

| Status | Common meaning in this project |
| --- | --- |
| 200 | Success |
| 401 / 403 | Missing authentication or permission |
| 422 | Input violates the contract, such as text being too short |
| 429 | A usage or rate limit was reached |
| 500 | A backend failure; inspect its logs |
| 503 | A dependency is unavailable, such as the database |

### 7.3 TypeScript and React: how a page changes

TypeScript adds type checking to JavaScript. `.tsx` also allows JSX, an HTML-like way to describe the interface.

Chapter 9 uses `useState` to hold input, results, and loading state. Calling `setText(...)` makes React render the page with the new state. `onClick` connects a button to a function. `async/await` lets the function wait for an HTTP request while the page can display a loading message.

`fetch` does not automatically throw when the server returns HTTP 422, so the request helper checks `response.ok`. Browser-side TypeScript types cannot replace backend validation: a caller can bypass the page and call the API directly.

<a id="step-8"></a>
## 8. Follow one request through the real source

Do not read every file alphabetically. Start from the Analyze button and follow one path:

| Order | File | Question to answer |
| --- | --- | --- |
| 1 | [`app/page.tsx`](../apps/web/app/page.tsx) | Which components form the home page? |
| 2 | [`diagnostic-input.tsx`](../apps/web/components/diagnostic-input.tsx) | Where do text input and click events come from? |
| 3 | [`diagnose-provider.tsx`](../apps/web/components/diagnose-provider.tsx) | Where are loading, result, and error set? |
| 4 | [`api-client.ts`](../apps/web/lib/api-client.ts) | How does `diagnose()` construct JSON and send it? |
| 5 | [`main.py`](../apps/api/app/main.py) | How are routes registered under `/api/v1`? |
| 6 | [`api/routes/diagnose.py`](../apps/api/app/api/routes/diagnose.py) | How are identity, deduplication, and persistence coordinated? |
| 7 | [`models/diagnostic.py`](../apps/api/app/models/diagnostic.py) | Which fields does `DiagnoseRequest` accept? |
| 8 | [`diagnose_service.py`](../apps/api/app/services/diagnose_service.py) | How are the task and selected model defined? |
| 9 | [`ai_client.py`](../apps/api/app/services/ai_client.py) | How is the model called and its output validated? |
| 10 | [`db/repositories.py`](../apps/api/app/db/repositories.py) → [`postgres_repositories.py`](../apps/api/app/db/postgres_repositories.py) | How are records saved and queried? |

A route is the API entry point, a service handles business logic, and a repository provides data access. Some orchestration remains in the real route file; these names describe responsibilities, not a promise of perfectly separated textbook layers.

Exercise: search the workspace for `DiagnoseRequest`, then for `USE_FAKE_AI`. Find the model and setting, and explain why a visible report does not necessarily mean an AI service was called.

<a id="step-9"></a>
## 9. Build a smaller version from an empty directory

Build a small app that accepts an English sentence, returns a rule-based correction, and displays history. It uses **in-memory storage, a fixed rule, and one shared history**, with no real AI, user isolation, or production security. Keep it local. Restarting the backend clears its history. This exercise does not overwrite the original project.

Each file block labeled with a path below is a complete file. Both language editions use the same code. Stop the frontend and backend from Chapter 5 first to avoid port conflicts.

### 9.1 Create the empty project and dependencies

Terminal A, starting from any folder:

```bash
cd ~/projects
mkdir weakspot-mini
cd weakspot-mini
mkdir api web
cd api
uv init --bare --python 3.11
uv add 'fastapi>=0.110,<1.0' 'uvicorn[standard]>=0.29' 'pydantic>=2.6,<3' httpx
mkdir app
touch app/__init__.py
```

If `weakspot-mini` exists, choose a new folder name instead of merging or overwriting an older exercise. `uv add` installs dependencies and writes this exercise's `pyproject.toml` and `uv.lock`. Leave `app/__init__.py` empty; it identifies a Python package.

Open `weakspot-mini` in your editor and create the following four backend files.

### 9.2 Data contracts: `api/app/models.py`

```python
from pydantic import BaseModel, Field, field_validator


class DiagnoseRequest(BaseModel):
    text: str = Field(min_length=1, max_length=12000)

    @field_validator("text")
    @classmethod
    def require_words(cls, value: str) -> str:
        if len(value.split()) < 5:
            raise ValueError("Write at least 5 words.")
        return value.strip()


class Submission(BaseModel):
    id: str
    originalText: str
    correctedText: str
    explanation: str
```

`DiagnoseRequest` is the input contract. Missing text, too few words, or too many characters produces HTTP 422. `Submission` is the output contract. This simplified word counter splits on whitespace; the real project also excludes punctuation-only tokens.

### 9.3 Storage: `api/app/repository.py`

```python
from uuid import uuid4

from app.models import Submission

_items: list[Submission] = []


def save(original: str, corrected: str, explanation: str) -> Submission:
    item = Submission(
        id=uuid4().hex,
        originalText=original,
        correctedText=corrected,
        explanation=explanation,
    )
    _items.append(item)
    return item


def list_all() -> list[Submission]:
    return list(reversed(_items))
```

`uuid4()` creates an identifier. `_items` is a list in this process. `append` adds a record. Returning the reversed list puts new records first. Keeping storage in one file makes the future PostgreSQL replacement easier to locate.

### 9.4 Business logic: `api/app/service.py`

```python
from app import repository
from app.models import Submission


def diagnose(text: str) -> Submission:
    if text == "Yesterday I go to school.":
        corrected = "Yesterday I went to school."
        explanation = "Use the past tense after Yesterday in this example."
    else:
        corrected = text
        explanation = "This demo only checks its exact example sentence."
    return repository.save(text, corrected, explanation)
```

The rule deliberately matches only one complete sentence. Other inputs are returned unchanged, which does not mean their grammar is correct. First verify the program connections, then replace the rule with validated model output.

### 9.5 HTTP entry points: `api/app/main.py`

```python
from fastapi import FastAPI

from app import repository, service
from app.models import DiagnoseRequest, Submission

app = FastAPI(title="WeakSpot Mini")


@app.get("/api/v1/health")
def health():
    return {"status": "ok"}


@app.post("/api/v1/diagnose", response_model=Submission)
def diagnose(request: DiagnoseRequest):
    return service.diagnose(request.text)


@app.get("/api/v1/history", response_model=list[Submission])
def history():
    return repository.list_all()
```

The lines beginning with `@` are decorators, connecting paths to handler functions here. FastAPI converts JSON into a `DiagnoseRequest`, calls the function, and serializes its returned model as JSON. Browser requests in this exercise use a same-origin Next.js proxy, so no additional CORS middleware is needed.

Terminal A, from `~/projects/weakspot-mini/api`:

```bash
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Open the [mini app's API docs](http://localhost:8000/docs). Try `GET /api/v1/health`, then send `{"text":"Yesterday I go to school."}` to `POST /api/v1/diagnose`. Expect the corrected sentence and an ID.

### 9.6 Create the minimal frontend manually

Create Next.js's required files yourself so you can see the entry points without relying on a generator's defaults. Terminal B:

```bash
cd ~/projects/weakspot-mini/web
mkdir app
```

Create **`web/package.json`**:

```json
{
  "name": "weakspot-mini-web",
  "version": "0.1.0",
  "private": true,
  "packageManager": "pnpm@9.6.0",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "16.2.6",
    "react": "19.2.4",
    "react-dom": "19.2.4"
  },
  "devDependencies": {
    "typescript": "5.7.3",
    "@types/node": "^24",
    "@types/react": "19.2.14",
    "@types/react-dom": "19.2.3"
  }
}
```

These core frontend versions match the main repository inspected for this guide. This local exercise is not a long-term production dependency upgrade policy.

Create **`web/next.config.mjs`**:

```javascript
const nextConfig = {
  async rewrites() {
    return [{
      source: "/backend/api/v1/:path*",
      destination: "http://127.0.0.1:8000/api/v1/:path*",
    }]
  },
}

export default nextConfig
```

Create **`web/tsconfig.json`**:

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [{ "name": "next" }]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

Create **`web/app/layout.tsx`**:

```tsx
import type { ReactNode } from "react"

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>{children}</body></html>
}
```

`layout.tsx` supplies the outer HTML for pages. `children` is the page content placed inside it. Next, create **`web/app/page.tsx`**:

```tsx
"use client"

import { useState } from "react"

type Submission = {
  id: string
  originalText: string
  correctedText: string
  explanation: string
}

async function request<T>(path: string, body?: { text: string }): Promise<T> {
  const response = await fetch(`/backend/api/v1${path}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`)
  }
  return response.json()
}

export default function Home() {
  const [text, setText] = useState("Yesterday I go to school.")
  const [result, setResult] = useState<Submission | null>(null)
  const [history, setHistory] = useState<Submission[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  async function run(analyze: boolean) {
    setBusy(true)
    setError("")
    try {
      if (analyze) {
        setResult(await request<Submission>("/diagnose", { text }))
      }
      setHistory(await request<Submission[]>("/history"))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Request failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: "40px auto", padding: 16 }}>
      <h1>WeakSpot Mini</h1>
      <p>Local learning demo: one rule, shared in-memory history.</p>
      <label htmlFor="writing">Write at least five words</label>
      <textarea
        id="writing"
        value={text}
        onChange={(event) => setText(event.target.value)}
        maxLength={12000}
        rows={5}
        style={{ display: "block", width: "100%", margin: "12px 0" }}
      />
      <button disabled={busy} onClick={() => void run(true)}>
        {busy ? "Working..." : "Analyze"}
      </button>{" "}
      <button disabled={busy} onClick={() => void run(false)}>Load history</button>
      {error && <p role="alert">{error}</p>}
      {result && (
        <section aria-label="Result">
          <h2>Result</h2>
          <p>{result.correctedText}</p>
          <p>{result.explanation}</p>
        </section>
      )}
      <h2>History</h2>
      <ul>{history.map((item) => (
        <li key={item.id}>{item.originalText} → {item.correctedText}</li>
      ))}</ul>
    </main>
  )
}
```

`"use client"` allows browser interaction and state in this component. The type parameter in `request<T>` describes the expected response; it does not validate remote JSON at runtime, so the actual API must still maintain its contracts. `try/catch/finally` handles success, failure, and cleanup that runs in either case.

### 9.7 Run and verify the mini app

Terminal B, from `~/projects/weakspot-mini/web`:

```bash
pnpm install
pnpm dev
```

This new project has no lockfile yet, so its first installation does not use `--frozen-lockfile`. Next.js generates `next-env.d.ts` during startup; do not manually edit that framework type file.

Open the [mini app](http://localhost:3000) and perform these checks:

| Action | Expected result | What it proves |
| --- | --- | --- |
| Submit the default sentence | `Yesterday I went to school.` | Frontend, backend, and rule work together |
| Submit `Hello there` | The page displays HTTP 422 | Backend validation works |
| Restore and resubmit the default sentence | History gains another record | This simplified app has no deduplication |
| Refresh the page, then click Load history | Saved history appears again | Browser state and backend state are separate |
| Restart the backend, then Load history | History is empty | In-memory storage does not replace a database |

### 9.8 Write your first automated test

Create **`api/test_app.py`**. A test sends requests and checks the results in code, without opening a browser:

```python
import unittest

from fastapi.testclient import TestClient

from app import repository
from app.main import app


class AppTest(unittest.TestCase):
    def setUp(self):
        repository._items.clear()
        self.client = TestClient(app)

    def test_diagnosis_is_saved(self):
        response = self.client.post("/api/v1/diagnose", json={
            "text": "Yesterday I go to school."
        })
        self.assertEqual(response.status_code, 200)
        item = response.json()
        self.assertEqual(item["correctedText"], "Yesterday I went to school.")
        self.assertEqual(self.client.get("/api/v1/history").json(), [item])

    def test_invalid_input_does_not_create_history(self):
        for payload in ({"text": "Hello there"}, {}, {"text": "word " * 3000}):
            response = self.client.post("/api/v1/diagnose", json=payload)
            self.assertEqual(response.status_code, 422)
        self.assertEqual(self.client.get("/api/v1/history").json(), [])

    def test_unknown_sentence_is_not_claimed_as_corrected(self):
        text = "Today I enjoy learning new things."
        response = self.client.post("/api/v1/diagnose", json={"text": text})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["correctedText"], text)
        self.assertIn("only checks", response.json()["explanation"])


if __name__ == "__main__":
    unittest.main()
```

Terminal C, from `~/projects/weakspot-mini/api`:

```bash
uv run python -m unittest -v
```

Expect 3 passing tests. Then run these checks from `weakspot-mini/web`:

```bash
pnpm exec tsc --noEmit
pnpm build
```

`tsc` checks types; `build` checks production compilation. You have now written a small full-stack app from an empty folder. Return to the main repository to see how it handles the problems the mini app leaves unresolved.

<a id="step-10"></a>
## 10. Replace temporary records with database records

Think of a database table as a spreadsheet with rules: each row is a record and each column is a field. A primary key identifies a record; a foreign key connects records; an index accelerates specific queries; a transaction makes a group of changes succeed or roll back together.

In the real project, [`schema.py`](../apps/api/app/db/schema.py) defines tables, Alembic tracks schema migrations, and SQLAlchemy/psycopg communicate with PostgreSQL. A JSONB `payload` column stores flexible report details; frequently queried identifiers and timestamps have separate columns for constraints and queries.

Return to the main repository, start the full project as in Chapter 5, and submit a diagnosis. Terminal C, from the main repository's `apps/api`:

```bash
docker compose -f docker-compose.local.yml exec postgres psql -U weakspot -d weakspot
```

You are now in the database command-line interface, not the shell. Enter:

```sql
\dt
\d submissions
SELECT count(*) FROM submissions;
SELECT user_id, submission_id, created_at FROM submissions ORDER BY created_at DESC LIMIT 5;
\q
```

`\dt` lists tables, `\d` describes a table, `SELECT` reads data, and `\q` exits. Restart the backend and query again; records remaining verifies persistence. Refreshing a browser, restarting the backend, and deleting a database volume are different operations.

To extend Chapter 9's mini app with a database:

1. Design a `submissions` table with ID, original text, correction, explanation, and timestamp fields.
2. Add database configuration and an Alembic migration; create the table through the migration.
3. Replace the internals of `repository.save/list_all` with database operations while keeping their interface shape.
4. Verify that history survives a restart; finish any model call before beginning a short persistence transaction.
5. Before supporting multiple users, add trusted identity and `user_id` isolation to all relevant queries.

This is the next stage of work, not a database migration achieved by changing one URL. For progressive SQL exercises, see the [PostgreSQL beginner guide](POSTGRESQL_BEGINNER_GUIDE.md).

<a id="step-11"></a>
## 11. Connect real AI and understand learning memory

### 11.1 Replace the model capability before adding other services

Return to the main repository. Attempt this only after the no-key loop works. Real calls require your own provider account and available quota. The following is a **configuration-shape example**: replace every angle-bracket placeholder. It is not a shell command.

For an OpenAI-compatible provider supporting this project's structured text requests, edit the host-run backend's `apps/api/.env`:

```dotenv
USE_FAKE_AI=false
OPENAI_COMPAT_API_KEY=<your-provider-key>
OPENAI_COMPAT_BASE_URL=<provider-documented-api-base-url>
OPENAI_COMPAT_MODEL=<available-deep-model-id>
OPENAI_COMPAT_FAST_MODEL=<available-fast-model-id>
OPENAI_BUILD_WEEK_ENABLED=false
```

These setting names come from the repository's [`config.py`](../apps/api/app/config.py). “OpenAI-compatible” describes an API format; it does not guarantee identical models, response formats, or parameter support across providers. Use your provider's current documentation and your account's model access rather than assuming that an older model name remains available.

Configure just one text provider initially. Existing OpenRouter, OpenCode Go, or Qwen keys may take precedence over generic configuration; the private Fast model has separate routing too. Read [`MODEL_ROUTING.md`](MODEL_ROUTING.md) together with `config.py` to establish the actual selection. Do not fill every example variable at once.

Restart the backend, clear custom-provider overrides in the browser's AI settings, select the default/Fast option, and diagnose **new** text so deduplication does not return an older fake result. Check model selection in backend logs and inspect the report. A successful `/health` response does not validate model credentials.

### 11.2 Why model output needs a contract

A chat can return free-form prose; the website needs stable fields such as `correctedText` and `errors` to render and store results. Pydantic defines the result structure, and `ai_client.py` handles structured calls, parsing, validation, and errors.

Make “model output → validated data → persistence” reliable before expanding prompt complexity. A confident sentence from a model is not automatically a fact about a learner.

### 11.3 Learning memory does not mean resending every conversation

| Stage | Problem it addresses | Source entry point |
| --- | --- | --- |
| Learning evidence | Distinguishes actual errors, successes, and missing observation opportunities | [`learning_service.py`](../apps/api/app/services/learning_service.py) |
| Memory writing | Stores preferences, goals, strategies, weaknesses, and experiences; merges or resolves conflicts | [`memory_service.py`](../apps/api/app/services/memory_service.py) |
| Retrieval | Selects limited context relevant to the current task | Same service; [`embedding_client.py`](../apps/api/app/services/embedding_client.py) |
| Next action | Chooses practice from evidence and past outcomes | [`decision_service.py`](../apps/api/app/services/decision_service.py) |
| User control | Lets learners inspect, edit, and forget memories | [`memory/page.tsx`](../apps/web/app/memory/page.tsx) |

Defaults retrieve at most 6 memories with a 700 estimated-token ceiling and a 15% reserve. Text chat also limits recent-message context. Think of tokens as the model's units for processing text; they are not equivalent to characters or words. Retrieval can fall back to lexical matching without an embedding service; fake AI skips real embedding calls too.

Exercise: add a preference in `/memory`, such as “Explain the one issue that most affects clarity first.” Preview retrieval, forget the preference, and preview again. Check whether active context changes. Fake AI can verify storage and retrieval behavior, but cannot prove a real model follows that preference.

Real voice, TTS, ebook translation, and the dedicated Coach planner have their own settings, permissions, and model requirements. They are not prerequisites for basic diagnosis. Add them individually using the [backend documentation](../apps/api/README.md).

<a id="step-12"></a>
## 12. Change a feature, test it, and save a version

### 12.1 Make a small visible change

Run from the main repository root. Inspect the working tree first and preserve changes already made by you or others:

```bash
git status
git switch -c codex/beginner-first-change
```

A branch is a separate line of version history. Creating one does not clear uncommitted changes. Choose another name if this branch already exists.

Search [`apps/web/lib/i18n.ts`](../apps/web/lib/i18n.ts) for `Analyze my English`. Edit the relevant button wording and inspect both language versions. Do not replace every field called `analyze`. Keep the frontend running, save the file, and observe the update. Then inspect the diff:

```bash
git diff -- apps/web/lib/i18n.ts
```

### 12.2 Choose checks related to your change

Backend check, from `apps/api`:

```bash
uv run --frozen python -m scripts.smoke_test
```

This offline smoke test checks application imports and API/model contracts. It does not need a running backend server or real model service.

For database business flows, start local PostgreSQL first, then run:

```bash
DATABASE_URL=postgresql+psycopg://weakspot:weakspot@127.0.0.1:5432/weakspot_test \
  USE_FAKE_AI=true uv run --frozen python -m scripts.integration_test
```

This resets application data in the dedicated test database. Use only a disposable local database whose name ends in `_test`; never substitute your manual `weakspot` database or a production URL. The command's variables affect only that execution and do not edit `.env`.

Frontend checks, from `apps/web`:

```bash
pnpm lint
pnpm exec tsc --noEmit
pnpm test:chat-import
pnpm test:realtime-transcript
pnpm test:timeouts
pnpm build
```

lint checks code rules, tsc checks types, focused scripts verify their respective behaviors, and build checks production compilation. The main project's `next.config.mjs` currently sets `ignoreBuildErrors: true`, so **a successful build does not replace a separate TypeScript check**. See [LOCAL_TESTING.md](../LOCAL_TESTING.md) for broader test selection.

### 12.3 Save a change

Run from the main repository root. Confirm that you are committing only your intended changes:

```bash
git status
git diff
git add apps/web/lib/i18n.ts
git diff --cached
git commit -m "docs(ui): clarify analyze button wording"
```

`add` places a file in the staging area; `commit` saves a local version; `push` uploads commits to a remote. If your first commit requests an identity, follow Git's instructions to set your chosen `user.name` and `user.email` for this repository. Learn local commits first. Without write access to the original repository, contribute through your own fork and a Pull Request.

<a id="step-13"></a>
## 13. Move from local development to deployment

Deployment means running the program somewhere other people can reach it, with domains, HTTPS, identity, persistent storage, and maintenance. `pnpm dev` and `uvicorn --reload` are development commands, not this project's production deployment method.

The current repository describes a Next.js frontend on Vercel, with FastAPI and PostgreSQL 16 running in Docker on the same Oracle Cloud server and Nginx/HTTPS providing the API entry point. This describes the configured architecture, not a fresh verification of live service status. RDS, DynamoDB, and earlier Alibaba-origin documentation describe historical paths.

For a fresh deployment of your own, proceed in this order:

| Order | Work | Checkpoint |
| --- | --- | --- |
| 1 | Prepare a Linux host, domain, Docker/Compose, Nginx, and TLS tools | You can access your server and identify installation steps for its distribution |
| 2 | Download the code and configure from `deploy/.env.production.example` | Database/session secrets are independently generated; fake AI is disabled |
| 3 | Follow the current runbook to start the private database, migrate, and start the API | Server-local `/api/v1/health/ready` returns ready |
| 4 | Configure your API domain, Nginx, and HTTPS | The HTTPS health endpoint is reachable in a browser |
| 5 | Import your repository into Vercel with Root Directory `apps/web` | The frontend builds successfully |
| 6 | Set `NEXT_PUBLIC_API_BASE_URL` to your own HTTPS API base and redeploy | Requests reach your backend without duplicating `/api/v1` |
| 7 | Set precise CORS origins, frontend URL, OAuth callbacks, and cookie configuration | Login preserves identity and cross-user access is rejected |
| 8 | Exercise diagnosis, history, and practice; schedule backups and test restoration | New records survive restarts and backups can actually be restored |

Public frontend environment values are incorporated into the build. Rebuild and redeploy after changing them. [Next.js environment variables](https://nextjs.org/docs/app/guides/environment-variables)

Use the [backend deployment guide](../apps/api/DEPLOY.md) and [current server-local PostgreSQL runbook](LOCAL_POSTGRESQL_PRODUCTION.md) for commands and templates. The latter includes migration steps for an existing installation; a new deployment does not need to migrate old RDS data. Production PostgreSQL uses the private Compose network: its URL usually uses `postgres`, not local development's `127.0.0.1`. Do not publish port 5432 to the internet.

The example local passwords and session value are for learning only. Production needs automatic backups and an off-host copy; a backup on the same server cannot protect against losing the entire host or disk. This chapter is a deployment roadmap. Finish local verification, then work through the linked deployment instructions step by step.

<a id="step-14"></a>
## 14. Troubleshoot errors

Check dependencies in order: **tools → Docker → healthy PostgreSQL → migrations → ready API → correct frontend address → successful business request**. Start with the failing command's final lines and the end of the backend traceback. Do not change every setting at once.

| Symptom | First check | Action |
| --- | --- | --- |
| `command not found` | Can this terminal locate node/pnpm/uv? | Finish installation and reopen the terminal; recheck inside WSL |
| Global npm installation returns `EACCES` | Node's installation location and permissions | Use a user-owned nvm installation; avoid arbitrary permission changes to the project |
| `Cannot connect to Docker daemon` | Is Docker Desktop running? | Start the engine; check Ubuntu integration in WSL |
| Docker socket `permission denied` | Your user's Docker permissions | Follow the operating system's official post-install steps; do not make the socket world-writable |
| Port 5432 or 8000 is occupied | Another database or backend launch method | Stop your own duplicate service; do not terminate unfamiliar processes |
| Database is unhealthy | `docker compose -f docker-compose.local.yml logs --tail=80 postgres` | Inspect startup errors, ports, free disk space, and the existing volume's initialization settings |
| Database password fails | Was the volume created with different credentials? | Use its existing configuration; editing Compose does not recreate existing database users |
| `/health` works, `/health/ready` returns 503 | `DATABASE_URL` and PostgreSQL status | Use the host-run database URL and start the API from `apps/api` |
| `relation ... does not exist` | Were application tables migrated? | Run `uv run --frozen alembic upgrade head` against the correct database |
| A report appears with no backend request | Is the API base empty? | Set `.env.local` to `/backend` and restart the frontend |
| `Failed to fetch` or proxy 502 | Is the API listening on 8000? | Open readiness first, then inspect Network and both server logs |
| `/api/v1/api/v1` or 404 | Was the API prefix duplicated? | Use only `/backend` as the local base |
| HTTP 422 | Which field failed in Response? | Check fields, minimum word count, and character limits; reinstalling is unnecessary |
| HTTP 429 | Guest/user quota | Adjust local `GUEST_DAILY_LIMIT` and restart; respect deployed usage limits |
| History unexpectedly disappears | Different cookies, hostname, or mode | Use the same browser address and confirm the same local database |
| Changed key, still fixed output | Fake AI, container environment, or duplicate-text cache | Disable fake AI for the actual running process, restart, and try new text |
| `pnpm install --frozen-lockfile` fails | Do package.json and lockfile match? | Inspect Git changes; do not hide the problem by deleting the lockfile |
| Font download fails during build | External resource address in build logs | Check network/proxy access; this is a build resource issue, not a database issue |

When asking for help, include your operating system, working directory, exact command, final error lines, and expected behavior. Redact keys, database passwords, cookies, and real learner text. Do not paste the entire `.env` file.

<a id="step-15"></a>
## 15. Learning milestones, self-checks, and further reading

### 15.1 Progress through observable outcomes

| Stage | Reading and practice | Evidence of completion |
| --- | --- | --- |
| First introduction | Chapters 1–4 | Explain frontend/backend, find the project folder, and check tools independently |
| First run | Chapters 5–6 | A report, real request, and persistent history in no-key mode |
| First code | Chapters 7–9 | The mini app runs and its 3 automated tests pass |
| First data understanding | Chapters 8 and 10 | Trace persistence from a request and read records with SQL |
| First real capability | Chapter 11 | Distinguish frontend mocks, fake AI, and real model output |
| First delivered change | Chapter 12 | An explainable diff, relevant checks, and a local commit |
| First deployment preparation | Chapters 13–14 | Explain configuration differences, backup restoration, and troubleshooting order |

Each stage may take several days. Learn to explain the commands you just ran before adding more features.

### 15.2 Self-checks and answers

1. **Does opening the page prove the database works?** No. The UI may use mocks. Check readiness and an actual business write.
2. **Does `USE_FAKE_AI=true` remove the database requirement?** No. In the main project, it replaces model results, not storage.
3. **Why run migrations?** A running database does not imply that application tables exist. Migrations track schema versions.
4. **Why does changing React state update the page?** State changes trigger rendering; ordinary variable assignment does not provide that state-management behavior.
5. **Why does the mini app lose history on restart while the main project retains it?** The former uses an in-process list; the latter uses PostgreSQL with a persistent volume.
6. **Can a model key go into `NEXT_PUBLIC_API_KEY`?** No. That prefix exposes values to the browser; server keys belong in the backend.
7. **Does the absence of a reported error prove mastery?** No. Consider whether the task offered an observation opportunity and whether success has verifiable evidence.
8. **Does `pnpm build` prove this project's types are correct?** No. Run `pnpm exec tsc --noEmit` separately for the current main repository.

### 15.3 Continue reading

- [Source walkthrough, in Chinese](PROJECT_CODE_WALKTHROUGH_ZH.md): locate functions and call relationships.
- [PostgreSQL beginner guide](POSTGRESQL_BEGINNER_GUIDE.md): practice data design, SQL, and transactions.
- [Chinese development notes](../development.md) / [English development notes](../development.en.md): deeper Python, React, and engineering explanations; compare deployment sections with the current runbook.
- [MemoryAgent design](MEMORY_AGENT_DESIGN.md): memory lifecycle, retrieval, forgetting, and evaluation.
- [Architecture](ARCHITECTURE.md) and [local testing](../LOCAL_TESTING.md): the complete system and regression checks.

Extend the mini app in this order: PostgreSQL → identity and user isolation → real structured AI → learning records and practice → bounded memory → deployment. Add one layer at a time, keeping both a successful example and a failing example to verify its boundaries.

### 15.4 Verification performed for this guide

Both editions were checked for matching chapters, relative links, command syntax, and identical teaching code. The mini app extracted from the guide passed 3 backend tests, TypeScript checking, and a Next.js production build; the main project's offline smoke test passed too. These runs reused dependencies already installed on this computer, rather than performing fresh installations on macOS, Windows, and Linux individually. The full project's PostgreSQL integration flow, real model calls, and cloud deployment were not rerun for this documentation update.
