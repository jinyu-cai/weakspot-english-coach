from datetime import datetime, timedelta, timezone
import hashlib
import json
from typing import Optional

from boto3.dynamodb.conditions import Key
from boto3.dynamodb.types import TypeSerializer
from botocore.exceptions import ClientError

from app.db.dynamodb import table
from app.db.keys import (
    active_plan_sk,
    attempt_sk,
    chat_message_sk,
    chat_session_sk,
    error_sk,
    exercise_sk,
    note_sk,
    memory_sk,
    memory_trace_sk,
    profile_sk,
    skill_sk,
    submission_hash_sk,
    submission_sk,
    user_pk,
)
from app.db.serialization import clean, to_dynamo


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _put(item: dict) -> None:
    table.put_item(Item=to_dynamo(item))


def _delete(pk: str, sk: str) -> None:
    table.delete_item(Key={"PK": pk, "SK": sk})


# ----- Profile -----

def get_profile(user_id: str) -> Optional[dict]:
    res = table.get_item(Key={"PK": user_pk(user_id), "SK": profile_sk()})
    item = res.get("Item")
    return clean(item) if item else None


def get_or_create_profile(user_id: str) -> dict:
    existing = get_profile(user_id)
    if existing:
        return existing

    now = now_iso()
    item = {
        "PK": user_pk(user_id),
        "SK": profile_sk(),
        "entityType": "PROFILE",
        "userId": user_id,
        "nativeLanguage": "Chinese",
        "targetLanguage": "English",
        "estimatedLevel": "B1",
        "totalSubmissions": 0,
        "totalPracticeAttempts": 0,
        "createdAt": now,
        "updatedAt": now,
    }
    _put(item)
    return clean(item)


def save_profile(profile: dict) -> None:
    item = {
        **profile,
        "PK": user_pk(profile["userId"]),
        "SK": profile_sk(),
        "entityType": "PROFILE",
    }
    _put(item)


# ----- Skills -----

def list_skills(user_id: str) -> list:
    res = table.query(
        KeyConditionExpression=Key("PK").eq(user_pk(user_id)) & Key("SK").begins_with("SKILL#")
    )
    return [clean(i) for i in res.get("Items", [])]


def get_skill(user_id: str, skill_code: str) -> Optional[dict]:
    res = table.get_item(Key={"PK": user_pk(user_id), "SK": skill_sk(skill_code)})
    item = res.get("Item")
    return clean(item) if item else None


def put_skill(skill: dict) -> None:
    item = {
        **skill,
        "PK": user_pk(skill["userId"]),
        "SK": skill_sk(skill["skillCode"]),
        "entityType": "SKILL",
    }
    _put(item)


def delete_skill(user_id: str, skill_code: str) -> None:
    _delete(user_pk(user_id), skill_sk(skill_code))


# ----- Submissions -----

def save_submission(submission: dict) -> None:
    item = {
        **submission,
        "PK": user_pk(submission["userId"]),
        "SK": submission_sk(submission["createdAt"], submission["id"]),
        "entityType": "SUBMISSION",
    }
    _put(item)


def list_recent_submissions(user_id: str, limit: Optional[int] = 10) -> list:
    if limit is not None and limit <= 0:
        return []

    submissions: list[dict] = []
    query_kwargs = {
        "KeyConditionExpression": Key("PK").eq(user_pk(user_id))
        & Key("SK").begins_with("SUBMISSION#"),
        "ScanIndexForward": False,
    }
    while limit is None or len(submissions) < limit:
        if limit is not None:
            query_kwargs["Limit"] = limit - len(submissions)
        res = table.query(**query_kwargs)
        submissions.extend(clean(item) for item in res.get("Items", []))
        last_key = res.get("LastEvaluatedKey")
        if not last_key:
            break
        query_kwargs["ExclusiveStartKey"] = last_key
    return submissions if limit is None else submissions[:limit]


def get_submission(user_id: str, created_at: str, submission_id: str) -> Optional[dict]:
    res = table.get_item(Key={"PK": user_pk(user_id), "SK": submission_sk(created_at, submission_id)})
    item = res.get("Item")
    return clean(item) if item else None


def delete_submission(user_id: str, created_at: str, submission_id: str) -> None:
    _delete(user_pk(user_id), submission_sk(created_at, submission_id))


# ----- Errors -----

def save_error(error: dict) -> None:
    item = {
        **error,
        "PK": user_pk(error["userId"]),
        "SK": error_sk(error["createdAt"], error["id"]),
        "entityType": "ERROR",
    }
    _put(item)


def list_recent_errors(user_id: str, limit: Optional[int] = 20) -> list:
    if limit is not None and limit <= 0:
        return []

    errors: list[dict] = []
    query_kwargs = {
        "KeyConditionExpression": Key("PK").eq(user_pk(user_id))
        & Key("SK").begins_with("ERROR#"),
        "ScanIndexForward": False,
    }
    while limit is None or len(errors) < limit:
        if limit is not None:
            query_kwargs["Limit"] = limit - len(errors)
        res = table.query(**query_kwargs)
        errors.extend(clean(item) for item in res.get("Items", []))
        last_key = res.get("LastEvaluatedKey")
        if not last_key:
            break
        query_kwargs["ExclusiveStartKey"] = last_key
    return errors if limit is None else errors[:limit]


def list_weekly_errors(user_id: str, limit: int = 100) -> list:
    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat().replace("+00:00", "Z")
    res = table.query(
        KeyConditionExpression=Key("PK").eq(user_pk(user_id))
        & Key("SK").between(f"ERROR#{week_ago}", "ERROR#~"),
        ScanIndexForward=False,
        Limit=limit,
    )
    return [clean(i) for i in res.get("Items", [])]


def list_errors_for_submission(user_id: str, created_at: str, submission_id: str) -> list:
    # Errors share their submission's createdAt timestamp in the SK, so a
    # begins_with on ERROR#<created_at># pulls exactly that submission's errors.
    res = table.query(
        KeyConditionExpression=Key("PK").eq(user_pk(user_id))
        & Key("SK").begins_with(f"ERROR#{created_at}#")
    )
    items = [clean(i) for i in res.get("Items", [])]
    return [e for e in items if e.get("submissionId") == submission_id]


def delete_error(user_id: str, created_at: str, error_id: str) -> None:
    _delete(user_pk(user_id), error_sk(created_at, error_id))


# ----- Submission de-dup markers -----

def get_submission_hash(user_id: str, text_hash: str) -> Optional[dict]:
    res = table.get_item(Key={"PK": user_pk(user_id), "SK": submission_hash_sk(text_hash)})
    item = res.get("Item")
    return clean(item) if item else None


def put_submission_hash(user_id: str, text_hash: str, submission_id: str, submission_created_at: str) -> None:
    _put({
        "PK": user_pk(user_id),
        "SK": submission_hash_sk(text_hash),
        "entityType": "SUBHASH",
        "userId": user_id,
        "textHash": text_hash,
        "submissionId": submission_id,
        "submissionCreatedAt": submission_created_at,
        "createdAt": now_iso(),
    })


def delete_submission_hash(user_id: str, text_hash: str) -> None:
    _delete(user_pk(user_id), submission_hash_sk(text_hash))


# ----- Learning notes -----

def save_note(note: dict) -> None:
    item = {
        **note,
        "PK": user_pk(note["userId"]),
        "SK": note_sk(note["createdAt"], note["id"]),
        "entityType": "NOTE",
    }
    _put(item)


def list_notes(user_id: str, limit: Optional[int] = None) -> list:
    if limit is not None and limit <= 0:
        return []

    notes: list[dict] = []
    query_kwargs = {
        "KeyConditionExpression": Key("PK").eq(user_pk(user_id)) & Key("SK").begins_with("NOTE#"),
        "ScanIndexForward": False,
    }
    while limit is None or len(notes) < limit:
        if limit is not None:
            query_kwargs["Limit"] = limit - len(notes)
        res = table.query(**query_kwargs)
        notes.extend(clean(item) for item in res.get("Items", []))
        last_key = res.get("LastEvaluatedKey")
        if not last_key:
            break
        query_kwargs["ExclusiveStartKey"] = last_key
    return notes if limit is None else notes[:limit]


