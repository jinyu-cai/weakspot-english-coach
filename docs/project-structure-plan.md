# Project Structure

The GitHub repository uses a standard `apps/` monorepo layout:

```text
repo-root/
  apps/
    api/
      app/
      deploy/
      Dockerfile
      docker-compose.yml
      pyproject.toml
      uv.lock
    web/
      app/
      components/
      lib/
      package.json
      pnpm-lock.yaml
      vercel.json
  docs/
  README.md
  LOCAL_TESTING.md
```

Vercel must use `apps/web` as the project Root Directory and keep
`NEXT_PUBLIC_API_BASE_URL=https://enapi.jinxxx.de`. The Vercel config lives at
`apps/web/vercel.json`, where Vercel reads it after entering that Root Directory.

## Verification

Run these checks before deployment:

```bash
git rev-parse --show-toplevel
test ! -d frontend/frontend
test ! -d frontend/backend
cd apps/web && pnpm exec tsc --noEmit
cd apps/web && pnpm build
cd apps/api && UV_CACHE_DIR=.uv-cache uv run python -m scripts.smoke_test
cd apps/api && UV_CACHE_DIR=.uv-cache uv run python -m scripts.integration_test
```

After deployment:

```bash
curl -s https://enapi.jinxxx.de/api/v1/health
```

Confirm `https://englearning.jinxxx.de` loads the frontend and uses
`https://enapi.jinxxx.de` as its API base.

## Notes

- Keep real secrets out of GitHub. Only `.env.example` templates should be tracked.
- If v0 pushes directly to this repo, confirm it targets `apps/web`.
- Rebuild the backend only when backend files change:
  `ssh oracle-us-sj 'cd ~/weakspot-backend && docker compose up -d --build'`.
- Keep Oracle as the normal Cloudflare origin. Keep Alibaba on the same release,
  and switch the stable API hostname to Alibaba only for the final submission
  demonstration; switch it back to Oracle afterwards.
