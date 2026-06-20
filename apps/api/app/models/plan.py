from typing import List

from pydantic import BaseModel

from app.models.common import PracticeType


class LearningPlanTaskAI(BaseModel):
    titleZh: str
    descriptionZh: str
    practiceType: PracticeType
    estimatedMinutes: int


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