def list_notes_for_submission(user_id: str, created_at: str, submission_id: str) -> list:
    notes: list[dict] = []
    query_kwargs = {
        "KeyConditionExpression": Key("PK").eq(user_pk(user_id))
        & Key("SK").begins_with(f"NOTE#{created_at}#"),
    }
    while True:
        res = table.query(**query_kwargs)
        notes.extend(
            clean(item)
            for item in res.get("Items", [])
            if item.get("submissionId") == submission_id
        )
        last_key = res.get("LastEvaluatedKey")
        if not last_key:
            break
        query_kwargs["ExclusiveStartKey"] = last_key
    return notes


def get_note(user_id: str, created_at: str, note_id: str) -> Optional[dict]:
    res = table.get_item(Key={"PK": user_pk(user_id), "SK": note_sk(created_at, note_id)})
    item = res.get("Item")
    return clean(item) if item else None


def delete_note(user_id: str, created_at: str, note_id: str) -> None:
    _delete(user_pk(user_id), note_sk(created_at, note_id))


# ----- MemoryAgent memories and retrieval traces -----

MEMORY_WRITE_LEASE_SK = "MEMORY_WRITE"


class MemoryWriteClaimLostError(RuntimeError):
    """A stale worker attempted to persist after its learner lease expired."""


def claim_memory_write_lease(
    user_id: str,
    claim_id: str,
    *,
    stale_after_seconds: int = 120,
) -> bool:
    """Acquire the learner-scoped memory writer lease, taking over stale work."""
    now = datetime.now(timezone.utc)
    now_text = now.isoformat().replace("+00:00", "Z")
    values = {
        ":claim": claim_id,
        ":at": now_text,
        ":epoch": int(now.timestamp()),
        ":stale": int(now.timestamp()) - max(30, stale_after_seconds),
        ":entity": "MEMORY_WRITE_LEASE",
        ":user": user_id,
    }
    try:
        table.update_item(
            Key={"PK": user_pk(user_id), "SK": MEMORY_WRITE_LEASE_SK},
            UpdateExpression=(
                "SET memoryWriteClaimId = :claim, memoryWriteClaimedAt = :at, "
                "memoryWriteClaimedAtEpoch = :epoch, entityType = :entity, userId = :user"
            ),
            ConditionExpression=(
                "attribute_not_exists(memoryWriteClaimId) OR "
                "memoryWriteClaimId = :claim OR memoryWriteClaimedAtEpoch < :stale"
            ),
            ExpressionAttributeValues=values,
        )
        return True
    except ClientError as exc:
        if exc.response.get("Error", {}).get("Code") == "ConditionalCheckFailedException":
            return False
        raise


def release_memory_write_lease(user_id: str, claim_id: str) -> None:
    """Release only the lease still owned by this worker."""
    try:
        table.update_item(
            Key={"PK": user_pk(user_id), "SK": MEMORY_WRITE_LEASE_SK},
            UpdateExpression=(
                "SET releasedAt = :at REMOVE memoryWriteClaimId, "
                "memoryWriteClaimedAt, memoryWriteClaimedAtEpoch"
            ),
            ConditionExpression="memoryWriteClaimId = :claim",
            ExpressionAttributeValues={":claim": claim_id, ":at": now_iso()},
        )
    except ClientError as exc:
        if exc.response.get("Error", {}).get("Code") != "ConditionalCheckFailedException":
            raise


def _memory_row(memory: dict) -> dict:
    return {
        **memory,
        "PK": user_pk(memory["userId"]),
        "SK": memory_sk(memory["id"]),
        "entityType": "MEMORY",
    }


def save_memory_with_memory_write_lease(memory: dict, claim_id: str) -> None:
    """Fence a memory Put to the current learner-scoped writer lease."""
    try:
        table.meta.client.transact_write_items(TransactItems=[
            {
                "ConditionCheck": {
                    "TableName": table.name,
                    "Key": to_dynamo({
                        "PK": user_pk(memory["userId"]),
                        "SK": MEMORY_WRITE_LEASE_SK,
                    }),
                    "ConditionExpression": "memoryWriteClaimId = :claim",
                    "ExpressionAttributeValues": to_dynamo({":claim": claim_id}),
                }
            },
            {
                "Put": {
                    "TableName": table.name,
                    "Item": to_dynamo(_memory_row(memory)),
                }
            },
        ])
    except ClientError as exc:
        if exc.response.get("Error", {}).get("Code") == "TransactionCanceledException":
            lease = table.get_item(
                Key={
                    "PK": user_pk(memory["userId"]),
                    "SK": MEMORY_WRITE_LEASE_SK,
                },
                ConsistentRead=True,
            ).get("Item") or {}
            if lease.get("memoryWriteClaimId") != claim_id:
                raise MemoryWriteClaimLostError(
                    "The learner memory write lease was replaced."
                ) from exc
        raise


def save_memory(memory: dict) -> None:
    _put(_memory_row(memory))


def get_memory(user_id: str, memory_id: str) -> Optional[dict]:
    res = table.get_item(Key={"PK": user_pk(user_id), "SK": memory_sk(memory_id)})
    item = res.get("Item")
    return clean(item) if item else None


def list_memories(user_id: str, limit: Optional[int] = 200) -> list:
    if limit is not None and limit <= 0:
        return []
    memories: list[dict] = []
    query_kwargs = {
        "KeyConditionExpression": Key("PK").eq(user_pk(user_id)) & Key("SK").begins_with("MEMORY#"),
    }
    while limit is None or len(memories) < limit:
        res = table.query(**query_kwargs)
        memories.extend(clean(item) for item in res.get("Items", []))
        last_key = res.get("LastEvaluatedKey")
        if not last_key:
            break
        query_kwargs["ExclusiveStartKey"] = last_key
    memories.sort(key=lambda item: item.get("updatedAt", item.get("createdAt", "")), reverse=True)
    return memories if limit is None else memories[:limit]


def delete_memory(user_id: str, memory_id: str) -> None:
    _delete(user_pk(user_id), memory_sk(memory_id))


def save_memory_trace(trace: dict) -> None:
    item = {
        **trace,
        "PK": user_pk(trace["userId"]),
        "SK": memory_trace_sk(trace["createdAt"], trace["id"]),
        "entityType": "MEMORY_TRACE",
    }
    _put(item)


def list_memory_traces(user_id: str, limit: int = 20) -> list:
    if limit <= 0:
        return []
    res = table.query(
        KeyConditionExpression=Key("PK").eq(user_pk(user_id)) & Key("SK").begins_with("MEMTRACE#"),
        ScanIndexForward=False,
        Limit=limit,
    )
    return [clean(item) for item in res.get("Items", [])]


# ----- Input Learning sources and extracted targets -----

class InputLearningClaimLostError(RuntimeError):
    """The input-learning worker no longer owns its persistence lease."""


def _input_learning_source_sk(source_id: str) -> str:
    return f"INPUT_SOURCE#{source_id}"


def _input_learning_item_sk(source_id: str, item_id: str) -> str:
    return f"INPUT_ITEM#{source_id}#{item_id}"


def save_input_learning_source(source: dict) -> None:
    item = {
        **source,
        "PK": user_pk(source["userId"]),
        "SK": _input_learning_source_sk(source["id"]),
        "entityType": "INPUT_LEARNING_SOURCE",
    }
    _put(item)


