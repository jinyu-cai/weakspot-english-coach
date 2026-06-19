# Project Structure Cleanup Plan

## Current State

This GitHub repository was originally created from the frontend folder, so the
repository root is currently the Next.js frontend:

```text
repo-root/
  app/
  components/
  lib/
  package.json
  backend/
```

That layout is functional and keeps the existing Vercel deployment working, but
it is not the clearest long-term project shape because the frontend source is
implicit at the repository root while the backend is explicit under `backend/`.

## Target Structure

Move to a more intuitive monorepo layout:

```text
repo-root/
  frontend/
    app/
    components/
    lib/
    package.json
    pnpm-lock.yaml
  backend/
    app/
    deploy/
    Dockerfile
    docker-compose.yml
    pyproject.toml
    uv.lock
  docs/
    project-structure-plan.md
  README.md
```

## Migration Steps

1. Create a migration branch.
2. Move the current frontend files into `frontend/`.
3. Keep backend source under top-level `backend/`.
4. Update Vercel project settings:
   - `Build and Deployment` -> `Root Directory` -> `frontend`
   - Keep `NEXT_PUBLIC_API_BASE_URL=https://enapi.jinxxx.de`
5. Update README and deployment docs so all commands use the new paths.
6. Verify locally:
   - `cd frontend && pnpm build`
   - `cd backend && UV_CACHE_DIR=.uv-cache uv run python -m scripts.smoke_test`
   - `cd backend && UV_CACHE_DIR=.uv-cache uv run python -m scripts.integration_test`
7. Deploy frontend through Vercel and confirm `https://englearning.jinxxx.de`.
8. Rebuild the backend only if backend files changed:
   - `ssh oracle-us-west 'cd ~/weakspot-backend && docker compose up -d --build'`

## Notes

- Do not move files directly on `main` without first checking Vercel settings.
- The current layout should remain until the frontend redeploy path is confirmed.
- Keep real secrets out of GitHub. Only `.env.example` templates should be tracked.
- If v0 continues pushing directly to this repo, confirm whether it supports the
  `frontend/` root before completing the migration.
