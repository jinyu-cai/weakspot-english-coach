from typing import Optional

from app.core.mastery import DEFAULT_MASTERY
from app.db.repositories import (
    get_or_create_profile,
    list_recent_errors,
    list_recent_submissions,
    list_skills,
)


def build_profile_overview(user_id: str) -> dict:
    """Aggregate everything the dashboard / profile page needs in one call."""
    return {
        "profile": get_or_create_profile(user_id),
        "skills": list_skills(user_id),
        "recentErrors": list_recent_errors(user_id, limit=10),
        "recentSubmissions": list_recent_submissions(user_id, limit=10),
    }


def weakest_skill_code(user_id: str) -> Optional[str]:
    """Return the skillCode with the lowest mastery, or None if no skills yet."""
    skills = list_skills(user_id)
    if not skills:
        return None
    weakest = min(skills, key=lambda s: float(s.get("mastery", DEFAULT_MASTERY)))
    return weakest.get("skillCode")
