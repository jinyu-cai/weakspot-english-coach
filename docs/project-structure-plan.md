# Project Structure

The GitHub repository uses an explicit monorepo layout:

```text
repo-root/
  backend/
    app/
    deploy/
    Dockerfile
    docker-compose.yml
    pyproject.toml
    uv.lock
  frontend/
    app/
    components/
    lib/
    package.json
    pnpm-lock.yaml
  docs/
  README.md
```

Vercel must use `frontend/` as the project Root Directory and keep
`NEXT_PUBLIC_API_BASE_URL=https://enapi.jinxxx.de`. The Vercel config lives at
`frontend/vercel.json`, where Vercel reads it after entering that Root Directory.

## Verification

Run these checks before deployment:

```bash
cd frontend && pnpm build
cd backend && UV_CACHE_DIR=.uv-cache uv run python -m scripts.smoke_test
cd backend && UV_CACHE_DIR=.uv-cache uv run python -m scripts.integration_test
```

After deployment:

```bash
curl -s https://enapi.jinxxx.de/api/v1/health
```

Confirm `https://englearning.jinxxx.de` loads the frontend and uses
`https://enapi.jinxxx.de` as its API base.

## Notes

- Keep real secrets out of GitHub. Only `.env.example` templates should be tracked.
- If v0 pushes directly to this repo, confirm it targets the `frontend/` root.
- Rebuild the backend only when backend files change:
  `ssh oracle-us-west 'cd ~/weakspot-backend && docker compose up -d --build'`
