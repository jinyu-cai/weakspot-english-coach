"""One-time, idempotent DynamoDB to PostgreSQL migration.

Install the isolated source dependency group first:

    uv sync --group migration

The API must be in maintenance mode before ``--apply`` so no claims or writes
are active. No learner content is printed.
"""

from __future__ import annotations

import argparse
from collections import Counter
from datetime import datetime, timezone
from decimal import Decimal
import hashlib
import json
import os
from uuid import uuid4


SKIPPED_TYPES = {
    "ACTIVITY_RUN_TIMELINE",
    "EVIDENCE_EVENT_TIMELINE",
    "RATELIMIT",
    "CHAT_TRANSCRIPT_STAGE",
}

PRIORITY = {
    "AUTH": 0,
    "PROFILE": 1,
    "SKILL": 2,
    "LEARNING_STATE": 3,
    "SUBMISSION": 4,
    "CHAT_SESSION": 4,
    "INPUT_LEARNING_SOURCE": 4,
    "EBOOK": 4,
    "ACTIVITY_RUN": 5,
    "EVIDENCE_EVENT": 5,
    "ERROR": 5,
    "NOTE": 5,
    "MEMORY": 5,
    "MEMORY_TRACE": 5,
    "PLAN": 5,
    "EXERCISE": 5,
    "ATTEMPT": 5,
    "SUBHASH": 5,
    "PRACTICE_REQUEST": 5,
    "CHAT_TRANSCRIPT_BATCH": 5,
    "INPUT_LEARNING_ITEM": 6,
    "EBOOK_PAGE": 6,
    "EBOOK_ANALYSIS_PAGE": 6,
    "EBOOK_STUDY_PACK": 6,
    "EBOOK_ANNOTATION": 6,
    "EBOOK_LEARNING_TARGET": 6,
    "EBOOK_PRACTICE_SESSION": 6,
    "CHAT_MESSAGE": 6,
    "ACCESS_ROLE": 6,
}

TARGET_LABELS = {
    "AUTH": "users",
    "PROFILE": "profiles",
    "SKILL": "skills",
    "LEARNING_STATE": "learningStates",
    "ACTIVITY_RUN": "activityRuns",
    "EVIDENCE_EVENT": "evidenceEvents",
    "SUBMISSION": "submissions",
    "ERROR": "errors",
    "NOTE": "notes",
    "SUBHASH": "diagnosisRequests",
    "PLAN": "plans",
    "EXERCISE": "exercises",
    "PRACTICE_REQUEST": "practiceRequests",
    "ATTEMPT": "practiceAttempts",
    "MEMORY": "memories",
    "MEMORY_TRACE": "memoryTraces",
    "INPUT_LEARNING_SOURCE": "inputSources",
    "INPUT_LEARNING_ITEM": "inputItems",
    "EBOOK": "ebooks",
    "EBOOK_PAGE": "ebookPages",
    "EBOOK_ANALYSIS_PAGE": "ebookAnalysisPages",
    "EBOOK_STUDY_PACK": "ebookStudyPacks",
    "EBOOK_ANNOTATION": "ebookAnnotations",
    "EBOOK_LEARNING_TARGET": "ebookTargets",
    "EBOOK_PRACTICE_SESSION": "ebookPracticeSessions",
    "CHAT_SESSION": "chatSessions",
    "CHAT_MESSAGE": "chatMessages",
    "CHAT_TRANSCRIPT_BATCH": "chatTranscriptBatches",
    "ACCESS_ROLE": "accessRoles",
}


def _clean(value):
    if isinstance(value, Decimal):
        return int(value) if value % 1 == 0 else float(value)
    if isinstance(value, list):
        return [_clean(item) for item in value]
    if isinstance(value, dict):
        return {key: _clean(item) for key, item in value.items()}
    return value


def _source_table():
    try:
        import boto3
    except ImportError as exc:
        raise SystemExit("Install migration dependencies with `uv sync --group migration`.") from exc
    region = os.getenv("DYNAMODB_SOURCE_REGION", os.getenv("AWS_REGION", "us-east-1"))
    name = os.getenv("DYNAMODB_SOURCE_TABLE", os.getenv("DYNAMODB_TABLE", "WeakSpotEnglishCoach"))
    endpoint = os.getenv("DYNAMODB_SOURCE_ENDPOINT_URL", "") or None
    resource = boto3.resource(
        "dynamodb",
        region_name=region,
        aws_access_key_id=os.getenv("DYNAMODB_SOURCE_ACCESS_KEY_ID") or os.getenv("AWS_ACCESS_KEY_ID") or None,
        aws_secret_access_key=os.getenv("DYNAMODB_SOURCE_SECRET_ACCESS_KEY") or os.getenv("AWS_SECRET_ACCESS_KEY") or None,
        endpoint_url=endpoint,
    )
    return resource.Table(name)


