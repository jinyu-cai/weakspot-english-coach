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

## 2026-07-13 — Notebook lifecycle and confirmed History deletion

Date: 2026-07-13

Branch: `feature/note-lifecycle-ui`

GitHub status: PR #34 open; Vercel Preview passed.

Deploy status: Vercel Preview built successfully; production and backend
deployments wait for merge.

Summary:

- Kept automatic weakness graduation non-destructive: notes linked only to
  resolved weaknesses appear in a reversible Previous view and return to
  Current if later evidence reopens a weakness.
- Added Current / Previous / All Notebook state filters above the existing
  expression / vocabulary / grammar filters, with explicit model-uncertainty
  messaging on retained previous notes.
- Replaced the History delete dropdown with a confirmation dialog that explains
  the permanent effect and names the related correction/note counts.
- Made confirmed manual History deletion remove associated Notebook rows in the
  backend and return `removedNotes`, while keeping automatic graduation separate.
- Expanded frontend, backend, learning-guide, and local-testing documentation
  for note sources, unbounded DynamoDB reads, export, deletion, and retention.
- Fixed narrow-screen clipping in the global header, Notebook state/category
  controls, Notebook/History cards, and long learner-generated text.
- Documented Oracle as the normal production origin and Alibaba/Qwen as a
  release-matched origin used only for the final submission demo. The stable
  API hostname remains unchanged while Cloudflare switches the origin.

Files changed:

- `apps/api/app/api/routes/history.py`
- `apps/api/app/api/routes/notes.py`
- `apps/api/app/db/repositories.py`
- `apps/api/app/services/notebook_service.py`
- `apps/api/scripts/dedup_test.py`
- `apps/api/scripts/integration_test.py`
- Notebook/History frontend components, types, mock data, and localized copy
- `apps/web/components/app-shell.tsx`, `auth-button.tsx`, and `error-card.tsx`
- `apps/api/README.md`, `apps/web/README.md`, `LOCAL_TESTING.md`, and
  `development.md`
- `README.md`, `docs/ARCHITECTURE.md`,
  `docs/ALIBABA_QWEN_DEPLOYMENT.md`, `docs/SUBMISSION.md`,
  `docs/DEMO_VIDEO_SCRIPT.md`, and `docs/project-structure-plan.md`

Tests run:

- `scripts.smoke_test` passed.
- `scripts.dedup_test` passed manual deletion, note cascade, weakness rollback,
  and fresh re-diagnosis after deletion.
- `scripts.integration_test` passed the full loop, 57-note multi-page retrieval,
  and reversible Current/Previous classification.
- TypeScript, ESLint, and the Next.js production build passed.
- Code-level responsive audit passed; controls no longer depend on content
  width below the `sm` breakpoint and long content uses explicit wrapping.

Known issues:

- Current/Previous classification depends on retained weakness source
  references. Physical cleanup of old resolved notes is intentionally not yet
  enabled and needs a separately reviewed retention policy.
- Automated browser visual QA was unavailable in the local tool session; the
  Vercel Preview still needs a manual narrow-screen review.
- The current public API origin is still Alibaba. This machine has no Cloudflare
  API credential, so returning `enapi.jinxxx.de` to Oracle requires the DNS
  change in the Cloudflare dashboard after both deployments are verified.

Next step: Merge PR #34, deploy the same merged commit to both servers, then
return the Cloudflare origin to Oracle and verify the request reaches Oracle.

## 2026-07-12 — Stealth practice and authentic Input Learning

Date: 2026-07-12

Branch: `feature/stealth-input-learning`

GitHub status: Merged in PR #32.

Deploy status: LIVE on Vercel and the Alibaba ECS primary backend.

Summary:

- Extended weakness memory with retention scheduling, difficulty/stability,
  due checks, transfer context, error fingerprints, bounded probe history, and
  separate evidence by learning modality.
- Added stealth weakness missions to text and voice conversation: the agent
  naturally elicits a due target, evaluates it only after a fair opportunity,
  and records `success`, `hinted_success`, `failure`, `avoided`, or
  `no_opportunity` without revealing the target beforehand.
- Added a strict opportunity gate so an irrelevant or unobservable response
  cannot lower mastery, stability, or retention evidence; no-op attempts are
  audited with a 12-hour reselection cooldown.
- Added replay → variation → transfer progression, delayed cold-recall
  scheduling, avoidance detection, relapse reopening, and post-session stealth
  summaries.
- Added memory verification states (`candidate`, `observed`, `confirmed`, and
  `contradicted`), candidate-aware retrieval discounting, natural confirmation
  guidance, and preserved conflict audit history.
