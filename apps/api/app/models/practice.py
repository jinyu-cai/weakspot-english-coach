from typing import Optional

from pydantic import BaseModel, Field

from app.models.common import OutputLanguage, PracticeType


class GeneratePracticeRequest(BaseModel):
    userId: str
    targetSkillCode: Optional[str] = None
    outputLanguage: OutputLanguage = "en"
    # When set, force the generated exercise to this type so a learner can
    # "regenerate the same kind" of exercise (e.g. re-do a plan task).
    practiceType: Optional[PracticeType] = None


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
    userAnswer: str = Field(min_length=1)
    outputLanguage: OutputLanguage = "en"


class GradePracticeRequest(BaseModel):
    """Ad-hoc grading for an exercise that isn't a stored PracticeExercise.

    Used by the plan-exercise practice runner: the question and model answer
    travel with the request (they're already on the client) so plan exercises
    can be graded — and any mistake recorded to the weakness library — without
    first persisting them as practice exercises.
    """

    userId: str
    targetSkillCode: str
    question: str = Field(min_length=1)
    expectedAnswer: str = ""
    userAnswer: str = Field(min_length=1)
    outputLanguage: OutputLanguage = "en"
    exerciseType: Optional[PracticeType] = None
    promptZh: Optional[str] = None
    explanationZh: Optional[str] = None


class PracticeGradeAIResult(BaseModel):
    isCorrect: bool
    score: int = Field(ge=0, le=100)
    feedbackZh: str
    correctedAnswer: str
    skillMasteryDelta: float
