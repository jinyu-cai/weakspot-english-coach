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
## 2026-06-20 — Add Google (email) login

Date: 2026-06-20

Branch: `feature/google-login` (from `origin/main`)

GitHub status: Pushed; PR opened to `main`.

Deploy status: Inactive until `GOOGLE_CLIENT_ID/SECRET` + `GOOGLE_REDIRECT_URI` are
set in the server `.env` (GitHub login keeps working regardless).

Summary:

- Backend Google OAuth (`/auth/google/login` + `/auth/google/callback`) mirroring the
  GitHub flow; same session cookie + identity + rate-limit infrastructure.
- Owner check now also matches `OWNER_EMAILS`, so a Google login can be an owner.
- Google users stored as `USER#google_<sub>/AUTH`; per-account daily limits apply
  (login = email).
- Frontend: header shows GitHub + Google login buttons; `startLogin(provider)`.

Files changed:

- `apps/api/app/config.py`, `app/api/deps.py`, `app/db/repositories.py`, `app/api/routes/auth.py`
- `apps/web/lib/auth.ts`, `apps/web/components/auth-button.tsx`
## 2026-06-20 — English-first AI feedback

Date: 2026-06-20

Branch: `feature/english-feedback` (from `origin/main`)

GitHub status: Pushed; PR opened to `main`.

Deploy status: Not in production. Restart backend after merge for English feedback.

Summary:

- Flipped all LLM feedback to clear, simple English (diagnose, plan, practice, and
  chat-import system prompts). Audience note ("for Chinese native speakers") kept.
- Translated the fake-AI canned data to English for dev/mock + integration-test
  consistency.
- Field names keep the `*Zh` suffix (they now hold English) to avoid a large
  model+frontend rename; internal tech-debt only.

Files changed:

- `apps/api/app/services/{diagnose,plan,practice,chat_import}_service.py`
- `apps/api/app/services/fake_ai.py`
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
- `apps/api` `smoke_test` passed (Google routes load).
- `apps/web` `tsc --noEmit` + `build` passed.

Known issues:

- Inactive until a Google OAuth client is created and the 3 env vars added.

Next step:

1. Create a Google OAuth client (Web app), redirect URI
   `https://enapi.jinxxx.de/api/v1/auth/google/callback`.
2. Add `GOOGLE_CLIENT_ID/SECRET`, `GOOGLE_REDIRECT_URI`, `OWNER_EMAILS` to `.env`;
   `docker compose up -d --force-recreate api`.
3. Verify on the Preview / live: the Google button signs you in.
- `apps/api` `smoke_test` + `integration_test` passed.

Known issues:

- Dashboard skill labels still use Chinese taxonomy `zhLabel`; UI chrome strings are
  mixed. Broader UI English-ification is a separate task.

Next step:

- Merge; restart the backend so production feedback is English.

## 2026-06-20 — English-first: dashboard skill labels (extends PR #5)

Date: 2026-06-20

