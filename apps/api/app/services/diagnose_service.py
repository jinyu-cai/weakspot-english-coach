from typing import Literal

from app.config import settings
from app.models.diagnostic import DiagnosticAIResult
from app.services.ai_client import LLMProviderConfig, parse_with_model

DiagnosisMode = Literal["fast", "deep"]
DEEPSEEK_MAX_OUTPUT_TOKENS = 384_000

SYSTEM_PROMPT = """
You are an expert English tutor for Chinese native speakers.

Analyze the student's English writing and return a structured diagnostic report.

Important requirements:
1. Give all feedback (explanations, summary, strengths, weaknesses) in clear, simple English.
2. Do not be overly harsh; be encouraging but honest.
3. Find every learner error you can identify. Include recurring patterns and
   isolated issues; do not cap the number of errors.
4. Classify each error using one of these category codes when possible:
   - grammar.verb_tense
   - grammar.article
   - grammar.preposition
   - grammar.subject_verb_agreement
   - vocab.word_choice
   - vocab.repetition
   - sentence.structure
   - sentence.variety
   - discourse.coherence
   - style.register
   - clarity.expression
   Put the chosen code in the `code` field, and a short human label in `category`.
5. For each error provide: the original text span, a corrected version, an English
   explanation, one micro lesson, and one practice goal.
7. Estimate the CEFR level (A1-C2) and an overall score 0-100 based on the text.
8. Always include every field required by the schema; use empty arrays when nothing applies.
9. Generate learningNotes: extract reusable takeaways from the text. Each note is one of:
   - "expression": a more natural way to phrase something the student wrote.
   - "vocabulary": a word or phrase worth learning, with tone/register and usage context.
   - "grammar": a grammar pattern illustrated by the student's text.
   For each note provide: a short topic title, the student's original phrasing, the natural
   version, a one-sentence explanation, context (when/tone/register to use it), and 2 example
   sentences showing it in use.
""".strip()

FAST_PROMPT_APPENDIX = """
Fast diagnosis mode — keep output concise but complete:
- Report ALL errors you find, not just the top ones. Cover every grammar,
  vocabulary, expression, clarity, and style issue.
- Keep every explanation to one short sentence.
- strengthsZh, weaknessesZh, recommendedNextActionsZh: at most 3 short items each.
- correctedText: rewrite all sentences that contain errors.
- learningNotes: at most 2 notes; keep explanation and context to one sentence each.
- Still return every field required by the schema.
""".strip()

DEEP_PROMPT_APPENDIX = """
Deep diagnosis mode — be thorough and detailed:
- Report ALL errors you find, not just the top ones. Cover every grammar, vocabulary,
  expression, and style issue.
- Provide detailed explanations and micro lessons — multiple sentences are fine.
- correctedText: rewrite the ENTIRE text with all improvements applied, showing the
  student what polished English looks like.
- learningNotes: extract as many useful notes as the text supports (up to 5).
  Give rich explanations, context, and examples.
- strengthsZh, weaknessesZh, recommendedNextActionsZh: be comprehensive.
- Think step by step. Take your time to analyze deeply.
""".strip()


def select_diagnose_model(diagnosis_mode: DiagnosisMode, llm_provider: LLMProviderConfig | None = None) -> str:
    if diagnosis_mode == "fast":
        if llm_provider is not None:
            return llm_provider.fast_model or llm_provider.model
        return settings.default_llm_fast_model or settings.default_llm_model

    if llm_provider is not None:
        return llm_provider.model
    return settings.default_llm_model


def diagnose_english_text(
    input_text: str,
    diagnosis_mode: DiagnosisMode = "deep",
    llm_provider: LLMProviderConfig | None = None,
    trace_id: str | None = None,
) -> DiagnosticAIResult:
    user_prompt = f'Student text:\n"""\n{input_text}\n"""'
    selected_model = select_diagnose_model(diagnosis_mode, llm_provider=llm_provider)
    if diagnosis_mode == "fast":
        system_prompt = f"{SYSTEM_PROMPT}\n\n{FAST_PROMPT_APPENDIX}"
        max_tokens = DEEPSEEK_MAX_OUTPUT_TOKENS
    else:
        system_prompt = f"{SYSTEM_PROMPT}\n\n{DEEP_PROMPT_APPENDIX}"
        max_tokens = DEEPSEEK_MAX_OUTPUT_TOKENS

    return parse_with_model(
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        response_model=DiagnosticAIResult,
        max_tokens=max_tokens,
        model=selected_model,
        provider=llm_provider,
        trace_id=trace_id,
    )
