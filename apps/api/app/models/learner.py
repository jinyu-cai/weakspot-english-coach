from typing import Optional

from pydantic import BaseModel

from app.models.common import CEFRLevel, Severity


class LearnerProfile(BaseModel):
    userId: str
    nativeLanguage: str = "Chinese"
    targetLanguage: str = "English"
    estimatedLevel: CEFRLevel = CEFRLevel.B1
    totalSubmissions: int = 0
    totalPracticeAttempts: int = 0
    createdAt: str
    updatedAt: str


class SkillState(BaseModel):
    userId: str
    skillCode: str
    label: str
    zhLabel: str
    mastery: float
    errorCount: int
    correctCount: int
    lastSeenAt: Optional[str] = None
    lastPracticedAt: Optional[str] = None
    updatedAt: str


class Submission(BaseModel):
    id: str
    userId: str
    mode: str
    originalText: str
    correctedText: Optional[str] = None
    cefrEstimate: Optional[CEFRLevel] = None
    summaryZh: Optional[str] = None
    createdAt: str


class EnglishError(BaseModel):
    id: str
    userId: str
    submissionId: str
    code: str
    category: str
    severity: Severity
    originalText: str
    correctedText: str
    explanationZh: str
    microLessonZh: str
    practiceGoal: str
    createdAt: str
