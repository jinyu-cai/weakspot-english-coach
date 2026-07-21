# OpenAI Build Week — Codex Collaboration Log

This file records the Build Week extension separately from WeakSpot's
pre-existing product history. It is a concise evidence index, not a replacement
for the timestamped Codex session or Git history.

## Build session

- **Date:** 2026-07-20 PDT
- **Goal:** Adapt WeakSpot for OpenAI Build Week with a real GPT-5.6 runtime
  feature, preserve the existing product, and prepare the required Devpost and
  video evidence.
- **Codex Session ID:** `[ADD AFTER RUNNING /feedback IN THE MAIN BUILD SESSION]`
- **Feature merge commit:** `ffd994ee203925562f6d2206d21545df571511f7`
- **Deployment:** backend live at `https://enapi.jinxxx.de`; frontend live at
  `https://englearning.jinxxx.de`; Vercel Production deployment
  `4mEndEFNzSgh4C5BuXiBmM1eaWqf`

## What Codex contributed

1. Audited the current Qwen/DeepSeek provider router, Coach mission contracts,
   learner scheduler, frontend mission UI, tests, and existing demo material.
2. Checked current official OpenAI guidance for GPT-5.6 model selection,
   intentional reasoning effort, the Responses API, Pydantic Structured
   Outputs, and privacy-preserving safety identifiers.
3. Separated Codex's development role from the website's runtime model role.
4. Designed an opt-in GPT-5.6 extension instead of renaming the pre-existing
   provider or rewriting the existing learning loop.
5. Implemented the OpenAI Responses adapter, structured planner insight,
   backend routing, runtime metadata, frontend evidence panel, capability
   health output, configuration templates, and offline contract coverage.
6. Prepared the Build Week README explanation, Devpost draft, exact demo
   narration, Chinese review translation, and shot-by-shot capture list.
7. Ran the full local validation matrix, verified the existing Oracle OpenAI
   credential without printing it, deployed the backend with a preserved `.env`
   backup, and completed a real public GPT-5.6 mission call.
8. Created and merged PR #70, verified Vercel Production, captured fresh public
   product states, and built the final sentence-aligned demo video.

## Key engineering decisions

| Decision | Reason |
| --- | --- |
| Use `gpt-5.6-sol` explicitly | The adaptive planner is the new quality-critical feature; an explicit model makes evidence and logs unambiguous. |
| Use Responses API | This is a new reasoning + structured-output workflow; it avoids extending the provider-neutral Chat Completions compatibility layer with OpenAI-only semantics. |
| Use native Pydantic parsing | The planner must return both a valid mission and an evidence trail with stable required fields. |
| Keep existing providers | Build Week judges can distinguish the new extension from the pre-existing foundation, and current deployments are not silently changed. |
| Make the route opt-in | No production provider switches until the owner has authorized the key and completed a real model check. |
| Show runtime metadata only on real path | The demo cannot claim GPT-5.6 merely because a static label exists in the UI. |
| Set `store=false` and hash the safety ID | Learner identity is not sent directly, and response storage is not needed for this stateless planning call. |
| Fail on non-GPT-5.6 IDs | Prevents accidental or misleading Build Week evidence. |

## Build Week files

- `apps/api/app/services/openai_mission_service.py`
- `apps/api/app/models/coach.py`
- `apps/api/app/services/coach_service.py`
- `apps/api/app/api/routes/coach.py`
- `apps/api/app/api/routes/health.py`
- `apps/api/app/config.py`
- `apps/api/scripts/coach_contract_test.py`
- `apps/web/lib/types.ts`
- `apps/web/app/coach/page.tsx`
- `apps/web/lib/i18n.ts`
- `apps/api/.env.example`
- `apps/api/deploy/.env.production.example`
- `README.md`
- `docs/OPENAI_BUILD_WEEK_SUBMISSION.md`
- `docs/openai-build-week/*`

## Validation evidence

Completed without network or secrets:

```text
COACH CONTRACT CHECKS PASSED
pnpm exec tsc --noEmit -> exit 0
python -m compileall -q app scripts/coach_contract_test.py -> exit 0
FULL LOOP PASSED
MEMORYAGENT TESTS PASSED
MEMORY BENCHMARK PASSED (Recall@6 1.0; context reduction 0.873)
LEARNING LOOP TESTS PASSED
pnpm lint -> exit 0
pnpm build -> compiled successfully; 19 routes generated
```

The mocked Responses contract verifies request shape and application behavior;
it is deliberately not described as a live GPT-5.6 call.

Live evidence completed:

- public health reports enabled/configured with `gpt-5.6-sol` and `responses`;
- public mission `mission_8af078f6caf7` reports the OpenAI-returned model and
  contains all four planner-insight sections;
- public picture-story mission `mission_55c5ac47c15f` independently reports
  `gpt-5.6-sol`, four evidence items, and four evaluation-focus items;
- backend trace records `openai_mission ... upstream_ok`, the response ID,
  21.596-second upstream time, and 2,404 total tokens;
- the second trace records a distinct response ID, 14.091-second upstream time,
  and 2,104 total tokens;
- deployed backend archive SHA-256 is
  `94d7c349089746ac2c505cbb6f326a38fe415ea7e527c3cd651096b2c630ae4e`;
- the pre-change production `.env` is preserved as a timestamped server backup.
- Vercel successfully built Preview deployment `9ib8oZ6s7Wr3vsVF9n7pdZJdHDJ3`
  for commit `dae5e40`; Preview SSO means production remains the judge-facing
  surface.

Final video QA completed:

- 174.033 seconds; 1920×1080; constant 30 fps; H.264 + 48 kHz mono AAC;
- 20 narration segments, 20 English cues, and 20 Chinese cues;
- every visual cut starts on a narration-sentence boundary;
- no detected silence longer than 0.8 seconds;
- fixed screenshots and hard cuts only—no digital zoom/pan jitter;
- the previous demo audio and its 17–19 second voice intrusion are not reused.

Still required: public YouTube upload, Devpost submission, and `/feedback`
Session ID.

Video-production audio completed separately from the runtime model: Qwen Audio
3 TTS Plus generated 20 sentence clips with the configured `longanlingxin`
voice. The mastered track is exactly 174.000 seconds, AAC mono at 48 kHz, and
the English and reviewed Chinese SRT files share the same real sentence timing.
This voice provider is narration tooling only and is not described as the
Build Week runtime model.

## Pre-existing boundary

Writing diagnosis, cross-session MemoryAgent storage/retrieval, five Coach
practice formats, chat, voice, dashboard, and the original Qwen/Alibaba demo all
predate this extension. They are supporting product context. The code and UI
listed above are the Build Week work judges should evaluate as the meaningful
extension.