def _scan_all(table) -> list[dict]:
    rows: list[dict] = []
    kwargs = {}
    while True:
        response = table.scan(**kwargs)
        rows.extend(_clean(item) for item in response.get("Items", []))
        last_key = response.get("LastEvaluatedKey")
        if not last_key:
            return rows
        kwargs["ExclusiveStartKey"] = last_key


def _durable_rows(rows: list[dict]) -> list[dict]:
    now_epoch = int(datetime.now(timezone.utc).timestamp())
    committed_batches = {
        (row.get("userId"), row.get("sessionId"), row.get("batchId"))
        for row in rows
        if row.get("entityType") == "CHAT_TRANSCRIPT_BATCH" and row.get("status") == "committed"
    }
    durable: list[dict] = []
    seen: set[tuple[str, str, str]] = set()
    for row in rows:
        entity_type = str(row.get("entityType") or "")
        if row.get("ttl") and int(row["ttl"]) <= now_epoch:
            continue
        if entity_type == "CHAT_TRANSCRIPT_BATCH" and row.get("status") != "committed":
            continue
        if entity_type in SKIPPED_TYPES:
            if entity_type != "CHAT_TRANSCRIPT_STAGE":
                continue
            marker = (row.get("userId"), row.get("sessionId"), row.get("batchId"))
            if marker not in committed_batches:
                continue
            for message in row.get("messages") or []:
                normalized = {
                    **message,
                    "userId": row["userId"],
                    "sessionId": row["sessionId"],
                    "transcriptBatchId": row["batchId"],
                    "entityType": "CHAT_MESSAGE",
                }
                key = (
                    "CHAT_MESSAGE",
                    normalized["userId"],
                    f"{normalized['sessionId']}:{normalized['id']}",
                )
                if key not in seen:
                    durable.append(normalized)
                    seen.add(key)
            continue
        if not entity_type or entity_type in {"MEMORY_WRITE_LEASE", "MEMORY_WRITE"}:
            continue
        identity = str(row.get("id") or row.get("SK") or row.get("identifier") or "")
        if entity_type == "CHAT_MESSAGE":
            identity = f"{row.get('sessionId')}:{identity}"
        key = (entity_type, str(row.get("userId") or row.get("PK") or ""), identity)
        if key in seen:
            continue
        durable.append(row)
        seen.add(key)
    durable.sort(key=lambda item: (PRIORITY.get(str(item.get("entityType")), 99), str(item.get("PK", "")), str(item.get("SK", ""))))
    return durable


