# Model routing policy

This document records the intended quality/latency policy for every AI-backed
product flow. Exact model names remain deployment configuration; the application
routes provider-neutral work to a `Deep` or `Fast` slot.

Production observed on 2026-07-21:

- Deep slot: `deepseek-v4-pro`
- Fast slot: `deepseek-v4-flash`
- Adaptive mission planner: `gpt-5.6-sol` through the OpenAI Responses API
- Realtime voice: the configured OpenAI Realtime model
- Speech: the configured OpenAI TTS model
- Memory retrieval: the configured Qwen embedding model when available, with a
  lexical fallback

The public production sources are `/api/v1/llm/models` and `/api/v1/health`.
Users may select another available Deep/Fast pair or provide BYOK models. A BYOK
request without a separate Fast model necessarily falls back to its primary
model.

## Product routing matrix

| Product operation | Route | Reason |
| --- | --- | --- |
| Diagnose writing | User-selected Fast/Deep; Fast default | Fast supports interactive checks; Deep remains available for a thorough report. |
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

- Fast calls omit `reasoning_effort`, avoiding hidden high-reasoning latency on
  models intended for quick interaction.
- Deep provider-neutral calls request `high` reasoning when supported.
- The GPT-5.6 adaptive mission planner uses its separately configured reasoning
  level (`medium` in the current production deployment).
- Qwen Model Studio JSON calls keep thinking disabled because this compatibility
  path relies on its structured JSON behavior.

Model routing is covered by the offline smoke gate, including the exact Practice
contract: generation uses Deep, grading uses Fast, and Fast grading does not ask
for high reasoning.