def claim_input_learning_source(
    user_id: str,
    source_id: str,
    claim_id: str,
    seed: dict,
    *,
    stale_after_seconds: int = 900,
) -> bool:
    """Claim one deterministic capture ID for side-effectful persistence."""
    now = datetime.now(timezone.utc)
    now_text = now.isoformat().replace("+00:00", "Z")
    claim_row = {
        **seed,
        "id": source_id,
        "userId": user_id,
        "status": "processing",
        "processingClaimId": claim_id,
        "processingClaimedAt": now_text,
        "processingClaimedAtEpoch": int(now.timestamp()),
        "createdAt": seed.get("createdAt") or now_text,
        "updatedAt": now_text,
        "PK": user_pk(user_id),
        "SK": _input_learning_source_sk(source_id),
        "entityType": "INPUT_LEARNING_SOURCE",
    }
    try:
        table.put_item(
            Item=to_dynamo(claim_row),
            ConditionExpression="attribute_not_exists(PK)",
        )
        return True
    except ClientError as exc:
        if exc.response.get("Error", {}).get("Code") != "ConditionalCheckFailedException":
            raise

    try:
        table.update_item(
            Key={"PK": user_pk(user_id), "SK": _input_learning_source_sk(source_id)},
            UpdateExpression=(
                "SET #status = :processing, processingClaimId = :claim, "
                "processingClaimedAt = :at, processingClaimedAtEpoch = :epoch, updatedAt = :at"
            ),
            ConditionExpression=(
                "#status <> :complete AND "
                "(attribute_not_exists(processingClaimId) OR processingClaimedAtEpoch < :stale)"
            ),
            ExpressionAttributeNames={"#status": "status"},
            ExpressionAttributeValues={
                ":processing": "processing",
                ":complete": "complete",
                ":claim": claim_id,
                ":at": now_text,
                ":epoch": int(now.timestamp()),
                ":stale": int(now.timestamp()) - max(60, stale_after_seconds),
            },
        )
        return True
    except ClientError as exc:
        if exc.response.get("Error", {}).get("Code") == "ConditionalCheckFailedException":
            return False
        raise


def complete_input_learning_source(source: dict, claim_id: str) -> None:
    item = {
        **source,
        "PK": user_pk(source["userId"]),
        "SK": _input_learning_source_sk(source["id"]),
        "entityType": "INPUT_LEARNING_SOURCE",
    }
    # A Put replaces the processing claim with the final public row in one
    # conditional operation; a stale worker cannot overwrite a newer claim.
    try:
        table.put_item(
            Item=to_dynamo(item),
            ConditionExpression="processingClaimId = :claim AND #status = :processing",
            ExpressionAttributeNames={"#status": "status"},
            ExpressionAttributeValues={
                ":claim": claim_id,
                ":processing": "processing",
            },
        )
    except ClientError as exc:
        if exc.response.get("Error", {}).get("Code") == "ConditionalCheckFailedException":
            raise InputLearningClaimLostError(
                "The input-learning persistence claim was replaced."
            ) from exc
        raise


def release_input_learning_source_claim(user_id: str, source_id: str, claim_id: str) -> None:
    try:
        table.update_item(
            Key={"PK": user_pk(user_id), "SK": _input_learning_source_sk(source_id)},
            UpdateExpression=(
                "SET updatedAt = :updated "
                "REMOVE processingClaimId, processingClaimedAt, processingClaimedAtEpoch"
            ),
            ConditionExpression="processingClaimId = :claim AND #status = :processing",
            ExpressionAttributeNames={"#status": "status"},
            ExpressionAttributeValues={
                ":claim": claim_id,
                ":processing": "processing",
                ":updated": now_iso(),
            },
        )
    except ClientError as exc:
        if exc.response.get("Error", {}).get("Code") != "ConditionalCheckFailedException":
            raise


def get_input_learning_source(user_id: str, source_id: str) -> Optional[dict]:
    res = table.get_item(
        Key={"PK": user_pk(user_id), "SK": _input_learning_source_sk(source_id)}
    )
    item = res.get("Item")
    return clean(item) if item else None


def list_input_learning_sources(user_id: str, limit: int = 50) -> list:
    if limit <= 0:
        return []
    sources: list[dict] = []
    query_kwargs = {
        "KeyConditionExpression": Key("PK").eq(user_pk(user_id))
        & Key("SK").begins_with("INPUT_SOURCE#"),
    }
    while len(sources) < limit:
        res = table.query(**query_kwargs)
        sources.extend(clean(item) for item in res.get("Items", []))
        last_key = res.get("LastEvaluatedKey")
        if not last_key:
            break
        query_kwargs["ExclusiveStartKey"] = last_key
    sources.sort(
        key=lambda item: item.get("createdAt", item.get("updatedAt", "")),
        reverse=True,
    )
    return sources[:limit]


def _raise_if_input_claim_transaction_lost(exc: ClientError) -> None:
    if exc.response.get("Error", {}).get("Code") != "TransactionCanceledException":
        raise exc
    reasons = exc.response.get("CancellationReasons") or []
    if any(reason.get("Code") == "ConditionalCheckFailed" for reason in reasons):
        raise InputLearningClaimLostError(
            "The input-learning persistence claim was replaced."
        ) from exc
    raise exc


def _write_with_input_learning_claim(
    user_id: str,
    source_id: str,
    claim_id: str,
    mutation: dict,
) -> None:
    """Commit one derivative mutation only while ``claim_id`` owns the source.

    DynamoDB serializes the condition check and derivative write together. An
    expired worker therefore cannot resume after a takeover and add/remove an
    item or memory row produced by the newer worker.
    """
    serialize = to_dynamo
    try:
        table.meta.client.transact_write_items(TransactItems=[
            {
                "ConditionCheck": {
                    "TableName": table.name,
                    "Key": serialize({
                        "PK": user_pk(user_id),
                        "SK": _input_learning_source_sk(source_id),
                    }),
                    "ConditionExpression": (
                        "processingClaimId = :claim AND #status = :processing"
                    ),
                    "ExpressionAttributeNames": {"#status": "status"},
                    "ExpressionAttributeValues": serialize({
                        ":claim": claim_id,
                        ":processing": "processing",
                    }),
                }
            },
            mutation,
        ])
    except ClientError as exc:
        _raise_if_input_claim_transaction_lost(exc)


def save_input_learning_item(item: dict, claim_id: Optional[str] = None) -> None:
    row = {
        **item,
        "PK": user_pk(item["userId"]),
        "SK": _input_learning_item_sk(item["sourceId"], item["id"]),
        "entityType": "INPUT_LEARNING_ITEM",
    }
    if not claim_id:
        _put(row)
        return
    _write_with_input_learning_claim(
        item["userId"],
        item["sourceId"],
        claim_id,
        {
            "Put": {
                "TableName": table.name,
                "Item": to_dynamo(row),
            }
        },
    )


def save_memory_with_input_learning_claim(
    memory: dict,
    source_id: str,
    claim_id: str,
    memory_claim_id: Optional[str] = None,
) -> None:
    """Fence a memory merge to both the input worker and memory writer.

    Keeping both conditions in the same transaction prevents an expired input
    worker or an expired learner-memory worker from committing after takeover.
    """
    row = _memory_row(memory)
    if not memory_claim_id:
        _write_with_input_learning_claim(
            memory["userId"],
            source_id,
            claim_id,
            {
                "Put": {
                    "TableName": table.name,
                    "Item": to_dynamo(row),
                }
            },
        )
        return

    user_id = memory["userId"]
    try:
        table.meta.client.transact_write_items(TransactItems=[
            {
                "ConditionCheck": {
                    "TableName": table.name,
                    "Key": to_dynamo({
                        "PK": user_pk(user_id),
                        "SK": MEMORY_WRITE_LEASE_SK,
                    }),
                    "ConditionExpression": "memoryWriteClaimId = :memoryClaim",
                    "ExpressionAttributeValues": to_dynamo({
                        ":memoryClaim": memory_claim_id,
                    }),
                }
            },
            {
                "ConditionCheck": {
                    "TableName": table.name,
                    "Key": to_dynamo({
                        "PK": user_pk(user_id),
                        "SK": _input_learning_source_sk(source_id),
                    }),
                    "ConditionExpression": (
                        "processingClaimId = :inputClaim AND #status = :processing"
                    ),
                    "ExpressionAttributeNames": {"#status": "status"},
                    "ExpressionAttributeValues": to_dynamo({
                        ":inputClaim": claim_id,
                        ":processing": "processing",
                    }),
                }
            },
            {
                "Put": {
                    "TableName": table.name,
                    "Item": to_dynamo(row),
                }
            },
        ])
    except ClientError as exc:
        if exc.response.get("Error", {}).get("Code") != "TransactionCanceledException":
            raise
        lease = table.get_item(
            Key={"PK": user_pk(user_id), "SK": MEMORY_WRITE_LEASE_SK},
            ConsistentRead=True,
        ).get("Item") or {}
        if lease.get("memoryWriteClaimId") != memory_claim_id:
            raise MemoryWriteClaimLostError(
                "The learner memory write lease was replaced."
            ) from exc
        _raise_if_input_claim_transaction_lost(exc)


