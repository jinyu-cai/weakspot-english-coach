# Model routing policy

This document records the intended quality/latency policy for every AI-backed
product flow. Exact model names remain deployment configuration; the application
routes provider-neutral work to a `Deep` or `Fast` slot.

Target text-chat routing:

- Deep slot: `openai/gpt-5.6-luna-pro` through OpenRouter
- Default Fast slot: `ds-v4-flash-0731` through the official DeepSeek API
- Alternate Fast slot: `openai/gpt-5.6-luna` through OpenRouter
- Reasoning: Deep uses `max`; Fast uses `medium`
- Luna Pro provider routing: only `openai`, with provider fallbacks disabled
- Adaptive mission planner: `gpt-5.6-sol` through the OpenAI Responses API
- Realtime voice: the configured OpenAI Realtime model
- Speech: the configured Qwen3-TTS-Flash model
- Memory retrieval: the configured Qwen embedding model when available, with a
  lexical fallback

The public production sources are `/api/v1/llm/models` and `/api/v1/health`.
Users may select another available Deep/Fast pair or provide BYOK models. A BYOK
request without a separate Fast model necessarily falls back to its primary
model.

## Product routing matrix

| Product operation | Route | Reason |
| --- | --- | --- |
| Diagnose writing | Selectable Fast/Deep pair; DS V4 Flash 0731 Fast / Luna Pro Deep by default | Fast supports interactive checks; Deep remains available for a thorough report. The selected safe pair is honored for Diagnose. |
| Import ChatGPT history | User-selected Fast/Deep; Fast default | The learner controls the tradeoff for potentially large imports. |
| Chat reply | Fast default; Deep optional per session | A conversation turn is latency-sensitive; the chosen model is pinned to the session. |
| Chat completion suggestions | Fast | Small, bounded prediction used while typing. |
| Dynamic chat scene generation | Deep default; Fast only when explicitly selected | Scene coherence and progression benefit from the quality slot. |
| Today Mission generation | `gpt-5.6-sol` adaptive planner when enabled; Deep fallback | Mission design is personalized, generative planning. |
| Vocabulary lesson generation | `gpt-5.6-sol` adaptive planner when enabled; Deep fallback | Word meaning, collocation, situation, and transfer task must stay coherent. |
| Today Mission / Vocabulary answer analysis | Fast Diagnose | The mission already supplies trusted context; feedback should be interactive. |
| Practice exercise generation | Deep | New questions must be varied, level-appropriate, and faithful to the target skill. |
| Practice Submit Answer grading | Fast | The question, expected answer, learner answer, and target skill form a bounded grading task. |
| Seven-day learning plan | Deep | Produces 42 connected exercises with progression and schema constraints. |
| End-of-chat learning analysis | Deep | Corrections update mastery, errors, notes, and memory, so evidence quality matters. |
| Input Learning analysis | Deep | Source-grounded extraction and personalization create durable learning records. |
| Realtime voice conversation | Dedicated Realtime model | Low-latency audio requires a purpose-built model. |
| Generated speech | Dedicated TTS model | Speech quality and voice support are independent from text model routing. |
| Memory semantic retrieval | Dedicated embedding model | Retrieval uses embeddings, not a chat model; lexical fallback keeps the product available. |
| Scheduler, mastery math, history, stats, notes, CRUD | No LLM | These operations are deterministic application logic. |

## Reasoning policy

- Fast calls request `medium` reasoning.
- Deep provider-neutral calls request `max` reasoning.
- OpenRouter calls send the provider-neutral `reasoning.effort` object; the
  official DeepSeek compatibility endpoint receives `reasoning_effort` when supported.
- Luna Pro dynamic scenes keep `max` reasoning but request a compact scene plan
  through native JSON Schema. The server expands that bounded plan into the
  full learner task and facilitator prompt. OpenRouter receives an explicit
  `max_completion_tokens` total budget because hidden reasoning tokens count as
  completion tokens; this prevents MAX reasoning from consuming the entire
  response and truncating the final JSON.
- The GPT-5.6 adaptive mission planner uses its separately configured reasoning
  level (`medium` in the current production deployment).
- Qwen Model Studio JSON calls keep thinking disabled because this compatibility
  path relies on its structured JSON behavior.

Model routing is covered by the offline smoke gate, including the exact Practice
contract: generation uses Deep with max reasoning and grading uses Fast with
medium reasoning.
