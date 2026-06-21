from datetime import datetime, timezone
from typing import Optional

from boto3.dynamodb.conditions import Key

from app.db.dynamodb import table
from app.db.keys import (
    active_plan_sk,
    attempt_sk,
    error_sk,
    exercise_sk,
    profile_sk,
    skill_sk,
    submission_sk,
    user_pk,
)
from app.db.serialization import clean, to_dynamo


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _put(item: dict) -> None:
    table.put_item(Item=to_dynamo(item))


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
