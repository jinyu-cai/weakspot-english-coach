from typing import List, Optional

from app.config import settings
from app.models.common import OutputLanguage
from app.models.chat import SessionAnalysisAI
from app.services.ai_client import LLMProviderConfig, parse_with_model
from app.services.output_language import language_instruction

SESSION_ANALYSIS_PROMPT = """\
You are an expert English tutor for Chinese native speakers.

You will receive a complete English conversation between a learner and an AI coach.
Diagnose the learner's English from their own messages (role: user). You may also read the
coach's replies (role: assistant) for context — in particular, when the learner asked the
coach how to say or phrase something, use the coach's suggested wording as the source of the
natural expression you record.

Your analysis must cover:

1. **corrections** — Every grammar, vocabulary, or usage error the learner made.
   For each: code, category, severity (low/medium/high), the original text,
   the corrected version, an explanation, one micro lesson,
   and one practice goal.
   Be thorough — catch every error, even small ones.

2. **naturalExpressions** — Useful phrasings to save to the learner's notebook. Include BOTH:
   (a) Places where the learner's English was grammatically correct but sounds unnatural or
       non-idiomatic — suggest a more natural alternative.
   (b) **Expression gaps** — moments where the learner asked how to express an idea (e.g.
       "how do I say...", "怎么用英语说..."), switched to Chinese because the English was
       missing, or asked the coach to translate or rephrase something. Record what the learner
       wanted to convey as `original` (their Chinese or rough attempt) and the natural English
       as `natural` (use the coach's suggestion when one was given in the conversation).
   For each: original, natural version, explanation, usage context, and 2 example sentences.
   Include every expression that would be useful for the learner to acquire.

3. **weaknesses** — Recurring patterns or skill gaps you observe across the conversation.
   Count repeated expression gaps — asking how to say things, or falling back on Chinese
   because the English is missing — as a `clarity.expression` weakness so they enter the
   learner's weakness profile.
   Use the same standard skill codes for corrections and weaknesses where applicable:
   grammar.verb_tense, grammar.article, grammar.preposition, grammar.subject_verb_agreement,
   vocab.word_choice, vocab.repetition, sentence.structure, sentence.variety,
   discourse.coherence, style.register, clarity.expression
   For each: code, category label, severity (low/medium/high), evidence quote, explanation,
   and a practice goal.

4. **strengthsZh** — What the learner does well.

5. **summaryZh** — A summary of the learner's overall performance in this conversation.

6. **recommendedNextActionsZh** — Recommended next steps.

Be encouraging but honest. Include both recurring patterns and isolated slips.
"""


def analyze_session(
    messages: List[dict],
    topic: Optional[str] = None,
    output_language: OutputLanguage = "en",
    llm_provider: Optional[LLMProviderConfig] = None,
    max_tokens: Optional[int] = 16384,
    trace_id: Optional[str] = None,
) -> SessionAnalysisAI:
    transcript_lines = []
    for msg in messages:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        if content.strip():
            label = "Learner" if role == "user" else "Coach"
            transcript_lines.append(f"{label}: {content}")

    transcript_text = "\n".join(transcript_lines)

    system = f"{SESSION_ANALYSIS_PROMPT}\n\n{language_instruction(output_language)}"
    if topic:
        system += f"\n\nConversation topic: {topic}"

    user_prompt = f'Conversation transcript:\n"""\n{transcript_text}\n"""'

    model = None
    if llm_provider:
        model = llm_provider.model
    elif settings.default_llm_model:
        model = settings.default_llm_model

    return parse_with_model(
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user_prompt},
        ],
        response_model=SessionAnalysisAI,
        max_tokens=max_tokens,
        model=model,
        provider=llm_provider,
        trace_id=trace_id,
    )
