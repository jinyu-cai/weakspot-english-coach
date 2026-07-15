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

The learner model is also used as an active teaching policy. It can create a
natural opportunity to use a due skill during ordinary conversation, observe
whether the learner used or avoided it, and schedule a later cold-recall check.
Alongside output practice, Input Learning lets a learner bring material from a
show, video, article, podcast, transcript, meeting, or daily-life encounter and
turn grounded phrases into personalized noticing and reuse plans.

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
SK=INPUT_SOURCE#{sourceId}           Input Learning source metadata
SK=INPUT_ITEM#{sourceId}#{itemId}    grounded or attention target
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

Candidates from one analyzer response are coalesced by kind and normalized
canonical key before persistence. A correction, weakness summary, and explicit
memory candidate that describe the same learner event therefore add one
observation instead of three.

Users can inspect, edit, pin, and forget memories from `/memory`. The current
message always overrides recalled memory.

Every durable fact also carries a verification state:

```text
candidate -> observed -> confirmed
active fact + newer conflict -> contradicted (archived audit row)
```

A low-confidence single observation is `candidate`; it is discounted during
retrieval and the Memory Pack explicitly tells the coach to confirm it
naturally before relying on it. A stronger single observation is `observed`.
Two independent sources with sufficient confidence make it `confirmed`, as
does a direct learner edit or manual memory. When newer evidence conflicts on
the same canonical key, the prior row becomes `superseded` with verification
state `contradicted` and a pointer to the replacement. This separates
uncertainty about a fact from its storage lifecycle.

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

## Retention scheduling and modality mastery

Each active weakness carries a compact retention state in addition to its
graduation evidence:

- `stabilityDays`: the estimated interval over which the learner can retain the
  skill;
- `difficulty`: a learner-specific estimate of how hard the skill is to retain;
- `dueAt`: the earliest time for a useful cold-recall or transfer check;
- `lastColdRecallAt`: the latest unprompted success after a meaningful delay;
- `lastOutcome` in retention plus hint levels in bounded mission evidence;
- mastery by `exercise`, `writing`, `text_chat`, and `voice`, so success in one
  channel is not treated as proof of spontaneous use in every channel;
- contexts in which the learner has transferred the skill successfully.

The scheduler rewards delayed, unprompted success more than same-session
repetition. Hinted success grows stability less; failure shortens the next
interval; avoidance keeps the weakness due without fabricating a wrong grammar
attempt. A new error after resolution reopens the same weakness and brings its
next check forward. `dueAt` is a prioritization signal, not a notification
promise, and the agent still waits for an appropriate conversational context.

## Stealth weakness missions

A stealth mission turns a due weakness into an optional natural conversational
opportunity. Text chat never injects the raw weakness, old error sentence, or
remembered named entity into ordinary memory context. It does not reserve fixed
turns. A current message becomes eligible only when it contains meaningful
spontaneous English, has live fit with a target, and is far enough from the last
confirmed opportunity. Meta-language help such as translation, word meaning,
grammar explanation, and pronunciation stays probe-free. The scheduler excludes
every memory, skill code, and interaction move already confirmed in that session
and keeps a maximum of three confirmed opportunities as a fatigue and analysis
guardrail. This does not limit the cross-session pool of core skills. If no
distinct due weakness fits the live message, it may neutrally sample one
under-observed core skill. A neutral sample is not a suspected weakness and
cannot change mastery by itself. The coach must skip either target when the
current message has no natural opening, and a skipped candidate consumes no
confirmed-opportunity slot. Its bounded private attempt record still enforces
the cooldown and rotates the next candidate, so a conservative model report
cannot immediately repeat the same hidden setup. The lifecycle is:

