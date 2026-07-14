import re
from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator

from app.models.common import CEFRLevel, OutputLanguage, Severity
from app.models.memory import MemoryCandidate


DiagnosisMode = Literal["fast", "deep"]
NoteType = Literal["expression", "vocabulary", "grammar"]
MIN_DIAGNOSE_WORDS = 5


def _word_count(value: str) -> int:
    return sum(
        1
        for token in re.split(r"\s+", value.strip())
        if token and re.search(r"[^\W_]", token, flags=re.UNICODE)
    )


class DiagnoseRequest(BaseModel):
    userId: str
    text: str = Field(min_length=1)
    diagnosisMode: DiagnosisMode = "fast"
    outputLanguage: OutputLanguage = "en"
    analysisContext: Optional[str] = Field(default=None, max_length=2400)

    @field_validator("text")
    @classmethod
    def require_enough_words(cls, value: str) -> str:
        if _word_count(value) < MIN_DIAGNOSE_WORDS:
            raise ValueError(f"Write at least {MIN_DIAGNOSE_WORDS} words.")
        return value


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
    memoryCandidates: List[MemoryCandidate] = Field(default_factory=list)
