from typing import Literal

from app.config import settings
from app.models.common import OutputLanguage
from app.models.chat_import import ChatImportAIResult, ImportedChatConversation
from app.services.ai_client import LLMProviderConfig, parse_with_model
from app.services.output_language import language_instruction
from app.services.memory_service import MEMORY_EXTRACTION_INSTRUCTION

AnalysisMode = Literal["fast", "deep"]

MAX_TRANSCRIPT_CHARS = 64000
MAX_MESSAGE_CHARS = 1600

SYSTEM_PROMPT = """
You are an expert English learning analyst for Chinese native speakers.

Analyze imported ChatGPT conversations as learning evidence. You must inspect BOTH sides:
1. User messages: direct English mistakes, awkward wording, weak vocabulary, unclear structure.
2. User help-seeking: places where the user asks "how do I say this", uses Chinese because English is missing, or avoids expressing something in English. Treat these as expression gaps.
3. Assistant messages: corrections, rewrites, vocabulary suggestions, grammar explanations, or repeated advice already given by the assistant. Treat these as confirmed weaknesses when relevant.

Follow the language requirement provided below for learner-facing summaries, explanations, micro-lessons, and recommendations. Do not summarize private life details; focus only on English learning patterns.

Use these codes when possible:
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

For each weakness:
- evidenceType must be one of: user_error, expression_gap, assistant_correction, assistant_advice.
- evidenceQuote should be relevant and include enough context to justify the weakness.
- suggestedBetterEnglish should be a better English phrasing when applicable, or a short skill target.
- Include recurring patterns and clear one-off mistakes. Do not dismiss a learner error as a typo unless it is clearly accidental and not useful for learning.

Generate learningNotes: extract reusable takeaways from the conversations. Each note is one of:
- "expression": a more natural way to phrase something the user wrote.
- "vocabulary": a word or phrase worth learning, with tone/register and usage context.
- "grammar": a grammar pattern illustrated by the user's messages.
For each note provide: a short topic title, the user's original phrasing, the natural
version, a one-sentence explanation, context (when/tone/register to use it), and 2 example
sentences showing it in use.

Output depth depends on the evidence, not on a fixed cap:
- Report ALL weaknesses and learner errors you find, including expression gaps, confirmed corrections, grammar, vocabulary, clarity, style, and discourse issues.
- Do not cap the number of weaknesses, blind spots, recommended actions, or learning notes.
- Give detailed explanations, rich examples, and comprehensive lists when the conversations support them. Think step by step and analyze thoroughly.
- learningNotes: extract every useful note the conversations support. Give rich explanations, context, and examples.
""".strip()


def _clean_text(text: str, limit: int | None = MAX_MESSAGE_CHARS) -> str:
    compact = " ".join(text.split())
    if limit is None:
        return compact
    if len(compact) <= limit:
        return compact
    return compact[: limit - 1].rstrip() + "…"


def build_chat_transcript(
    conversations: list[ImportedChatConversation],
    char_budget: int | None = MAX_TRANSCRIPT_CHARS,
    message_char_limit: int | None = MAX_MESSAGE_CHARS,
) -> str:
    lines: list[str] = []
    used = 0

    for index, convo in enumerate(conversations, start=1):
        title = _clean_text(convo.title or f"Conversation {index}", 160)
        header = f"\n[Conversation {index}: {title}]"
        if char_budget is not None and used + len(header) > char_budget:
            break
        lines.append(header)
        used += len(header)

        for msg in convo.messages:
            text = _clean_text(msg.text, message_char_limit)
            line = f"{msg.role.upper()}: {text}"
            if char_budget is not None and used + len(line) + 1 > char_budget:
                lines.append("[Transcript truncated for analysis budget]")
                return "\n".join(lines)
            lines.append(line)
            used += len(line) + 1

    return "\n".join(lines).strip()


def select_chat_import_model(analysis_mode: AnalysisMode, llm_provider: LLMProviderConfig | None = None) -> str:
    if analysis_mode == "fast":
        if llm_provider is not None:
            return llm_provider.fast_model or llm_provider.model
        return settings.default_llm_fast_model or settings.default_llm_model

    if llm_provider is not None:
        return llm_provider.model
    return settings.default_llm_model


def analyze_imported_chat(
    conversations: list[ImportedChatConversation],
    analysis_mode: AnalysisMode = "fast",
    output_language: OutputLanguage = "en",
    llm_provider: LLMProviderConfig | None = None,
    max_tokens: int | None = 16384,
    transcript_char_budget: int | None = MAX_TRANSCRIPT_CHARS,
    message_char_limit: int | None = MAX_MESSAGE_CHARS,
    trace_id: str | None = None,
    memory_context: str | None = None,
) -> ChatImportAIResult:
    transcript = build_chat_transcript(
        conversations,
        char_budget=transcript_char_budget,
        message_char_limit=message_char_limit,
    )
    if not transcript:
        raise ValueError("No analyzable chat text found.")

    selected_model = select_chat_import_model(analysis_mode, llm_provider=llm_provider)
    user_prompt = f'Imported ChatGPT conversations:\n"""\n{transcript}\n"""'

    system = (
        SYSTEM_PROMPT
        + f"\n\n{language_instruction(output_language)}\n\nAnalysis mode: {analysis_mode}."
        + f"\n\n{MEMORY_EXTRACTION_INSTRUCTION}"
    )
    request_messages = [{"role": "system", "content": system}]
    if memory_context:
        request_messages.append({
            "role": "system",
            "content": memory_context
            + "\nUse it for continuity, but derive reported errors from the imported evidence.",
        })
    request_messages.append({"role": "user", "content": user_prompt})
    return parse_with_model(
        messages=request_messages,
        response_model=ChatImportAIResult,
        max_tokens=max_tokens,
        model=selected_model,
        provider=llm_provider,
        trace_id=trace_id,
    )
