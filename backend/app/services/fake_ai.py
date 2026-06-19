"""Canned AI results for local testing (USE_FAKE_AI=true) — no DeepSeek calls.

Lets you exercise the full data loop (diagnose -> profile -> plan -> practice)
with zero API cost and no API key. Results are deterministic and always flag
verb_tense + vocab.repetition so the weakness profile populates predictably.
"""

from typing import Type

from app.models.common import CEFRLevel, PracticeType, Severity
from app.models.diagnostic import DiagnosticAIResult, DiagnosticErrorAI, SkillUpdateAI
from app.models.plan import LearningPlanAIResult, LearningPlanDayAI, LearningPlanTaskAI
from app.models.practice import PracticeExerciseAIResult, PracticeGradeAIResult


def _fake_diagnostic() -> DiagnosticAIResult:
    return DiagnosticAIResult(
        cefrEstimate=CEFRLevel.B1,
        overallScore=68,
        summaryZh="整体能表达清楚，但动词时态和词汇多样性需要加强。",
        strengthsZh=["敢于表达想法", "句子结构基本完整"],
        weaknessesZh=["一般过去时容易出错", "用词偏简单且重复"],
        correctedText="Yesterday I went to my university and met my friend. We talked about our project.",
        errors=[
            DiagnosticErrorAI(
                code="grammar.verb_tense",
                category="Verb tense",
                severity=Severity.high,
                originalText="Yesterday I go to my university",
                correctedText="Yesterday I went to my university",
                explanationZh="表示过去发生的动作要用一般过去时，go 应改为 went。",
                microLessonZh="一般过去时：规则动词加 -ed，不规则动词用过去式（go→went）。",
                practiceGoal="用一般过去时改写 5 个句子。",
            ),
            DiagnosticErrorAI(
                code="vocab.repetition",
                category="Repetitive vocabulary",
                severity=Severity.medium,
                originalText="good ... good ... good",
                correctedText="great / solid / effective",
                explanationZh="同一个词重复过多，建议用近义词替换以丰富表达。",
                microLessonZh="积累同义词，避免在一段里反复使用同一个形容词。",
                practiceGoal="为 good 找 3 个语境合适的替换词。",
            ),
        ],
        skillUpdates=[
            SkillUpdateAI(skillCode="grammar.verb_tense", label="Verb tense", zhLabel="动词时态", masteryDelta=-12, evidenceZh="go 应为 went"),
            SkillUpdateAI(skillCode="vocab.repetition", label="Repetitive vocabulary", zhLabel="词汇重复", masteryDelta=-7, evidenceZh="good 多次重复"),
        ],
        recommendedNextActionsZh=["完成 3 道一般过去时改写练习", "积累并使用 5 个 good 的替换词"],
    )


def _fake_plan() -> LearningPlanAIResult:
    days = [
        LearningPlanDayAI(
            day=d,
            goalZh=f"第 {d} 天：巩固动词时态，并提升词汇多样性",
            targetSkillCodes=["grammar.verb_tense", "vocab.repetition"],
            tasks=[
                LearningPlanTaskAI(titleZh="过去式改写", descriptionZh="把 5 个一般现在时句子改写成一般过去时。", practiceType=PracticeType.fix_sentence, estimatedMinutes=10),
                LearningPlanTaskAI(titleZh="同义词替换", descriptionZh="为 3 个高频词各找 2 个替换词并造句。", practiceType=PracticeType.rewrite_sentence, estimatedMinutes=10),
            ],
        )
        for d in range(1, 8)
    ]
    return LearningPlanAIResult(title="7 天个性化提升计划（动词时态 & 词汇多样性）", days=days)


def _fake_exercise() -> PracticeExerciseAIResult:
    return PracticeExerciseAIResult(
        type=PracticeType.fix_sentence,
        targetSkillCode="grammar.verb_tense",
        promptZh="改正下面句子中的时态错误，并写出完整正确句子。",
        question="Yesterday I go to the park and play football with my friends.",
        answer="Yesterday I went to the park and played football with my friends.",
        explanationZh="时间状语 yesterday 表示过去，go→went，play→played。",
    )


def _fake_grade() -> PracticeGradeAIResult:
    return PracticeGradeAIResult(
        isCorrect=True,
        score=90,
        feedbackZh="很好，过去式用对了！继续保持。",
        correctedAnswer="Yesterday I went to the park and played football with my friends.",
        skillMasteryDelta=8.0,
    )


_BUILDERS = {
    DiagnosticAIResult: _fake_diagnostic,
    LearningPlanAIResult: _fake_plan,
    PracticeExerciseAIResult: _fake_exercise,
    PracticeGradeAIResult: _fake_grade,
}


def fake_for(response_model: Type):
    builder = _BUILDERS.get(response_model)
    if builder is None:
        name = getattr(response_model, "__name__", response_model)
        raise ValueError(f"No fake AI result registered for {name}")
    return builder()
