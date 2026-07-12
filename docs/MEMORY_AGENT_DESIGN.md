# MemoryAgent Design

This document is the concise algorithm reference. For a step-by-step explanation
of Python/FastAPI, the original learning loop, and how MemoryAgent connects to
the rest of the application, start with the
[beginner learning guide](../development.md#11-新功能memoryagent-详细讲解).

WeakSpot's MemoryAgent turns isolated tutoring sessions into a learner model
that persists across diagnosis, text/voice chat, imported conversations,
planning, and practice. It is designed around four properties required by the
Qwen Cloud Hackathon MemoryAgent track: autonomous accumulation, efficient
retrieval, timely forgetting, and critical recall under a bounded context.

## What the agent remembers

| Kind | Example | Default lifetime |
| --- | --- | --- |
| `preference` | concise feedback, business English, explanation language | no automatic expiry |
| `goal` | IELTS writing band target, interview preparation | 365 days |
| `strategy` | per-skill/per-format attempts, average score, success rate | 180 days |
| `weakness` | recurring article or verb-tense gap with evidence | 60 days |
| `episode` | a consequential recent practice result | 30 days |

Every memory has a stable `canonicalKey`, content, evidence, confidence,
importance, source reference, observation count, access count, status,
timestamps, and optional vector. Qwen emits conservative `memoryCandidates`
inside the existing structured diagnosis/chat response, so accumulation does
not require an extra chat-completion call. Deterministic signals add weaknesses
from diagnosed errors and aggregate practice outcomes.

## DynamoDB layout

The existing single-table partition remains `PK=USER#{userId}`:

```text
SK=MEMORY#{memoryId}                 durable memory
SK=MEMTRACE#{timestamp}#{traceId}    recall audit trail (30-day TTL)
```

Active memory rows use `expiresAt` for synchronous filtering and `ttl` for
eventual physical deletion. This makes expiration correct immediately even
though DynamoDB TTL deletion is asynchronous.

## Consolidation and conflict handling

1. Validate kind, confidence, length, and canonical key.
2. If the same key and semantically equivalent content already exists, merge
   the evidence, raise confidence, and increment `observationCount`.
3. If the same key conflicts with the new statement, create the new memory and
   mark the old row `superseded`, with `supersededBy` and a 30-day cleanup TTL.
4. Keep pinned memory indefinitely. Expire other kinds using the lifetimes
   above.
5. If a user exceeds the configured capacity (default 200 active memories),
   forget the lowest-importance, oldest non-pinned episodes first.

Users can inspect, edit, pin, and forget memories from `/memory`. The current
message always overrides recalled memory.

## Evidence-based weakness graduation

A weakness is not hard-deleted after one correct answer. Each practice result
for the same `weakness.{skillCode}` appends bounded evidence (the latest 20
events). The weakness moves from `active` to `resolved` only when all of these
conditions hold:

| Evidence | Threshold |
| --- | --- |
| total attempts | at least 5 |
| distinct practice days | at least 3 |
| time between first and latest retained attempt | at least 14 days |
| success in the latest 5 attempts | at least 80%; success means correct and score >= 80 |
| average of the latest 3 scores | at least 85 |
| current skill mastery | at least 85 |
| successful exercise formats | at least 2 |
| time since the weakness was last observed | at least 14 days |

This combines repeated retrieval, spacing, transfer across formats, recent
performance, the aggregate skill model, and a recurrence-free interval. It is
a conservative product policy rather than a clinical proof that learning can
never decay.

The policy is motivated by research on
[retrieval practice](https://doi.org/10.1126/science.1152408),
[distributed practice](https://doi.org/10.1037/0033-2909.132.3.354), and
[knowledge tracing](https://doi.org/10.1007/BF01099821). The papers support the
general evidence signals, not these exact product thresholds; the constants are
kept together so production data can calibrate them later.

`resolved` rows immediately stop participating in retrieval and next-practice
decisions, but remain auditable for 180 days (or indefinitely when pinned).
Fresh error or diagnosis evidence for the same canonical key reactivates the
same row, increments `reopenedCount`, and keeps a short `resolutionHistory`.
This preserves a relapse history without creating duplicate weaknesses.

## Hybrid retrieval

Production vectors come from Alibaba Cloud Model Studio
`text-embedding-v4` at 256 dimensions. If the embedding API is unavailable,
the same path continues with lexical retrieval.

For memory `m` and query `q`, the score is:

```text
0.50 semantic similarity
+ 0.15 lexical similarity
+ 0.15 importance
+ 0.10 recency decay (kind-specific half-life)
+ 0.05 access-frequency signal
+ 0.05 critical-kind signal (preference or goal)
+ 0.15 when pinned
```

The ranker reserves up to two important preferences/goals, then fills the rest
by score. It writes an explainable `MEMTRACE` containing selected IDs, component
scores, query preview/hash, candidate count, and token usage.

## Bounded Memory Pack

The default pack is at most 700 estimated tokens and six memories. It is added
to the model as a separate system message with an explicit rule that current
input wins. Text chat also keeps only the 12 latest in-session messages.
Planning caps raw skills at 20 and recent errors at 40 instead of sending an
unbounded history.

This keeps the prompt roughly constant as learner history grows:

```text
all stored history
  -> expiry/status filter
  -> vector + lexical hybrid ranking
  -> critical-memory reservation
  -> 700-token Memory Pack
  -> Qwen diagnosis/chat/plan/practice prompt
```

## Outcome-aware next-practice decision

The skill score combines:

```text
45% mastery gap + 25% recent error density
+ 20% historical failure need + 10% time since practice
```

The exercise-format score combines learning need, closeness to a productive
difficulty around 75/100, exploration of under-sampled formats, and reliability
from repeated attempts. Every recommendation returns its component scores,
supporting strategy-memory IDs, and a human-readable reason.

## API

```text
GET    /api/v1/memory?status=active|resolved|superseded|expired|forgotten|all
POST   /api/v1/memory
PATCH  /api/v1/memory/{memoryId}
DELETE /api/v1/memory/{memoryId}
POST   /api/v1/memory/retrieve
GET    /api/v1/memory/traces
GET    /api/v1/memory/next-action
```

Identity is resolved server-side; a client cannot read or mutate another
learner's memories by changing `userId`.

## Reproducible validation

```bash
cd apps/api
DYNAMODB_ENDPOINT_URL= uv run python -m scripts.memory_agent_test
DYNAMODB_ENDPOINT_URL= uv run python -m scripts.memory_benchmark
```

The deterministic benchmark currently reports:

```text
Recall@6:               1.00 (5/5 fixtures)
Stale-memory suppression: pass
Token-budget compliance: pass
Raw history:            1,266 estimated tokens
Average Memory Pack:      220 estimated tokens
Context reduction:       82.6%
```

Set `MEMORY_BENCHMARK_LIVE=1` with a Model Studio key to exercise the live Qwen
embedding path. The default benchmark intentionally uses the lexical fallback
so CI remains deterministic and secret-free.
