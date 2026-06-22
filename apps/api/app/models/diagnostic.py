from typing import List, Literal

from pydantic import BaseModel, Field

from app.models.common import CEFRLevel, Severity


DiagnosisMode = Literal["fast", "deep"]
NoteType = Literal["expression", "vocabulary", "grammar"]


class DiagnoseRequest(BaseModel):
    userId: str
    text: str = Field(min_length=20, max_length=4000)
    diagnosisMode: DiagnosisMode = "fast"


class DiagnosticErrorAI(BaseModel):
    code: str
    category: str
    severity: Severity
    originalText: str
    correctedText: str
    explanationZh: str
    microLessonZh: str
    practiceGoal: str


class SkillUpdateAI(BaseModel):
    skillCode: str
    label: str
    zhLabel: str
    masteryDelta: float
    evidenceZh: str


class LearningNoteAI(BaseModel):
    type: NoteType
    topic: str
    original: str
    natural: str
    explanation: str
    context: str
    examples: List[str]


class DiagnosticAIResult(BaseModel):
    cefrEstimate: CEFRLevel
    overallScore: int = Field(ge=0, le=100)
    summaryZh: str
    strengthsZh: List[str]
    weaknessesZh: List[str]
    correctedText: str
    errors: List[DiagnosticErrorAI]
    recommendedNextActionsZh: List[str]
    learningNotes: List[LearningNoteAI] = []
