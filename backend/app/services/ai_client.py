"""OpenAI-compatible AI client.

DeepSeek and many other model providers expose OpenAI-compatible APIs but not all
of them support OpenAI's strict `client.beta.chat.completions.parse` helper. This
client uses chat completions JSON mode plus Pydantic validation so the same path
works across OpenAI-compatible providers.
"""

from dataclasses import dataclass
import json
from typing import Optional, Type, TypeVar

from openai import OpenAI
from pydantic import BaseModel, ValidationError

from app.config import settings

T = TypeVar("T", bound=BaseModel)

_client: Optional[OpenAI] = None


@dataclass(frozen=True)
class LLMProviderConfig:
    api_key: str
    base_url: str
    model: str


def get_client(provider: Optional[LLMProviderConfig] = None) -> OpenAI:
    """Lazily construct the client so the module can be imported without secrets."""
    if provider is not None:
        return OpenAI(api_key=provider.api_key, base_url=provider.base_url)

    global _client
    if _client is None:
        _client = OpenAI(
            api_key=settings.default_llm_api_key,
            base_url=settings.default_llm_base_url,
        )
    return _client


def parse_with_model(
    messages: list,
    response_model: Type[T],
    max_tokens: int = 4000,
    model: Optional[str] = None,
    provider: Optional[LLMProviderConfig] = None,
) -> T:
    # Local testing: return canned results without calling an external model.
    if settings.use_fake_ai:
        from app.services.fake_ai import fake_for

        return fake_for(response_model)

    selected_model = model or (provider.model if provider else settings.default_llm_model)
    if not selected_model:
        raise ValueError("No LLM model configured.")

    schema = json.dumps(response_model.model_json_schema(), ensure_ascii=False)

    messages = list(messages)
    messages[0] = {
        "role": "system",
        "content": messages[0]["content"]
        + "\n\nReturn ONLY a valid json object that conforms to this JSON schema. "
        "Do not use markdown code fences and do not add any commentary.\n"
        "JSON schema:\n" + schema,
    }

    last_error: Optional[Exception] = None
    for _ in range(2):  # one retry
        resp = get_client(provider).chat.completions.create(
            model=selected_model,
            messages=messages,
            response_format={"type": "json_object"},
            temperature=0.2,
            max_tokens=max_tokens,
        )
        content = resp.choices[0].message.content or ""
        try:
            return response_model.model_validate_json(content)
        except ValidationError as e:
            last_error = e
            messages.append(
                {
                    "role": "user",
                    "content": f"Your previous json was invalid: {e}. "
                    "Return corrected valid json only.",
                }
            )

    raise ValueError(f"LLM provider did not return valid structured output: {last_error}")
