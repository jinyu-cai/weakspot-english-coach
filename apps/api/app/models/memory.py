from typing import Literal, Optional

from pydantic import BaseModel, Field


MemoryKind = Literal["preference", "goal", "strategy", "weakness", "episode"]
MemoryStatus = Literal["active", "resolved", "superseded", "expired", "forgotten"]
MemorySourceType = Literal[
    "manual",
    "diagnosis",
    "chat",
    "chat_import",
    "session_analysis",
    "practice",
    "input_learning",
    "system",
]


class MemoryCandidate(BaseModel):
    """A durable learner fact proposed by Qwen or a deterministic signal.

    Candidates are deliberately conservative: callers persist only facts that
    are explicit, useful across sessions, and sufficiently confident.
    """

    kind: MemoryKind
    canonicalKey: str = Field(min_length=3, max_length=160)
    content: str = Field(min_length=3, max_length=800)
    evidence: str = Field(default="", max_length=800)
    confidence: float = Field(default=0.8, ge=0, le=1)
    importance: float = Field(default=0.6, ge=0, le=1)
    expiresInDays: Optional[int] = Field(default=None, ge=1, le=3650)


class CreateMemoryRequest(BaseModel):
    userId: Optional[str] = None
    kind: MemoryKind
    canonicalKey: Optional[str] = Field(default=None, max_length=160)
    content: str = Field(min_length=3, max_length=800)
    evidence: str = Field(default="", max_length=800)
    confidence: float = Field(default=1.0, ge=0, le=1)
    importance: float = Field(default=0.8, ge=0, le=1)
    pinned: bool = False
    expiresInDays: Optional[int] = Field(default=None, ge=1, le=3650)


class UpdateMemoryRequest(BaseModel):
    content: Optional[str] = Field(default=None, min_length=3, max_length=800)
    evidence: Optional[str] = Field(default=None, max_length=800)
    confidence: Optional[float] = Field(default=None, ge=0, le=1)
    importance: Optional[float] = Field(default=None, ge=0, le=1)
    pinned: Optional[bool] = None
    expiresInDays: Optional[int] = Field(default=None, ge=1, le=3650)


class RetrieveMemoryRequest(BaseModel):
    userId: Optional[str] = None
    query: str = Field(min_length=1, max_length=2000)
    tokenBudget: int = Field(default=700, ge=100, le=2000)
    limit: int = Field(default=6, ge=1, le=20)
