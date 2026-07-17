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


def submission_hash_sk(text_hash: str) -> str:
    return f"SUBHASH#{text_hash}"


def active_plan_sk() -> str:
    return "PLAN#ACTIVE"


def exercise_sk(exercise_id: str) -> str:
    return f"EXERCISE#{exercise_id}"


def attempt_sk(created_at: str, attempt_id: str) -> str:
    return f"ATTEMPT#{created_at}#{attempt_id}"


def note_sk(created_at: str, note_id: str) -> str:
    return f"NOTE#{created_at}#{note_id}"


def chat_session_sk(session_id: str) -> str:
    return f"CHAT#{session_id}"


def chat_message_sk(created_at: str, message_id: str, session_id: str | None = None) -> str:
    if session_id:
        return f"CHATMSG#{session_id}#{created_at}#{message_id}"
    return f"CHATMSG#{created_at}#{message_id}"


def memory_sk(memory_id: str) -> str:
    return f"MEMORY#{memory_id}"


def memory_trace_sk(created_at: str, trace_id: str) -> str:
    return f"MEMTRACE#{created_at}#{trace_id}"


def activity_run_sk(run_id: str) -> str:
    return f"RUN#{run_id}"


def activity_completion_time_sk(completed_at: str, run_id: str) -> str:
    return f"RUN_TIME#{completed_at}#{run_id}"


def evidence_event_sk(event_id: str) -> str:
    return f"EVIDENCE#{event_id}"


def evidence_event_time_sk(created_at: str, event_id: str) -> str:
    return f"EVIDENCE_TIME#{created_at}#{event_id}"


def learning_state_sk(skill_code: str) -> str:
    return f"LEARNING#{skill_code}"