```text
due weakness OR neutral under-observed skill + meaningful live message + unused skill
  -> bounded mission brief
  -> unused interaction move (recast | confirm | clarify | extend)
  -> one-reply naturalness gate with no old-example leakage
  -> model acknowledgement that a fair opportunity was actually created
  -> turn-bounded opportunity gate
  -> outcome: success | hinted_success | failure | avoided | no_opportunity
  -> weakness probe: retention + modality + transfer update + next due check
  -> neutral sample: coverage audit only; no mastery assignment
```

The opportunity gate is essential. A message is scored only when the prompt
and response genuinely made the target form or concept useful. If there was no
fair opportunity, the result is `no_opportunity`: attempts, mastery, stability,
and failure counts are unchanged. The attempt is still audited and suppresses
that weakness from probe selection for 12 hours, preventing an unsuitable
target from being injected repeatedly. This prevents silence, a topic change,
or an irrelevant short answer from becoming a fabricated mistake.

Outcomes have distinct meanings:

| Outcome | Meaning | Scheduling effect |
| --- | --- | --- |
| `success` | spontaneous, unhinted target use | strongest stability/mastery gain; schedule later transfer |
| `hinted_success` | correct after a cue or partial scaffold | smaller gain; schedule a nearer cold check |
| `failure` | fair opportunity, attempted target, materially incorrect | record weakness evidence and shorten interval |
| `avoided` | fair opportunity, but learner consistently routes around the target | keep due and vary the next context; do not label it a grammar error |
| `no_opportunity` | target was not reasonably elicited or observable | no learner penalty and no attempt counted |

Mission records keep the target kind, source weakness when present, activation
turn, `progressionStage` (`sample`, `replay`, `variation`, or `transfer`),
modality, context, elicitation strategy, outcome,
interaction move, evidence, hint level, and timestamps. Within one text session,
both skill codes and interaction moves rotate. Per-skill strategy memory keeps
bounded reward statistics for each move so the scheduler can learn which setup
creates usable opportunities without abandoning exploration. A recast,
confirmation check, or content extension that supplies target-shaped wording
makes later uptake `hinted_success`; it cannot count as cold recall. The stage advances only after independent
cold success: first retrieval of the same skill family, then changed details,
then a genuinely new setting. Even at replay, the prompt stays inside the live
conversation and never reproduces the stored mistake or its named entities.
Guided exercises cannot advance the ladder. The hidden teaching objective is
never shown before the response; only the post-session evidence summaries are
returned to the learner.

Neutral samples use `probeKind=discovery` and `progressionStage=sample`. Their
modality-specific coverage statistics are kept in one bounded strategy row per
modality, including attempts, fair opportunities, outcomes, recent probe IDs
and interaction-move yield. Retrying the same analysis is idempotent. Even a
confident independent success remains a sample, not mastery; a failure becomes
a learner weakness only when the ordinary correction/weakness analysis also
finds an exact learner utterance supporting it. This preserves the distinction
between “not observed,” “observed once,” and “durably learned.”

End-of-session analysis may also emit an ordinary correction for the same skill
as the stealth assessment. The durable source evidence is still merged, but the
matching skill code is skipped for the second retention/modality update. One
utterance cannot become two mastery penalties.

Analysis itself is retry-safe. The exact model output is saved as an internal
draft before learning state changes. Errors, expression notes, skill rows, and
the final public session result are then committed in one DynamoDB transaction.
If finalization fails, the claim is released but the draft remains; a retry
reuses it without another model call. Probe outcomes and memory source evidence
are independently idempotent. A stealth or durable-memory persistence error
also aborts finalization, so a retry completes missing evidence without double
counting. Text messages and voice transcripts are accepted only by their
matching session modality, and a session stops accepting new input once
analysis starts. Voice turns carry stable client IDs so an upload retry does
not collapse two legitimate repeated utterances. Text turn generation and
analysis use mutually exclusive claims; a complete user/assistant pair is
committed atomically, and analysis takes its claim before reading messages.
The browser also blocks app links, sign-out, history navigation, and local chat
controls while a voice session is active or has an unsaved transcript.
Voice transcript batches share the session turn claim and are published through
a commit marker: staged chunks remain invisible to chat history and analysis,
fit below DynamoDB item/transaction byte limits, and retain a cleanup TTL until
the final publish transaction atomically makes the complete batch durable.

