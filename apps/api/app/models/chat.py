from typing import Annotated, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, ValidationInfo, field_validator

from app.models.common import OutputLanguage, Severity
from app.models.coach import CoachScenarioFamily
from app.models.memory import MemoryCandidate
from app.models.diagnostic import TargetEvidenceAI
from app.core.taxonomy import ERROR_TAXONOMY


RealtimeVoiceModel = Literal["gpt-realtime-mini-2025-12-15", "gpt-realtime-2"]
TextChatModelMode = Literal["fast", "deep"]
CHAT_MESSAGE_MAX_CHARACTERS = 12_000
EVIDENCE_QUOTE_MAX_CHARACTERS = 600


class ChatCreateSessionRequest(BaseModel):
    userId: str
    topic: Optional[str] = Field(default=None, max_length=300)
    scenarioPrompt: Optional[str] = Field(default=None, max_length=4000)
    starterMessage: Optional[str] = Field(default=None, max_length=1200)
    scenarioFamily: Optional[CoachScenarioFamily] = None
    scenarioKey: Optional[str] = Field(default=None, max_length=160)
    textModel: Optional[str] = Field(default=None, max_length=200)
    # Optional for backwards compatibility. Older clients used the server Fast
    # slot (or the BYOK primary model) and should retain that behavior.
    textModelMode: Optional[TextChatModelMode] = None
    missionRunId: Optional[str] = Field(default=None, max_length=100)
    missionType: Optional[str] = Field(default=None, max_length=100)
    missionTargetSkills: List[str] = Field(default_factory=list, max_length=4)

    @field_validator("missionTargetSkills")
    @classmethod
    def validate_mission_skills(cls, value: List[str]) -> List[str]:
        invalid = [skill for skill in value if skill not in ERROR_TAXONOMY]
        if invalid:
            raise ValueError(f"Unsupported mission target skill(s): {', '.join(invalid)}")
        return list(dict.fromkeys(value))


class ChatSendRequest(BaseModel):
    userId: str
    sessionId: str
    text: str = Field(min_length=1, max_length=CHAT_MESSAGE_MAX_CHARACTERS)
    clientMessageId: Optional[str] = Field(
        default=None,
        min_length=8,
        max_length=128,
        pattern=r"^[A-Za-z0-9][A-Za-z0-9._:-]*$",
    )


class ChatPredictRequest(BaseModel):
    userId: str
    sessionId: str
    partialText: str = Field(
        min_length=1,
        max_length=CHAT_MESSAGE_MAX_CHARACTERS,
    )


class AnalyzeSessionRequest(BaseModel):
    outputLanguage: OutputLanguage = "en"
    # The UI reports the highest progressive hint revealed in this mission.
    # A non-zero value can only make mastery attribution more conservative.
    hintLevel: int = Field(default=0, ge=0, le=4)


class CorrectionAI(BaseModel):
    original: str
    corrected: str
    explanationZh: str


class BetterExpressionAI(BaseModel):
    original: str
    natural: str
    explanationZh: str


class ChatReplyAI(BaseModel):
    reply: str
    corrections: List[CorrectionAI] = []
    betterExpression: Optional[BetterExpressionAI] = None
    memoryCandidates: List[MemoryCandidate] = Field(default_factory=list)
    practiceOpportunityCreated: bool = Field(
        description=(
            "Internal conservative acknowledgement that an optional hidden one-turn instruction "
            "was actually used to create a fair opportunity in the next learner response."
        ),
    )


class ChatPredictionAI(BaseModel):
    predictions: List[str] = Field(min_length=1, max_length=3)


# ---- Session analysis (end-of-conversation) ----

class SessionCorrectionAI(BaseModel):
    code: str
    category: str
    severity: Severity
    original: str
    corrected: str
    explanationZh: str
    microLessonZh: str
    practiceGoal: str

    @field_validator("code")
    @classmethod
    def validate_error_code(cls, value: str) -> str:
        if value not in ERROR_TAXONOMY:
            raise ValueError(f"Unsupported session correction code: {value}")
        return value


