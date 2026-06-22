"""Canned AI results for local testing (USE_FAKE_AI=true) — no DeepSeek calls.

Lets you exercise the full data loop (diagnose -> profile -> plan -> practice)
with zero API cost and no API key. Results are deterministic and always flag
verb_tense + vocab.repetition so the weakness profile populates predictably.
Feedback strings are English-first, matching production prompts.
"""

from typing import Type

from app.models.chat_import import ChatImportAIResult, ChatWeaknessAI
from app.models.common import CEFRLevel, PracticeType, Severity
from app.models.diagnostic import DiagnosticAIResult, DiagnosticErrorAI, LearningNoteAI, SkillUpdateAI
from app.models.plan import LearningPlanAIResult, LearningPlanDayAI, LearningPlanTaskAI
from app.models.practice import PracticeExerciseAIResult, PracticeGradeAIResult


def _fake_diagnostic() -> DiagnosticAIResult:
    return DiagnosticAIResult(
        cefrEstimate=CEFRLevel.B1,
        overallScore=68,
        summaryZh="Overall you communicate clearly, but verb tense and vocabulary variety need work.",
        strengthsZh=["You express your ideas confidently", "Sentence structure is mostly complete"],
        weaknessesZh=["Simple past tense is error-prone", "Word choice is simple and repetitive"],
        correctedText="Yesterday I went to my university and met my friend. We talked about our project.",
        errors=[
            DiagnosticErrorAI(
                code="grammar.verb_tense",
                category="Verb tense",
                severity=Severity.high,
                originalText="Yesterday I go to my university",
                correctedText="Yesterday I went to my university",
                explanationZh="Past actions take the simple past tense, so 'go' should be 'went'.",
                microLessonZh="Simple past: regular verbs add -ed; irregular verbs use a past form (go -> went).",
                practiceGoal="Rewrite 5 sentences in the simple past.",
            ),
            DiagnosticErrorAI(
                code="vocab.repetition",
                category="Repetitive vocabulary",
                severity=Severity.medium,
                originalText="good ... good ... good",
                correctedText="great / solid / effective",
                explanationZh="The same word repeats too often; use synonyms to enrich your writing.",
                microLessonZh="Build a small synonym bank so you don't reuse one adjective across a paragraph.",
                practiceGoal="Find 3 context-appropriate replacements for 'good'.",
            ),
        ],
        skillUpdates=[
            SkillUpdateAI(skillCode="grammar.verb_tense", label="Verb tense", zhLabel="Verb tense", masteryDelta=-12, evidenceZh="'go' should be 'went'"),
            SkillUpdateAI(skillCode="vocab.repetition", label="Repetitive vocabulary", zhLabel="Repetitive vocabulary", masteryDelta=-7, evidenceZh="'good' repeated many times"),
        ],
        recommendedNextActionsZh=["Do 3 simple-past rewrite drills", "Collect and use 5 replacements for 'good'"],
        learningNotes=[
            LearningNoteAI(
                type="expression",
                topic="Talking about past activities",
                original="Yesterday I go to my university",
                natural="Yesterday I went to my university",
                explanation="When telling a story about the past, use past-tense verbs to sound natural.",
                context="Casual conversation or writing about past events; any register.",
                examples=["I went to the gym after work yesterday.", "We visited our grandparents last weekend."],
            ),
            LearningNoteAI(
                type="vocabulary",
                topic="Alternatives for 'good'",
                original="good",
                natural="great / solid / effective / impressive",
                explanation="English has many synonyms for 'good' that carry different shades of meaning.",
                context="Use 'great' for enthusiasm, 'solid' for reliability, 'effective' for results, 'impressive' for admiration.",
                examples=["That was a solid presentation.", "The results were impressive."],
            ),
        ],
    )


