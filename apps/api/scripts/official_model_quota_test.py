"""Offline contracts for daily OpenAI quota windows and Luna routing."""

from contextlib import ExitStack
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import call, patch

from pydantic import BaseModel

from app.config import Settings
from app.services import ai_client
from app.services.ai_client import LLMProviderConfig
from app.services import official_model_quota as quota


class RoutedResult(BaseModel):
    value: str


def window_contract() -> None:
    config = Settings(
        openai_quota_timezone="America/Los_Angeles",
        openai_quota_reset_hour=5,
    )
    before_reset = quota.quota_window(
        datetime(2026, 8, 25, 11, 59, tzinfo=timezone.utc),
        config,
    )
    assert before_reset.started_at == datetime(2026, 8, 24, 12, 0, tzinfo=timezone.utc)
    assert before_reset.ends_at == datetime(2026, 8, 25, 12, 0, tzinfo=timezone.utc)

    at_reset = quota.quota_window(
        datetime(2026, 8, 25, 12, 0, tzinfo=timezone.utc),
        config,
    )
    assert at_reset.started_at == datetime(2026, 8, 25, 12, 0, tzinfo=timezone.utc)
    assert at_reset.ends_at == datetime(2026, 8, 26, 12, 0, tzinfo=timezone.utc)
    assert quota.quota_limit("luna", config) == 2_500_000
    assert quota.quota_limit("sol", config) == 250_000
    estimated = quota.estimate_request_tokens(
        [{"role": "user", "content": "abcd"}],
        max_output_tokens=100,
        attempts=2,
    )
    assert estimated >= 2 * (len("abcd") + 100)
    assert quota.quota_route(
        "sol",
        total_tokens=300_000,
        reserved_tokens=0,
        token_limit=250_000,
    ) == "official"
    assert quota.quota_route(
        "luna",
        total_tokens=2_500_000,
        reserved_tokens=0,
        token_limit=2_500_000,
    ) == "fallback"


def luna_routing_contract() -> None:
    openrouter = LLMProviderConfig(
        api_key="openrouter-key",
        base_url="https://openrouter.ai/api/v1",
        model="openai/gpt-5.6-luna",
        fast_model="openai/gpt-5.6-luna",
        server_model_id="openrouter-fast",
    )
    openrouter_deep = LLMProviderConfig(
        api_key="openrouter-key",
        base_url="https://openrouter.ai/api/v1",
        model="openai/gpt-5.6-luna-pro",
        fast_model="openai/gpt-5.6-luna-pro",
        server_model_id="openrouter-deep",
    )
    requests: list[dict] = []

    def create_completion(**kwargs):
        requests.append(kwargs)
        return SimpleNamespace(
            choices=[
                SimpleNamespace(
                    message=SimpleNamespace(content='{"value":"ok"}'),
                    finish_reason="stop",
                )
            ],
            usage=SimpleNamespace(
                prompt_tokens=20,
                completion_tokens=5,
                total_tokens=25,
            ),
        )

    client = SimpleNamespace(
        chat=SimpleNamespace(completions=SimpleNamespace(create=create_completion))
    )
    reservation = quota.QuotaReservation(
        quota_key="luna",
        window_started_at=datetime(2026, 8, 25, 12, 0, tzinfo=timezone.utc),
        reserved_tokens=500,
    )

    def enter_settings(stack: ExitStack) -> None:
        stack.enter_context(patch.object(ai_client.settings, "use_fake_ai", False))
        stack.enter_context(
            patch.object(ai_client.settings, "openai_translation_api_key", "official-key")
        )
        stack.enter_context(
            patch.object(ai_client.settings, "openai_translation_model", "gpt-5.6-luna")
        )
        stack.enter_context(
            patch.object(ai_client.settings, "openrouter_fast_model", "openai/gpt-5.6-luna")
        )
        stack.enter_context(
            patch.object(
                ai_client.settings,
                "openrouter_model",
                "openai/gpt-5.6-luna-pro",
            )
        )
        stack.enter_context(patch.object(ai_client, "get_client", return_value=client))

    with ExitStack() as stack:
        enter_settings(stack)
        stack.enter_context(patch.object(quota, "reserve_quota", return_value=reservation))
        settle = stack.enter_context(patch.object(quota, "settle_quota"))
        result = ai_client.parse_with_model(
            messages=[
                {"role": "system", "content": "Return JSON."},
                {"role": "user", "content": "Route this request."},
            ],
            response_model=RoutedResult,
            max_tokens=256,
            model=openrouter.model,
            provider=openrouter,
            reasoning_effort="none",
            max_attempts=1,
        )
        deep_result = ai_client.parse_with_model(
            messages=[
                {"role": "system", "content": "Return JSON."},
                {"role": "user", "content": "Route this deep request."},
            ],
            response_model=RoutedResult,
            max_tokens=256,
            model=openrouter_deep.model,
            provider=openrouter_deep,
            reasoning_effort="max",
            max_attempts=1,
        )

    assert result.value == "ok"
    assert deep_result.value == "ok"
    assert [request["model"] for request in requests] == [
        "gpt-5.6-luna",
        "gpt-5.6-luna",
    ]
    assert requests[0]["reasoning_effort"] == "medium"
    assert requests[1]["reasoning_effort"] == "xhigh"
    assert settle.call_args_list == [
        call(
            reservation,
            input_tokens=20,
            output_tokens=5,
            total_tokens=25,
        ),
        call(
            reservation,
            input_tokens=20,
            output_tokens=5,
            total_tokens=25,
        ),
    ]

    requests.clear()
    with ExitStack() as stack:
        enter_settings(stack)
        stack.enter_context(
            patch.object(
                quota,
                "reserve_quota",
                side_effect=quota.OfficialModelQuotaExceeded("daily limit reached"),
            )
        )
        result = ai_client.parse_with_model(
            messages=[
                {"role": "system", "content": "Return JSON."},
                {"role": "user", "content": "Route this request."},
            ],
            response_model=RoutedResult,
            max_tokens=256,
            model=openrouter.model,
            provider=openrouter,
            reasoning_effort="none",
            max_attempts=1,
        )
        deep_result = ai_client.parse_with_model(
            messages=[
                {"role": "system", "content": "Return JSON."},
                {"role": "user", "content": "Route this deep request."},
            ],
            response_model=RoutedResult,
            max_tokens=256,
            model=openrouter_deep.model,
            provider=openrouter_deep,
            reasoning_effort="max",
            max_attempts=1,
        )

    assert result.value == "ok"
    assert deep_result.value == "ok"
    assert [request["model"] for request in requests] == [
        "openai/gpt-5.6-luna",
        "openai/gpt-5.6-luna-pro",
    ]
    assert requests[0]["extra_body"]["reasoning"] == {"effort": "medium"}
    assert requests[1]["extra_body"]["reasoning"] == {"effort": "xhigh"}


def main() -> None:
    window_contract()
    luna_routing_contract()
    print("05:00 Los Angeles quota windows and official-to-OpenRouter Luna routing OK.")


if __name__ == "__main__":
    main()
