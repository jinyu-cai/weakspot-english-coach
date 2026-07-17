from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator

from app.models.common import OutputLanguage


InputSourceType = Literal[
    "series",
    "movie",
    "video",
    "podcast",
    "article",
    "book",
    "work",
    "conversation",
    "other",
]
InputLearningMode = Literal["grounded_capture", "attention_mission"]
InputLearningItemKind = Literal[
    "word",
    "phrase",
    "collocation",
    "grammar_pattern",
    "pronunciation",
    "culture",
]
InputLearningAttemptKind = Literal["retell", "required_reuse", "delayed_retrieval"]


class AnalyzeInputLearningRequest(BaseModel):
    """Create learning targets from supplied input or prepare an attention mission.

    ``userId`` is intentionally absent. The route always uses the authenticated
    or guest identity resolved on the server.
    """

    sourceType: InputSourceType
    title: str = Field(min_length=1, max_length=240)
    content: Optional[str] = Field(default=None, max_length=64000)
    transcript: Optional[str] = Field(default=None, max_length=64000)
    notes: Optional[str] = Field(default=None, max_length=32000)
    goal: Optional[str] = Field(default=None, max_length=800)
    targetItemCount: int = Field(default=6, ge=3, le=12)
    outputLanguage: OutputLanguage = "en"

    @field_validator("title")
    @classmethod
    def normalize_title(cls, value: str) -> str:
        normalized = " ".join(value.split())
        if not normalized:
            raise ValueError("title must not be blank")
        return normalized

    @field_validator("content", "transcript", "notes", "goal")
    @classmethod
    def blank_to_none(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None


class SubmitInputLearningAttemptRequest(BaseModel):
    kind: InputLearningAttemptKind
    responseText: str = Field(min_length=1, max_length=8000)
    targetItemIds: list[str] = Field(default_factory=list, max_length=6)
    clientAttemptId: str = Field(
        min_length=8,
        max_length=128,
        pattern=r"^[A-Za-z0-9][A-Za-z0-9._:-]*$",
    )
    hintUsed: bool = False

    @field_validator("responseText")
    @classmethod
    def normalize_response(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("responseText must not be blank")
        return normalized


class InputLearningAIItem(BaseModel):
    kind: InputLearningItemKind
    expression: str = Field(min_length=1, max_length=180)
    meaning: str = Field(min_length=1, max_length=600)
    whyUseful: str = Field(min_length=1, max_length=800)
    personalizedReason: str = Field(default="", max_length=800)
    example: str = Field(default="", max_length=800)
    sourceEvidence: Optional[str] = Field(default=None, max_length=300)


class AttentionMission(BaseModel):
    objective: str = Field(min_length=1, max_length=800)
    beforeYouStart: list[str] = Field(default_factory=list, max_length=8)
    focusTargets: list[str] = Field(default_factory=list, max_length=12)
    whileConsuming: list[str] = Field(default_factory=list, max_length=8)
    afterYouFinish: list[str] = Field(default_factory=list, max_length=8)


class InputLearningAIResult(BaseModel):
    summary: str = Field(min_length=1, max_length=1200)
    items: list[InputLearningAIItem] = Field(default_factory=list, max_length=12)
    attentionMission: Optional[AttentionMission] = None
