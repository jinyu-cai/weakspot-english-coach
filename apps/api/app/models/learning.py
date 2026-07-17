from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.taxonomy import ERROR_TAXONOMY


ActivityType = Literal[
    "diagnose",
    "coach",
    "practice",
    "plan",
    "input_learning",
    "chat",
    "vocabulary",
]
ActivityStatus = Literal[
    "assigned",
    "started",
    "completed",
    "abandoned",
    "skipped",
]
EvidenceOutcome = Literal[
    "success",
    "hinted_success",
    "failure",
    "avoided",
    "no_opportunity",
]
CoverageStatus = Literal["unassessed", "exploring", "enough_evidence"]


class CreateActivityRunRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    activityType: ActivityType
    sourceId: Optional[str] = Field(default=None, max_length=160)
    parentRunId: Optional[str] = Field(default=None, max_length=100)
    title: Optional[str] = Field(default=None, max_length=240)
    taskType: Optional[str] = Field(default=None, max_length=100)
    goal: Optional[str] = Field(default=None, max_length=800)
    targetSkills: list[str] = Field(default_factory=list, max_length=8)
    modality: Optional[str] = Field(default=None, max_length=60)
    difficulty: Optional[str] = Field(default=None, max_length=60)
    estimatedMinutes: Optional[int] = Field(default=None, ge=1, le=180)

    @field_validator("targetSkills")
    @classmethod
    def validate_skills(cls, value: list[str]) -> list[str]:
        invalid = [code for code in value if code not in ERROR_TAXONOMY]
        if invalid:
            raise ValueError(f"Unsupported skill code(s): {', '.join(invalid)}")
        return list(dict.fromkeys(value))


class UpdateActivityRunRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Optional[ActivityStatus] = None
    hintLevel: Optional[int] = Field(default=None, ge=0, le=4)
    playCount: Optional[int] = Field(default=None, ge=0, le=20)
    attemptCount: Optional[int] = Field(default=None, ge=0, le=100)
    completedCriteria: Optional[list[int]] = Field(default=None, max_length=20)
    skipReason: Optional[str] = Field(default=None, max_length=500)
    abandonReason: Optional[str] = Field(default=None, max_length=500)
    selfReportedDifficulty: Optional[Literal["too_easy", "right", "too_hard"]] = None


class RecordEvidenceRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    clientEventId: str = Field(
        min_length=8,
        max_length=128,
        pattern=r"^[A-Za-z0-9][A-Za-z0-9._:-]*$",
    )
    runId: Optional[str] = Field(default=None, max_length=100)
    sourceId: Optional[str] = Field(default=None, max_length=160)
    skillCode: str = Field(max_length=200)
    outcome: EvidenceOutcome
    opportunityPresent: bool
    supportLevel: int = Field(default=0, ge=0, le=4)
    modality: str = Field(default="exercise", min_length=1, max_length=60)
    taskType: str = Field(default="practice", min_length=1, max_length=100)
    taskDifficulty: float = Field(default=0.5, ge=0, le=1)
    evaluatorConfidence: float = Field(default=1.0, ge=0, le=1)
    contextKey: Optional[str] = Field(default=None, max_length=240)
    novelContext: bool = False
    delayed: bool = False
    evidenceQuote: str = Field(default="", max_length=600)

    @field_validator("skillCode")
    @classmethod
    def validate_skill(cls, value: str) -> str:
        if value not in ERROR_TAXONOMY:
            raise ValueError(f"Unsupported skill code: {value}")
        return value

    @field_validator("opportunityPresent")
    @classmethod
    def validate_opportunity(cls, value: bool, info):
        outcome = info.data.get("outcome")
        if outcome == "no_opportunity" and value:
            raise ValueError("no_opportunity cannot have opportunityPresent=true")
        if outcome != "no_opportunity" and not value:
            raise ValueError("A scored outcome requires opportunityPresent=true")
        return value