Branch: `feature/english-feedback` (updates PR #5)

GitHub status: Pushed.

Deploy status: Frontend via Vercel on merge; backend redeploy needed for the prompts.

Summary:

- Frontend now renders the English skill `label` instead of the Chinese taxonomy
  `zhLabel` (dashboard skill list, skill-bar-chart, weakness-radar). A full scan
  found NO other hardcoded Chinese in `apps/web` — the rest of the UI was already
  English. So "all frontend English-first" = this flip + the PR #5 prompt change.

Files changed:

- `apps/web/app/dashboard/page.tsx`
- `apps/web/components/weakness-radar.tsx`
- `apps/web/components/skill-bar-chart.tsx`
- `docs/change-log.md`

Tests run:

- `apps/web` `tsc --noEmit` + `build` passed; `apps/api` `integration_test` passed.

Known issues: none.

Next step: local test, then merge PR #5.

## 2026-06-21 — Theme switcher: selectable color palettes

Date: 2026-06-21

Branch: feature/theme-switcher

GitHub status: Pushed; PR open.

Deploy status: Frontend-only. Vercel Preview per PR; not in production until merged.

Summary:

- Added a user-selectable color theme system layered on top of light/dark mode.
- Four palettes: Cream (default — the existing warm honey/custard look), Light
  Green (the Ghibli-style nature palette), Sky, and Blossom.
- Cream stays the default in `:root`/`.dark`. The other three are scoped by a
  `data-palette` attribute on `<html>` (light + `.dark` variants), sharing a
  soft parchment neutral base and differing mainly by accent hue.
- Selection persists in `localStorage` (`weakspot-palette`) and is applied
  before first paint via a small inline script in the layout (no theme flash).
- The header shows a palette-icon dropdown (base-ui menu). Items are visual
  preview chips — each renders the theme's background plus a primary dot and an
  accent bar, with no text label (the name is a hover tooltip / aria-label only);
  the active chip is ringed. A single compact icon button, so it shows on mobile
  too.

Files changed:

- `apps/web/app/globals.css` (themed `[data-palette]` blocks)
- `apps/web/lib/palette.ts` (new)
- `apps/web/components/palette-switcher.tsx` (new)
- `apps/web/components/app-shell.tsx` (mount switcher in header)
- `apps/web/app/layout.tsx` (no-flash init script)
- `docs/change-log.md`

Tests run:

- `apps/web` `tsc --noEmit` passed; `pnpm build` passed; themed `data-palette`
  selectors confirmed present in the compiled production CSS.

Known issues:

- Palette colors tuned without a local browser preview here; fine-tune on the
  Vercel Preview if any swatch needs adjusting.

Next step: verify on the Vercel Preview, then merge to `main` (frontend-only; no
backend redeploy needed).

## 2026-06-21 — De-dup diagnoses + manual history delete (weakness-model safe)

Date: 2026-06-21

Branch: feature/dedup-history

GitHub status: Pushed; PR open.

Deploy status: Backend + frontend. Frontend auto-deploys on merge; the backend
needs a manual redeploy for the new de-dup + delete logic to go live.

Summary:

- Problem: accidentally submitting the SAME text multiple times re-recorded the
  same errors, inflating skill error counts and corrupting the weakness model.
  (Different inputs that merely share an error type are a genuine recurring
  weakness and must still be counted — only identical text is a false duplicate.)
- Auto de-dup (system): every diagnosis stores a normalized text-hash marker
  (`SUBHASH#<hash>`, whitespace/case-insensitive). Re-submitting identical text
  returns the prior result with `duplicate: true` and does NOT re-record errors,
  move skill mastery, or bump `totalSubmissions`; no LLM call is made. Different
  text hashes differently and is still counted.
- Manual delete (user): `DELETE /history/{submissionId}?createdAt=...` removes a
  submission, deletes its errors, and reverses each error's skill penalty
  (mastery restored, errorCount decremented, pristine skills dropped), decrements
  `totalSubmissions`, and clears the de-dup marker so the text can be diagnosed
  fresh later. Identity is server-resolved, so a caller can only delete own data.
- Frontend: history submission cards get a delete control (trash → confirm
  dropdown) that rolls back the weakness profile and revalidates the dashboard;
  the diagnose page shows a banner + info toast when a result is a duplicate.

Files changed:

- `apps/api/app/core/text_hash.py` (new), `apps/api/app/core/mastery.py`
- `apps/api/app/db/keys.py`, `apps/api/app/db/repositories.py`
- `apps/api/app/api/routes/diagnose.py`, `apps/api/app/api/routes/history.py`
- `apps/api/scripts/dedup_test.py` (new regression test)
- `apps/web/lib/types.ts`, `apps/web/lib/api-client.ts`
- `apps/web/components/submission-card.tsx`, `apps/web/app/history/page.tsx`
- `apps/web/app/page.tsx`, `docs/change-log.md`

Tests run:

- `apps/api`: `smoke_test` ✅, `integration_test` ✅, `dedup_test` ✅ (de-dup +
  delete + skill reversal asserted in-process with moto + fake AI).
- `apps/web`: `tsc --noEmit` ✅, `pnpm build` ✅.

Known issues:

- Skill-mastery reversal is clamped, so a skill that had bottomed out at 0 may not
  restore to its exact pre-error value; it self-corrects over later diagnoses.
- De-dup markers are forward-looking: submissions made before this ships have no
  marker, so an identical resubmission of a pre-existing entry is de-duped only
  after it has been diagnosed once under the new code.

Next step: verify on the Vercel Preview, merge, then redeploy the backend.

## 2026-06-21 — Backend redeployed to oracle-us-west (English + Google + dedup)

Date: 2026-06-21

Branch: deployed from `main` @ `cbb2864` (after merging #9).

GitHub status: `main` has #5 + #6 + #9 merged.

Deploy status: LIVE. Backend rebuilt and running on oracle-us-west.

Summary:

- Merged PR #9, then redeployed the backend so the server runs current `main`:
  English AI feedback (#5), Google login routes (#6), and de-dup + manual history
  delete (#9). (The container had been ~21h old, i.e. pre-#5, so this shipped all
  three at once.)
- Server: oracle-us-west (ARM / aarch64), Docker. Code lives at
  `/home/ubuntu/weakspot-backend` and is NOT a git repo, so it is updated by
  `git archive origin/main:apps/api | ssh oracle-us-west tar -x` (tracked files
  only — no local `.uv-cache`/`.venv`; the server `.env` is excluded/preserved and
  was backed up to `.env.bak`).
- Rebuilt the arm64 image with `docker compose up -d --build`; container
  `weakspot-api` is healthy on `127.0.0.1:8000` (Nginx fronts HTTPS).
- Verified: `GET /api/v1/health` → ok; OpenAPI now exposes
  `DELETE /api/v1/history/{submission_id}` (the new delete route) alongside
  `GET /api/v1/history/{user_id}`.

Known issues / follow-ups:

- Google login (#6) is deployed but inactive: the server `.env` has no
  `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` /
  `OWNER_EMAILS`. Add those and register the Google OAuth client to enable it;
  GitHub login is unaffected.

Next step: confirm on the live site — run a diagnosis (English feedback), resubmit
the same text (duplicate banner), delete a history entry (weakness profile rolls
back).
