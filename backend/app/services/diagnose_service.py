from typing import Literal

from app.config import settings
from app.models.diagnostic import DiagnosticAIResult
from app.services.ai_client import LLMProviderConfig, parse_with_model

DiagnosisMode = Literal["fast", "deep"]

SYSTEM_PROMPT = """
You are an expert English tutor for Chinese native speakers.

Analyze the student's English writing and return a structured diagnostic report.

Important requirements:
1. Give all feedback (explanations, summary, strengths, weaknesses) in Simplified Chinese.
2. Do not be overly harsh; be encouraging but honest.
3. Focus on recurring patterns, not only isolated typos.
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
5. For each error provide: the original text span, a corrected version, a Chinese
   explanation, one micro lesson, and one practice goal.
6. In `skillUpdates`, list the skills touched by this text with a masteryDelta
   (negative for weaknesses, slightly positive for demonstrated strengths) and
   short Chinese evidence.
7. Estimate the CEFR level (A1-C2) and an overall score 0-100 based on the text.
8. Always include every field required by the schema; use empty arrays when nothing applies.
""".strip()

FAST_PROMPT_APPENDIX = """
Fast diagnosis mode:
- Identify only the 1-3 highest-impact recurring issues.
- Keep explanations and micro lessons concise.
- Still return every field required by the schema.
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
    system_prompt = SYSTEM_PROMPT
    max_tokens = 4000
    if diagnosis_mode == "fast":
        system_prompt = f"{SYSTEM_PROMPT}\n\n{FAST_PROMPT_APPENDIX}"
        max_tokens = 2200

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
