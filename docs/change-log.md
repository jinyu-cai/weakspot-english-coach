# Project Change Log

This file records meaningful project changes, testing status, and deployment
status. For every future branch or feature, append a new entry before opening a
PR or deploying.

## Entry Template

```text
Date:
Branch:
GitHub status:
Deploy status:
Summary:
Files changed:
Tests run:
Known issues:
Next step:
```

## 2026-06-20 — Move repo to apps monorepo layout

Date: 2026-06-20

Branch: current local branch

GitHub status: Not pushed.

Deploy status: Not deployed. Vercel Project Settings still need Root Directory
set to `apps/web` before the next production deployment.

Summary:

- Moved the effective Git root from the nested local `frontend/` folder to the
  project root.
- Moved the FastAPI service from `backend/` to `apps/api`.
- Moved the Next.js app from `frontend/` to `apps/web`.
- Kept Vercel config with the web app at `apps/web/vercel.json`.
- Updated docs, local testing commands, ignore rules, and deploy notes for the
  new paths.

Files changed:

- `.gitignore`
- `README.md`
- `LOCAL_TESTING.md`
- `docs/project-structure-plan.md`
- `apps/api/README.md`
- `apps/api/DEPLOY.md`
- `apps/api/deploy/start_backend.sh`
- `apps/web/README.md`
- `apps/web/V0_PROMPT.md`

Tests run:

- `git rev-parse --show-toplevel` points to the project root.
- `test ! -d frontend && test ! -d backend && test -d apps/web && test -d apps/api`
  passed.
- `cd apps/web && pnpm exec tsc --noEmit` passed.
- `cd apps/web && pnpm build` passed after allowing network access for Google
  Fonts used by `next/font`.
- `cd apps/api && UV_CACHE_DIR=.uv-cache uv run python -m scripts.smoke_test`
  passed after allowing network access for PyPI dependency install.
- `cd apps/api && UV_CACHE_DIR=.uv-cache uv run python -m scripts.integration_test`
  passed.
- `curl -s https://enapi.jinxxx.de/api/v1/health` returned `{"status":"ok"}`.

Known issues:

- Vercel dashboard settings must be changed manually to use `apps/web`.

Next step:

1. Run backend and frontend validation from the new paths.
2. Push the branch and verify the Vercel Preview.

## 2026-06-20 — Daily Wins stats, Vercel structure, and testing docs

Date: 2026-06-20

Branch: `feature/daily-wins-stats`

GitHub status: Branch pushed to GitHub as `feature/daily-wins-stats`. GitHub
`main` has not changed and no PR has been merged.

Deploy status: Not deployed. Frontend and backend production are unchanged until
the branch is pushed, reviewed in a PR, and merged/deployed.

Summary:

- Preserved previous local UI work with stash message:
  `backup before daily-wins structure work`
- Fetched latest GitHub `origin/main` and created fresh branches:
  `chore/structure-vercel-testing-docs` and `feature/daily-wins-stats`
- Kept the canonical monorepo layout:
  `backend/`, `frontend/`, `docs/`, `README.md`, `LOCAL_TESTING.md`
- Did not move `.git` and did not flatten the outer local folder
- Moved Vercel config from Git repo root to the Next.js app root:
  `frontend/vercel.json`
- Deleted the misleading root-level `vercel.json`
- Added backend Daily Wins endpoint:
  `GET /api/v1/stats/daily/{userId}?timezone=<IANA timezone>&days=7`
- Added DynamoDB repository helper for recent practice attempts
- Added backend stats service that computes daily stats from existing records
- Added frontend Daily Wins route:
  `/stats`
- Added Daily Wins navigation item
- Added frontend `DailyStatsResponse` types and `getDailyStats`
- Added mock Daily Wins data when `NEXT_PUBLIC_API_BASE_URL` is unset
- Warmed the global UI theme toward a yellow primary tone
- Updated README, backend README, frontend README, local testing guide, and
  project structure notes

Files changed:

