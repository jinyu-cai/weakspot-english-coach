from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from app.core.taxonomy import ERROR_TAXONOMY
from app.db.repositories import (
    list_completed_activity_runs_since,
    list_evidence_events_since,
    list_learning_states,
    list_errors_since,
    list_practice_attempts_since,
    list_submissions_since,
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
        "minutesTracked": 0,
        "completedActivities": 0,
        "learningOpportunities": 0,
        "independentSuccesses": 0,
        "assistedSuccesses": 0,
        "failedOpportunities": 0,
        "noOpportunities": 0,
        "delayedTransfers": 0,
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
    start_utc = datetime.combine(start_local, datetime.min.time(), tzinfo=tz).astimezone(timezone.utc)
    start_utc_text = start_utc.isoformat().replace("+00:00", "Z")
    day_map = {
        (start_local + timedelta(days=offset)).isoformat(): _day_template(start_local + timedelta(days=offset))
        for offset in range(days)
    }
    score_map: dict[str, list[int]] = {day: [] for day in day_map}

    submissions = list_submissions_since(user_id, start_utc_text)
    errors = list_errors_since(user_id, start_utc_text)
    attempts = list_practice_attempts_since(user_id, start_utc_text)
    runs = list_completed_activity_runs_since(user_id, start_utc_text)
    evidence_events = list_evidence_events_since(user_id, start_utc_text)
    learning_states = list_learning_states(user_id)

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

    for run in runs:
        if run.get("status") != "completed" or not run.get("completedAt"):
            continue
        day = local_date_for(str(run["completedAt"]), tz.key)
        if day not in day_map:
            continue
        day_map[day]["completedActivities"] += 1
        if run.get("startedAt"):
            try:
                elapsed = (
                    parse_iso_datetime(str(run["completedAt"]))
                    - parse_iso_datetime(str(run["startedAt"]))
                ).total_seconds() / 60
                cap = max(1, int(run.get("estimatedMinutes") or 15) * 2)
                day_map[day]["minutesTracked"] += round(max(0, min(elapsed, cap)))
            except (TypeError, ValueError):
                pass

    for event in evidence_events:
        created_at = event.get("createdAt")
        if not created_at:
            continue
        day = local_date_for(str(created_at), tz.key)
        if day not in day_map:
            continue
        outcome = str(event.get("outcome") or "")
        if event.get("opportunityPresent"):
            day_map[day]["learningOpportunities"] += 1
            if outcome == "success" and int(event.get("supportLevel", 0)) == 0:
                day_map[day]["independentSuccesses"] += 1
                if event.get("delayed") and event.get("novelContext"):
                    day_map[day]["delayedTransfers"] += 1
            elif outcome == "hinted_success" or int(event.get("supportLevel", 0)) > 0:
                day_map[day]["assistedSuccesses"] += 1
            elif outcome in {"failure", "avoided"}:
                day_map[day]["failedOpportunities"] += 1
        else:
            day_map[day]["noOpportunities"] += 1

    weekly = []
    for day in sorted(day_map):
        row = day_map[day]
        row["averageScore"] = _score_average(score_map[day])
        row["minutesEstimated"] = row["minutesTracked"] or row["checkins"] * 4 + row["practiceAttempts"] * 3
        row["active"] = (
            row["checkins"] > 0
            or row["practiceAttempts"] > 0
            or row["completedActivities"] > 0
        )
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
        "minutesTracked": sum(row["minutesTracked"] for row in weekly),
        "completedActivities": sum(row["completedActivities"] for row in weekly),
        "learningOpportunities": sum(row["learningOpportunities"] for row in weekly),
        "independentSuccesses": sum(row["independentSuccesses"] for row in weekly),
        "assistedSuccesses": sum(row["assistedSuccesses"] for row in weekly),
        "failedOpportunities": sum(row["failedOpportunities"] for row in weekly),
        "noOpportunities": sum(row["noOpportunities"] for row in weekly),
        "delayedTransfers": sum(row["delayedTransfers"] for row in weekly),
    }
    successful = summary["independentSuccesses"] + summary["assistedSuccesses"]
    exploring_count = sum(1 for state in learning_states if state.get("coverageStatus") == "exploring")
    enough_count = sum(1 for state in learning_states if state.get("coverageStatus") == "enough_evidence")
    coverage = {
        "unassessed": max(0, len(ERROR_TAXONOMY) - exploring_count - enough_count),
        "exploring": exploring_count,
        "enoughEvidence": enough_count,
        "tracked": len(learning_states),
        "total": len(ERROR_TAXONOMY),
    }

    return {
        "timezone": tz.key,
        "today": today,
        "weekly": weekly,
        "summary": summary,
        "achievements": _achievements(summary, today),
        "nextBestAction": _next_best_action(today),
        "learning": {
            "coverage": coverage,
            "assistanceRate": round(summary["assistedSuccesses"] / successful * 100) if successful else 0,
            "independentSuccesses": summary["independentSuccesses"],
            "assistedSuccesses": summary["assistedSuccesses"],
            "failedOpportunities": summary["failedOpportunities"],
            "noOpportunities": summary["noOpportunities"],
            "delayedTransfers": summary["delayedTransfers"],
        },
        "generatedAt": now_iso(),
    }
