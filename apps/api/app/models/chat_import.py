from typing import List, Literal, Optional

from pydantic import BaseModel, Field

from app.models.common import CEFRLevel, Severity


ChatRole = Literal["user", "assistant"]
EvidenceType = Literal["user_error", "expression_gap", "assistant_correction", "assistant_advice"]


class ImportedChatMessage(BaseModel):
    role: ChatRole
    text: str = Field(min_length=1)
    createdAt: Optional[str] = None


class ImportedChatConversation(BaseModel):
    id: Optional[str] = None
    title: Optional[str] = None
    messages: List[ImportedChatMessage] = Field(min_length=1, max_length=120)


class ChatImportAnalyzeRequest(BaseModel):
    userId: str
    sourceName: Optional[str] = Field(default=None, max_length=180)
    analysisMode: Literal["fast", "deep"] = "fast"
    conversations: List[ImportedChatConversation] = Field(min_length=1, max_length=20)


class ChatWeaknessAI(BaseModel):
    code: str
    category: str
    severity: Severity
    evidenceType: EvidenceType
    evidenceQuote: str
    suggestedBetterEnglish: str
    explanationZh: str
    microLessonZh: str
    practiceGoal: str
    confidence: float = Field(ge=0, le=1)


class ChatImportAIResult(BaseModel):
    cefrEstimate: CEFRLevel
    overallScore: int = Field(ge=0, le=100)
    summaryZh: str
    strengthsZh: List[str]
    topBlindSpotsZh: List[str]
    weaknesses: List[ChatWeaknessAI]
    assistantConfirmedWeaknessesZh: List[str]
    recommendedNextActionsZh: List[str]


class ChatImportAnalyzeResponse(BaseModel):
    submission: dict
    analysis: ChatImportAIResult
    savedErrors: list
    updatedSkills: list
    profile: dict
    importStats: dict
