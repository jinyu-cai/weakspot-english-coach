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
Daily Wins
Dashboard
Plan
Practice
History
```

Daily Wins should load at `/stats` with mock 7-day stats.

## Backend smoke and integration tests

These tests do not need real AWS, Docker, or an LLM key.

```bash
cd apps/api
uv run python -m scripts.smoke_test
uv run python -m scripts.integration_test
```

The integration test covers diagnose, profile, plan, practice generation,
practice submit, history, and `GET /api/v1/stats/daily/{userId}`. It also checks
that fixed UTC timestamps group into the expected local day for a timezone.

## Full local frontend + backend

Terminal A:

```bash
cd apps/api
uv run uvicorn app.main:app --reload --port 8000
```

Terminal B:

```bash
cd apps/web
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 pnpm dev
```

Open [http://localhost:3000](http://localhost:3000), then verify:

```text
Diagnose creates records
Practice submit creates attempts
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
cd apps/web && pnpm exec tsc --noEmit
cd apps/web && pnpm build
```

Then verify the PR's Vercel Preview:

```text
Daily Wins /stats
Diagnose /
Practice /practice
Dashboard /dashboard
History /history
Backend CORS and HTTPS
```

Merge to `main` only after local tests and Preview pass. Vercel will deploy
production from `main`.
