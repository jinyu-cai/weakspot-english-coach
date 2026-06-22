from typing import Literal

from app.config import settings
from app.models.chat_import import ChatImportAIResult, ImportedChatConversation
from app.services.ai_client import LLMProviderConfig, parse_with_model

AnalysisMode = Literal["fast", "deep"]

MAX_TRANSCRIPT_CHARS = 18000

SYSTEM_PROMPT = """
You are an expert English learning analyst for Chinese native speakers.

Analyze imported ChatGPT conversations as learning evidence. You must inspect BOTH sides:
1. User messages: direct English mistakes, awkward wording, weak vocabulary, unclear structure.
2. User help-seeking: places where the user asks "how do I say this", uses Chinese because English is missing, or avoids expressing something in English. Treat these as expression gaps.
3. Assistant messages: corrections, rewrites, vocabulary suggestions, grammar explanations, or repeated advice already given by the assistant. Treat these as confirmed weaknesses when relevant.

Return all explanations in clear, simple English. Do not summarize private life details; focus only on English learning patterns.

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
- evidenceQuote should be short and relevant, at most one sentence or phrase.
- suggestedBetterEnglish should be a better English phrasing when applicable, or a short skill target.
- Focus on recurring or high-signal patterns, not random one-off typos.

Output depth depends on analysis mode:
- fast mode: 3-5 weaknesses. Keep items concise (at most 4 items per list).
- deep mode: report ALL weaknesses you find (up to 12). Give detailed explanations,
  rich examples, and comprehensive lists. Think step by step and analyze thoroughly.
""".strip()


def _clean_text(text: str, limit: int = 1600) -> str:
    compact = " ".join(text.split())
    if len(compact) <= limit:
        return compact
    return compact[: limit - 1].rstrip() + "…"


def build_chat_transcript(conversations: list[ImportedChatConversation], char_budget: int = MAX_TRANSCRIPT_CHARS) -> str:
    lines: list[str] = []
    used = 0

    for index, convo in enumerate(conversations, start=1):
        title = _clean_text(convo.title or f"Conversation {index}", 160)
        header = f"\n[Conversation {index}: {title}]"
        if used + len(header) > char_budget:
            break
        lines.append(header)
        used += len(header)

        for msg in convo.messages:
            text = _clean_text(msg.text)
            line = f"{msg.role.upper()}: {text}"
            if used + len(line) + 1 > char_budget:
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
    llm_provider: LLMProviderConfig | None = None,
    trace_id: str | None = None,
) -> ChatImportAIResult:
    transcript = build_chat_transcript(conversations)
    if not transcript:
        raise ValueError("No analyzable chat text found.")

    selected_model = select_chat_import_model(analysis_mode, llm_provider=llm_provider)
    user_prompt = f'Imported ChatGPT conversations:\n"""\n{transcript}\n"""'

    return parse_with_model(
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT + f"\n\nAnalysis mode: {analysis_mode}."},
            {"role": "user", "content": user_prompt},
        ],
        response_model=ChatImportAIResult,
        max_tokens=3600 if analysis_mode == "fast" else 8192,
        model=selected_model,
        provider=llm_provider,
        trace_id=trace_id,
    )
