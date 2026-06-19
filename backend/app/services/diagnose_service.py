from app.models.diagnostic import DiagnosticAIResult
from app.services.ai_client import LLMProviderConfig, parse_with_model

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


def diagnose_english_text(input_text: str, llm_provider: LLMProviderConfig | None = None) -> DiagnosticAIResult:
    user_prompt = f'Student text:\n"""\n{input_text}\n"""'
    return parse_with_model(
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        response_model=DiagnosticAIResult,
        provider=llm_provider,
    )
