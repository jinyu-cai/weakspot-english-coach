# Local Testing Guide

You do not need to merge to `main` to test the frontend. The safe loop is:

```text
new branch from latest origin/main
  -> test frontend locally with mocks
  -> test backend locally
  -> test frontend + backend together
  -> push branch and open PR
  -> verify Vercel Preview
  -> merge to main only after checks pass
```

All paths below assume the Git repo root:

```text
repo-root/
  apps/
    api/
    web/
  docs/
  README.md
  LOCAL_TESTING.md
```

Backend commands run from `apps/api`; frontend commands run from `apps/web`.

## Node and pnpm

This frontend uses Next 16 and pnpm 9. Use Node 24 locally:

```bash
nvm install 24
nvm use 24
nvm alias default 24
corepack enable
corepack prepare pnpm@9.6.0 --activate
```

Your earlier Node `v17.9.1` is too old for this pnpm version. After setting the
default, open a new terminal and confirm:

```bash
node -v
pnpm -v
```

## Branch workflow

Create a new branch for every feature or deployment-risky change:

```bash
git fetch origin
git switch -c feature/daily-wins-stats origin/main
```

Use naming like `feature/...`, `fix/...`, or `chore/...`. Do not develop feature
work directly on `main`.

## Frontend-only mock testing

Use this when you are changing UI and do not need the backend yet.

```bash
cd apps/web
pnpm install --frozen-lockfile
pnpm exec tsc --noEmit
pnpm build
pnpm dev
```

Do not set `NEXT_PUBLIC_API_BASE_URL`. The app will use `apps/web/lib/mock-data.ts`.
If your `apps/web/.env.local` points at `http://localhost:8000`, temporarily
override it for a mock-only run:

```bash
NEXT_PUBLIC_API_BASE_URL= pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) and check:

```text
Diagnose
Chat (Auto / Deep / Fast server-model choices)
Import
Daily Wins
Dashboard
Memory Center (add/retrieve/trace/forget)
Notebook
Plan
Practice
History
Login
```

Daily Wins should load at `/stats` with mock 7-day stats.

## Backend smoke and integration tests

These tests do not need real AWS, Docker, or an LLM key.

```bash
cd apps/api
uv run python -m scripts.smoke_test
uv run python -m scripts.integration_test
DYNAMODB_ENDPOINT_URL= uv run python -m scripts.memory_agent_test
DYNAMODB_ENDPOINT_URL= uv run python -m scripts.stealth_input_test
DYNAMODB_ENDPOINT_URL= uv run python -m scripts.memory_benchmark
```

The integration test covers diagnose, profile, plan, practice generation,
practice submit, history, auth/rate limiting, server model routing, realtime
session rules, chat import, session analysis, and daily stats. The dedicated
MemoryAgent test covers merge, conflict replacement, expiry, bounded recall,
source retraction, adaptive decisions, and Memory APIs.

`stealth_input_test` is the focused release gate for personalized learning. It
uses moto and fake AI, so it needs no AWS or model key. It verifies retention
scheduling, the no-penalty opportunity gate, all stealth outcomes, modality
mastery separation, replay/variation/transfer progression, memory verification,
relapse/due behavior, hidden-until-summary chat integration, grounded Input
Learning capture, single-event penalty de-duplication, attention missions,
derivative cleanup, CRUD, and cross-user isolation.

## Full local frontend + backend

Terminal A:

```bash
cd apps/api
uv run python -m scripts.dev_server
```

This recommended learning mode uses in-process moto + fake AI, needs no AWS or
model keys, and resets data when stopped. To test real configured services,
use `uv run uvicorn app.main:app --reload --port 8000` with a valid `.env`.

Terminal B:

```bash
cd apps/web
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 pnpm dev
```

Open [http://localhost:3000](http://localhost:3000), then verify:

```text
Diagnose creates records
Practice submit creates attempts
Memory Center recalls and forgets a manual memory
Chat model selector shows independent Deep and Fast choices (Qwen defaults,
mixed Qwen/DeepSeek combinations available when both providers are configured)
Input Learning `/input` saves grounded material, creates an attention mission
without pasted material, opens a saved capture, and deletes it
Chat quietly exercises a due weakness and reveals the result only in the
post-session learning summary; no-opportunity exchanges do not lower mastery
Daily Wins shows real backend stats
Dashboard and History still load
```

Local HTTP is fine for local testing. Production Vercel is HTTPS, so the backend
must also be HTTPS in production.

## Vercel Preview PR workflow

1. Push your feature branch.
2. Open a GitHub PR.
3. Let Vercel create a Preview Deployment for that PR.
4. Open the Preview URL and test the changed pages.
5. Confirm Vercel Project Settings:

```text
Root Directory:  apps/web
Install Command: corepack enable && corepack prepare pnpm@9.6.0 --activate && pnpm install --frozen-lockfile
Build Command:   corepack enable && corepack prepare pnpm@9.6.0 --activate && pnpm build
Output:          .next
```

6. If testing against the real backend, set Preview environment variable:

```text
NEXT_PUBLIC_API_BASE_URL=https://<your-backend-domain>
```

7. Ensure the backend `CORS_ORIGINS` includes the Vercel Preview origin if you
are calling the real backend from Preview.

## Production deploy checklist

Before merging:

```bash
cd apps/api && uv run python -m scripts.smoke_test
cd apps/api && uv run python -m scripts.integration_test
cd apps/api && DYNAMODB_ENDPOINT_URL= uv run python -m scripts.memory_agent_test
cd apps/api && DYNAMODB_ENDPOINT_URL= uv run python -m scripts.stealth_input_test
cd apps/api && DYNAMODB_ENDPOINT_URL= uv run python -m scripts.memory_benchmark
cd apps/web && pnpm exec tsc --noEmit
cd apps/web && pnpm build
```

Then verify the PR's Vercel Preview:

```text
Daily Wins /stats
Diagnose /
Chat /chat
Input Learning /input
Memory /memory
Login /login
Practice /practice
Dashboard /dashboard
History /history
Backend CORS and HTTPS
```

Merge to `main` only after local tests and Preview pass. Vercel will deploy
production from `main`.