- Coalesced duplicate same-batch memory candidates and prevented a matching
  stealth assessment plus ordinary chat correction from charging retention or
  modality mastery twice for one learner event.
- Added Input Learning for authentic material from shows, films, videos,
  podcasts, articles, books, meetings, messages, travel, games, or daily life.
  It creates source-grounded vocabulary/phrase/pattern items when text is
  supplied and an attention mission when the learner wants guidance before
  consuming material.
- Added Input Learning create/list/read/delete operations and learner-owned
  identity enforcement, plus the `/input` frontend experience and navigation.
- Exposed verification state, due date, stability, relapse risk, progression,
  and modality-specific mastery in the Memory Center.
- Added an immutable analysis draft plus an atomic DynamoDB effects/finalize
  transaction, probe/source idempotency, and failure-retry coverage so
  concurrent, repeated, or partially failed end-session requests cannot create
  duplicate errors, notes, memory observations, or mastery penalties.
- Added a mutually exclusive text-turn claim and atomic user/assistant message
  transaction. Analysis claims the session before reading its message snapshot,
  so a concurrent End action cannot omit an in-flight final turn and an AI
  failure cannot leave a lone learner message.
- Applied the same claim to voice transcript upload. Byte-budgeted staging
  chunks stay invisible until one final DynamoDB transaction publishes the
  entire batch; failed or crashed staging is deleted or expires automatically.
- Added a learner-scoped, re-entrant Memory writer lease with stale-worker
  fencing, preventing concurrent independent sources from losing canonical
  source references, observations, verification, or retention updates.
- Added end-to-end practice retry keys, a durable grade draft/result, stable
  attempt/error/probe IDs, and per-effect idempotency so an HTTP retry cannot
  re-grade or double-change skill, profile, strategy, weakness, or retention.
- Enforced text/voice session boundaries on the API, restricted transcript
  roles, and changed voice teardown to retain/recover and retry a failed
  transcript save before analysis. A settle window protects the last turn,
  active/pending voice locks local controls, app-wide links, sign-out, browser
  history, and unload; stable turn IDs preserve legitimate repeated utterances
  while keeping upload retries idempotent.
- Restricted the hidden-target preview to owner-only QA. Active missions remain
  absent from normal learner session and memory responses.
- Made identical Input Learning client retries address the same deterministic
  capture and return the completed result without duplicating durable memories;
  a conditional claim serializes concurrent requests, and interrupted captures
  retain a cleanup/recovery anchor. Claim-fenced item and memory transactions
  prevent an expired worker from writing after a newer retry takes ownership.
- Added focused deterministic regression coverage and expanded the MemoryAgent,
  backend, frontend, and local-testing documentation.

Files changed:

- MemoryAgent models/services, chat/session integration, and Memory APIs
- Learner-scoped Memory write leases and practice request idempotency
- Input Learning models/service/repositories/routes
- `/input`, API client/types/navigation, and mock learning data
- `apps/api/scripts/stealth_input_test.py`
- `docs/MEMORY_AGENT_DESIGN.md`, backend/frontend READMEs,
  `LOCAL_TESTING.md`, and this change log

Tests run:

- `scripts.stealth_input_test` passed all 11 deterministic sections with moto +
  fake AI: due-only scheduling, the opportunity gate, all scored outcomes,
  replay/variation/transfer, candidate verification, modality separation,
  concurrent canonical merge and writer fencing, relapse, practice replay and
  grade-draft recovery, atomic partial-failure retry, text/voice upload-analysis
  exclusion and half-turn/batch rollback, hidden-target privacy, strict
  modality, single-event de-duplication, grounded capture, retry idempotency,
  stale-worker fencing and cross-source evidence merging, attention missions,
  derivative cleanup, CRUD, and cross-user isolation.
- `scripts.smoke_test` passed imports, schemas, model catalog/routing, mastery,
  and serialization with the new routes mounted.
- `scripts.memory_agent_test` passed the existing seven lifecycle, retrieval,
  adaptive-decision, graduation/relapse, source-retraction, and API sections.
- `scripts.integration_test` passed the complete diagnose → profile → plan →
  practice → chat/realtime/auth loop.
- `scripts.dedup_test` passed repeated diagnosis and deletion reversal.
- `scripts.memory_benchmark` passed with recall@6 `1.0`, stale suppression,
  budget compliance, and `82.7%` estimated context reduction.
- Python compile, `git diff --check`, TypeScript, ESLint, and the Next.js
  production build all passed; `/input` and `/memory` prerender successfully.

Known issues:

- Authentic streaming-media playback and third-party subtitle fetching are
  intentionally out of scope. Learners paste text/transcripts or create a
  pre-consumption attention mission; the server does not bypass media access or
  copyright controls.

