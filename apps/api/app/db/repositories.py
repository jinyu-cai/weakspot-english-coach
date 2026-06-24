from datetime import datetime, timezone
from typing import Optional

from boto3.dynamodb.conditions import Key

from app.db.dynamodb import table
from app.db.keys import (
    active_plan_sk,
    attempt_sk,
    chat_message_sk,
    chat_session_sk,
    error_sk,
    exercise_sk,
    note_sk,
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


def list_recent_submissions(user_id: str, limit: int = 10) -> list:
    res = table.query(
        KeyConditionExpression=Key("PK").eq(user_pk(user_id)) & Key("SK").begins_with("SUBMISSION#"),
        ScanIndexForward=False,
        Limit=limit,
    )
    return [clean(i) for i in res.get("Items", [])]


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


def list_recent_errors(user_id: str, limit: int = 20) -> list:
    res = table.query(
        KeyConditionExpression=Key("PK").eq(user_pk(user_id)) & Key("SK").begins_with("ERROR#"),
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


def list_notes(user_id: str, limit: int = 50) -> list:
    res = table.query(
        KeyConditionExpression=Key("PK").eq(user_pk(user_id)) & Key("SK").begins_with("NOTE#"),
        ScanIndexForward=False,
        Limit=limit,
    )
    return [clean(i) for i in res.get("Items", [])]


def get_note(user_id: str, created_at: str, note_id: str) -> Optional[dict]:
    res = table.get_item(Key={"PK": user_pk(user_id), "SK": note_sk(created_at, note_id)})
    item = res.get("Item")
    return clean(item) if item else None


def delete_note(user_id: str, created_at: str, note_id: str) -> None:
    _delete(user_pk(user_id), note_sk(created_at, note_id))


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


def _count_chat_messages_by_session(user_id: str, session_ids: set[str]) -> dict[str, int]:
    if not session_ids:
        return {}

    counts = {session_id: 0 for session_id in session_ids}
    query_kwargs = {
        "KeyConditionExpression": Key("PK").eq(user_pk(user_id)) & Key("SK").begins_with("CHATMSG#"),
        "ScanIndexForward": True,
    }

    while True:
        res = table.query(**query_kwargs)
        for item in res.get("Items", []):
            session_id = item.get("sessionId")
            if session_id in counts:
                counts[session_id] += 1

        last_key = res.get("LastEvaluatedKey")
        if not last_key:
            return counts
        query_kwargs["ExclusiveStartKey"] = last_key


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


def list_chat_messages(user_id: str, session_id: str, limit: Optional[int] = None) -> list:
    if limit is not None and limit <= 0:
        return []

    messages = []
    query_kwargs = {
        "KeyConditionExpression": Key("PK").eq(user_pk(user_id)) & Key("SK").begins_with("CHATMSG#"),
        "ScanIndexForward": True,
    }
    if limit is not None:
        query_kwargs["Limit"] = limit

    while True:
        res = table.query(**query_kwargs)
        for item in res.get("Items", []):
            message = clean(item)
            if message.get("sessionId") == session_id:
                messages.append(message)
                if limit is not None and len(messages) >= limit:
                    return messages[:limit]

        last_key = res.get("LastEvaluatedKey")
        if not last_key:
            return messages
        query_kwargs["ExclusiveStartKey"] = last_key


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
) -> None:
    table.update_item(
        Key={"PK": user_pk(user_id), "SK": chat_session_sk(session_id)},
        UpdateExpression=(
            "SET analysis = :a, analysisCreatedAt = :t, analysisSavedNotes = :n, "
            "analysisSavedErrors = :e, analysisUpdatedSkills = :s, updatedAt = :u"
        ),
        ExpressionAttributeValues=to_dynamo(
            {
                ":a": analysis,
                ":t": analyzed_at,
                ":n": saved_notes,
                ":e": saved_errors,
                ":s": updated_skills,
                ":u": analyzed_at,
            }
        ),
    )


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
