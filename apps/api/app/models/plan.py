from typing import List

from pydantic import BaseModel, Field

from app.models.common import PracticeType


class PlanExerciseAI(BaseModel):
    promptZh: str
    question: str
    answer: str
    explanationZh: str


class LearningPlanTaskAI(BaseModel):
    titleZh: str
    descriptionZh: str
    practiceType: PracticeType
    estimatedMinutes: int = Field(ge=5)
    exercises: List[PlanExerciseAI] = Field(min_length=8, max_length=20)


class LearningPlanDayAI(BaseModel):
    day: int
    goalZh: str
    targetSkillCodes: List[str]
    tasks: List[LearningPlanTaskAI]


class LearningPlanAIResult(BaseModel):
    title: str
    days: List[LearningPlanDayAI]


class GeneratePlanRequest(BaseModel):
    userId: str
