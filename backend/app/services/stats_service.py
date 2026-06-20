from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from app.db.repositories import (
    list_recent_errors,
    list_recent_practice_attempts,
    list_recent_submissions,
    now_iso,
)


def resolve_timezone(tz_name: str | None) -> ZoneInfo:
    if not tz_name:
        return ZoneInfo("UTC")
    try:
        return ZoneInfo(tz_name)
    except ZoneInfoNotFoundError:
        return ZoneInfo("UTC")


def parse_iso_datetime(value: str) -> datetime:
    normalized = value.replace("Z", "+00:00")
    parsed = datetime.fromisoformat(normalized)
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed


def local_date_for(created_at: str, tz_name: str | None) -> str:
    tz = resolve_timezone(tz_name)
    return parse_iso_datetime(created_at).astimezone(tz).date().isoformat()


def _day_template(day: date) -> dict:
    return {
        "date": day.isoformat(),
        "checkins": 0,
        "practiceAttempts": 0,
        "correctAttempts": 0,
        "averageScore": 0,
        "errorsFound": 0,
        "minutesEstimated": 0,
        "active": False,
    }


def _score_average(scores: list[int]) -> int:
    return round(sum(scores) / len(scores)) if scores else 0


def _achievements(summary: dict, today: dict) -> list[dict]:
    achievement_defs = [
        {
            "id": "first-checkin",
            "title": "First Check-in",
            "description": "Complete one English check-in.",
            "progress": min(summary["totalCheckins"], 1),
            "target": 1,
        },
        {
            "id": "three-day-streak",
            "title": "3-Day Warm Streak",
            "description": "Learn on three days in a row.",
            "progress": min(summary["streakDays"], 3),
            "target": 3,
        },
        {
            "id": "practice-spark",
            "title": "Practice Spark",
            "description": "Finish five practice attempts.",
            "progress": min(summary["totalPracticeAttempts"], 5),
            "target": 5,
        },
        {
            "id": "sunny-score",
            "title": "Sunny Score",
            "description": "Reach an average practice score of 80.",
            "progress": min(summary["averageScore"], 80),
            "target": 80,
        },
        {
            "id": "today-winner",
            "title": "Today’s Win",
            "description": "Do any check-in or practice today.",
            "progress": 1 if today["active"] else 0,
            "target": 1,
        },
    ]
    return [
        {
            **achievement,
            "unlocked": achievement["progress"] >= achievement["target"],
        }
        for achievement in achievement_defs
    ]


def _next_best_action(today: dict) -> dict:
    if today["checkins"] == 0:
        return {
            "title": "Start with a gentle check-in",
            "description": "Paste a short paragraph and let WeakSpot find today’s learning clues.",
            "href": "/",
        }
    if today["practiceAttempts"] == 0:
        return {
            "title": "Turn today’s clues into practice",
            "description": "Do a short targeted exercise while the pattern is fresh.",
            "href": "/practice",
        }
    return {
        "title": "Review your growth map",
        "description": "See which skill moved and choose the next small step.",
        "href": "/dashboard",
    }


def build_daily_stats(user_id: str, timezone_name: str | None = None, days: int = 7) -> dict:
    days = max(1, min(days, 30))
    tz = resolve_timezone(timezone_name)
    today_local = datetime.now(timezone.utc).astimezone(tz).date()
    start_local = today_local - timedelta(days=days - 1)
    day_map = {
        (start_local + timedelta(days=offset)).isoformat(): _day_template(start_local + timedelta(days=offset))
        for offset in range(days)
    }
    score_map: dict[str, list[int]] = {day: [] for day in day_map}

    submissions = list_recent_submissions(user_id, limit=500)
    errors = list_recent_errors(user_id, limit=500)
    attempts = list_recent_practice_attempts(user_id, limit=500)

    for submission in submissions:
        day = local_date_for(submission["createdAt"], tz.key)
        if day in day_map:
            day_map[day]["checkins"] += 1

    for error in errors:
        day = local_date_for(error["createdAt"], tz.key)
        if day in day_map:
            day_map[day]["errorsFound"] += 1

    for attempt in attempts:
        day = local_date_for(attempt["createdAt"], tz.key)
        if day in day_map:
            day_map[day]["practiceAttempts"] += 1
            if attempt.get("isCorrect"):
                day_map[day]["correctAttempts"] += 1
            score = attempt.get("score")
            if isinstance(score, (int, float)):
                score_map[day].append(int(score))

    weekly = []
    for day in sorted(day_map):
        row = day_map[day]
        row["averageScore"] = _score_average(score_map[day])
        row["minutesEstimated"] = row["checkins"] * 4 + row["practiceAttempts"] * 3
        row["active"] = row["checkins"] > 0 or row["practiceAttempts"] > 0
        weekly.append(row)

    today = day_map[today_local.isoformat()]
    active_days = sum(1 for row in weekly if row["active"])
    streak = 0
    cursor = today_local
    while cursor.isoformat() in day_map and day_map[cursor.isoformat()]["active"]:
        streak += 1
        cursor -= timedelta(days=1)

    all_scores = [score for scores in score_map.values() for score in scores]
    summary = {
        "days": days,
        "activeDays": active_days,
        "streakDays": streak,
        "totalCheckins": sum(row["checkins"] for row in weekly),
        "totalPracticeAttempts": sum(row["practiceAttempts"] for row in weekly),
        "totalCorrectAttempts": sum(row["correctAttempts"] for row in weekly),
        "totalErrorsFound": sum(row["errorsFound"] for row in weekly),
        "averageScore": _score_average(all_scores),
        "minutesEstimated": sum(row["minutesEstimated"] for row in weekly),
    }

    return {
        "timezone": tz.key,
        "today": today,
        "weekly": weekly,
        "summary": summary,
        "achievements": _achievements(summary, today),
        "nextBestAction": _next_best_action(today),
        "generatedAt": now_iso(),
    }
