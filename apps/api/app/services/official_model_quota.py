"""Durable daily token budgets for official OpenAI model routing."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, time, timedelta, timezone
import json
from typing import Iterable, Literal
from zoneinfo import ZoneInfo

from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.config import Settings, settings
from app.db import schema
from app.db.database import session_scope


QuotaKey = Literal["luna", "sol"]


class OfficialModelQuotaExceeded(RuntimeError):
    """The official daily budget cannot accept another request."""


@dataclass(frozen=True)
class QuotaWindow:
    started_at: datetime
    ends_at: datetime


@dataclass(frozen=True)
class QuotaReservation:
    quota_key: QuotaKey
    window_started_at: datetime
    reserved_tokens: int


def quota_limit(quota_key: QuotaKey, config: Settings = settings) -> int:
    if quota_key == "luna":
        return max(0, config.openai_luna_daily_token_limit)
    return max(0, config.openai_sol_daily_token_limit)


def quota_route(
    quota_key: QuotaKey,
    *,
    total_tokens: int,
    reserved_tokens: int,
    token_limit: int,
) -> Literal["official", "fallback"]:
    if quota_key == "sol":
        return "official"
    return (
        "official"
        if total_tokens + reserved_tokens < token_limit
        else "fallback"
    )


def quota_window(
    now: datetime | None = None,
    config: Settings = settings,
) -> QuotaWindow:
    """Return the active 05:00-to-05:00 Los Angeles quota window."""

    zone = ZoneInfo(config.openai_quota_timezone)
    current = (now or datetime.now(timezone.utc)).astimezone(zone)
    reset_hour = min(23, max(0, config.openai_quota_reset_hour))
    window_day = current.date()
    if current.timetz().replace(tzinfo=None) < time(reset_hour):
        window_day -= timedelta(days=1)
    next_day = window_day + timedelta(days=1)
    started_local = datetime.combine(window_day, time(reset_hour), tzinfo=zone)
    ends_local = datetime.combine(next_day, time(reset_hour), tzinfo=zone)
    return QuotaWindow(
        started_at=started_local.astimezone(timezone.utc),
        ends_at=ends_local.astimezone(timezone.utc),
    )


def estimate_request_tokens(
    messages: Iterable[dict],
    max_output_tokens: int | None,
    *,
    attempts: int = 1,
) -> int:
    """Conservatively reserve input bytes plus the output ceiling."""

    serialized = json.dumps(list(messages), ensure_ascii=False, default=str)
    input_budget = max(1, len(serialized.encode("utf-8")))
    output_budget = max(1, max_output_tokens or 16_384)
    return max(1, attempts) * (input_budget + output_budget)


def _ensure_counter(quota_key: QuotaKey, window: QuotaWindow, limit: int) -> None:
    table = schema.official_model_quota_usage
    with session_scope() as session:
        session.execute(
            pg_insert(table)
            .values(
                quota_key=quota_key,
                window_started_at=window.started_at,
                window_ends_at=window.ends_at,
                token_limit=limit,
            )
            .on_conflict_do_update(
                index_elements=[table.c.quota_key, table.c.window_started_at],
                set_={
                    "window_ends_at": window.ends_at,
                    "token_limit": limit,
                    "updated_at": func.now(),
                },
            )
        )


def reserve_quota(
    quota_key: QuotaKey,
    requested_tokens: int,
    *,
    now: datetime | None = None,
    config: Settings = settings,
) -> QuotaReservation:
    """Atomically reserve room so concurrent official calls cannot overspend."""

    limit = quota_limit(quota_key, config)
    if limit <= 0:
        raise OfficialModelQuotaExceeded(f"Official {quota_key} daily quota is disabled.")
    requested = max(1, requested_tokens)
    window = quota_window(now, config)
    _ensure_counter(quota_key, window, limit)
    table = schema.official_model_quota_usage
    with session_scope() as session:
        row = session.execute(
            update(table)
            .where(
                table.c.quota_key == quota_key,
                table.c.window_started_at == window.started_at,
                table.c.total_tokens + table.c.reserved_tokens + requested <= table.c.token_limit,
            )
            .values(
                reserved_tokens=table.c.reserved_tokens + requested,
                updated_at=func.now(),
            )
            .returning(table.c.quota_key)
        ).first()
    if row is None:
        mark_fallback(quota_key, now=now, config=config)
        raise OfficialModelQuotaExceeded(
            f"Official {quota_key} daily quota has reached its routing threshold."
        )
    return QuotaReservation(quota_key, window.started_at, requested)


def settle_quota(
    reservation: QuotaReservation,
    *,
    input_tokens: int,
    output_tokens: int,
    total_tokens: int,
) -> None:
    """Replace a conservative reservation with the provider's actual usage."""

    table = schema.official_model_quota_usage
    with session_scope() as session:
        session.execute(
            update(table)
            .where(
                table.c.quota_key == reservation.quota_key,
                table.c.window_started_at == reservation.window_started_at,
            )
            .values(
                input_tokens=table.c.input_tokens + max(0, input_tokens),
                output_tokens=table.c.output_tokens + max(0, output_tokens),
                total_tokens=table.c.total_tokens + max(0, total_tokens),
                reserved_tokens=func.greatest(
                    0,
                    table.c.reserved_tokens - reservation.reserved_tokens,
                ),
                official_request_count=table.c.official_request_count + 1,
                updated_at=func.now(),
            )
        )


