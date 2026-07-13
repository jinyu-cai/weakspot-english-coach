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

## Input Learning

`/input` turns authentic material into personalized language intake and later
output. Learners can paste a short excerpt or transcript from a show, film,
video, podcast, article, book, meeting, message, or everyday encounter and add
optional source details. The page shows the saved capture, source-grounded
items, or a pre-input attention mission when no material is supplied yet.

The page has two input flows. Grounded Capture extracts a small set of useful
items from supplied material. Attention Mission creates before/during/after
noticing and retelling guidance when the learner has not pasted material yet.
The learner is not locked into a fixed vocabulary list: selection considers
their goals, due weaknesses, existing memory, and phrases already seen.
Each grounded item keeps a short source excerpt so the explanation is auditable.

Input captures can be listed, opened, and deleted. Deletion also removes or
archives dependent phrase and mission records; the UI should refresh Memory
Center and Input Learning after the operation. In mock mode, `/input` contains
the same Grounded Capture and Attention Mission flows so the full page can be
reviewed without a backend.

The related stealth mission flow runs primarily inside text chat. A normal
conversation may create a fair opportunity to use a due weakness,
but the app records a learning outcome only after the backend opportunity gate
confirms the target was actually observable. `no_opportunity` never lowers a
learner's mastery or retention estimate and puts that target on a 12-hour
selection cooldown. Voice teardown now waits for the transcript API to confirm
the save before starting analysis. A failed save keeps the transcript in the
current browser tab's session storage and presents a retry action; it can be
recovered after client navigation or refresh. Active/pending voice state locks
the chat's back, new-session, and mode controls, plus app-wide links, sign-out,
and browser-history navigation. A short settle window captures the last
transcription event. Stable per-turn IDs make a retry idempotent without
deleting legitimate repeated utterances. Text turns are also UI-locked while a
reply is pending, and continuing after a completed analysis creates a fresh
same-topic session because analyzed sessions are immutable.

Practice submission uses a per-answer `clientAttemptId`. The ID is retained
when a request fails and replaced only when the learner edits the answer or
moves to another exercise, so retrying a lost response cannot create a second
attempt or apply mastery changes twice.

## Text-model selection

The header AI settings button loads the backend's safe server-model catalog.
Users independently select a Deep model and a Fast model from the providers
configured by the backend without receiving an API key. The default pair is
Qwen 3.7 Max for deep work and Qwen 3.7 Plus for fast work. Either slot can be
switched to its DeepSeek equivalent, so Qwen/DeepSeek mixed pairs are supported.
Loading failures are shown with a retry action. The same pair applies to text
AI features; the chat page also exposes both selectors before a new
conversation starts.

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

For a source-guided introduction to React/Next.js, the FastAPI backend, and the
complete request/data flow, start with the repo-level
[`development.md`](../../development.md).

To learn more, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs)
- [Learn Next.js](https://nextjs.org/learn)
- [v0 Documentation](https://v0.app/docs)
