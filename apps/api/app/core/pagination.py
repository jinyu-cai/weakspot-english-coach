"""Opaque, identity-bound cursors for DynamoDB-backed list endpoints."""

from __future__ import annotations

import base64
import binascii
import json
from typing import Optional


def encode_dynamo_cursor(last_key: Optional[dict]) -> Optional[str]:
    """Encode a DynamoDB ``LastEvaluatedKey`` without exposing it as JSON."""
    if not last_key:
        return None
    payload = {
        "v": 1,
        "pk": last_key.get("PK"),
        "sk": last_key.get("SK"),
    }
    if not isinstance(payload["pk"], str) or not isinstance(payload["sk"], str):
        raise ValueError("Pagination key is incomplete.")
    raw = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def decode_dynamo_cursor(
    cursor: Optional[str],
    *,
    expected_pk: str,
    expected_sk_prefix: str,
) -> Optional[dict]:
    """Decode a cursor and keep it inside the authenticated learner's list."""
    if not cursor:
        return None
    try:
        padded = cursor + ("=" * (-len(cursor) % 4))
        payload = json.loads(base64.urlsafe_b64decode(padded.encode("ascii")))
        if payload.get("v") != 1:
            raise ValueError
        pk = payload.get("pk")
        sk = payload.get("sk")
        if pk != expected_pk or not isinstance(sk, str) or not sk.startswith(expected_sk_prefix):
            raise ValueError
    except (AttributeError, UnicodeError, ValueError, TypeError, binascii.Error) as exc:
        raise ValueError("Invalid pagination cursor.") from exc
    return {"PK": pk, "SK": sk}