def _source_summary(rows: list[dict]) -> tuple[dict[str, int], str]:
    counts = Counter(str(row.get("entityType") or "UNKNOWN") for row in rows)
    canonical = sorted(
        json.dumps(row, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        for row in rows
    )
    checksum = hashlib.sha256("\n".join(canonical).encode("utf-8")).hexdigest()
    return dict(sorted(counts.items())), checksum


def _target_payload(item: dict) -> dict:
    payload = {
        key: value
        for key, value in item.items()
        if key not in {"PK", "SK", "entityType", "ttl"}
    }
    if item.get("entityType") in {"SUBHASH", "PRACTICE_REQUEST"} and payload.get("status") == "processing":
        payload["status"] = "failed"
        for key in (
            "processingClaimId",
            "processingClaimedAt",
            "processingClaimedAtEpoch",
        ):
            payload.pop(key, None)
    return payload


def _expected_target_fingerprints(
    rows: list[dict],
) -> tuple[dict[str, int], dict[str, str], dict[str, int]]:
    payloads: dict[str, list[str]] = {}
    unmapped: Counter[str] = Counter()
    for item in rows:
        entity_type = str(item.get("entityType") or "UNKNOWN")
        label = TARGET_LABELS.get(entity_type)
        if not label:
            unmapped[entity_type] += 1
            continue
        payloads.setdefault(label, []).append(
            json.dumps(
                _target_payload(item),
                ensure_ascii=False,
                sort_keys=True,
                separators=(",", ":"),
            )
        )
    counts = {label: len(values) for label, values in sorted(payloads.items())}
    checksums = {
        label: hashlib.sha256("\n".join(sorted(values)).encode("utf-8")).hexdigest()
        for label, values in sorted(payloads.items())
    }
    return counts, checksums, dict(sorted(unmapped.items()))


def _verification_errors(
    expected_counts: dict[str, int],
    expected_checksums: dict[str, str],
    target_counts: dict[str, int],
    target_checksums: dict[str, str],
    unmapped: dict[str, int],
) -> list[str]:
    errors = []
    if unmapped:
        errors.append(f"unmapped durable entities: {json.dumps(unmapped, sort_keys=True)}")
    for label, expected_count in expected_counts.items():
        actual_count = target_counts.get(label, 0)
        # A user row is also created for guest/domain data that had no AUTH row.
        if label == "users":
            if actual_count < expected_count:
                errors.append(
                    f"users count is {actual_count}; expected at least {expected_count}"
                )
            elif actual_count == expected_count and target_checksums.get(label) != expected_checksums[label]:
                errors.append("users payload checksum differs")
            continue
        if actual_count != expected_count:
            errors.append(
                f"{label} count is {actual_count}; expected {expected_count}"
            )
        elif target_checksums.get(label) != expected_checksums[label]:
            errors.append(f"{label} payload checksum differs")
    return errors


def main() -> None:
    parser = argparse.ArgumentParser()
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--dry-run", action="store_true")
    mode.add_argument("--apply", action="store_true")
    mode.add_argument("--verify", action="store_true")
    args = parser.parse_args()

    table = _source_table()
    rows = _durable_rows(_scan_all(table))
    source_counts, source_checksum = _source_summary(rows)
    expected_counts, expected_checksums, unmapped = _expected_target_fingerprints(rows)
    print(f"Source table: {table.name}")
    print(f"Durable rows: {len(rows)}; source checksum: {source_checksum}")
    print("Source entity counts:", json.dumps(source_counts, sort_keys=True))
    print("Expected target counts:", json.dumps(expected_counts, sort_keys=True))
    if unmapped:
        print("Unmapped durable entity counts:", json.dumps(unmapped, sort_keys=True))
    if args.dry_run:
        if unmapped:
            raise SystemExit(1)
        return

    from app.db.repositories import (
        database_payload_fingerprints,
        import_legacy_item,
        record_migration_audit,
    )

    migration_id = f"dynamo_{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}_{uuid4().hex[:8]}"
    if args.apply:
        imported = Counter()
        skipped = Counter()
        for item in rows:
            label = import_legacy_item(item)
            if label:
                imported[label] += 1
            else:
                skipped[str(item.get("entityType") or "UNKNOWN")] += 1
        target_counts, target_checksums = database_payload_fingerprints()
        errors = _verification_errors(
            expected_counts,
            expected_checksums,
            target_counts,
            target_checksums,
            dict(skipped) or unmapped,
        )
        record_migration_audit(
            migration_id,
            table.name,
            target_counts,
            target_checksums,
            status="failed" if errors else "verified",
        )
        print("Imported table counts:", json.dumps(dict(sorted(imported.items())), sort_keys=True))
        if skipped:
            print("Unmapped entity counts:", json.dumps(dict(sorted(skipped.items())), sort_keys=True))
        print("Target table counts:", json.dumps(target_counts, sort_keys=True))
        print(f"Migration audit: {migration_id}")
        if errors:
            print("Verification failed:")
            for error in errors:
                print(f"  - {error}")
            raise SystemExit(1)
        print("Verification passed: target counts and payload checksums match the source.")
        return

    target_counts, target_checksums = database_payload_fingerprints()
    print("Target table counts:", json.dumps(target_counts, sort_keys=True))
    print("Target checksums:", json.dumps(target_checksums, sort_keys=True))
    errors = _verification_errors(
        expected_counts,
        expected_checksums,
        target_counts,
        target_checksums,
        unmapped,
    )
    if errors:
        print("Verification failed:")
        for error in errors:
            print(f"  - {error}")
        raise SystemExit(1)
    print("Verification passed: target counts and payload checksums match the source.")


if __name__ == "__main__":
    main()