def list_input_learning_items(user_id: str, source_id: str) -> list:
    items: list[dict] = []
    query_kwargs = {
        "KeyConditionExpression": Key("PK").eq(user_pk(user_id))
        & Key("SK").begins_with(f"INPUT_ITEM#{source_id}#"),
    }
    while True:
        res = table.query(**query_kwargs)
        items.extend(clean(item) for item in res.get("Items", []))
        last_key = res.get("LastEvaluatedKey")
        if not last_key:
            break
        query_kwargs["ExclusiveStartKey"] = last_key
    items.sort(key=lambda item: (int(item.get("position", 0)), item.get("createdAt", "")))
    return items


def delete_input_learning_items(
    user_id: str,
    source_id: str,
    claim_id: Optional[str] = None,
) -> None:
    for item in list_input_learning_items(user_id, source_id):
        if not claim_id:
            _delete(user_pk(user_id), item["SK"])
            continue
        _write_with_input_learning_claim(
            user_id,
            source_id,
            claim_id,
            {
                "Delete": {
                    "TableName": table.name,
                    "Key": to_dynamo({
                        "PK": user_pk(user_id),
                        "SK": item["SK"],
                    }),
                }
            },
        )


def delete_input_learning_source(user_id: str, source_id: str) -> None:
    delete_input_learning_items(user_id, source_id)
    _delete(user_pk(user_id), _input_learning_source_sk(source_id))


# ----- Plan -----

def save_active_plan(plan: dict) -> None:
    item = {
        **plan,
        "PK": user_pk(plan["userId"]),
        "SK": active_plan_sk(),
        "entityType": "PLAN",
    }
    _put(item)


def get_active_plan(user_id: str) -> Optional[dict]:
    res = table.get_item(Key={"PK": user_pk(user_id), "SK": active_plan_sk()})
    item = res.get("Item")
    return clean(item) if item else None


# ----- Exercises -----

def save_exercise(exercise: dict) -> None:
    item = {
        **exercise,
        "PK": user_pk(exercise["userId"]),
        "SK": exercise_sk(exercise["id"]),
        "entityType": "EXERCISE",
    }
    _put(item)


def get_exercise(user_id: str, exercise_id: str) -> Optional[dict]:
    res = table.get_item(Key={"PK": user_pk(user_id), "SK": exercise_sk(exercise_id)})
    item = res.get("Item")
    return clean(item) if item else None


# ----- Practice attempts -----

PRACTICE_REQUEST_PREFIX = "PRACTICE_REQUEST#"


class PracticeAttemptConflictError(RuntimeError):
    """A client attempt key was reused for a different grading request."""


class PracticeAttemptClaimLostError(RuntimeError):
    """A stale practice worker attempted to complete after claim takeover."""


def stable_practice_attempt_id(user_id: str, client_attempt_id: str) -> str:
    digest = hashlib.sha256(
        f"{user_id}\0{client_attempt_id}".encode("utf-8")
    ).hexdigest()[:20]
    return f"att_{digest}"


def _practice_request_sk(client_attempt_id: str) -> str:
    digest = hashlib.sha256(client_attempt_id.encode("utf-8")).hexdigest()
    return f"{PRACTICE_REQUEST_PREFIX}{digest}"


def get_practice_attempt_request(user_id: str, client_attempt_id: str) -> Optional[dict]:
    res = table.get_item(
        Key={"PK": user_pk(user_id), "SK": _practice_request_sk(client_attempt_id)},
        ConsistentRead=True,
    )
    item = res.get("Item")
    return clean(item) if item else None


def claim_practice_attempt_request(
    user_id: str,
    client_attempt_id: str,
    request_hash: str,
    claim_id: str,
    *,
    stale_after_seconds: int = 300,
) -> dict:
    """Claim a network-retry key or return its durable completed response."""
    now = datetime.now(timezone.utc)
    now_text = now.isoformat().replace("+00:00", "Z")
    row = {
        "PK": user_pk(user_id),
        "SK": _practice_request_sk(client_attempt_id),
        "entityType": "PRACTICE_REQUEST",
        "userId": user_id,
        "clientAttemptId": client_attempt_id,
        "requestHash": request_hash,
        "attemptId": stable_practice_attempt_id(user_id, client_attempt_id),
        "attemptCreatedAt": now_text,
        "status": "processing",
        "processingClaimId": claim_id,
        "processingClaimedAt": now_text,
        "processingClaimedAtEpoch": int(now.timestamp()),
        "createdAt": now_text,
        "updatedAt": now_text,
    }
    try:
        table.put_item(Item=to_dynamo(row), ConditionExpression="attribute_not_exists(PK)")
        return {**clean(row), "claimState": "acquired"}
    except ClientError as exc:
        if exc.response.get("Error", {}).get("Code") != "ConditionalCheckFailedException":
            raise

    existing = get_practice_attempt_request(user_id, client_attempt_id)
    if not existing:
        return {"claimState": "busy"}
    if existing.get("requestHash") != request_hash:
        raise PracticeAttemptConflictError(
            "clientAttemptId was already used for a different practice request."
        )
    if existing.get("status") == "complete" and isinstance(existing.get("result"), dict):
        return {**existing, "claimState": "complete"}

    try:
        table.update_item(
            Key={"PK": user_pk(user_id), "SK": _practice_request_sk(client_attempt_id)},
            UpdateExpression=(
                "SET #status = :processing, processingClaimId = :claim, "
                "processingClaimedAt = :at, processingClaimedAtEpoch = :epoch, updatedAt = :at"
            ),
            ConditionExpression=(
                "requestHash = :requestHash AND #status <> :complete AND "
                "(#status = :failed OR attribute_not_exists(processingClaimId) OR "
                "processingClaimedAtEpoch < :stale)"
            ),
            ExpressionAttributeNames={"#status": "status"},
            ExpressionAttributeValues={
                ":processing": "processing",
                ":complete": "complete",
                ":failed": "failed",
                ":claim": claim_id,
                ":at": now_text,
                ":epoch": int(now.timestamp()),
                ":stale": int(now.timestamp()) - max(60, stale_after_seconds),
                ":requestHash": request_hash,
            },
        )
        current = get_practice_attempt_request(user_id, client_attempt_id) or existing
        return {**current, "claimState": "acquired"}
    except ClientError as exc:
        if exc.response.get("Error", {}).get("Code") != "ConditionalCheckFailedException":
            raise
        current = get_practice_attempt_request(user_id, client_attempt_id)
        if current and current.get("requestHash") != request_hash:
            raise PracticeAttemptConflictError(
                "clientAttemptId was already used for a different practice request."
            )
        if current and current.get("status") == "complete" and isinstance(current.get("result"), dict):
            return {**current, "claimState": "complete"}
        return {**(current or existing), "claimState": "busy"}


def complete_practice_attempt_request(
    user_id: str,
    client_attempt_id: str,
    claim_id: str,
    result: dict,
) -> None:
    try:
        table.update_item(
            Key={"PK": user_pk(user_id), "SK": _practice_request_sk(client_attempt_id)},
            UpdateExpression=(
                "SET #status = :complete, #result = :result, completedAt = :at, updatedAt = :at "
                "REMOVE processingClaimId, processingClaimedAt, processingClaimedAtEpoch"
            ),
            ConditionExpression="processingClaimId = :claim AND #status = :processing",
            ExpressionAttributeNames={"#status": "status", "#result": "result"},
            ExpressionAttributeValues=to_dynamo({
                ":complete": "complete",
                ":processing": "processing",
                ":claim": claim_id,
                ":result": result,
                ":at": now_iso(),
            }),
        )
    except ClientError as exc:
        if exc.response.get("Error", {}).get("Code") == "ConditionalCheckFailedException":
            raise PracticeAttemptClaimLostError(
                "The practice attempt claim was replaced."
            ) from exc
        raise


