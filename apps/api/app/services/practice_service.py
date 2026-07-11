from app.models.practice import PracticeExerciseAIResult, PracticeGradeAIResult
from app.models.common import OutputLanguage
from app.services.ai_client import LLMProviderConfig, parse_with_model
from app.services.output_language import language_instruction

GENERATE_SYSTEM_PROMPT = """
You are creating one targeted English exercise for a Chinese native speaker.

Requirements:
1. Generate exactly one exercise.
2. The exercise must target the given weakness (targetSkillCode) directly.
3. The difficulty should match the learner's CEFR level.
4. Follow the language requirement provided below for the instruction (promptZh) and explanation (explanationZh).
5. The exercise `type` must be one of: fix_sentence, fill_blank, rewrite_sentence.
6. `question` is the English prompt the student sees; `answer` is the model answer.
7. Always include every field required by the schema.
""".strip()

GRADE_SYSTEM_PROMPT = """
You are grading a targeted English exercise for a Chinese native speaker.

Requirements:
1. Decide if the student's answer is correct (isCorrect).
2. Give a score from 0 to 100.
3. Follow the language requirement provided below for feedback (feedbackZh).
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
    practice_type: str | None = None,
    output_language: OutputLanguage = "en",
    memory_context: str | None = None,
    decision_reason: str | None = None,
) -> PracticeExerciseAIResult:
    type_line = (
        f"Required exercise type:\n{practice_type} (the `type` field MUST be exactly this)\n\n"
        if practice_type
        else ""
    )
    user_prompt = (
        f"Target skill:\n{skill_code} / {zh_label}\n\n"
        f"{type_line}"
        f"Estimated CEFR level:\n{cefr_level}\n\n"
        f"Recent learner error examples:\n{recent_error_examples}"
    )
    if decision_reason:
        user_prompt += f"\n\nAdaptive selection rationale:\n{decision_reason}"
    if memory_context:
        user_prompt += f"\n\n{memory_context}\nHonor relevant learner preferences and effective strategies."
    return parse_with_model(
        messages=[
            {"role": "system", "content": f"{GENERATE_SYSTEM_PROMPT}\n\n{language_instruction(output_language)}"},
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
    output_language: OutputLanguage = "en",
) -> PracticeGradeAIResult:
    user_prompt = (
        f"Target skill:\n{target_skill_code}\n\n"
        f"Question:\n{question}\n\n"
        f"Expected answer:\n{expected_answer}\n\n"
        f"Student answer:\n{user_answer}"
    )
    return parse_with_model(
        messages=[
            {"role": "system", "content": f"{GRADE_SYSTEM_PROMPT}\n\n{language_instruction(output_language)}"},
            {"role": "user", "content": user_prompt},
        ],
        response_model=PracticeGradeAIResult,
        provider=llm_provider,
    )
