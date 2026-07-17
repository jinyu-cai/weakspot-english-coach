import re
from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator

from app.models.common import CEFRLevel, OutputLanguage, Severity
from app.models.memory import MemoryCandidate
from app.core.taxonomy import ERROR_TAXONOMY


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
    learningContext: Optional["DiagnoseLearningContext"] = None

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


class DiagnoseLearningContext(BaseModel):
    activityRunId: str = Field(min_length=1, max_length=100)
    missionType: str = Field(min_length=1, max_length=100)
    targetSkills: List[str] = Field(min_length=1, max_length=4)
    modality: str = Field(default="text", min_length=1, max_length=60)
    hintLevel: int = Field(default=0, ge=0, le=4)
    playCount: int = Field(default=0, ge=0, le=20)
    contextKey: Optional[str] = Field(default=None, max_length=240)
    taskDifficulty: float = Field(default=0.5, ge=0, le=1)
    delayed: bool = False
    novelContext: bool = False

    @field_validator("targetSkills")
    @classmethod
    def validate_target_skills(cls, value: List[str]) -> List[str]:
        invalid = [skill for skill in value if skill not in ERROR_TAXONOMY]
        if invalid:
            raise ValueError(f"Unsupported target skill(s): {', '.join(invalid)}")
        return list(dict.fromkeys(value))


class TargetEvidenceAI(BaseModel):
    skillCode: str
    opportunityPresent: bool
    outcome: Literal["success", "failure", "avoided", "no_opportunity"]
    evidenceQuote: str = ""
    confidence: float = Field(default=0.0, ge=0, le=1)

    @field_validator("skillCode")
    @classmethod
    def validate_skill_code(cls, value: str) -> str:
        if value not in ERROR_TAXONOMY:
            raise ValueError(f"Unsupported target skill: {value}")
        return value


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
    targetEvidence: List[TargetEvidenceAI] = Field(default_factory=list, max_length=4)