All canonical Memory read-modify-write paths use a learner-scoped, re-entrant
write lease. A stale holder is fenced at the DynamoDB write itself, while two
valid sources serialize and re-read the latest canonical row before merging.
This prevents concurrent input captures or chat analyses from losing source
references, observation counts, verification, or retention state.

Visible practice uses a client-generated attempt key. Its model grade is saved
before learner-state effects, and the stable attempt ID is carried through
skill/profile counters, strategy evidence, weakness evidence, and the guided
retention probe. A lost HTTP response can therefore return the same completed
result without calling the model again or changing mastery twice.

## Input Learning: personalized intake, not another worksheet

Input Learning complements output practice by starting from material the
learner actually encountered. A capture may include pasted text or a transcript,
plus a source type and title, with an optional goal and learner note.
Source text is treated as data, never as model instructions. The resulting
items retain short source excerpts so the selected expression is auditable;
meanings and coaching explanations remain model-generated guidance.

The agent selects a small set of useful phrases based on relevant goals,
preferences, remembered weaknesses, and learning strategies. The public flow
has two modes:

- `grounded_capture`: notice meaning, collocation, grammar, pronunciation, and
  reuse value in text the learner supplied; every item keeps exact evidence;
- `attention_mission`: before/during/after guidance for what to notice and how
  to retell the content when no source material has been supplied yet.

Selected items are also stored as 180-day episode memories. They can therefore
inform later planning and conversation through the normal bounded Memory Pack,
without pretending that a suggested attention target was a quote from the
source.

Each validated capture request has a deterministic learner-scoped ID and a
conditional processing claim. Sequential retries return the completed result;
concurrent identical requests cannot mix model outputs or duplicate memory
evidence. If a worker fails, the retained processing anchor lets the next retry
retract partial item/memory derivatives before completing.

This is not limited to television. The same flow supports films, YouTube,
podcasts, news, books, emails, meeting transcripts, signs, menus, games, and
phrases heard in real life. The capture is durable and queryable; generated
items and missions are bounded. Deleting a capture removes or archives
its dependent learning items so orphaned excerpts are not recalled later.

Input Learning and weakness missions share one feedback loop:

```text
authentic input
  -> grounded phrase capture
  -> notice in context / attention mission
  -> learner retells or reuses selected language
  -> later bounded recall can personalize practice and conversation
```

This lets the agent use interesting content as comprehensible input while still
quietly targeting the learner's durable weak spots.

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
then x 0.75 when verification state is candidate
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
supporting strategy-memory IDs, progression stage, error fingerprint, and a
human-readable reason. Replay and variation keep the outcome-aware format
choice; transfer moves to open rewriting.

## API

```text
GET    /api/v1/memory?status=active|resolved|superseded|expired|forgotten|all
POST   /api/v1/memory
PATCH  /api/v1/memory/{memoryId}
DELETE /api/v1/memory/{memoryId}
POST   /api/v1/memory/retrieve
GET    /api/v1/memory/traces
GET    /api/v1/memory/next-action
GET    /api/v1/memory/stealth-next?modality=text_chat&topic=...  # owner-only QA

POST   /api/v1/input-learning/analyze
GET    /api/v1/input-learning
GET    /api/v1/input-learning/{sourceId}
DELETE /api/v1/input-learning/{sourceId}
```

Identity is resolved server-side; a client cannot read or mutate another
learner's memories by changing `userId`.

## Reproducible validation

```bash
cd apps/api
DYNAMODB_ENDPOINT_URL= uv run python -m scripts.memory_agent_test
DYNAMODB_ENDPOINT_URL= uv run python -m scripts.stealth_input_test
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
