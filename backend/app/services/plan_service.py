from app.models.plan import LearningPlanAIResult
from app.services.ai_client import LLMProviderConfig, parse_with_model

SYSTEM_PROMPT = """
You are an adaptive English learning coach.

Create a 7-day personalized learning plan for this learner, derived from their
actual weaknesses (lowest-mastery skills and recent errors).

Requirements:
1. Output learning goals and task descriptions in Simplified Chinese.
2. Each day should have 2 or 3 tasks.
3. Each task must target one or more weak skill codes (use targetSkillCodes).
4. Prefer short, focused practice over generic lessons.
5. Each task's practiceType must be one of: fix_sentence, fill_blank, rewrite_sentence.
6. Do not create speaking or pronunciation tasks.
7. Build difficulty progressively across the 7 days.
8. Always include every field required by the schema.
""".strip()


def generate_learning_plan(
    profile: dict,
    skills: list,
    recent_errors: list,
    llm_provider: LLMProviderConfig | None = None,
) -> LearningPlanAIResult:
    user_prompt = (
        f"Learner profile:\n{profile}\n\n"
        f"Current skill states (lower mastery = weaker):\n{skills}\n\n"
        f"Recent errors:\n{recent_errors}"
    )
    return parse_with_model(
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        response_model=LearningPlanAIResult,
        provider=llm_provider,
    )
