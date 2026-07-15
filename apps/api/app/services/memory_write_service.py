"""Learner-scoped, re-entrant and fenced MemoryAgent write leases."""

from __future__ import annotations

from contextlib import contextmanager
from contextvars import ContextVar
from functools import wraps
from inspect import signature
import time
from typing import Callable, Iterator, Optional, TypeVar
from uuid import uuid4

from app.db.repositories import (
    MemoryWriteClaimLostError,
    claim_memory_write_lease,
    release_memory_write_lease,
    save_memory as save_memory_unfenced,
    save_memory_with_memory_write_lease,
)


class MemoryWriteBusyError(RuntimeError):
    """Another request currently owns this learner's memory writer lease."""


_CURRENT_LEASE: ContextVar[Optional[tuple[str, str]]] = ContextVar(
    "memory_write_lease",
    default=None,
)


def current_memory_write_claim(user_id: str) -> Optional[str]:
    current = _CURRENT_LEASE.get()
    if current and current[0] == user_id:
        return current[1]
    return None


@contextmanager
def memory_write_lease(
    user_id: str,
    *,
    wait_timeout_seconds: float = 3.0,
) -> Iterator[str]:
    """Acquire once per call tree and reuse the token for nested memory work."""
    current = _CURRENT_LEASE.get()
    if current:
        if current[0] != user_id:
            raise MemoryWriteBusyError(
                "One request cannot mutate memory for multiple learners."
            )
        yield current[1]
        return

    claim_id = f"mwl_{uuid4().hex}"
    deadline = time.monotonic() + max(0.0, wait_timeout_seconds)
    while not claim_memory_write_lease(user_id, claim_id):
        if time.monotonic() >= deadline:
            raise MemoryWriteBusyError(
                "Learner memory is being updated by another request; retry shortly."
            )
        time.sleep(0.02)
    reset_token = _CURRENT_LEASE.set((user_id, claim_id))
    try:
        yield claim_id
    finally:
        _CURRENT_LEASE.reset(reset_token)
        release_memory_write_lease(user_id, claim_id)


def save_memory(memory: dict) -> None:
    """Persist through the active lease, falling back only for seed/admin code."""
    claim_id = current_memory_write_claim(str(memory.get("userId") or ""))
    if claim_id:
        save_memory_with_memory_write_lease(memory, claim_id)
        return
    save_memory_unfenced(memory)


F = TypeVar("F", bound=Callable)


def memory_write_locked(function: F) -> F:
    """Wrap a public read-modify-write operation in the re-entrant lease."""
    function_signature = signature(function)

    @wraps(function)
    def wrapped(*args, **kwargs):
        bound = function_signature.bind_partial(*args, **kwargs)
        user_id = str(bound.arguments.get("user_id") or "")
        if not user_id:
            raise ValueError("A learner id is required for memory writes.")
        with memory_write_lease(user_id):
            return function(*args, **kwargs)

    return wrapped  # type: ignore[return-value]


__all__ = [
    "MemoryWriteBusyError",
    "MemoryWriteClaimLostError",
    "current_memory_write_claim",
    "memory_write_lease",
    "memory_write_locked",
    "save_memory",
]
