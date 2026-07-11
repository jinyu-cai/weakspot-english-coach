from typing import List, Literal, Optional

from pydantic import BaseModel, Field

from app.models.common import OutputLanguage, Severity
from app.models.memory import MemoryCandidate


RealtimeVoiceModel = Literal["gpt-realtime-mini-2025-12-15", "gpt-realtime-2"]


class ChatCreateSessionRequest(BaseModel):
    userId: str
    topic: Optional[str] = None
    scenarioPrompt: Optional[str] = None
    textModel: Optional[str] = None


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

class SessionAnalysisAI(BaseModel):
    summaryZh: str
    corrections: List[SessionCorrectionAI] = []
    naturalExpressions: List[SessionNaturalExpressionAI] = []
    weaknesses: List[SessionWeaknessAI] = []
    strengthsZh: List[str] = []
    recommendedNextActionsZh: List[str] = []
    memoryCandidates: List[MemoryCandidate] = Field(default_factory=list)
