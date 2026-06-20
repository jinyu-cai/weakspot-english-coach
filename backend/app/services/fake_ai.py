"""Canned AI results for local testing (USE_FAKE_AI=true) — no DeepSeek calls.

Lets you exercise the full data loop (diagnose -> profile -> plan -> practice)
with zero API cost and no API key. Results are deterministic and always flag
verb_tense + vocab.repetition so the weakness profile populates predictably.
"""

from typing import Type

from app.models.chat_import import ChatImportAIResult, ChatWeaknessAI
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


def _fake_chat_import() -> ChatImportAIResult:
    return ChatImportAIResult(
        cefrEstimate=CEFRLevel.B1,
        overallScore=66,
        summaryZh="对话显示你能持续用英语练习，但时态、自然表达和求助型表达盲区比较明显。",
        strengthsZh=["会主动请求改写和解释", "能围绕真实任务持续练习"],
        topBlindSpotsZh=["不知道如何自然表达中文想法", "过去时和介词仍反复出现", "容易依赖简单词"],
        weaknesses=[
            ChatWeaknessAI(
                code="clarity.expression",
                category="Expression gap",
                severity=Severity.high,
                evidenceType="expression_gap",
                evidenceQuote="这个怎么说 / how can I say this",
                suggestedBetterEnglish="How can I phrase this more naturally?",
                explanationZh="频繁询问“怎么说”说明你有想法，但缺少可直接调用的英文表达块。",
                microLessonZh="把常见中文意图整理成英文句型块，比临时逐词翻译更稳定。",
                practiceGoal="积累 10 个求助与改写句型。",
                confidence=0.88,
            ),
            ChatWeaknessAI(
                code="grammar.verb_tense",
                category="Verb tense",
                severity=Severity.high,
                evidenceType="assistant_correction",
                evidenceQuote="Assistant corrected: I go -> I went",
                suggestedBetterEnglish="Yesterday I went...",
                explanationZh="AI 已纠正过过去时，说明这是已确认弱点。",
                microLessonZh="有 yesterday、last week 等过去时间时，主要动词要切到过去式。",
                practiceGoal="用一般过去时复述 5 个昨天做过的动作。",
                confidence=0.92,
            ),
            ChatWeaknessAI(
                code="vocab.word_choice",
                category="Word choice",
                severity=Severity.medium,
                evidenceType="assistant_advice",
                evidenceQuote="Assistant suggested more natural wording",
                suggestedBetterEnglish="more natural alternatives for simple words",
                explanationZh="助手多次给自然改写，说明词汇选择和搭配需要系统积累。",
                microLessonZh="不要只背单词，要按场景记搭配和整句。",
                practiceGoal="从聊天中整理 8 个高频替换表达。",
                confidence=0.8,
            ),
        ],
        assistantConfirmedWeaknessesZh=["过去时错误已被 AI 明确纠正", "自然表达/改写需求反复出现"],
        recommendedNextActionsZh=["把 expression gap 做成句型卡片", "优先练过去时复述", "每次聊天后保存 AI 给出的自然改写"],
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
    ChatImportAIResult: _fake_chat_import,
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
