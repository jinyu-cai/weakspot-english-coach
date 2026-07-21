# WeakSpot English Coach

**A cross-session English coach that remembers what works for each learner.**

WeakSpot is being submitted to the **Qwen Cloud Hackathon — Track 1:
MemoryAgent**. It diagnoses real English, autonomously accumulates learner
preferences, goals, recurring weaknesses, learning strategies, and recent
experience, then uses a bounded, explainable Memory Pack to make the next
conversation, plan, and exercise more accurate.

Live app: [englearning.jinxxx.de](https://englearning.jinxxx.de)<br>
Primary API: [enapi.jinxxx.de/api/v1/health](https://enapi.jinxxx.de/api/v1/health)

## Why this is a MemoryAgent

| Capability | Implementation |
| --- | --- |
| Autonomous experience accumulation | Qwen extracts durable memory candidates during diagnosis/chat; practice outcomes update strategy statistics automatically |
| Preferences and goals | Remembers feedback style, explanation language, learning focus, IELTS/career goals, and explicit manual memories |
| Efficient retrieval | Qwen `text-embedding-v4` (256d) + lexical hybrid ranking; the same embeddings help match Stealth Practice to the live topic |
| Timely forgetting | Kind-specific expiration, evidence-based weakness graduation and relapse, conflict replacement, capacity pruning, user-controlled forget, DynamoDB TTL |
| Limited-context recall | At most six memories under a 700 estimated-token ceiling with a 15% safety reserve; text chat keeps 12 recent turns |
| Improving decisions | Next skill and exercise format use mastery, error density, spacing, historical score, productive difficulty, and exploration |
| Explainability | Memory Center shows every memory; recall traces show selected IDs, component scores, and token use |

## Learning loop

```text
diagnose / chat / import / practice
  -> Qwen structured analysis + durable memory candidates
  -> consolidate, merge evidence, replace conflicts, expire stale memory
  -> store MEMORY# rows in DynamoDB
  -> hybrid retrieve into a bounded Memory Pack
  -> personalize chat, diagnosis, plan, and exercise generation
  -> grade outcome, update strategy effectiveness, and evaluate spaced mastery evidence
  -> make the next decision with more evidence
```

## Architecture

```mermaid
flowchart LR
    Browser[Next.js on Vercel] -->|HTTPS| Stable[enapi.jinxxx.de\nCloudflare]
    Stable -->|daily origin| Oracle[Oracle Cloud\nNginx + FastAPI + DeepSeek]
    Stable -. final demo origin .-> Ali[Alibaba Cloud ECS\nNginx + FastAPI + Qwen]
    Ali -->|structured generation| Qwen[Qwen 3.7 Max / Plus]
    Ali -->|256d embeddings| Embed[Qwen text-embedding-v4]
    Oracle -. embedding-only calls .-> Embed
    Oracle --> Memory[Memory lifecycle + hybrid ranker]
    Ali --> Memory
    Memory <--> DB[(DynamoDB single table)]
```

Oracle Cloud is the normal production origin. Alibaba Cloud ECS stays healthy
and on the same release, but receives production traffic only during the final
Qwen Cloud Hackathon demonstration/evidence window. The stable API hostname and
Vercel environment variable do not change; Cloudflare switches only the origin,
and both servers share the same DynamoDB learner state. See
[Architecture](docs/ARCHITECTURE.md) and the
[Alibaba/Qwen deployment runbook](docs/ALIBABA_QWEN_DEPLOYMENT.md).

## Product features

- Writing diagnosis with CEFR estimate, corrected text, categorized errors,
  micro-lessons, and auto-collected notes.
- Today's Mission with five production formats: generated roleplay, picture
  story, listening retell, open-ended decision, and contextual vocabulary.
- Contextual vocabulary at `/vocabulary`: use words in a real message first,
  then review provisional word-choice evidence across learning history.
- Text and realtime voice conversation, end-of-session analysis, and ChatGPT
  history import.
- Persistent learner weakness/mastery model and daily progress dashboard.
- Memory Center at `/memory`: add, inspect, edit, pin, forget, preview recall,
  inspect mastery evidence and recall traces, and see the next-action decision.
- Seven-day plan built from bounded recent evidence plus goals, preferences,
  strategies, and memories.
- Targeted practice whose skill and format adapt from actual learning outcomes.

Preview design and safety boundaries for guided, non-quiz learning are documented
in [Coach Mode / Input Lab 2.0 P0](docs/COACH_MODE_P0.md).

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 16, TypeScript, Tailwind CSS, shadcn/ui, Vercel |
| Daily backend | FastAPI/Python 3.11 in Docker on Oracle Cloud, Nginx, TLS, DeepSeek |
| Final-demo backend | Same FastAPI release on Alibaba Cloud ECS with Qwen Model Studio |
| Qwen | Model Studio `qwen3.7-max`, `qwen3.7-plus`, `text-embedding-v4` |
| Persistence | Amazon DynamoDB single-table design with TTL |
| Traffic switch | Stable Cloudflare API hostname; Oracle normally, Alibaba only for final demo |
| Voice | OpenAI Realtime API for voice chat; OpenAI Speech API for Coach listening; browser speech fallback |
| Auth | GitHub/Google OAuth, server-resolved identity, per-tier limits |

## Repository

```text
apps/api/   FastAPI, Qwen integration, DynamoDB, MemoryAgent, tests, deploy
apps/web/   Next.js application and Memory Center
docs/       architecture, MemoryAgent design, submission, demo, deployment
```

## Learn the codebase

If you have some CS/programming background but are new to Python, FastAPI, and
production Web engineering, start with the Chinese
[beginner learning guide](development.md). It explains the required Python
syntax, HTTP/FastAPI request lifecycle, route/service/repository layering,
DynamoDB key design, the original diagnosis-plan-practice loop, server model
selection, and the complete MemoryAgent flow using the current source code.

After that, use [Architecture](docs/ARCHITECTURE.md) for the production view,
[MemoryAgent Design](docs/MEMORY_AGENT_DESIGN.md) for algorithm details, and
[Local Testing](LOCAL_TESTING.md) while making changes. A comprehensive Chinese
[source walkthrough](docs/PROJECT_CODE_WALKTHROUGH_ZH.md) follows the current
request, service, storage, and UI paths function by function.

## Quickstart

Backend:

```bash
cd apps/api
uv sync
cp .env.example .env
uv run python -m scripts.create_table
uv run uvicorn app.main:app --reload --port 8000
```

Frontend:

```bash
cd apps/web
pnpm install
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 pnpm dev
```

Configure Alibaba Model Studio in `apps/api/.env`:

```bash
QWEN_MODEL_STUDIO_API_KEY=...
QWEN_MODEL_STUDIO_BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1
QWEN_MODEL_STUDIO_MODEL=qwen3.7-max
QWEN_MODEL_STUDIO_FAST_MODEL=qwen3.7-plus
QWEN_EMBEDDING_MODEL=text-embedding-v4
QWEN_EMBEDDING_DIMENSIONS=256
```

An embedding-only deployment can instead set `QWEN_EMBEDDING_API_KEY` and
`QWEN_EMBEDDING_BASE_URL`; this enables Model Studio vectors without changing
the server's default text provider.

## Tests and benchmark

All backend tests below run without external services by using moto and fake
structured model output:

```bash
cd apps/api
uv run python -m scripts.smoke_test
DYNAMODB_ENDPOINT_URL= uv run python -m scripts.integration_test
DYNAMODB_ENDPOINT_URL= uv run python -m scripts.memory_agent_test
DYNAMODB_ENDPOINT_URL= uv run python -m scripts.memory_benchmark
```

Frontend:

```bash
cd apps/web
pnpm exec tsc --noEmit
pnpm build
```

The deterministic MemoryAgent benchmark achieves Recall@6 `1.00`, suppresses
expired/superseded rows, stays within every conservative effective budget, and
reduces the sample context by `87.3%`. See [MemoryAgent Design](docs/MEMORY_AGENT_DESIGN.md) for the
method and live-embedding option.

## Submission material

- [Devpost submission draft](docs/SUBMISSION.md)
- [Under-three-minute demo script](docs/DEMO_VIDEO_SCRIPT.md)
- [Demo video production pack](docs/demo-production/README.md)
- [MemoryAgent technical design](docs/MEMORY_AGENT_DESIGN.md)
- [Alibaba Cloud deployment evidence checklist](docs/ALIBABA_QWEN_DEPLOYMENT.md)

## License

Released under the [MIT License](LICENSE).