def _fake_chat_import() -> ChatImportAIResult:
    return ChatImportAIResult(
        cefrEstimate=CEFRLevel.B1,
        overallScore=66,
        summaryZh="Your chats show steady English practice, but tense, natural phrasing, and help-seeking expression gaps stand out.",
        strengthsZh=["You actively ask for rewrites and explanations", "You keep practicing around real tasks"],
        topBlindSpotsZh=["Unsure how to express ideas naturally", "Past tense and prepositions keep recurring", "You lean on simple words"],
        weaknesses=[
            ChatWeaknessAI(
                code="clarity.expression",
                category="Expression gap",
                severity=Severity.high,
                evidenceType="expression_gap",
                evidenceQuote="how can I say this?",
                suggestedBetterEnglish="How can I phrase this more naturally?",
                explanationZh="Asking 'how do I say this' often means you have the idea but lack a ready English phrase.",
                microLessonZh="Turn common intents into reusable English phrase chunks instead of translating word by word.",
                practiceGoal="Collect 10 help-seeking and rewriting phrases.",
                confidence=0.88,
            ),
            ChatWeaknessAI(
                code="grammar.verb_tense",
                category="Verb tense",
                severity=Severity.high,
                evidenceType="assistant_correction",
                evidenceQuote="Assistant corrected: I go -> I went",
                suggestedBetterEnglish="Yesterday I went...",
                explanationZh="The assistant already corrected your past tense, so this is a confirmed weakness.",
                microLessonZh="With yesterday, last week, etc., switch the main verb to its past form.",
                practiceGoal="Retell 5 things you did yesterday in the simple past.",
                confidence=0.92,
            ),
            ChatWeaknessAI(
                code="vocab.word_choice",
                category="Word choice",
                severity=Severity.medium,
                evidenceType="assistant_advice",
                evidenceQuote="Assistant suggested more natural wording",
                suggestedBetterEnglish="more natural alternatives for simple words",
                explanationZh="The assistant kept offering natural rewrites, so word choice and collocations need systematic work.",
                microLessonZh="Don't just memorize words; learn collocations and whole phrases by context.",
                practiceGoal="Collect 8 frequent replacement expressions from your chats.",
                confidence=0.8,
            ),
        ],
        assistantConfirmedWeaknessesZh=["Past-tense errors were explicitly corrected by the AI", "Natural-rewrite requests recur"],
        recommendedNextActionsZh=["Turn expression gaps into phrase cards", "Prioritize past-tense retelling", "Save the AI's natural rewrites after each chat"],
    )


def _fake_plan() -> LearningPlanAIResult:
    days = [
        LearningPlanDayAI(
            day=d,
            goalZh=f"Day {d}: reinforce verb tense and grow vocabulary variety",
            targetSkillCodes=["grammar.verb_tense", "vocab.repetition"],
            tasks=[
                LearningPlanTaskAI(titleZh="Past-tense rewrite", descriptionZh="Rewrite 5 present-tense sentences into the simple past.", practiceType=PracticeType.fix_sentence, estimatedMinutes=10),
                LearningPlanTaskAI(titleZh="Synonym swap", descriptionZh="Find 2 replacements for each of 3 frequent words and use them in sentences.", practiceType=PracticeType.rewrite_sentence, estimatedMinutes=10),
            ],
        )
        for d in range(1, 8)
    ]
    return LearningPlanAIResult(title="7-Day Personalized Plan (Verb Tense & Vocabulary Variety)", days=days)


def _fake_exercise() -> PracticeExerciseAIResult:
    return PracticeExerciseAIResult(
        type=PracticeType.fix_sentence,
        targetSkillCode="grammar.verb_tense",
        promptZh="Fix the tense error below and write out the full correct sentence.",
        question="Yesterday I go to the park and play football with my friends.",
        answer="Yesterday I went to the park and played football with my friends.",
        explanationZh="The time marker 'yesterday' is past, so go -> went and play -> played.",
    )


def _fake_grade() -> PracticeGradeAIResult:
    return PracticeGradeAIResult(
        isCorrect=True,
        score=90,
        feedbackZh="Nice work, the past tense is correct! Keep it up.",
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
