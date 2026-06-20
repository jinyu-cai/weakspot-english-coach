# Local Testing Guide

You can test everything locally **before** deploying — including the full
front + back integration. Tiers go from "zero setup" to "production parity".
All backend commands run from `backend/`.

| Tier | What it proves | Needs |
|------|----------------|-------|
| 0 Smoke | code imports, AI schemas, validation | nothing |
| 1 Full loop | the entire API + data model end-to-end | nothing (moto + fake AI) |
| 2 Live server | a real HTTP server + a real DB | DeepSeek key and/or AWS or Docker |
| 3 Front+back | the browser → backend integration | Tier 2 + the frontend |
| 4 Docker parity | the container you'll ship | Docker |

---

## Tier 0 — Offline smoke (no services)
```bash
cd backend
uv run python -m scripts.smoke_test
```
Imports the whole app, generates the 4 AI JSON schemas, validates a sample payload,
checks the mastery + Decimal round-trip.

## Tier 1 — Full backend loop, zero external deps ✅ (recommended first)
```bash
cd backend
uv run python -m scripts.integration_test
```
Runs **diagnose → profile → plan → practice/generate → practice/submit → history**
in-process using **moto** (mock AWS) + **fake AI**. No Docker, no AWS, no DeepSeek key.
You'll see the weakness profile accumulate and mastery change. This is your fast
"did I break the loop?" check.

## Tier 2 — Live backend server
Run a real Uvicorn server and hit it with curl or the Swagger UI at
`http://localhost:8000/docs`. Pick a database:

**2a — No Docker: real AWS DynamoDB** (you have an AWS account; DynamoDB free tier
covers this). Set real values in `backend/.env` (`DEEPSEEK_API_KEY`, AWS creds,
`DYNAMODB_TABLE`). To skip DeepSeek spend while wiring UI, set `USE_FAKE_AI=true`.
```bash
cd backend
uv run python -m scripts.create_table          # one-time
uv run uvicorn app.main:app --reload --port 8000
curl -s localhost:8000/api/v1/health
curl -s -X POST localhost:8000/api/v1/diagnose \
  -H 'content-type: application/json' \
  -d '{"userId":"demo-user-001","text":"Yesterday I go to school and I meet my friend. I always use simple words."}' | jq .
```

**2b — Docker: DynamoDB Local** (no AWS at all):
```bash
cd backend
docker compose -f docker-compose.local.yml up -d        # DynamoDB Local on :8001
export DYNAMODB_ENDPOINT_URL=http://localhost:8001
export AWS_ACCESS_KEY_ID=local AWS_SECRET_ACCESS_KEY=local
uv run python -m scripts.create_table
uv run uvicorn app.main:app --reload --port 8000
```

> **Validate DeepSeek once** (real key, `USE_FAKE_AI` unset/false): the first real
> `/diagnose` call confirms your `LLM_MODEL=deepseek-v4-pro` + `DEEPSEEK_BASE_URL`
> work. If it 404s, try `DEEPSEEK_BASE_URL=https://api.deepseek.com/v1`.

## Tier 3 — Front + back integration (the real pre-deploy test)
Terminal A: run the backend (Tier 2). Terminal B: run the frontend.
```bash
cd frontend
# .env.local:
#   NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
#   NEXT_PUBLIC_DEMO_USER_ID=demo-user-001
npm install
npm run dev            # http://localhost:3000
```
Open `http://localhost:3000` and click through Diagnose → Dashboard → Plan → Practice.
This mirrors production exactly **except** there's no HTTPS/domain — and locally that's
fine because `http://localhost:3000 → http://localhost:8000` is not mixed content.
CORS already allows `http://localhost:3000` (see `CORS_ORIGINS`).

## Tier 4 — Docker parity (optional, before shipping to the Linux box)
```bash
cd backend
docker compose up -d --build        # builds the prod image, runs on :8000
curl -s localhost:8000/api/v1/health
```
Confirms the uv-based Dockerfile builds and runs before you push it to the server.

---

## What changes when you actually deploy
Only two things that local testing can't fully cover:
1. **HTTPS** — the Vercel frontend is HTTPS, so the backend must be HTTPS too
   (Nginx + Certbot). Browsers block HTTPS → HTTP "mixed content".
2. **CORS origins** — add your real Vercel domain to `CORS_ORIGINS`, and set
   `NEXT_PUBLIC_API_BASE_URL` to the HTTPS backend domain on Vercel (then redeploy).