class SessionNaturalExpressionAI(BaseModel):
    original: str
    natural: str
    explanationZh: str
    context: str
    examples: List[str] = Field(default_factory=list, max_length=2)

    @field_validator("examples", mode="before")
    @classmethod
    def cap_examples(cls, value):
        return value[:2] if isinstance(value, list) else value

class SessionWeaknessAI(BaseModel):
    code: str
    category: str
    severity: str
    evidenceQuote: str = Field(max_length=EVIDENCE_QUOTE_MAX_CHARACTERS)
    explanationZh: str
    practiceGoal: str

    @field_validator("code")
    @classmethod
    def validate_error_code(cls, value: str) -> str:
        if value not in ERROR_TAXONOMY:
            raise ValueError(f"Unsupported session weakness code: {value}")
        return value

    @field_validator("evidenceQuote", mode="before")
    @classmethod
    def bound_evidence_quote(cls, value):
        return value[:EVIDENCE_QUOTE_MAX_CHARACTERS] if isinstance(value, str) else value


class StealthProbeAssessmentAI(BaseModel):
    """End-of-session evidence gate for a hidden practice opportunity."""

    probeId: Optional[str] = None
    opportunityPresent: bool
    outcome: Literal[
        "success",
        "hinted_success",
        "failure",
        "avoided",
        "no_opportunity",
    ]
    evidenceQuote: str = Field(default="", max_length=EVIDENCE_QUOTE_MAX_CHARACTERS)
    rationale: str = ""
    confidence: float = Field(default=0.0, ge=0, le=1)
    hintLevel: int = Field(default=0, ge=0, le=4)

    @field_validator("evidenceQuote", mode="before")
    @classmethod
    def bound_evidence_quote(cls, value):
        return value[:EVIDENCE_QUOTE_MAX_CHARACTERS] if isinstance(value, str) else value


class SessionAnalysisAI(BaseModel):
    summaryZh: str
    # Bounded collections keep analysis storage and responses predictable even
    # if a provider tries to over-generate.
    corrections: List[SessionCorrectionAI] = Field(default_factory=list, max_length=12)
    naturalExpressions: List[SessionNaturalExpressionAI] = Field(default_factory=list, max_length=8)
    weaknesses: List[SessionWeaknessAI] = Field(default_factory=list, max_length=6)
    strengthsZh: List[str] = Field(default_factory=list, max_length=5)
    recommendedNextActionsZh: List[str] = Field(default_factory=list, max_length=5)
    memoryCandidates: List[MemoryCandidate] = Field(default_factory=list, max_length=8)
    stealthProbeAssessments: List[StealthProbeAssessmentAI] = Field(
        default_factory=list,
        max_length=3,
    )
    # Kept for realtime voice and analysis drafts created before multi-target
    # text chat. New text analyses use ``stealthProbeAssessments``.
    stealthProbeAssessment: Optional[StealthProbeAssessmentAI] = None
    targetEvidence: List[TargetEvidenceAI] = Field(default_factory=list, max_length=4)

    @field_validator(
        "corrections",
        "naturalExpressions",
        "weaknesses",
        "strengthsZh",
        "recommendedNextActionsZh",
        "memoryCandidates",
        "targetEvidence",
        mode="before",
    )
    @classmethod
    def cap_generated_collections(cls, value, info: ValidationInfo):
        limits = {
            "corrections": 12,
            "naturalExpressions": 8,
            "weaknesses": 6,
            "strengthsZh": 5,
            "recommendedNextActionsZh": 5,
            "memoryCandidates": 8,
            "targetEvidence": 4,
        }
        return value[:limits[info.field_name]] if isinstance(value, list) else value


SessionAnalysisShortText = Annotated[str, Field(min_length=1, max_length=300)]
SessionAnalysisEvidenceText = Annotated[
    str,
    Field(min_length=1, max_length=EVIDENCE_QUOTE_MAX_CHARACTERS),
]


