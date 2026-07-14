# Backend Deployment (Linux + Docker + Nginx + HTTPS)

Deploys the FastAPI backend on a Linux server, behind Nginx with a real HTTPS
certificate, talking to a configured OpenAI-compatible text provider and real
AWS DynamoDB. Oracle Cloud is the normal production origin and uses the
DeepSeek profile. Alibaba Cloud ECS uses Alibaba Model Studio Qwen and is kept
as the release-matched final-demo origin; it should receive public traffic only
during the planned Qwen Cloud Hackathon demonstration/evidence window. This
guide applies to either Ubuntu/Debian host (`apt`). The frontend is on Vercel
and always calls the stable Cloudflare API hostname.

Text diagnosis/chat/analysis uses the configured Qwen, provider-neutral, or
DeepSeek profile. Realtime voice is separate and uses the official OpenAI
Realtime API, so voice-enabled production also needs an OpenAI API key on the
backend server.

For ordinary releases, deploy and verify Oracle only. Before the final demo,
deploy the exact same Git commit to Alibaba, verify local health and the model
catalog, then switch the Cloudflare origin manually. A frontend-only release
does not require either backend to restart and must not change the origin.

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

Set **real** values and make sure local-testing toggles are off. For Alibaba
Model Studio, use the Qwen profile (the key and endpoint must come from the same
workspace/region):

```bash
QWEN_MODEL_STUDIO_API_KEY=<model-studio-api-key>
QWEN_MODEL_STUDIO_BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1
QWEN_MODEL_STUDIO_MODEL=qwen3.7-max
QWEN_MODEL_STUDIO_FAST_MODEL=qwen3.7-plus
QWEN_EMBEDDING_MODEL=text-embedding-v4
QWEN_EMBEDDING_DIMENSIONS=256

# MemoryAgent defaults; set explicitly in production for clarity.
MEMORY_ENABLED=true
MEMORY_CONTEXT_TOKEN_BUDGET=700
MEMORY_RETRIEVAL_LIMIT=6
MEMORY_MAX_ITEMS_PER_USER=200
MEMORY_CHAT_RECENT_MESSAGES=12

# Optional additional/standby provider. The safe model catalog exposes every
# provider whose key, endpoint, and model are configured.
DEEPSEEK_API_KEY=<deepseek-api-key>
DEEPSEEK_BASE_URL=https://api.deepseek.com
LLM_MODEL=deepseek-v4-pro
LLM_MODEL_FAST=deepseek-v4-flash

# Realtime voice only; keep this server-side.
OPENAI_API_KEY=<openai-api-key>
OPENAI_REALTIME_MODEL=gpt-realtime-mini-2025-12-15
OPENAI_REALTIME_MODELS=gpt-realtime-mini-2025-12-15,gpt-realtime-2

AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...real...
AWS_SECRET_ACCESS_KEY=...real...
DYNAMODB_TABLE=WeakSpotEnglishCoach

# MUST include your Vercel URL (and any custom frontend domain):
CORS_ORIGINS=https://your-vercel-app.vercel.app

# Leave these UNSET in production:
# DYNAMODB_ENDPOINT_URL=   (empty -> real AWS)
# USE_FAKE_AI=false        (real configured provider)
```

Provider-neutral `OPENAI_COMPAT_*` variables are also supported. When a Qwen
key is present it becomes the server default; otherwise provider-neutral config
or the backwards-compatible DeepSeek config is used.

> Prefer an IAM role over static AWS keys if the server is an EC2 instance — then
> omit `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` and the SDK uses the role.

## 3. Create/update the DynamoDB table

```bash
docker compose run --rm api python -m scripts.create_table
```

The command is idempotent. It also requests the DynamoDB `ttl` attribute used
for Memory and recall-trace cleanup, so run it again after deploying
MemoryAgent even when the table already exists.

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

Verify health, the safe model catalog, and the Memory routes before testing the
browser:

```bash
curl -s https://api.your-domain.com/api/v1/health
curl -s https://api.your-domain.com/api/v1/llm/models
```

Then open the Vercel site, run a diagnosis, inspect `/memory`, and confirm the
result persists. The model catalog must never contain API keys or provider base
URLs.

## Updating after changes

```bash
git pull            # or re-scp the apps/api dir
bash deploy/start_backend.sh
```

The helper rebuilds the image, runs the idempotent table/TTL setup, recreates
the service, and checks local health. Deploy the backend before a frontend that
depends on new endpoints.

## Logs / restart

```bash
docker compose logs -f api
docker compose restart api
```

`restart: always` in `docker-compose.yml` brings the API back after reboots
(ensure Docker starts on boot: `sudo systemctl enable docker`).
