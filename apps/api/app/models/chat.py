from typing import List, Literal, Optional

from pydantic import BaseModel, Field

from app.models.common import OutputLanguage, Severity
from app.models.coach import CoachScenarioFamily
from app.models.memory import MemoryCandidate


RealtimeVoiceModel = Literal["gpt-realtime-mini-2025-12-15", "gpt-realtime-2"]


class ChatCreateSessionRequest(BaseModel):
    userId: str
    topic: Optional[str] = Field(default=None, max_length=300)
    scenarioPrompt: Optional[str] = Field(default=None, max_length=4000)
    starterMessage: Optional[str] = Field(default=None, max_length=1200)
    scenarioFamily: Optional[CoachScenarioFamily] = None
    scenarioKey: Optional[str] = Field(default=None, max_length=160)
    textModel: Optional[str] = Field(default=None, max_length=200)


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
    examples: List[str] = Field(default_factory=list)

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
    corrections: List[SessionCorrectionAI] = Field(default_factory=list, max_length=20)
    naturalExpressions: List[SessionNaturalExpressionAI] = Field(default_factory=list, max_length=20)
    weaknesses: List[SessionWeaknessAI] = Field(default_factory=list, max_length=20)
    strengthsZh: List[str] = Field(default_factory=list, max_length=20)
    recommendedNextActionsZh: List[str] = Field(default_factory=list, max_length=20)
    memoryCandidates: List[MemoryCandidate] = Field(default_factory=list, max_length=20)
    stealthProbeAssessments: List[StealthProbeAssessmentAI] = Field(
        default_factory=list,
        max_length=3,
    )
    # Kept for realtime voice and analysis drafts created before multi-target
    # text chat. New text analyses use ``stealthProbeAssessments``.
    stealthProbeAssessment: Optional[StealthProbeAssessmentAI] = None
