# WeakSpot English Coach Frontend

This is the [Next.js](https://nextjs.org) app bootstrapped with [v0](https://v0.app).

## Built with v0

This repository is linked to a [v0](https://v0.app) project. The deployed Vercel
project uses `apps/web` as its Root Directory. Every merge to `main` will
automatically deploy after Vercel reads that subdirectory.

[Continue working on v0](https://v0.app/chat/projects/prj_AWmIPvTwLlarjoJtYdAzXdZMIomq)

## Backend connection

This frontend talks to the WeakSpot **FastAPI backend** in the repo-level
`apps/api` directory and deployed on the Linux server.
The backend URL is configured via `NEXT_PUBLIC_API_BASE_URL`:

- **Local**: create `.env.local` with `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000`.
  Run a no-keys local backend with `uv run python -m scripts.dev_server` (moto + fake AI).
- **Vercel**: set `NEXT_PUBLIC_API_BASE_URL=https://<your-backend-domain>` in
  Project Settings → Environment Variables, then redeploy (it's inlined at build time).

If `NEXT_PUBLIC_API_BASE_URL` is unset, the app falls back to built-in mock data
(`apps/web/lib/mock-data.ts`) — handy for previewing the UI. The backend's `CORS_ORIGINS`
must include this app's origin.

## Memory Center

`/memory` is the Track 1 MemoryAgent control surface. It shows active and
archived preferences, goals, strategies, weaknesses, and experiences; supports
manual add/edit/pin/forget; previews the bounded Memory Pack and score
breakdown; lists recall traces; and displays the explainable next-practice
decision. Mock mode includes representative memory data so the complete page
can be reviewed without a backend.

## Text-model selection

The header AI settings button loads the backend's safe server-model catalog.
Users can select any model configured by the backend (for example DeepSeek or
Qwen) without receiving an API key. The same selection applies to text AI
features; the chat page also exposes it before a new conversation starts.

The optional custom-provider form is BYOK and is stored only in that browser's
local storage. It overrides the server-model choice until cleared.

## Getting Started

First, run the development server:

```bash
cd apps/web
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `apps/web/app/page.tsx`. The page auto-updates as you edit the file.

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
