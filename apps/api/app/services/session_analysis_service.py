from typing import List, Optional

from app.config import settings
from app.models.chat import SessionAnalysisAI
from app.services.ai_client import LLMProviderConfig, parse_with_model

SESSION_ANALYSIS_PROMPT = """\
You are an expert English tutor for Chinese native speakers.

You will receive a complete English conversation between a learner and an AI coach.
Analyze ONLY the learner's messages (role: user) and produce a structured report.

Your analysis must cover:

1. **corrections** — Every grammar, vocabulary, or usage error the learner made.
   For each: code, category, severity (low/medium/high), the original text,
   the corrected version, a Chinese explanation, one micro lesson in Chinese,
   and one practice goal.
   Be thorough — catch every error, even small ones.

2. **naturalExpressions** — Places where the learner's English was grammatically correct
   but sounds unnatural or non-idiomatic. Suggest a more natural alternative.
   For each: original, natural version, Chinese explanation, usage context, and 2 example sentences.
   Focus on expressions that would be most useful for the learner to acquire.

3. **weaknesses** — Recurring patterns or skill gaps you observe across the conversation.
   Use the same standard skill codes for corrections and weaknesses where applicable:
   grammar.verb_tense, grammar.article, grammar.preposition, grammar.subject_verb_agreement,
   vocab.word_choice, vocab.repetition, sentence.structure, sentence.variety,
   discourse.coherence, style.register, clarity.expression
   For each: code, category label, severity (low/medium/high), evidence quote, Chinese explanation,
   and a practice goal.

4. **strengthsZh** — What the learner does well (in Chinese, 2-3 items).

5. **summaryZh** — A brief Chinese summary of the learner's overall performance in this conversation.

6. **recommendedNextActionsZh** — 2-3 recommended next steps (in Chinese).

Be encouraging but honest. Focus on patterns, not isolated slips.
"""


def analyze_session(
    messages: List[dict],
    topic: Optional[str] = None,
    llm_provider: Optional[LLMProviderConfig] = None,
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

    system = SESSION_ANALYSIS_PROMPT
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
        max_tokens=16384,
        model=model,
        provider=llm_provider,
        trace_id=trace_id,
    )