Next step: Completed in PR #32 and deployed; continue monitoring the live
stealth/Input Learning flows.

## 2026-07-12 — Independent Fast / Deep server-model pairing

Date: 2026-07-12

Branch: `release/memory-graduation-model-pairing`

GitHub status: Merged in PR #31.

Deploy status: LIVE on Vercel and the Alibaba ECS primary backend.

Summary:

- Kept the default pair on Qwen 3.7 Max for deep work and Qwen 3.7 Plus for
  fast work.
- Added independent Deep and Fast selectors so either slot can use its matching
  Qwen or DeepSeek model, including mixed-provider combinations.
- Kept provider API keys and endpoints on the server; the browser sends only
  allowlisted deep/fast model IDs.
- Saved both IDs with new text-chat sessions so conversation/prediction uses
  the Fast slot and end-of-session analysis uses the Deep slot.
- Migrated legacy browser single-model settings and retained the legacy
  `X-LLM-Server-Model` backend header for older clients.

Tests run:

- `uv run python -m scripts.smoke_test` passed.
- `DYNAMODB_ENDPOINT_URL= uv run python -m scripts.integration_test` passed,
  including Qwen/DeepSeek mixed routing and saved-session behavior.
- `pnpm exec tsc --noEmit` passed.
- `pnpm build` passed with all application routes generated.
- `git diff --check` passed.

Next step: Completed in PR #31; keep the model catalog and mixed-provider
routing covered by release tests.

## 2026-07-10 — Qwen Track 1 MemoryAgent

Date: 2026-07-10

Branch: current local worktree

GitHub status: Not pushed.

Deploy status: Backend deployed to Alibaba Cloud ECS (primary) and
`oracle-us-sj` (standby). Both Docker containers are healthy. The public
Alibaba API passed live Qwen diagnosis and `text-embedding-v4` Memory retrieval.
Frontend source is validated locally but not yet deployed to Vercel.

Summary:

- Added five persistent memory kinds: preference, goal, strategy, weakness, and
  episode, with evidence, confidence, importance, source lineage, observation
  count, pinning, and lifecycle status.
- Added Qwen memory-candidate extraction to diagnosis, text chat, session
  analysis, and chat import without an extra chat-completion call.
- Added deterministic weakness memories and accumulated per-skill/per-format
  practice effectiveness.
- Added Alibaba Model Studio `text-embedding-v4` (256d), lexical fallback,
  hybrid ranking, critical goal/preference reservation, and fixed 700-token
  Memory Packs.
- Added expiration, kind-specific decay, conflict replacement, capacity
  pruning, explicit forget, and DynamoDB TTL enablement.
- Replaced the lowest-mastery-only exercise choice with an explainable policy
  using mastery, error density, spacing, observed score, productive difficulty,
  and exploration.
- Added Memory APIs, recall audit traces, and the bilingual `/memory` Memory
  Center with edit, pin, forget, retrieval preview, score breakdown, and
  next-action display.
- Added MIT license, Track 1 architecture/submission/demo documentation, and
  Alibaba deployment evidence guidance.

Tests run:

- `python -m scripts.smoke_test` passed.
- `DYNAMODB_ENDPOINT_URL= python -m scripts.integration_test` passed the full
  learner/auth/model/realtime loop.
- `DYNAMODB_ENDPOINT_URL= python -m scripts.memory_agent_test` passed merge,
  conflict, expiry, bounded recall, adaptive decision, and API tests.
- `DYNAMODB_ENDPOINT_URL= python -m scripts.memory_benchmark` passed with
  Recall@6 1.00, stale suppression, full budget compliance, and 82.6% sample
  context reduction.
- `pnpm exec tsc --noEmit` passed.
- `pnpm build` passed, including static `/memory` generation.
- Alibaba public Memory probe passed create → retrieve (57/180 tokens with
  score breakdown) → forget; container logs showed no embedding fallback.
- Live `qwen3.7-plus` diagnosis returned valid structured output with 4 errors,
  persisted preferences/goals/weaknesses, and source deletion retracted all
  active test memories.
- DynamoDB TTL is `ENABLED` on attribute `ttl`; Alibaba reports Qwen provider +
  `text-embedding-v4`/256d, Oracle reports lexical fallback readiness.
- First-visit streamed-diagnosis guest cookie regression passed in production
  configuration; all temporary submissions, notes, and active memories were
  cleaned.

Known issues:

- Browser visual automation was unavailable in the current tool environment;
  frontend compile/static-generation checks passed.
- Final frontend deployment requires the normal Vercel source deployment after
  the code is pushed.

Next step:

1. Push the repository and deploy the frontend through Vercel.
2. Capture Alibaba/Model Studio/DynamoDB proof and record the video.

## 2026-07-09 — Safe server-model selector (DeepSeek / Qwen)

Date: 2026-07-09

Branch: current local `main` worktree

GitHub status: Not pushed.

Deploy status: Backend deployed to `oracle-us-sj` on 2026-07-09. The public
`https://enapi.jinxxx.de/api/v1/llm/models` endpoint and CORS preflight are
healthy. The Vercel frontend changes are not deployed yet.

Summary:

- Added a safe server-managed text-model catalog at `GET /api/v1/llm/models`.
- Users can choose only models whose provider key is configured on the backend;
  the browser receives model IDs/labels, never provider secrets or base URLs.
- Added global model selection in the header and a dynamic selector before a
  new text chat. The choice applies to diagnosis, plans, practice, imports, and
  text chat; voice remains on its separate OpenAI Realtime selector.
- Added Qwen 3.7 Max/Plus and DeepSeek choices when the corresponding backend
  credentials are configured. Existing chat sessions retain their selected
  server model and safely fall back if a provider is removed.
- Removed the prior hard-coded DeepSeek chat default that would have sent a
  DeepSeek model name to Qwen Model Studio.
- Kept BYOK optional but separated it from server-model selection, require
  HTTPS, and enforce the normal account rate/size limits.

Files changed:

- `apps/api/app/services/model_catalog.py`
- `apps/api/app/api/routes/models.py`
- `apps/api/app/api/deps.py`
- `apps/api/app/api/routes/chat.py`
- `apps/web/components/llm-provider-settings.tsx`
- `apps/web/app/chat/page.tsx`
- related configuration, docs, and regression tests

Tests run:

- `DYNAMODB_ENDPOINT_URL= UV_CACHE_DIR=.uv-cache uv run python -m scripts.smoke_test` ✅
- `DYNAMODB_ENDPOINT_URL= UV_CACHE_DIR=.uv-cache uv run python -m scripts.integration_test` ✅
- `pnpm lint` ✅
- `pnpm exec tsc --noEmit` ✅
- `pnpm build` ✅

Known issues:

- Qwen is intentionally not enabled yet because the production `.env` has no
  `QWEN_MODEL_STUDIO_API_KEY`; the live catalog currently lists DeepSeek only.

Next step:

1. Add the Qwen Model Studio variables to
   `~/weakspot-backend/.env` on `oracle-us-sj`, then recreate the API
   container.
2. Deploy the current Vercel frontend changes and verify the selector at
   `https://englearning.jinxxx.de` against `https://enapi.jinxxx.de`.

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

## 2026-06-22 — History fallback shipped and backend redeployed

Date: 2026-06-22

Branch: backend deployed from `main` @ `f64f106`.

GitHub status: pushed to `origin/main`.

Deploy status: LIVE. Backend rebuilt and healthy on oracle-us-west; frontend
deploy is triggered from `main`.

Summary:

- Shipped the history-page resilience fix: failed history loads now show a retry
  state, deletes optimistically remove the entry and roll back on failure, and
  older malformed `mode`/`severity` values no longer crash the page.
- Fixed `apps/api/deploy/start_backend.sh` so the post-deploy health check works
  on Ubuntu hosts that provide `python3` but no `python` command.
- Updated oracle-us-west from `origin/main:apps/api` via `git archive`, preserving
  the server `.env`, then rebuilt and recreated `weakspot-api`.

Files changed:

- `apps/web/app/history/page.tsx`
- `apps/web/components/submission-card.tsx`
- `apps/web/components/error-card.tsx`
- `apps/api/deploy/start_backend.sh`

Tests run:

- Backend local: `smoke_test` ✅, `integration_test` ✅, `dedup_test` ✅.
- Frontend local: `pnpm exec tsc --noEmit` ✅, `pnpm build` ✅.
- Local front/back production smoke: health, CORS, diagnose, history, delete,
  delete-after-refresh, and `/history` HTML ✅.
- oracle-us-west deploy: `bash deploy/start_backend.sh` ✅; Docker reports
  `weakspot-api` healthy on `127.0.0.1:8000`; local health returns
  `{"status":"ok"}`; OpenAPI exposes `DELETE /api/v1/history/{submission_id}`.
- Public backend: `https://enapi.jinxxx.de/api/v1/health` returns
  `{"status":"ok"}`; CORS preflight allows `https://englearning.jinxxx.de`.

Known issues:

- No live diagnosis was run against production during this deploy, to avoid
  creating real DynamoDB learner records or spending LLM tokens unnecessarily.

Next step: verify the Vercel production deployment UI after it finishes building
from `main`.