def save_practice_attempt_grade_draft(
    user_id: str,
    client_attempt_id: str,
    claim_id: str,
    grade: dict,
) -> None:
    """Persist the model grade before any learner-state side effects."""
    try:
        table.update_item(
            Key={"PK": user_pk(user_id), "SK": _practice_request_sk(client_attempt_id)},
            UpdateExpression="SET gradeDraft = :grade, gradeDraftedAt = :at, updatedAt = :at",
            ConditionExpression="processingClaimId = :claim AND #status = :processing",
            ExpressionAttributeNames={"#status": "status"},
            ExpressionAttributeValues=to_dynamo({
                ":grade": grade,
                ":at": now_iso(),
                ":claim": claim_id,
                ":processing": "processing",
            }),
        )
    except ClientError as exc:
        if exc.response.get("Error", {}).get("Code") == "ConditionalCheckFailedException":
            raise PracticeAttemptClaimLostError(
                "The practice attempt claim was replaced."
            ) from exc
        raise


def release_practice_attempt_request(
    user_id: str,
    client_attempt_id: str,
    claim_id: str,
) -> None:
    try:
        table.update_item(
            Key={"PK": user_pk(user_id), "SK": _practice_request_sk(client_attempt_id)},
            UpdateExpression=(
                "SET #status = :failed, updatedAt = :at "
                "REMOVE processingClaimId, processingClaimedAt, processingClaimedAtEpoch"
            ),
            ConditionExpression="processingClaimId = :claim AND #status = :processing",
            ExpressionAttributeNames={"#status": "status"},
            ExpressionAttributeValues={
                ":failed": "failed",
                ":processing": "processing",
                ":claim": claim_id,
                ":at": now_iso(),
            },
        )
    except ClientError as exc:
        if exc.response.get("Error", {}).get("Code") != "ConditionalCheckFailedException":
            raise

def save_practice_attempt(attempt: dict) -> None:
    item = {
        **attempt,
        "PK": user_pk(attempt["userId"]),
        "SK": attempt_sk(attempt["createdAt"], attempt["id"]),
        "entityType": "ATTEMPT",
    }
    _put(item)


def list_recent_practice_attempts(user_id: str, limit: int = 100) -> list:
    res = table.query(
        KeyConditionExpression=Key("PK").eq(user_pk(user_id)) & Key("SK").begins_with("ATTEMPT#"),
        ScanIndexForward=False,
        Limit=limit,
    )
    return [clean(i) for i in res.get("Items", [])]


# ----- Auth users + rate-limit counters -----

def upsert_github_user(gh_id, login, name, avatar_url) -> dict:
    user_id = f"gh_{gh_id}"
    now = now_iso()
    existing = table.get_item(Key={"PK": user_pk(user_id), "SK": "AUTH"}).get("Item")
    item = {
        "PK": user_pk(user_id),
        "SK": "AUTH",
        "entityType": "AUTH",
        "userId": user_id,
        "githubId": str(gh_id),
        "login": login,
        "name": name,
        "avatarUrl": avatar_url,
        "createdAt": (existing or {}).get("createdAt", now),
        "lastLoginAt": now,
    }
    _put(item)
    return clean(item)


def get_github_user(gh_id) -> Optional[dict]:
    res = table.get_item(Key={"PK": user_pk(f"gh_{gh_id}"), "SK": "AUTH"})
    item = res.get("Item")
    return clean(item) if item else None


def incr_rate_counter(rate_key: str, feature: str, day: str, ttl_epoch: int) -> int:
    res = table.update_item(
        Key={"PK": f"RL#{rate_key}", "SK": f"{feature}#{day}"},
        UpdateExpression="ADD #c :one SET #t = if_not_exists(#t, :ttl), entityType = if_not_exists(entityType, :et)",
        ExpressionAttributeNames={"#c": "count", "#t": "ttl"},
        ExpressionAttributeValues={":one": 1, ":ttl": int(ttl_epoch), ":et": "RATELIMIT"},
        ReturnValues="UPDATED_NEW",
    )
    return int(res["Attributes"]["count"])


# ----- Chat sessions & messages -----

def save_chat_session(session: dict) -> None:
    item = {
        **session,
        "PK": user_pk(session["userId"]),
        "SK": chat_session_sk(session["id"]),
        "entityType": "CHAT_SESSION",
    }
    _put(item)


def get_chat_session(user_id: str, session_id: str) -> Optional[dict]:
    res = table.get_item(Key={"PK": user_pk(user_id), "SK": chat_session_sk(session_id)})
    item = res.get("Item")
    return clean(item) if item else None


def update_chat_session_fields(user_id: str, session_id: str, fields: dict) -> None:
    clean_fields = {k: v for k, v in fields.items() if k not in {"PK", "SK"}}
    if not clean_fields:
        return
    clean_fields.setdefault("updatedAt", now_iso())
    names = {f"#f{i}": key for i, key in enumerate(clean_fields)}
    values = {f":v{i}": value for i, value in enumerate(clean_fields.values())}
    table.update_item(
        Key={"PK": user_pk(user_id), "SK": chat_session_sk(session_id)},
        UpdateExpression="SET " + ", ".join(f"{name} = {value}" for name, value in zip(names, values)),
        ExpressionAttributeNames=names,
        ExpressionAttributeValues=to_dynamo(values),
    )


def claim_chat_session_analysis(
    user_id: str,
    session_id: str,
    claim_id: str,
    *,
    stale_after_seconds: int = 900,
) -> bool:
    """Atomically allow one analyzer; an abandoned claim can be recovered.

    Analysis and text-turn claims are mutually exclusive.  When a genuinely
    stale turn is recovered, its claim fields are removed in the same write so
    the session never advertises two active owners.
    """
    now = datetime.now(timezone.utc)
    now_epoch = int(now.timestamp())
    try:
        table.update_item(
            Key={"PK": user_pk(user_id), "SK": chat_session_sk(session_id)},
            UpdateExpression=(
                "SET analysisClaimId = :claim, analysisClaimedAt = :at, "
                "analysisClaimedAtEpoch = :epoch, updatedAt = :at "
                "REMOVE turnClaimId, turnClaimedAt, turnClaimedAtEpoch"
            ),
            ConditionExpression=(
                "attribute_not_exists(analysis) AND "
                "(attribute_not_exists(analysisClaimId) OR analysisClaimedAtEpoch < :stale) AND "
                "(attribute_not_exists(turnClaimId) OR turnClaimedAtEpoch < :stale)"
            ),
            ExpressionAttributeValues={
                ":claim": claim_id,
                ":at": now.isoformat().replace("+00:00", "Z"),
                ":epoch": now_epoch,
                ":stale": now_epoch - max(60, stale_after_seconds),
            },
        )
        return True
    except ClientError as exc:
        if exc.response.get("Error", {}).get("Code") == "ConditionalCheckFailedException":
            return False
        raise


def claim_chat_session_turn(
    user_id: str,
    session_id: str,
    claim_id: str,
    *,
    stale_after_seconds: int = 900,
) -> bool:
    """Claim the only text-message turn that may be in flight for a session."""
    now = datetime.now(timezone.utc)
    now_epoch = int(now.timestamp())
    try:
        table.update_item(
            Key={"PK": user_pk(user_id), "SK": chat_session_sk(session_id)},
            UpdateExpression=(
                "SET turnClaimId = :claim, turnClaimedAt = :at, "
                "turnClaimedAtEpoch = :epoch, updatedAt = :at"
            ),
            ConditionExpression=(
                "attribute_exists(PK) AND attribute_not_exists(analysis) AND "
                "attribute_not_exists(analysisDraft) AND "
                "attribute_not_exists(analysisClaimId) AND "
                "(attribute_not_exists(turnClaimId) OR turnClaimedAtEpoch < :stale)"
            ),
            ExpressionAttributeValues={
                ":claim": claim_id,
                ":at": now.isoformat().replace("+00:00", "Z"),
                ":epoch": now_epoch,
                ":stale": now_epoch - max(60, stale_after_seconds),
            },
        )
        return True
    except ClientError as exc:
        if exc.response.get("Error", {}).get("Code") == "ConditionalCheckFailedException":
            return False
        raise


