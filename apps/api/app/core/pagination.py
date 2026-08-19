"""Opaque, identity-bound keyset cursors for PostgreSQL list endpoints."""

from __future__ import annotations

import base64
import binascii
import hashlib
import hmac
import json
from typing import Optional

from app.config import settings


def _sign(raw: bytes) -> str:
    secret = settings.session_secret or "weakspot-local-cursor-development-only"
    digest = hmac.new(secret.encode("utf-8"), raw, hashlib.sha256).digest()
    return base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")


def encode_cursor(
    last_key: Optional[dict],
    *,
    user_id: str,
    entity: str,
) -> Optional[str]:
    if not last_key:
        return None
    created_at = last_key.get("createdAt")
    item_id = last_key.get("id")
    if not isinstance(created_at, str) or not isinstance(item_id, str):
        raise ValueError("Pagination key is incomplete.")
    payload = {
        "v": 2,
        "user": user_id,
        "entity": entity,
        "createdAt": created_at,
        "id": item_id,
    }
    raw = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    envelope = json.dumps(
        {"payload": payload, "signature": _sign(raw)},
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")
    return base64.urlsafe_b64encode(envelope).decode("ascii").rstrip("=")


def decode_cursor(
    cursor: Optional[str],
    *,
    expected_user_id: str,
    expected_entity: str,
) -> Optional[dict]:
    if not cursor:
        return None
    try:
        padded = cursor + ("=" * (-len(cursor) % 4))
        envelope = json.loads(base64.urlsafe_b64decode(padded.encode("ascii")))
        payload = envelope.get("payload")
        signature = envelope.get("signature")
        if not isinstance(payload, dict) or not isinstance(signature, str):
            raise ValueError
        raw = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
        if (
            not hmac.compare_digest(signature, _sign(raw))
            or payload.get("v") != 2
            or payload.get("user") != expected_user_id
            or payload.get("entity") != expected_entity
            or not isinstance(payload.get("createdAt"), str)
            or not isinstance(payload.get("id"), str)
        ):
            raise ValueError
    except (AttributeError, UnicodeError, ValueError, TypeError, binascii.Error) as exc:
        raise ValueError("Invalid or expired pagination cursor.") from exc
    return {"createdAt": payload["createdAt"], "id": payload["id"]}
