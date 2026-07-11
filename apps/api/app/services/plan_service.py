from typing import Optional

from app.models.common import OutputLanguage
from app.models.plan import LearningPlanAIResult
from app.services.ai_client import LLMProviderConfig, parse_with_model
from app.services.output_language import language_instruction

SYSTEM_PROMPT = """
You are an adaptive English learning coach.

Create a 7-day personalized learning plan for this learner, derived from their
actual weaknesses (lowest-mastery skills and recent errors).

Requirements:
1. Follow the language requirement provided below for all learner-facing text. The legacy schema
   field names may end in "Zh" (goalZh, titleZh, descriptionZh, promptZh,
   explanationZh), but their values must follow the requested output language.
2. Each day MUST have 2–4 tasks, and the total estimatedMinutes per day MUST be at least 30.
3. Each task must target one or more weak skill codes (use targetSkillCodes).
4. Each task's practiceType must be one of: fix_sentence, fill_blank, rewrite_sentence.
5. Each task MUST include 8–15 concrete exercises in the `exercises` array:
   - promptZh: a short instruction telling the student what to do.
   - question: the English sentence or prompt the student must work on.
   - answer: the correct/model answer.
   - explanationZh: an explanation of why the answer is correct and what rule it exercises.
6. Exercises must be realistic, varied, and directly target the weakness.
   Use the learner's recent error examples as inspiration for similar exercise sentences.
7. Do not create speaking or pronunciation tasks.
8. Build difficulty progressively across the 7 days:
   - Days 1–2: fundamental recognition (simpler sentences, one error per question).
   - Days 3–5: intermediate application (longer sentences, mixed error types).
   - Days 6–7: advanced production (paragraph-level, multi-skill integration).
9. Always include every field required by the schema.
""".strip()


def generate_learning_plan(
    profile: dict,
    skills: list,
    recent_errors: list,
    llm_provider: LLMProviderConfig | None = None,
    max_output_tokens: Optional[int] = None,
    output_language: OutputLanguage = "en",
    memory_context: str | None = None,
) -> LearningPlanAIResult:
    user_prompt = (
        f"Learner profile:\n{profile}\n\n"
        f"Current skill states (lower mastery = weaker):\n{skills}\n\n"
        f"Recent errors:\n{recent_errors}"
    )
    if memory_context:
        user_prompt += f"\n\n{memory_context}\nUse these memories to honor goals, preferences, and proven learning strategies."
    return parse_with_model(
        messages=[
            {"role": "system", "content": f"{SYSTEM_PROMPT}\n\n{language_instruction(output_language)}"},
            {"role": "user", "content": user_prompt},
        ],
        response_model=LearningPlanAIResult,
        max_tokens=max_output_tokens,
        provider=llm_provider,
    )