def release_chat_session_turn_claim(user_id: str, session_id: str, claim_id: str) -> None:
    """Release a failed/aborted text turn without disturbing a newer owner."""
    try:
        table.update_item(
            Key={"PK": user_pk(user_id), "SK": chat_session_sk(session_id)},
            UpdateExpression=(
                "SET updatedAt = :updated "
                "REMOVE turnClaimId, turnClaimedAt, turnClaimedAtEpoch"
            ),
            ConditionExpression="turnClaimId = :claim",
            ExpressionAttributeValues={":claim": claim_id, ":updated": now_iso()},
        )
    except ClientError as exc:
        if exc.response.get("Error", {}).get("Code") != "ConditionalCheckFailedException":
            raise


def release_chat_session_analysis_claim(user_id: str, session_id: str, claim_id: str) -> None:
    try:
        table.update_item(
            Key={"PK": user_pk(user_id), "SK": chat_session_sk(session_id)},
            UpdateExpression=(
                "SET updatedAt = :updated "
                "REMOVE analysisClaimId, analysisClaimedAt, analysisClaimedAtEpoch"
            ),
            ConditionExpression="analysisClaimId = :claim AND attribute_not_exists(analysis)",
            ExpressionAttributeValues={":claim": claim_id, ":updated": now_iso()},
        )
    except ClientError as exc:
        if exc.response.get("Error", {}).get("Code") != "ConditionalCheckFailedException":
            raise


def save_chat_session_analysis_draft(
    user_id: str,
    session_id: str,
    claim_id: str,
    analysis: dict,
) -> None:
    """Persist the model result before applying any learning side effects.

    A failed attempt can reuse this exact draft, so an LLM retry cannot create
    a different set of corrections or memories for the same ended session.
    """
    table.update_item(
        Key={"PK": user_pk(user_id), "SK": chat_session_sk(session_id)},
        UpdateExpression=(
            "SET analysisDraft = :draft, analysisDraftCreatedAt = :created, updatedAt = :created"
        ),
        ConditionExpression="analysisClaimId = :claim AND attribute_not_exists(analysis)",
        ExpressionAttributeValues=to_dynamo({
            ":draft": analysis,
            ":created": now_iso(),
            ":claim": claim_id,
        }),
    )


def request_chat_session_realtime_kick(user_id: str, session_id: str, reason: str) -> None:
    now = now_iso()
    update_chat_session_fields(
        user_id,
        session_id,
        {
            "realtimeStatus": "kick_requested",
            "realtimeKickRequestedAt": now,
            "realtimeKickReason": reason,
            "updatedAt": now,
        },
    )


def _chat_transcript_batch_sk(session_id: str, batch_id: str) -> str:
    return f"CHATBATCH#{session_id}#{batch_id}"


def _chat_transcript_stage_sk(session_id: str, batch_id: str, chunk_index: int) -> str:
    return f"CHATSTAGE#{session_id}#{batch_id}#{chunk_index:04d}"


_DYNAMO_TYPE_SERIALIZER = TypeSerializer()
_TRANSCRIPT_STAGE_ITEM_TARGET_BYTES = 385_000
_TRANSCRIPT_STAGE_TRANSACTION_TARGET_BYTES = 3_500_000
_TRANSCRIPT_STAGE_TTL_SECONDS = 24 * 60 * 60