def record_official_usage(
    quota_key: QuotaKey,
    *,
    input_tokens: int,
    output_tokens: int,
    total_tokens: int,
    now: datetime | None = None,
    config: Settings = settings,
) -> None:
    """Record usage without enforcing a routing threshold, as Sol requires."""

    window = quota_window(now, config)
    _ensure_counter(quota_key, window, quota_limit(quota_key, config))
    table = schema.official_model_quota_usage
    with session_scope() as session:
        session.execute(
            update(table)
            .where(
                table.c.quota_key == quota_key,
                table.c.window_started_at == window.started_at,
            )
            .values(
                input_tokens=table.c.input_tokens + max(0, input_tokens),
                output_tokens=table.c.output_tokens + max(0, output_tokens),
                total_tokens=table.c.total_tokens + max(0, total_tokens),
                official_request_count=table.c.official_request_count + 1,
                updated_at=func.now(),
            )
        )


def release_quota(
    reservation: QuotaReservation,
    *,
    upstream_failure: bool = False,
    count_fallback: bool = True,
) -> None:
    """Release an unused reservation and record why routing fell through."""

    table = schema.official_model_quota_usage
    values = {
        "reserved_tokens": func.greatest(
            0,
            table.c.reserved_tokens - reservation.reserved_tokens,
        ),
        "updated_at": func.now(),
    }
    if count_fallback:
        values["fallback_count"] = table.c.fallback_count + 1
    if upstream_failure:
        values["upstream_failure_count"] = table.c.upstream_failure_count + 1
    with session_scope() as session:
        session.execute(
            update(table)
            .where(
                table.c.quota_key == reservation.quota_key,
                table.c.window_started_at == reservation.window_started_at,
            )
            .values(**values)
        )


def mark_fallback(
    quota_key: QuotaKey,
    *,
    upstream_failure: bool = False,
    now: datetime | None = None,
    config: Settings = settings,
) -> None:
    window = quota_window(now, config)
    _ensure_counter(quota_key, window, quota_limit(quota_key, config))
    table = schema.official_model_quota_usage
    values = {
        "fallback_count": table.c.fallback_count + 1,
        "updated_at": func.now(),
    }
    if upstream_failure:
        values["upstream_failure_count"] = table.c.upstream_failure_count + 1
    with session_scope() as session:
        session.execute(
            update(table)
            .where(
                table.c.quota_key == quota_key,
                table.c.window_started_at == window.started_at,
            )
            .values(**values)
        )


def quota_status(
    quota_key: QuotaKey,
    *,
    now: datetime | None = None,
    config: Settings = settings,
) -> dict:
    window = quota_window(now, config)
    limit = quota_limit(quota_key, config)
    table = schema.official_model_quota_usage
    with session_scope() as session:
        row = session.execute(
            select(table).where(
                table.c.quota_key == quota_key,
                table.c.window_started_at == window.started_at,
            )
        ).mappings().first()
    values = dict(row) if row else {}
    total = int(values.get("total_tokens") or 0)
    reserved = int(values.get("reserved_tokens") or 0)
    return {
        "quotaKey": quota_key,
        "model": (
            config.openai_translation_model
            if quota_key == "luna"
            else config.openai_build_week_model
        ),
        "tokenLimit": limit,
        "inputTokens": int(values.get("input_tokens") or 0),
        "outputTokens": int(values.get("output_tokens") or 0),
        "totalTokens": total,
        "reservedTokens": reserved,
        "remainingTokens": max(0, limit - total - reserved),
        "officialRequestCount": int(values.get("official_request_count") or 0),
        "fallbackCount": int(values.get("fallback_count") or 0),
        "upstreamFailureCount": int(values.get("upstream_failure_count") or 0),
        "limitExceeded": total + reserved >= limit,
        "route": quota_route(
            quota_key,
            total_tokens=total,
            reserved_tokens=reserved,
            token_limit=limit,
        ),
        "windowStartedAt": window.started_at.isoformat(),
        "windowEndsAt": window.ends_at.isoformat(),
        "timezone": config.openai_quota_timezone,
        "resetHour": config.openai_quota_reset_hour,
    }


def all_quota_statuses(
    *,
    now: datetime | None = None,
    config: Settings = settings,
) -> list[dict]:
    return [
        quota_status("luna", now=now, config=config),
        quota_status("sol", now=now, config=config),
    ]
