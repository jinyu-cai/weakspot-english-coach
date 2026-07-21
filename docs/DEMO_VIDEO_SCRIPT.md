# WeakSpot MemoryAgent — Demo Video Script

Target runtime: **2:45**. Keep the mouse moving only when the narration names a
visible feature. Do not expose API keys, cookies, AWS credentials, or OAuth
secrets.

## 0:00–0:18 — Hook

**Show:** app home, then briefly open Memory Center.

> Most AI tutors forget you when the chat ends. You repeat your goals, your
> preferences, and even the learning methods that worked last time. WeakSpot is
> different: it is an English coach whose memory persists and improves its next
> decision.

## 0:18–0:48 — Autonomous accumulation

**Show:** enter an English paragraph that also says “I am preparing for IELTS
writing, and I prefer concise feedback.” Run a fast diagnosis with Qwen.

> I only submit my writing. Qwen diagnoses the language and, in the same
> structured response, proposes durable learner memories. WeakSpot stores the
> IELTS goal, concise-feedback preference, and evidenced grammar weaknesses.
> No separate memory button or extra model call is required.

**Show:** open `/memory`; highlight Goal, Preference, and Weakness cards plus
evidence, confidence, and observation count.

## 0:48–1:10 — Cross-session recall with bounded context

**Show:** Memory Center recall preview. Query: “Create my next writing plan.”

> In a new session, the system does not dump the entire history into the prompt.
> Qwen text-embedding-v4 and lexical ranking combine semantic match,
> importance, recency, and access history. Critical goals and preferences are
> reserved, then the Memory Pack uses a 700 estimated-token ceiling with a
> fifteen-percent safety reserve.

**Show:** token bar and “Why recalled” component scores.

## 1:10–1:32 — Real forgetting and conflict replacement

**Show:** edit the feedback preference from concise to detailed, or add it using
the same stable key in the prepared dataset. Switch filter to All and show the
old card marked Replaced. Click Forget on a disposable episode.

> Memory is not an append-only transcript. Equivalent observations merge.
> Contradictions replace the old fact. Goals, strategies, weaknesses, and recent
> episodes decay and expire at different rates, with DynamoDB TTL cleanup. The
> learner can inspect, correct, pin, or forget anything.

## 1:32–2:00 — Decisions improve from outcomes

**Show:** complete one or two prepared practice answers, then return to Memory
Center's Next Practice card. Open a Strategy card with attempts, average score,
and success rate.

> Every grade accumulates empirical strategy memory for that skill and exercise
> format. The next action no longer means “always choose the lowest mastery.” It
> combines mastery, error density, spacing, historical score, productive
> difficulty, and exploration. The recommendation explains its reason and
> links back to the memories that supported it.

## 2:00–2:27 — Alibaba Cloud and Qwen proof

**Show in quick sequence:** architecture diagram, Alibaba ECS instance summary,
public `/api/v1/health`, safe backend log lines showing `qwen3.7-max` or
`qwen3.7-plus`, Model Studio models, then DynamoDB rows beginning `MEMORY#` and
`MEMTRACE#`.

> For this final demo, the primary FastAPI origin runs in Docker on Alibaba
> Cloud ECS. Qwen 3.7 Max
> handles deep tasks, Plus handles fast paths, and text-embedding-v4 powers
> memory retrieval. DynamoDB stores the cross-session memory and recall audit.
> Oracle is the normal production origin outside this evidence window, not the
> demo's primary server.

## 2:27–2:44 — Evidence and close

**Show:** terminal with `memory_benchmark` result, then repository `LICENSE`.

> The reproducible benchmark reaches 100 percent Recall at 6 on the test set,
> suppresses stale memory, respects every token budget, and cuts sample context
> by 87.3 percent. WeakSpot English Coach: a Qwen MemoryAgent that learns not
> only your mistakes, but what you want and how you learn best.

## Capture checklist

- Use a test learner account with prepared data so no private content appears.
- Keep the final recording under three minutes.
- Show Alibaba ECS as the final-demo origin and the public health endpoint.
- Show Qwen model names but never keys.
- Show `MEMORY#` and `MEMTRACE#` rows in DynamoDB.
- Show the public repository and visible MIT license.
- Add captions; keep terminal/browser text large enough to read at 1080p.