def _serialized_dynamo_item_size(item: dict) -> int:
    """Conservative UTF-8 size of the low-level DynamoDB AttributeValue map."""
    wire_item = {
        key: _DYNAMO_TYPE_SERIALIZER.serialize(value)
        for key, value in to_dynamo(item).items()
    }
    return len(
        json.dumps(wire_item, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    )


def _build_chat_transcript_stage_items(
    user_id: str,
    session_id: str,
    batch_id: str,
    messages: list[dict],
) -> list[dict]:
    """Pack messages into sub-400KB items using serialized UTF-8 bytes."""
    message_sizes = [
        len(
            json.dumps(
                _DYNAMO_TYPE_SERIALIZER.serialize(to_dynamo(message)),
                ensure_ascii=False,
                separators=(",", ":"),
            ).encode("utf-8")
        )
        for message in messages
    ]
    chunks: list[list[dict]] = []
    current: list[dict] = []
    # Reserve room for PK/SK, metadata, DynamoDB type wrappers, and list syntax.
    current_bytes = 2_048
    for message, message_size in zip(messages, message_sizes):
        if current and current_bytes + message_size + 16 > _TRANSCRIPT_STAGE_ITEM_TARGET_BYTES:
            chunks.append(current)
            current = []
            current_bytes = 2_048
        current.append(message)
        current_bytes += message_size + 16
    if current:
        chunks.append(current)

    now = datetime.now(timezone.utc)
    now_text = now.isoformat().replace("+00:00", "Z")
    ttl = int(now.timestamp()) + _TRANSCRIPT_STAGE_TTL_SECONDS
    items = [
        {
            "PK": user_pk(user_id),
            "SK": _chat_transcript_stage_sk(session_id, batch_id, index),
            "entityType": "CHAT_TRANSCRIPT_STAGE",
            "batchId": batch_id,
            "transcriptBatchId": batch_id,
            "sessionId": session_id,
            "userId": user_id,
            "chunkIndex": index,
            "messages": chunk,
            "ttl": ttl,
            "createdAt": now_text,
            "updatedAt": now_text,
        }
        for index, chunk in enumerate(chunks)
    ]
    for item in items:
        size = _serialized_dynamo_item_size(item)
        if size >= 400_000:
            raise ValueError(f"Transcript stage item exceeds the safe DynamoDB item budget: {size} bytes.")
    if len(items) > 98:
        raise ValueError("Transcript batch requires too many atomic commit actions.")
    return items


def _committed_chat_transcript_batch_ids(user_id: str, session_id: str) -> set[str]:
    """Return commit markers that make staged transcript messages visible."""
    committed: set[str] = set()
    query_kwargs = {
        "KeyConditionExpression": Key("PK").eq(user_pk(user_id))
        & Key("SK").begins_with(f"CHATBATCH#{session_id}#"),
        "ScanIndexForward": True,
        "ConsistentRead": True,
    }
    while True:
        res = table.query(**query_kwargs)
        for item in res.get("Items", []):
            if item.get("status") == "committed" and item.get("batchId"):
                committed.add(str(item["batchId"]))
        last_key = res.get("LastEvaluatedKey")
        if not last_key:
            return committed
        query_kwargs["ExclusiveStartKey"] = last_key


def _list_chat_transcript_stage_items(user_id: str, session_id: str) -> list[dict]:
    items: list[dict] = []
    query_kwargs = {
        "KeyConditionExpression": Key("PK").eq(user_pk(user_id))
        & Key("SK").begins_with(f"CHATSTAGE#{session_id}#"),
        "ScanIndexForward": True,
        "ConsistentRead": True,
    }
    while True:
        res = table.query(**query_kwargs)
        items.extend(clean(item) for item in res.get("Items", []))
        last_key = res.get("LastEvaluatedKey")
        if not last_key:
            return items
        query_kwargs["ExclusiveStartKey"] = last_key


def _count_chat_messages_by_session(user_id: str, session_ids: set[str]) -> dict[str, int]:
    if not session_ids:
        return {}

    # Capture marker snapshots first. A batch committed after this point is
    # deliberately excluded from this read rather than exposing a mixed epoch.
    committed_by_session = {
        session_id: _committed_chat_transcript_batch_ids(user_id, session_id)
        for session_id in session_ids
    }
    counts = {session_id: 0 for session_id in session_ids}
    query_kwargs = {
        "KeyConditionExpression": Key("PK").eq(user_pk(user_id)) & Key("SK").begins_with("CHATMSG#"),
        "ScanIndexForward": True,
        "ConsistentRead": True,
    }

    while True:
        res = table.query(**query_kwargs)
        for item in res.get("Items", []):
            session_id = item.get("sessionId")
            if session_id in counts:
                batch_id = item.get("transcriptBatchId")
                if not batch_id or str(batch_id) in committed_by_session[session_id]:
                    counts[session_id] += 1

        last_key = res.get("LastEvaluatedKey")
        if not last_key:
            break
        query_kwargs["ExclusiveStartKey"] = last_key

    for session_id, committed in committed_by_session.items():
        if not committed:
            continue
        for item in _list_chat_transcript_stage_items(user_id, session_id):
            if str(item.get("batchId") or "") in committed:
                counts[session_id] += len(item.get("messages") or [])
    return counts


def list_chat_sessions(user_id: str, limit: int = 20) -> list:
    res = table.query(
        KeyConditionExpression=Key("PK").eq(user_pk(user_id)) & Key("SK").begins_with("CHAT#"),
        ScanIndexForward=False,
        Limit=limit,
    )
    sessions = [clean(i) for i in res.get("Items", [])]
    counts = _count_chat_messages_by_session(user_id, {s["id"] for s in sessions if s.get("id")})
    for session in sessions:
        session["messageCount"] = counts.get(session.get("id"), 0)
    return sessions


def save_chat_message(message: dict) -> None:
    item = {
        **message,
        "PK": user_pk(message["userId"]),
        "SK": chat_message_sk(message["createdAt"], message["id"]),
        "entityType": "CHAT_MESSAGE",
    }
    _put(item)


def finalize_chat_session_turn(
    user_id: str,
    session_id: str,
    claim_id: str,
    user_message: dict,
    assistant_message: dict,
    summary: str,
    message_count: int,
) -> None:
    """Commit a complete chat turn and release its claim atomically.

    Neither half of the exchange becomes visible unless both messages and the
    session summary can be written together.  The condition also prevents a
    late model response from appending to a session whose analysis has begun.
    """
    updated_at = now_iso()

    def message_item(message: dict) -> dict:
        return to_dynamo({
            **message,
            "PK": user_pk(user_id),
            "SK": chat_message_sk(message["createdAt"], message["id"]),
            "entityType": "CHAT_MESSAGE",
        })

    transaction = [
        {
            "Put": {
                "TableName": table.name,
                "Item": message_item(user_message),
                "ConditionExpression": "attribute_not_exists(PK) AND attribute_not_exists(SK)",
            }
        },
        {
            "Put": {
                "TableName": table.name,
                "Item": message_item(assistant_message),
                "ConditionExpression": "attribute_not_exists(PK) AND attribute_not_exists(SK)",
            }
        },
        {
            "Update": {
                "TableName": table.name,
                "Key": to_dynamo({
                    "PK": user_pk(user_id),
                    "SK": chat_session_sk(session_id),
                }),
                "UpdateExpression": (
                    "SET summary = :summary, messageCount = :count, updatedAt = :updated "
                    "REMOVE turnClaimId, turnClaimedAt, turnClaimedAtEpoch"
                ),
                "ConditionExpression": (
                    "turnClaimId = :claim AND attribute_not_exists(analysis) AND "
                    "attribute_not_exists(analysisDraft) AND attribute_not_exists(analysisClaimId)"
                ),
                "ExpressionAttributeValues": to_dynamo({
                    ":summary": summary,
                    ":count": message_count,
                    ":updated": updated_at,
                    ":claim": claim_id,
                }),
            }
        },
    ]
    table.meta.client.transact_write_items(TransactItems=transaction)


def finalize_chat_session_transcript_batch(
    user_id: str,
    session_id: str,
    claim_id: str,
    batch_id: str,
    messages: list[dict],
    summary: str,
    message_count: int,
) -> None:
    """Stage and atomically publish a complete realtime transcript batch.

    Staging chunks have a short TTL, so a process crash cannot create unbounded
    orphan rows.  The final transaction removes TTL from every chunk at the
    same instant it publishes the marker and releases the claim; committed
    transcripts therefore never depend on a later cleanup succeeding.
    """
    if not messages:
        raise ValueError("A transcript batch must contain at least one message.")

    stage_items = _build_chat_transcript_stage_items(
        user_id,
        session_id,
        batch_id,
        messages,
    )

    claim_condition = (
        "turnClaimId = :claim AND attribute_not_exists(analysis) AND "
        "attribute_not_exists(analysisDraft) AND attribute_not_exists(analysisClaimId)"
    )
    claim_values = to_dynamo({":claim": claim_id})
    session_key = to_dynamo({
        "PK": user_pk(user_id),
        "SK": chat_session_sk(session_id),
    })

    condition_action = {
        "ConditionCheck": {
            "TableName": table.name,
            "Key": session_key,
            "ConditionExpression": claim_condition,
            "ExpressionAttributeValues": claim_values,
        }
    }

    def write_stage_transaction(items: list[dict]) -> None:
        transaction: list[dict] = [condition_action]
        transaction.extend({
            "Put": {
                "TableName": table.name,
                "Item": to_dynamo(item),
            }
        } for item in items)
        table.meta.client.transact_write_items(TransactItems=transaction)

    marker_key = {
        "PK": user_pk(user_id),
        "SK": _chat_transcript_batch_sk(session_id, batch_id),
    }
    try:
        # Pack by both DynamoDB action count and conservative serialized bytes.
        pending: list[dict] = []
        pending_bytes = 2_048  # condition, table name, and expression overhead
        for item in stage_items:
            item_bytes = _serialized_dynamo_item_size(item) + 512
            if pending and (
                len(pending) >= 99
                or pending_bytes + item_bytes > _TRANSCRIPT_STAGE_TRANSACTION_TARGET_BYTES
            ):
                write_stage_transaction(pending)
                pending = []
                pending_bytes = 2_048
            pending.append(item)
            pending_bytes += item_bytes
        if pending:
            write_stage_transaction(pending)

        committed_at = now_iso()
        marker = to_dynamo({
            **marker_key,
            "entityType": "CHAT_TRANSCRIPT_BATCH",
            "batchId": batch_id,
            "sessionId": session_id,
            "userId": user_id,
            "status": "committed",
            "messageCount": len(messages),
            "chunkCount": len(stage_items),
            "createdAt": committed_at,
            "updatedAt": committed_at,
        })
        final_transaction: list[dict] = [
            {
                "Update": {
                    "TableName": table.name,
                    "Key": to_dynamo({"PK": item["PK"], "SK": item["SK"]}),
                    "UpdateExpression": "REMOVE #ttl",
                    "ConditionExpression": "transcriptBatchId = :batch",
                    "ExpressionAttributeNames": {"#ttl": "ttl"},
                    "ExpressionAttributeValues": to_dynamo({":batch": batch_id}),
                }
            }
            for item in stage_items
        ]
        final_transaction.extend([
            {
                "Put": {
                    "TableName": table.name,
                    "Item": marker,
                    "ConditionExpression": "attribute_not_exists(PK) AND attribute_not_exists(SK)",
                }
            },
            {
                "Update": {
                    "TableName": table.name,
                    "Key": session_key,
                    "UpdateExpression": (
                        "SET summary = :summary, messageCount = :count, updatedAt = :updated "
                        "REMOVE turnClaimId, turnClaimedAt, turnClaimedAtEpoch"
                    ),
                    "ConditionExpression": claim_condition,
                    "ExpressionAttributeValues": to_dynamo({
                        ":summary": summary,
                        ":count": message_count,
                        ":updated": committed_at,
                        ":claim": claim_id,
                    }),
                }
            },
        ])
        table.meta.client.transact_write_items(TransactItems=final_transaction)
    except Exception:
        # A transaction response can be ambiguous. Never delete permanent
        # chunks if the commit marker actually landed.
        marker = table.get_item(Key=marker_key, ConsistentRead=True).get("Item")
        if marker and marker.get("status") == "committed":
            return
        # Normal failures clean up immediately. If deletion itself fails or
        # the process crashed, each uncommitted chunk still has the short TTL.
        for item in stage_items:
            try:
                table.delete_item(Key={"PK": item["PK"], "SK": item["SK"]})
            except Exception:
                pass
        raise


def list_chat_messages(user_id: str, session_id: str, limit: Optional[int] = None) -> list:
    if limit is not None and limit <= 0:
        return []

    # Marker snapshot must precede message reads. A later commit belongs to the
    # next snapshot and cannot make only part of a new batch visible here.
    committed = _committed_chat_transcript_batch_ids(user_id, session_id)
    messages = []
    query_kwargs = {
        "KeyConditionExpression": Key("PK").eq(user_pk(user_id)) & Key("SK").begins_with("CHATMSG#"),
        "ScanIndexForward": True,
        "ConsistentRead": True,
    }

    while True:
        res = table.query(**query_kwargs)
        for item in res.get("Items", []):
            message = clean(item)
            if message.get("sessionId") == session_id:
                batch_id = str(message.get("transcriptBatchId") or "")
                if not batch_id or batch_id in committed:
                    messages.append(message)

        last_key = res.get("LastEvaluatedKey")
        if not last_key:
            break
        query_kwargs["ExclusiveStartKey"] = last_key

    if committed:
        for item in _list_chat_transcript_stage_items(user_id, session_id):
            if str(item.get("batchId") or "") not in committed:
                continue
            messages.extend(
                clean(message)
                for message in item.get("messages") or []
                if isinstance(message, dict)
            )
    messages.sort(key=lambda message: (str(message.get("createdAt") or ""), str(message.get("id") or "")))
    return messages[:limit] if limit is not None else messages


def update_chat_session_summary(user_id: str, session_id: str, summary: str, message_count: int) -> None:
    table.update_item(
        Key={"PK": user_pk(user_id), "SK": chat_session_sk(session_id)},
        UpdateExpression="SET summary = :s, messageCount = :c, updatedAt = :u",
        ExpressionAttributeValues={
            ":s": summary,
            ":c": message_count,
            ":u": now_iso(),
        },
    )


def update_chat_session_analysis(
    user_id: str,
    session_id: str,
    analysis: dict,
    saved_notes: list,
    saved_errors: list,
    updated_skills: list,
    analyzed_at: str,
    stealth_practice: Optional[dict] = None,
    claim_id: Optional[str] = None,
    errors_to_persist: Optional[list[dict]] = None,
    notes_to_persist: Optional[list[dict]] = None,
    skills_to_persist: Optional[list[dict]] = None,
    memory_claim_id: Optional[str] = None,
) -> None:
    expression_values = {
        ":a": analysis,
        ":t": analyzed_at,
        ":n": saved_notes,
        ":e": saved_errors,
        ":s": updated_skills,
        ":sp": stealth_practice,
        ":u": analyzed_at,
    }
    update_expression = (
        "SET analysis = :a, analysisCreatedAt = :t, analysisSavedNotes = :n, "
        "analysisSavedErrors = :e, analysisUpdatedSkills = :s, stealthPractice = :sp, updatedAt = :u "
        "REMOVE analysisClaimId, analysisClaimedAt, analysisClaimedAtEpoch, "
        "analysisDraft, analysisDraftCreatedAt"
    )

    # The analyzer always supplies a claim. Keep the legacy direct update for
    # repository callers that do not need an effects transaction.
    if not claim_id:
        table.update_item(
            Key={"PK": user_pk(user_id), "SK": chat_session_sk(session_id)},
            UpdateExpression=update_expression,
            ExpressionAttributeValues=to_dynamo(expression_values),
        )
        return

    expression_values[":claim"] = claim_id
    def serialize_map(value: dict) -> dict:
        # This client belongs to a DynamoDB resource, so boto3's resource
        # injector performs AttributeValue serialization for transaction calls.
        return to_dynamo(value)

    transaction: list[dict] = []
    if memory_claim_id:
        transaction.append({
            "ConditionCheck": {
                "TableName": table.name,
                "Key": serialize_map({
                    "PK": user_pk(user_id),
                    "SK": MEMORY_WRITE_LEASE_SK,
                }),
                "ConditionExpression": "memoryWriteClaimId = :memoryClaim",
                "ExpressionAttributeValues": serialize_map({
                    ":memoryClaim": memory_claim_id,
                }),
            }
        })
    for error in errors_to_persist or []:
        transaction.append({
            "Put": {
                "TableName": table.name,
                "Item": serialize_map({
                    **error,
                    "PK": user_pk(user_id),
                    "SK": error_sk(error["createdAt"], error["id"]),
                    "entityType": "ERROR",
                }),
            }
        })
    for note in notes_to_persist or []:
        transaction.append({
            "Put": {
                "TableName": table.name,
                "Item": serialize_map({
                    **note,
                    "PK": user_pk(user_id),
                    "SK": note_sk(note["createdAt"], note["id"]),
                    "entityType": "NOTE",
                }),
            }
        })
    for skill in skills_to_persist or []:
        transaction.append({
            "Put": {
                "TableName": table.name,
                "Item": serialize_map({
                    **skill,
                    "PK": user_pk(user_id),
                    "SK": skill_sk(skill["skillCode"]),
                    "entityType": "SKILL",
                }),
            }
        })

    transaction.append({
        "Update": {
            "TableName": table.name,
            "Key": serialize_map({
                "PK": user_pk(user_id),
                "SK": chat_session_sk(session_id),
            }),
            "UpdateExpression": update_expression,
            "ConditionExpression": "analysisClaimId = :claim AND attribute_not_exists(analysis)",
            "ExpressionAttributeValues": serialize_map(expression_values),
        }
    })
    if len(transaction) > 100:
        raise ValueError("Chat analysis produced too many atomic side effects.")
    try:
        table.meta.client.transact_write_items(TransactItems=transaction)
    except ClientError as exc:
        if (
            memory_claim_id
            and exc.response.get("Error", {}).get("Code")
            == "TransactionCanceledException"
        ):
            lease = table.get_item(
                Key={"PK": user_pk(user_id), "SK": MEMORY_WRITE_LEASE_SK},
                ConsistentRead=True,
            ).get("Item") or {}
            if lease.get("memoryWriteClaimId") != memory_claim_id:
                raise MemoryWriteClaimLostError(
                    "The learner memory write lease was replaced."
                ) from exc
        if exc.response.get("CancellationReasons"):
            raise RuntimeError(
                f"Chat analysis transaction failed: {exc.response['CancellationReasons']!r}"
            ) from exc
        raise


# ----- Access roles -----

def _normalize_access_identifier(identifier: str) -> str:
    return " ".join((identifier or "").strip().lower().split())


def get_access_role(identifier: str) -> Optional[dict]:
    normalized = _normalize_access_identifier(identifier)
    if not normalized:
        return None
    res = table.get_item(Key={"PK": "ACCESS_ROLE", "SK": normalized})
    item = res.get("Item")
    return clean(item) if item else None


def list_access_roles() -> list:
    res = table.query(KeyConditionExpression=Key("PK").eq("ACCESS_ROLE"))
    return [clean(i) for i in res.get("Items", [])]


def set_access_role(identifier: str, role: str, updated_by: str) -> dict:
    normalized = _normalize_access_identifier(identifier)
    if not normalized:
        raise ValueError("identifier is required")
    if role not in {"owner", "member"}:
        raise ValueError("role must be owner or member")
    now = now_iso()
    existing = get_access_role(normalized)
    item = {
        "PK": "ACCESS_ROLE",
        "SK": normalized,
        "entityType": "ACCESS_ROLE",
        "identifier": normalized,
        "role": role,
        "createdAt": (existing or {}).get("createdAt", now),
        "updatedAt": now,
        "updatedBy": updated_by,
    }
    _put(item)
    return clean(item)


def delete_access_role(identifier: str) -> None:
    normalized = _normalize_access_identifier(identifier)
    if normalized:
        _delete("ACCESS_ROLE", normalized)


def upsert_google_user(sub, email, name, avatar_url) -> dict:
    user_id = f"google_{sub}"
    now = now_iso()
    existing = table.get_item(Key={"PK": user_pk(user_id), "SK": "AUTH"}).get("Item")
    item = {
        "PK": user_pk(user_id),
        "SK": "AUTH",
        "entityType": "AUTH",
        "userId": user_id,
        "provider": "google",
        "googleSub": str(sub),
        "email": email,
        "login": email,
        "name": name,
        "avatarUrl": avatar_url,
        "createdAt": (existing or {}).get("createdAt", now),
        "lastLoginAt": now,
    }
    _put(item)
    return clean(item)
