from typing import List, Literal, Optional

from pydantic import BaseModel, Field, ValidationInfo, field_validator

from app.models.common import OutputLanguage, Severity
from app.models.coach import CoachScenarioFamily
from app.models.memory import MemoryCandidate


RealtimeVoiceModel = Literal["gpt-realtime-mini-2025-12-15", "gpt-realtime-2"]
TextChatModelMode = Literal["fast", "deep"]


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


class ChatSendRequest(BaseModel):
    userId: str
    sessionId: str
    text: str = Field(min_length=1)


class ChatPredictRequest(BaseModel):
    userId: str
    sessionId: str
    partialText: str = Field(min_length=1)


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
    evidenceQuote: str
    explanationZh: str
    practiceGoal: str


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
    evidenceQuote: str = ""
    rationale: str = ""
    confidence: float = Field(default=0.0, ge=0, le=1)
    hintLevel: int = Field(default=0, ge=0, le=4)


class SessionAnalysisAI(BaseModel):
    summaryZh: str
    # Bounded collections keep the atomic DynamoDB finalization below its
    # 100-item transaction limit even if a provider tries to over-generate.
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

    @field_validator(
        "corrections",
        "naturalExpressions",
        "weaknesses",
        "strengthsZh",
        "recommendedNextActionsZh",
        "memoryCandidates",
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
        }
        return value[:limits[info.field_name]] if isinstance(value, list) else value
