# Backend Deployment (Linux + Docker + Nginx + HTTPS)

Deploys the FastAPI backend on your Linux server, behind Nginx with a real HTTPS
certificate, talking to **real DeepSeek + real AWS DynamoDB**. Assumes Ubuntu/Debian
(`apt`). The frontend is on Vercel and calls this over HTTPS.

Text diagnosis/chat/analysis uses DeepSeek by default. Realtime voice uses the
official OpenAI Realtime API, so production also needs an OpenAI API key on the
backend server.

## 0. Prerequisites (once)

```bash
# Docker + compose plugin
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER   # re-login after this

# Nginx + Certbot
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
```

Point a DNS A record for `api.your-domain.com` at the server's public IP.

## 1. Get the code onto the server

Either `scp -r apps/api/ user@server:~/weakspot-backend`, or push the repo and
copy/checkout `apps/api` on the server. You need the API app directory with
`pyproject.toml`, `uv.lock`, `Dockerfile`, `docker-compose.yml`, `app/`, and
`scripts/`.

## 2. Create the production `.env`

```bash
cd ~/weakspot-backend       # wherever apps/api landed
cp .env.example .env
nano .env
```

You can also start from the production-focused template:

```bash
cp deploy/.env.production.example .env
nano .env
```

Set **real** values — and make sure the local-testing toggles are OFF. The
provider-neutral `OPENAI_COMPAT_*` variables are preferred for new deployments;
the original `DEEPSEEK_*` names are still supported.

```bash
DEEPSEEK_API_KEY=<deepseek-api-key>
DEEPSEEK_BASE_URL=https://api.deepseek.com
LLM_MODEL=deepseek-v4-pro
LLM_MODEL_FAST=deepseek-v4-flash

# Realtime voice only; keep this server-side.
OPENAI_API_KEY=<openai-api-key>
OPENAI_REALTIME_MODEL=gpt-realtime-mini-2025-12-15

AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...real...
AWS_SECRET_ACCESS_KEY=...real...
DYNAMODB_TABLE=WeakSpotEnglishCoach

# MUST include your Vercel URL (and any custom frontend domain):
CORS_ORIGINS=https://your-vercel-app.vercel.app

# Leave these UNSET in production:
# DYNAMODB_ENDPOINT_URL=   (empty -> real AWS)
# USE_FAKE_AI=false        (real DeepSeek)
```

> Prefer an IAM role over static AWS keys if the server is an EC2 instance — then
> omit `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` and the SDK uses the role.

## 3. Create the DynamoDB table (once)

```bash
docker compose run --rm api python -m scripts.create_table
```

## 4. Start the backend

```bash
docker compose up -d --build
curl -s http://127.0.0.1:8000/api/v1/health      # -> {"status":"ok"}
```

Or use the checked-in helper, which builds the image, creates the DynamoDB table
idempotently, starts the service, and waits for the health endpoint:

```bash
bash deploy/start_backend.sh
```

It listens on `127.0.0.1:8000` only (not public) — Nginx will expose it over HTTPS.

## 5. Nginx + HTTPS

```bash
sudo cp deploy/nginx.conf.example /etc/nginx/sites-available/weakspot-api
sudo nano /etc/nginx/sites-available/weakspot-api      # set server_name to your domain
sudo ln -s /etc/nginx/sites-available/weakspot-api /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d api.your-domain.com            # issues cert + adds HTTPS redirect
```

Verify from your laptop:

```bash
curl -s https://api.your-domain.com/api/v1/health      # -> {"status":"ok"}
```

## 6. Point the frontend at it

In Vercel → Project → Settings → Environment Variables:

```
NEXT_PUBLIC_API_BASE_URL=https://api.your-domain.com
```

Then **redeploy** the frontend (NEXT_PUBLIC_ vars are baked in at build time).
Confirm `CORS_ORIGINS` in the backend `.env` contains that exact Vercel origin.

## 7. Smoke-test the full chain

Open the Vercel site, run a diagnosis, and confirm it persists (DynamoDB console
shows new items — that's also your required submission screenshot).

## Updating after changes

```bash
git pull            # or re-scp the apps/api dir
docker compose up -d --build
```

## Logs / restart

```bash
docker compose logs -f api
docker compose restart api
```

`restart: always` in `docker-compose.yml` brings the API back after reboots
(ensure Docker starts on boot: `sudo systemctl enable docker`).
