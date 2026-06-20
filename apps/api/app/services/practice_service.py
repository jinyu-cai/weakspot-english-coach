from app.models.practice import PracticeExerciseAIResult, PracticeGradeAIResult
from app.services.ai_client import LLMProviderConfig, parse_with_model

GENERATE_SYSTEM_PROMPT = """
You are creating one targeted English exercise for a Chinese native speaker.

Requirements:
1. Generate exactly one exercise.
2. The exercise must target the given weakness (targetSkillCode) directly.
3. The difficulty should match the learner's CEFR level.
4. Use clear, simple English for the instruction (promptZh) and explanation (explanationZh).
5. The exercise `type` must be one of: fix_sentence, fill_blank, rewrite_sentence.
6. `question` is the English prompt the student sees; `answer` is the model answer.
7. Always include every field required by the schema.
""".strip()

GRADE_SYSTEM_PROMPT = """
You are grading a targeted English exercise for a Chinese native speaker.

Requirements:
1. Decide if the student's answer is correct (isCorrect).
2. Give a score from 0 to 100.
3. Give feedback in clear, simple English (feedbackZh).
4. Provide the corrected answer (correctedAnswer).
5. Provide a skillMasteryDelta:
   - +6 to +10 if clearly correct
   - +1 to +5 if partially correct
   - -3 to 0 if incorrect
6. Always include every field required by the schema.
""".strip()


def generate_practice_exercise(
    skill_code: str,
    zh_label: str,
    cefr_level: str,
    recent_error_examples: list,
    llm_provider: LLMProviderConfig | None = None,
) -> PracticeExerciseAIResult:
    user_prompt = (
        f"Target skill:\n{skill_code} / {zh_label}\n\n"
        f"Estimated CEFR level:\n{cefr_level}\n\n"
        f"Recent learner error examples:\n{recent_error_examples}"
    )
    return parse_with_model(
        messages=[
            {"role": "system", "content": GENERATE_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        response_model=PracticeExerciseAIResult,
        provider=llm_provider,
    )


def grade_practice(
    question: str,
    expected_answer: str,
    user_answer: str,
    target_skill_code: str,
    llm_provider: LLMProviderConfig | None = None,
) -> PracticeGradeAIResult:
    user_prompt = (
        f"Target skill:\n{target_skill_code}\n\n"
        f"Question:\n{question}\n\n"
        f"Expected answer:\n{expected_answer}\n\n"
        f"Student answer:\n{user_answer}"
    )
    return parse_with_model(
        messages=[
            {"role": "system", "content": GRADE_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        response_model=PracticeGradeAIResult,
        provider=llm_provider,
    )
