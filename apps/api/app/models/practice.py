from typing import Optional

from pydantic import BaseModel, Field

from app.models.common import OutputLanguage, PracticeType


PRACTICE_SKILL_CODE_MAX_CHARS = 200
PRACTICE_PROMPT_MAX_CHARS = 2_000
PRACTICE_QUESTION_MAX_CHARS = 4_000
PRACTICE_ANSWER_MAX_CHARS = 4_000
PRACTICE_EXPLANATION_MAX_CHARS = 4_000


class GeneratePracticeRequest(BaseModel):
    userId: str
    targetSkillCode: Optional[str] = Field(
        default=None,
        max_length=PRACTICE_SKILL_CODE_MAX_CHARS,
    )
    outputLanguage: OutputLanguage = "en"
    # When set, force the generated exercise to this type so a learner can
    # "regenerate the same kind" of exercise (e.g. re-do a plan task).
    practiceType: Optional[PracticeType] = None
    sessionId: Optional[str] = Field(default=None, min_length=8, max_length=128)
    sequenceIndex: int = Field(default=0, ge=0, le=20)
    previousSkillCodes: list[str] = Field(default_factory=list, max_length=8)
    previousPracticeTypes: list[PracticeType] = Field(default_factory=list, max_length=8)
    parentRunId: Optional[str] = Field(default=None, max_length=100)
    # Mixed / multi-item sessions pass slot + size so parallel generates diversify
    # skills, stages, and surface forms instead of cloning one error four times.
    sessionSlot: Optional[int] = Field(default=None, ge=0, le=20)
    sessionSize: Optional[int] = Field(default=None, ge=1, le=20)


class PracticeExerciseAIResult(BaseModel):
    type: PracticeType
    targetSkillCode: str = Field(max_length=PRACTICE_SKILL_CODE_MAX_CHARS)
    promptZh: str = Field(max_length=PRACTICE_PROMPT_MAX_CHARS)
    question: str = Field(max_length=PRACTICE_QUESTION_MAX_CHARS)
    answer: str = Field(max_length=PRACTICE_ANSWER_MAX_CHARS)
    explanationZh: str = Field(max_length=PRACTICE_EXPLANATION_MAX_CHARS)


class SubmitPracticeRequest(BaseModel):
    userId: str
    exerciseId: str
    userAnswer: str = Field(min_length=1)
    outputLanguage: OutputLanguage = "en"
    clientAttemptId: Optional[str] = Field(
        default=None,
        min_length=8,
        max_length=128,
        pattern=r"^[A-Za-z0-9][A-Za-z0-9._:-]*$",
    )


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
    activityRunId: Optional[str] = Field(default=None, max_length=100)
    completeActivityRun: bool = True
    clientAttemptId: Optional[str] = Field(
        default=None,
        min_length=8,
        max_length=128,
        pattern=r"^[A-Za-z0-9][A-Za-z0-9._:-]*$",
    )


class PracticeGradeAIResult(BaseModel):
    isCorrect: bool
    score: int = Field(ge=0, le=100)
    feedbackZh: str
    correctedAnswer: str
    skillMasteryDelta: float
