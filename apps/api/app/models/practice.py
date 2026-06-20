from typing import Optional

from pydantic import BaseModel, Field

from app.models.common import PracticeType


class GeneratePracticeRequest(BaseModel):
    userId: str
    targetSkillCode: Optional[str] = None


class PracticeExerciseAIResult(BaseModel):
    type: PracticeType
    targetSkillCode: str
    promptZh: str
    question: str
    answer: str
    explanationZh: str


class SubmitPracticeRequest(BaseModel):
    userId: str
    exerciseId: str
    userAnswer: str = Field(min_length=1, max_length=2000)


class PracticeGradeAIResult(BaseModel):
    isCorrect: bool
    score: int = Field(ge=0, le=100)
    feedbackZh: str
    correctedAnswer: str
    skillMasteryDelta: float
