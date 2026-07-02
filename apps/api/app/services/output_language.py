from app.models.common import OutputLanguage


def normalize_output_language(language: str | None) -> OutputLanguage:
    return "zh-CN" if language == "zh-CN" else "en"


def language_instruction(output_language: OutputLanguage) -> str:
    if output_language == "zh-CN":
        return (
            "Language requirement: Write learner-facing feedback, summaries, explanations, "
            "micro-lessons, practice goals, plan text, and recommendations in Simplified Chinese. "
            "Keep English examples, corrected English, exercise questions, model answers, quoted learner text, "
            "skill codes, and CEFR labels in English."
        )
    return (
        "Language requirement: Write all learner-facing feedback, summaries, explanations, "
        "micro-lessons, practice goals, plan text, and recommendations in clear, simple English. "
        "Even if schema field names end in Zh, their values must be English. Keep quoted learner text as-is."
    )
