from typing import List, Optional

from app.config import settings
from app.models.chat import ChatPredictionAI, ChatReplyAI
from app.services.ai_client import LLMProviderConfig, parse_with_model

CHAT_SYSTEM_PROMPT = """\
You are a friendly, patient English conversation partner for Chinese-speaking learners.

Your job:
1. Have a natural, engaging conversation in English. Keep your reply concise (2-4 sentences). Match the learner's apparent level — don't overwhelm beginners with complex language, but gently push intermediate learners.
2. Do NOT correct errors during the conversation. Just model correct usage naturally in your own responses. Errors will be analyzed after the session ends.
3. Ask follow-up questions to keep the conversation going. Be warm and encouraging — like a supportive friend, not a teacher.

Tone: warm, encouraging, conversational. The goal is a comfortable, flowing conversation.

Important: reply in English only. Return empty corrections and null betterExpression — analysis happens separately.
"""

PREDICT_SYSTEM_PROMPT = """\
You are an English sentence completion assistant for a Chinese-speaking English learner.

The learner is in the middle of typing a message during a conversation and got stuck. Given the conversation context and their partial text, predict 2-3 natural ways they might want to finish their sentence.

Rules:
- Return ONLY the completion part (the text that comes AFTER the partial text), not the full sentence
- Make completions natural and idiomatic
- Offer varied directions — different possible intentions or endings
- Keep each completion concise (5-15 words typically)
- Match the conversational context and tone
"""


def build_chat_messages(
    history: List[dict],
    user_text: str,
    topic: Optional[str] = None,
) -> list:
    messages = [{"role": "system", "content": CHAT_SYSTEM_PROMPT}]

    if topic:
        messages.append({
            "role": "system",
            "content": f"The conversation topic/scenario: {topic}",
        })

    for msg in history[-20:]:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": content})

    messages.append({"role": "user", "content": user_text})
    return messages


def chat_reply(
    history: List[dict],
    user_text: str,
    topic: Optional[str] = None,
    llm_provider: Optional[LLMProviderConfig] = None,
    model: Optional[str] = None,
    trace_id: Optional[str] = None,
) -> ChatReplyAI:
    messages = build_chat_messages(history, user_text, topic)
    return parse_with_model(
        messages=messages,
        response_model=ChatReplyAI,
        max_tokens=2000,
        model=model,
        provider=llm_provider,
        trace_id=trace_id,
    )


def build_predict_messages(
    history: List[dict],
    partial_text: str,
    topic: Optional[str] = None,
) -> list:
    messages = [{"role": "system", "content": PREDICT_SYSTEM_PROMPT}]

    if topic:
        messages.append({
            "role": "system",
            "content": f"Conversation topic/scenario: {topic}",
        })

    for msg in history[-10:]:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": content})

    messages.append({
        "role": "user",
        "content": f"The learner has typed so far: \"{partial_text}\"\n\nPredict 2-3 natural completions.",
    })
    return messages


def predict_completion(
    history: List[dict],
    partial_text: str,
    topic: Optional[str] = None,
    llm_provider: Optional[LLMProviderConfig] = None,
    trace_id: Optional[str] = None,
) -> ChatPredictionAI:
    messages = build_predict_messages(history, partial_text, topic)

    fast_model = None
    if llm_provider and llm_provider.fast_model:
        fast_model = llm_provider.fast_model
    elif not llm_provider:
        fast_model = settings.default_llm_fast_model

    return parse_with_model(
        messages=messages,
        response_model=ChatPredictionAI,
        max_tokens=500,
        model=fast_model,
        provider=llm_provider,
        trace_id=trace_id,
    )
