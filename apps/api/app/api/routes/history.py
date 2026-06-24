import re

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import Identity, resolve_identity
from app.core.mastery import reverse_skill_from_error
from app.core.text_hash import normalized_text_hash
from app.db.repositories import (
    delete_error,
    delete_skill,
    delete_submission,
    delete_submission_hash,
    get_profile,
    get_submission,
    list_errors_for_submission,
    list_notes,
    list_recent_errors,
    list_recent_submissions,
    list_skills,
    now_iso,
    put_skill,
    save_profile,
)

router = APIRouter()


_BROKEN_TZ = re.compile(r" (\d{2}:\d{2})$")


def _fix_tz(value: str) -> str:
    """URL query parsers decode '+' as space; restore '+00:00' from ' 00:00'."""
    return _BROKEN_TZ.sub(r"+\1", value)


@router.get("/history/{user_id}")
def get_history(user_id: str, identity: Identity = Depends(resolve_identity)):
    return {
        "submissions": list_recent_submissions(identity.user_id, limit=20),
        "errors": list_recent_errors(identity.user_id, limit=20),
        "notes": list_notes(identity.user_id, limit=50),
    }


@router.delete("/history/{submission_id}")
def delete_history_entry(
    submission_id: str,
    createdAt: str,
    identity: Identity = Depends(resolve_identity),
):
    """Delete one submission and roll back its contribution to the weakness model.

    `createdAt` (the submission's ISO timestamp, which the client already has)
    pins the exact item. Each error this submission recorded is removed and its
    skill penalty reversed, so the learner profile reflects only kept writing.
    Identity is server-resolved, so a caller can only delete their own data.
    """
    user_id = identity.user_id
    createdAt = _fix_tz(createdAt)
    submission = get_submission(user_id, createdAt, submission_id)
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    now = now_iso()
    errors = list_errors_for_submission(user_id, createdAt, submission_id)
    skills_by_code = {s["skillCode"]: s for s in list_skills(user_id)}

    for err in errors:
        code = err.get("code")
        skill = skills_by_code.get(code)
        if skill:
            reverted = reverse_skill_from_error(skill, err.get("severity", "medium"), now)
            if int(reverted.get("errorCount", 0)) <= 0 and int(reverted.get("correctCount", 0)) <= 0:
                # Skill is back to pristine (no errors, never practiced) — drop the row.
                delete_skill(user_id, code)
                skills_by_code.pop(code, None)
            else:
                put_skill(reverted)
                skills_by_code[code] = reverted
        delete_error(user_id, err.get("createdAt", createdAt), err["id"])

    delete_submission(user_id, createdAt, submission_id)
    text_hash = submission.get("textHash") or normalized_text_hash(submission.get("originalText", ""))
    delete_submission_hash(user_id, text_hash)

    profile = get_profile(user_id)
    if profile:
        profile["totalSubmissions"] = max(0, int(profile.get("totalSubmissions", 0)) - 1)
        profile["updatedAt"] = now
        save_profile(profile)

    return {
        "deleted": True,
        "submissionId": submission_id,
        "removedErrors": len(errors),
        "updatedSkills": list(skills_by_code.values()),
        "profile": profile,
    }
