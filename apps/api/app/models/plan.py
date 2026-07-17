from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator

from app.models.common import OutputLanguage, PracticeType

ErrorScope = Literal["weekly", "all"]

PLAN_TITLE_MAX_CHARS = 200
PLAN_GOAL_MAX_CHARS = 500
PLAN_TASK_TEXT_MAX_CHARS = 800
PLAN_EXERCISE_PROMPT_MAX_CHARS = 500
PLAN_EXERCISE_TEXT_MAX_CHARS = 1_200
PLAN_TASKS_PER_DAY = 2
PLAN_EXERCISES_PER_TASK = 3


class PlanExerciseAI(BaseModel):
    promptZh: str = Field(min_length=1, max_length=PLAN_EXERCISE_PROMPT_MAX_CHARS)
    question: str = Field(min_length=1, max_length=PLAN_EXERCISE_TEXT_MAX_CHARS)
    answer: str = Field(min_length=1, max_length=PLAN_EXERCISE_TEXT_MAX_CHARS)
    explanationZh: str = Field(min_length=1, max_length=PLAN_EXERCISE_TEXT_MAX_CHARS)


class LearningPlanTaskAI(BaseModel):
    titleZh: str = Field(min_length=1, max_length=PLAN_TASK_TEXT_MAX_CHARS)
    descriptionZh: str = Field(min_length=1, max_length=PLAN_TASK_TEXT_MAX_CHARS)
    practiceType: PracticeType
    estimatedMinutes: int = Field(ge=15, le=15)
    exercises: List[PlanExerciseAI] = Field(
        min_length=PLAN_EXERCISES_PER_TASK,
        max_length=PLAN_EXERCISES_PER_TASK,
    )

    @field_validator("exercises", mode="before")
    @classmethod
    def cap_exercises(cls, value):
        return value[:PLAN_EXERCISES_PER_TASK] if isinstance(value, list) else value

    @field_validator("estimatedMinutes", mode="before")
    @classmethod
    def normalize_estimated_minutes(cls, _value):
        return 15


class LearningPlanDayAI(BaseModel):
    day: int = Field(ge=1, le=7)
    goalZh: str = Field(min_length=1, max_length=PLAN_GOAL_MAX_CHARS)
    targetSkillCodes: List[str] = Field(min_length=1, max_length=4)
    tasks: List[LearningPlanTaskAI] = Field(
        min_length=PLAN_TASKS_PER_DAY,
        max_length=PLAN_TASKS_PER_DAY,
    )

    @field_validator("targetSkillCodes", mode="before")
    @classmethod
    def cap_target_skills(cls, value):
        return value[:4] if isinstance(value, list) else value

    @field_validator("tasks", mode="before")
    @classmethod
    def cap_tasks(cls, value):
        return value[:PLAN_TASKS_PER_DAY] if isinstance(value, list) else value


class LearningPlanAIResult(BaseModel):
    title: str = Field(min_length=1, max_length=PLAN_TITLE_MAX_CHARS)
    days: List[LearningPlanDayAI] = Field(min_length=7, max_length=7)

    @field_validator("days", mode="before")
    @classmethod
    def cap_days(cls, value):
        return value[:7] if isinstance(value, list) else value


class GeneratePlanRequest(BaseModel):
    userId: str
    errorScope: ErrorScope = "weekly"
    outputLanguage: OutputLanguage = "en"


class UpdatePlanTaskRequest(BaseModel):
    status: Literal["assigned", "started", "completed", "skipped"]
    score: Optional[int] = Field(default=None, ge=0, le=100)
