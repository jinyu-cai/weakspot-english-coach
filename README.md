# WeakSpot English Coach

**An adaptive English-learning coach that discovers what you need to practice — instead of asking you.**

Built for the **H0: Hack the Zero Stack** hackathon (Vercel v0 + AWS Databases).

Most AI English tutors are stateless: every session starts from zero and the learner
has to know what to ask. WeakSpot is different — the learner just writes English, and
the system diagnoses *specific* weaknesses (verb tense, repetitive vocabulary, clarity,
register, sentence variety…), accumulates an evolving **weakness profile** in DynamoDB,
and turns those real mistakes into a personalized 7-day plan and targeted exercises.
**The database is the learner's long-term memory — that's what makes it adaptive.**

## The adaptive loop

```
Learner writes English
  → DeepSeek diagnoses structured errors (11-category taxonomy)
    → errors + skill mastery written to DynamoDB (the learner profile)
      → plan & practice generated FROM that profile (weakest skills first)
        → practice graded → mastery updated → loop tightens
```

## Architecture (front/back separated)

```
Browser ──HTTPS──> Vercel (Next.js, built with v0)
                      │  fetch NEXT_PUBLIC_API_BASE_URL
                      ▼
                   Nginx (HTTPS / Certbot) ──> FastAPI (Docker, Linux)
                                                  ├─ DeepSeek-V4-Pro (JSON mode)
                                                  └─ DynamoDB (single table, boto3)
```

Secrets (DeepSeek key, AWS keys) live **only** in the backend. The frontend gets
just `NEXT_PUBLIC_API_BASE_URL` + `NEXT_PUBLIC_DEMO_USER_ID`.

## Repo layout

```
repo-root/
  apps/
    api/            FastAPI service: AI, DynamoDB, profile, plan, practice, stats
    web/            Next.js app generated with v0 + integration kit
  docs/             project notes and deployment structure
  README.md
  LOCAL_TESTING.md
```

This Git repo starts at the canonical monorepo root. Backend commands run from
`repo-root/apps/api`; frontend commands run from `repo-root/apps/web`.

## Tech stack

| Layer    | Choice |
|----------|--------|
| Frontend | Next.js + TypeScript + Tailwind + shadcn/ui, generated with **Vercel v0**, deployed on **Vercel** |
| Backend  | **FastAPI** (Python 3.11) in Docker on a Linux server, Nginx + Certbot HTTPS |
| Database | **Amazon DynamoDB** — single-table design (`WeakSpotEnglishCoach`) |
| AI       | **DeepSeek-V4-Pro** via OpenAI-compatible SDK, JSON mode + Pydantic validation |

## Quickstart

**Backend** (managed with [uv](https://docs.astral.sh/uv/); details in [`apps/api/README.md`](apps/api/README.md)):
```bash
cd apps/api
uv sync                                   # .venv (Python 3.11) + deps from lockfile
uv run python -m scripts.smoke_test       # offline: imports + schemas + validation
cp .env.example .env                       # fill in DeepSeek + AWS keys
uv run python -m scripts.create_table      # create the DynamoDB table
uv run uvicorn app.main:app --reload --port 8000
```

**Frontend** (details in [`apps/web/README.md`](apps/web/README.md)):
1. Generate the UI on **v0.dev** with [`apps/web/V0_PROMPT.md`](apps/web/V0_PROMPT.md).
2. Keep frontend source in `apps/web/app`, `apps/web/components`, and `apps/web/lib`.
3. `cd apps/web && pnpm install && pnpm dev` (point `NEXT_PUBLIC_API_BASE_URL` at the backend).

## Vercel deployment

In Vercel Project Settings, set **Root Directory** to:

```text
apps/web
```

Then use the frontend defaults:

```text
Install Command: corepack enable && corepack prepare pnpm@9.6.0 --activate && pnpm install --frozen-lockfile
Build Command:   corepack enable && corepack prepare pnpm@9.6.0 --activate && pnpm build
Output:          .next
```

The tracked Vercel config lives in `apps/web/vercel.json`, because Vercel reads
that file after entering the configured Root Directory.

## Testing locally (before deploying)

See **[LOCAL_TESTING.md](LOCAL_TESTING.md)**. The fastest check needs no Docker, no
AWS, and no DeepSeek key — it runs the whole loop in-process (moto + fake AI):
```bash
cd apps/api && uv run python -m scripts.integration_test
```
You can then run a live backend (real AWS DynamoDB or DynamoDB Local) and the v0
frontend on `localhost` to test the full front+back integration before shipping.

## End-to-end demo flow

Diagnose a paragraph → see structured errors + CEFR + score → open Dashboard
(weakness radar updates) → generate the 7-day Plan (built from weak skills) →
do a Practice exercise targeting the weakest skill → open Daily Wins to see your
7-day streak, focus minutes, badges, and next best action → re-diagnose and watch
mastery move.

## Branch workflow

Every new feature starts from the latest remote main:

```bash
git fetch origin
git switch -c feature/my-feature origin/main
```

Test locally, push the feature branch, open a PR, verify the Vercel Preview URL,
then merge to `main` only after the preview and backend checks pass. See
[`LOCAL_TESTING.md`](LOCAL_TESTING.md) for the full test and deploy checklist.
Record each meaningful change in [`docs/change-log.md`](docs/change-log.md).

User guide: [`docs/chatgpt-project-import-guide.md`](docs/chatgpt-project-import-guide.md)
explains how to import ChatGPT Project conversations into the website.

## Hackathon submission checklist

- [ ] Demo video < 3 min (YouTube) — show the loop **and** explain the DynamoDB data model
- [ ] Architecture diagram (the one above, fleshed out)
- [ ] **DynamoDB usage screenshot** (AWS console — table items)
- [ ] Published Vercel project link + **Vercel Team ID**
- [ ] Text description naming the AWS database used (DynamoDB)
- [ ] Track: **Monetizable B2C App** (education) or Open Innovation
- [ ] Submit before **2026-06-29 5:00pm PDT**