class SessionCorrectionPlanAI(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: str
    severity: Severity
    original: SessionAnalysisEvidenceText
    corrected: SessionAnalysisEvidenceText
    teachingNote: SessionAnalysisShortText
    practiceGoal: SessionAnalysisShortText

    @field_validator("code")
    @classmethod
    def validate_error_code(cls, value: str) -> str:
        if value not in ERROR_TAXONOMY:
            raise ValueError(f"Unsupported session correction code: {value}")
        return value


class SessionNaturalExpressionPlanAI(BaseModel):
    model_config = ConfigDict(extra="forbid")

    original: SessionAnalysisEvidenceText
    natural: SessionAnalysisEvidenceText
    teachingNote: SessionAnalysisShortText
    context: SessionAnalysisShortText
    example: SessionAnalysisShortText


class SessionWeaknessPlanAI(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: str
    severity: Severity
    evidenceQuote: SessionAnalysisEvidenceText
    teachingNote: SessionAnalysisShortText
    practiceGoal: SessionAnalysisShortText

    @field_validator("code")
    @classmethod
    def validate_error_code(cls, value: str) -> str:
        if value not in ERROR_TAXONOMY:
            raise ValueError(f"Unsupported session weakness code: {value}")
        return value


class SessionMemoryPlanAI(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Literal["preference", "goal", "strategy", "weakness", "episode"]
    canonicalKey: str = Field(min_length=3, max_length=160)
    content: str = Field(min_length=3, max_length=500)
    evidence: str = Field(max_length=500)
    confidence: float = Field(ge=0, le=1)
    importance: float = Field(ge=0, le=1)
    expiresInDays: Optional[int] = Field(ge=1, le=3650)


class SessionProbeAssessmentPlanAI(BaseModel):
    model_config = ConfigDict(extra="forbid")

    probeId: Optional[str]
    opportunityPresent: bool
    outcome: Literal[
        "success",
        "hinted_success",
        "failure",
        "avoided",
        "no_opportunity",
    ]
    evidenceQuote: str = Field(max_length=EVIDENCE_QUOTE_MAX_CHARACTERS)
    rationale: str = Field(max_length=300)
    confidence: float = Field(ge=0, le=1)
    hintLevel: int = Field(ge=0, le=4)


class SessionTargetEvidencePlanAI(BaseModel):
    model_config = ConfigDict(extra="forbid")

    skillCode: str
    opportunityPresent: bool
    outcome: Literal["success", "failure", "avoided", "no_opportunity"]
    evidenceQuote: str = Field(max_length=EVIDENCE_QUOTE_MAX_CHARACTERS)
    confidence: float = Field(ge=0, le=1)

    @field_validator("skillCode")
    @classmethod
    def validate_skill_code(cls, value: str) -> str:
        if value not in ERROR_TAXONOMY:
            raise ValueError(f"Unsupported session target code: {value}")
        return value


class SessionAnalysisPlanAI(BaseModel):
    """Compact MAX-reasoning result expanded into the public analysis shape."""

    model_config = ConfigDict(extra="forbid")

    summary: str = Field(min_length=1, max_length=500)
    corrections: List[SessionCorrectionPlanAI] = Field(max_length=4)
    naturalExpressions: List[SessionNaturalExpressionPlanAI] = Field(max_length=2)
    weaknesses: List[SessionWeaknessPlanAI] = Field(max_length=3)
    strengths: List[SessionAnalysisShortText] = Field(max_length=2)
    nextActions: List[SessionAnalysisShortText] = Field(max_length=2)
    memoryCandidates: List[SessionMemoryPlanAI] = Field(max_length=2)
    stealthProbeAssessments: List[SessionProbeAssessmentPlanAI] = Field(max_length=3)
    targetEvidence: List[SessionTargetEvidencePlanAI] = Field(max_length=4)
