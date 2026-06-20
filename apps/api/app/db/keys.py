def user_pk(user_id: str) -> str:
    return f"USER#{user_id}"


def profile_sk() -> str:
    return "PROFILE"


def skill_sk(skill_code: str) -> str:
    return f"SKILL#{skill_code}"


def submission_sk(created_at: str, submission_id: str) -> str:
    return f"SUBMISSION#{created_at}#{submission_id}"


def error_sk(created_at: str, error_id: str) -> str:
    return f"ERROR#{created_at}#{error_id}"


def active_plan_sk() -> str:
    return "PLAN#ACTIVE"


def exercise_sk(exercise_id: str) -> str:
    return f"EXERCISE#{exercise_id}"


def attempt_sk(created_at: str, attempt_id: str) -> str:
    return f"ATTEMPT#{created_at}#{attempt_id}"
