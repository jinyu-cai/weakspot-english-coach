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

Production keeps `NEXT_PUBLIC_API_BASE_URL=https://enapi.jinxxx.de`. Cloudflare
normally routes that stable hostname to Oracle; only the final hackathon demo
window routes it to the release-matched Alibaba/Qwen server. Origin switching
does not require rebuilding the frontend or changing its API-cookie hostname.

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

## Notebook lifecycle

`/notebook` collects reusable expression, vocabulary, and grammar notes from
writing diagnoses, end-of-conversation analysis, and ChatGPT imports. The API
returns the learner's complete Notebook; DynamoDB pages are joined by the
backend, so there is no 50-note display cap. Export always writes every note to
one Markdown file, regardless of the currently selected filters.

Notebook has two independent filters. The first selects **Current**,
**Previous**, or **All** learning states; the second selects expression,
vocabulary, or grammar. A note is Previous when its source is linked to one or
more resolved weakness memories and no active weakness memory. The note remains
stored because automatic mastery judgments can be imperfect. If later evidence
reopens a related weakness, the note automatically returns to Current.

On narrow screens, the state selector becomes a full-width vertical control and
the four note categories use two columns, expanding to four only when each tab
has enough room. Category labels use normal word boundaries and remain on one
line instead of splitting English words character by character. Card headers
and learner text wrap rather than overflowing, so long notes, counts, and
deletion details remain fully visible without horizontal page scrolling.

Deleting a History submission is different from automatic weakness resolution.
It is an explicit, confirmed learner action that permanently deletes the
submission, its error rows, and the Notebook notes generated from that source,
then retracts that source from the weakness and Memory models. Automatic
weakness graduation never deletes Notebook notes. A future retention policy may
physically clean up sufficiently old resolved evidence, but that policy is not
enabled today.

## History and dense labels

`/history` renders every submission and correction returned by the API; it does
not slice the arrays or impose a 20-item UI limit. The backend also reads every
DynamoDB page, so the visible counts reflect the learner's complete History.

Dashboard skill codes are localized when known and converted to readable words
when older data contains a code outside the current taxonomy. The horizontal
bar chart reserves a wider label column and wraps every line without ellipsis.
Chat and AI settings show server models as `provider · actual-model-name` in
full-width responsive selectors instead of squeezing verbose names into narrow
fixed-width controls.

The Chat session picker also has no 20-session ceiling. The API client follows
bounded cursor pages and de-duplicates then sorts the complete result, so a
large archive stays reachable without asking the backend for one unlimited
payload.

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

Input Learning history has no 50- or 200-capture ceiling. The frontend follows
the backend's bounded `nextCursor` pages until the archive is complete, with a
repeated-cursor guard and ID de-duplication before rendering.

The related stealth mission flow runs primarily inside text chat. The first
learner turn is not treated specially and no later turn number is reserved.
A one-reply probe is considered only when the learner is producing meaningful
English, the live message fits an unused target, and the last confirmed
opportunity is outside the cooldown. Translation, word-meaning, pronunciation,
and similar language-help requests stay probe-free. Raw weakness examples and
unrelated remembered topics are excluded from normal chat personalization, and
the coach skips a probe unless it is the natural next move in the live
conversation. A skipped candidate consumes no session slot. At most three
confirmed opportunities are retained in one chat as a fatigue guardrail. A
bounded private attempt history still applies cooldown and rotation after a
skip, preventing the next turn from retrying the same setup, while
the cross-session scheduler continues rotating through the full core-skill
pool. The probes also rotate natural reformulation,
meaning confirmation, genuine clarification, and content extension instead of
repeating the same follow-up-question pattern. If the coach models target
wording, later learner uptake is assisted evidence rather than cold recall. A
normal conversation may therefore create a
fair opportunity to use a due weakness,
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
configured by the backend without receiving an API key. The adaptive default
pair is published by the backend, so deployments may use DeepSeek, Qwen, or
another configured provider. Mixed-provider pairs are supported when the
server catalog exposes both providers.
Loading failures are shown with a retry action. The same pair applies to text
AI features; the chat page also exposes both selectors before a new
conversation starts. The dynamic “new AI situation” card has its own Fast/Deep
generation choice: Deep is the quality-first default for a coherent scene,
while Fast remains available when the learner explicitly prioritizes speed.

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