- `README.md`
- `LOCAL_TESTING.md`
- `backend/README.md`
- `backend/app/db/repositories.py`
- `backend/app/main.py`
- `backend/app/api/routes/stats.py`
- `backend/app/services/stats_service.py`
- `backend/scripts/integration_test.py`
- `docs/project-structure-plan.md`
- `frontend/README.md`
- `frontend/vercel.json`
- `frontend/app/globals.css`
- `frontend/app/stats/page.tsx`
- `frontend/lib/api-client.ts`
- `frontend/lib/mock-data.ts`
- `frontend/lib/nav.ts`
- `frontend/lib/types.ts`
- `vercel.json` deleted from Git repo root

Tests run:

- `cd frontend && pnpm exec tsc --noEmit` passed
- `cd backend && UV_CACHE_DIR=.uv-cache uv run python -m scripts.smoke_test`
  passed
- `cd backend && UV_CACHE_DIR=.uv-cache uv run python -m scripts.integration_test`
  passed, including `/stats/daily` and timezone day-boundary checks
- `cd frontend && pnpm build` passed after allowing network access for
  Google Fonts used by `next/font`
- `cd frontend && NEXT_PUBLIC_API_BASE_URL= pnpm dev --hostname 127.0.0.1 --port 3000`
  started successfully with elevated localhost permission
- `curl -I http://127.0.0.1:3000/stats` returned `200 OK`
- `git diff --check` passed

Known issues:

- `cd frontend && pnpm lint` fails because `package.json` has a `lint` script
  calling `eslint .`, but ESLint is not installed in the project dependencies.
  This is existing tooling configuration, not a Daily Wins compile failure.

Next step:

1. Push `feature/daily-wins-stats` to GitHub.
2. Open a PR into `main`.
3. Verify the Vercel Preview URL.
4. Confirm backend deployment plan if production backend needs the new
   `/api/v1/stats/daily/{userId}` endpoint before frontend production uses it.
5. Merge only after local tests and Preview pass.

## 2026-06-20 — ChatGPT Project import user guide

Date: 2026-06-20

Branch: `feature/daily-wins-stats`

GitHub status: Branch pushed to GitHub as `feature/daily-wins-stats`. GitHub
`main` has not changed and no PR has been merged.

Deploy status: Not deployed.

Summary:

- Added a user-facing guide for importing ChatGPT conversations into WeakSpot.
- Documented supported import sources: ChatGPT export ZIP, `conversations.json`,
  and pasted transcripts.
- Documented current limitations: no direct ChatGPT account connection, no
  automatic ChatGPT Project filtering, and a 20-conversation per-request limit.
- Added a README link to the new guide.

Files changed:

- `docs/chatgpt-project-import-guide.md`
- `docs/change-log.md`
- `README.md`

Tests run:

- `git diff --check` passed after the documentation change.

Known issues:

- The current app can load a full ChatGPT export, but it cannot automatically
  filter only one ChatGPT Project from that export.

Next step:

- Add project-level filtering or manual conversation selection in the Import UI
  if full ChatGPT Project import becomes a product requirement.

## 2026-06-20 — Import: relevance-ranked selection + how-to guide

Date: 2026-06-20

Branch: `feature/import-improvements` (based on `codex-apps-monorepo-restructure`)

GitHub status: Pushed; PR opened against `codex-apps-monorepo-restructure`.

Deploy status: Not in production. Verify on the PR's Vercel Preview first.

Summary:

- `selectImportConversations` now ranks conversations by English-learning relevance
  (practice keywords translate/correct/grammar + English-text ratio + user-message
  substance) instead of raw length, so dedicated practice projects (translation,
  correction) surface ahead of casual chats within the analysis cap.
- Added an English step-by-step "How to import your ChatGPT history" guide card to
  the import page (ChatGPT Settings -> Data controls -> Export data -> upload).

Files changed:

- `apps/web/lib/chatgpt-import.ts`
- `apps/web/app/import/page.tsx`
- `docs/change-log.md`

Tests run:

- `cd apps/web && pnpm exec tsc --noEmit` passed.
- `cd apps/web && pnpm build` passed (8 routes).

Known issues:

- AI feedback (summary/explanations) is still Simplified Chinese; full English-first
  feedback is a separate product decision.

Next step:

1. Verify the import page on the PR's Vercel Preview (upload a real export).
2. Merge after Preview passes.
