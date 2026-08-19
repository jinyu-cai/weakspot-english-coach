"""Offline contracts for the one-time DynamoDB normalization stage."""

from __future__ import annotations

from datetime import datetime, timezone

from scripts.migrate_dynamodb_to_postgres import (
    _durable_rows,
    _expected_target_fingerprints,
    _target_payload,
    _verification_errors,
)


def main() -> int:
    now_epoch = int(datetime.now(timezone.utc).timestamp())
    rows = [
        {
            "PK": "USER#u1",
            "SK": "PROFILE",
            "entityType": "PROFILE",
            "userId": "u1",
            "estimatedLevel": "B1",
            "createdAt": "2026-08-17T00:00:00Z",
        },
        {
            "PK": "USER#u1",
            "SK": "MEMORY#expired",
            "entityType": "MEMORY",
            "id": "expired",
            "userId": "u1",
            "ttl": now_epoch - 1,
        },
        {
            "PK": "USER#u1",
            "SK": "CHATBATCH#s1#b1",
            "entityType": "CHAT_TRANSCRIPT_BATCH",
            "batchId": "b1",
            "sessionId": "s1",
            "userId": "u1",
            "status": "committed",
            "messageCount": 1,
        },
        {
            "PK": "USER#u1",
            "SK": "CHATSTAGE#s1#b1#0000",
            "entityType": "CHAT_TRANSCRIPT_STAGE",
            "batchId": "b1",
            "sessionId": "s1",
            "userId": "u1",
            "messages": [
                {
                    "id": "m1",
                    "role": "user",
                    "content": "Hello",
                    "createdAt": "2026-08-17T00:00:01Z",
                }
            ],
            "ttl": now_epoch + 3_600,
        },
        {
            "PK": "USER#u1",
            "SK": "SUBHASH#h1",
            "entityType": "SUBHASH",
            "userId": "u1",
            "textHash": "h1",
            "status": "processing",
            "processingClaimId": "stale",
            "processingClaimedAtEpoch": 1,
        },
        {
            "PK": "USER#u1",
            "SK": "EVIDENCE_TIMELINE#ignored",
            "entityType": "EVIDENCE_EVENT_TIMELINE",
            "userId": "u1",
        },
    ]

    durable = _durable_rows(rows)
    entity_types = [item["entityType"] for item in durable]
    assert entity_types.count("CHAT_MESSAGE") == 1
    assert "MEMORY" not in entity_types
    assert "EVIDENCE_EVENT_TIMELINE" not in entity_types

    transformed = _target_payload(next(item for item in durable if item["entityType"] == "SUBHASH"))
    assert transformed["status"] == "failed"
    assert "processingClaimId" not in transformed

    counts, checksums, unmapped = _expected_target_fingerprints(durable)
    assert counts == {
        "chatMessages": 1,
        "chatTranscriptBatches": 1,
        "diagnosisRequests": 1,
        "profiles": 1,
    }
    assert not unmapped
    assert not _verification_errors(counts, checksums, counts, checksums, unmapped)

    mismatched_counts = {**counts, "profiles": 0}
    errors = _verification_errors(
        counts, checksums, mismatched_counts, checksums, unmapped
    )
    assert any("profiles count" in error for error in errors)
    print("MIGRATION NORMALIZATION CONTRACTS PASSED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
