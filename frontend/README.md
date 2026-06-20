# WeakSpot English Coach Frontend

This is the [Next.js](https://nextjs.org) app bootstrapped with [v0](https://v0.app).

## Built with v0

This repository is linked to a [v0](https://v0.app) project. The deployed Vercel
project uses `frontend/` as its Root Directory. Every merge to `main` will
automatically deploy after Vercel reads that subdirectory.

[Continue working on v0](https://v0.app/chat/projects/prj_AWmIPvTwLlarjoJtYdAzXdZMIomq)

## Backend connection

This frontend talks to the WeakSpot **FastAPI backend** in the repo-level
`backend/` directory and deployed on the Linux server.
The backend URL is configured via `NEXT_PUBLIC_API_BASE_URL`:

- **Local**: create `.env.local` with `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000`.
  Run a no-keys local backend with `uv run python -m scripts.dev_server` (moto + fake AI).
- **Vercel**: set `NEXT_PUBLIC_API_BASE_URL=https://<your-backend-domain>` in
  Project Settings → Environment Variables, then redeploy (it's inlined at build time).

If `NEXT_PUBLIC_API_BASE_URL` is unset, the app falls back to built-in mock data
(`frontend/lib/mock-data.ts`) — handy for previewing the UI. The backend's `CORS_ORIGINS`
must include this app's origin.

## Getting Started

First, run the development server:

```bash
cd frontend
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `frontend/app/page.tsx`. The page auto-updates as you edit the file.

Run type and production-build checks before opening a PR:

```bash
pnpm exec tsc --noEmit
pnpm build
```

## Learn More

To learn more, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs)
- [Learn Next.js](https://nextjs.org/learn)
- [v0 Documentation](https://v0.app/docs)
