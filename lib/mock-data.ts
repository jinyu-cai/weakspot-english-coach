import type {
  DiagnosticResult,
  EnglishError,
  LearnerProfile,
  LearningPlan,
  PracticeExercise,
  PracticeGrade,
  SkillState,
  Submission,
} from "./types"

export const DEMO_USER_ID = "demo-learner"

export const SAMPLE_PARAGRAPH =
  "Yesterday I go to the meeting with my manager and we discuss about the new project. " +
  "I think the project is very interesting and I am excited to start it. " +
  "But there is many problems we need to solve first. " +
  "My manager say that I should improve my communication skill and write more clear emails. " +
  "I will try my best to do a good job and make a good result."

export const mockProfile: LearnerProfile = {
  userId: DEMO_USER_ID,
  nativeLanguage: "Chinese",
  targetLanguage: "English",
  estimatedLevel: "B1",
  totalSubmissions: 12,
  totalPracticeAttempts: 34,
  createdAt: "2025-04-02T09:00:00.000Z",
  updatedAt: "2026-06-17T14:22:00.000Z",
}

export const mockSkills: SkillState[] = [
  {
    userId: DEMO_USER_ID,
    skillCode: "verb_tense",
    label: "Verb Tense",
    zhLabel: "动词时态",
    mastery: 38,
    errorCount: 14,
    correctCount: 9,
    lastSeenAt: "2026-06-17T14:22:00.000Z",
    lastPracticedAt: "2026-06-15T10:00:00.000Z",
    updatedAt: "2026-06-17T14:22:00.000Z",
  },
  {
    userId: DEMO_USER_ID,
    skillCode: "prepositions",
    label: "Prepositions",
    zhLabel: "介词使用",
    mastery: 45,
    errorCount: 11,
    correctCount: 12,
    lastSeenAt: "2026-06-17T14:22:00.000Z",
    lastPracticedAt: "2026-06-12T10:00:00.000Z",
    updatedAt: "2026-06-17T14:22:00.000Z",
  },
  {
    userId: DEMO_USER_ID,
    skillCode: "subject_verb_agreement",
    label: "Subject-Verb Agreement",
    zhLabel: "主谓一致",
    mastery: 52,
    errorCount: 8,
    correctCount: 14,
    lastSeenAt: "2026-06-17T14:22:00.000Z",
    lastPracticedAt: "2026-06-10T10:00:00.000Z",
    updatedAt: "2026-06-17T14:22:00.000Z",
  },
  {
    userId: DEMO_USER_ID,
    skillCode: "vocabulary_range",
    label: "Vocabulary Range",
    zhLabel: "词汇丰富度",
    mastery: 61,
    errorCount: 6,
    correctCount: 18,
    lastSeenAt: "2026-06-16T11:00:00.000Z",
    lastPracticedAt: "2026-06-14T10:00:00.000Z",
    updatedAt: "2026-06-16T11:00:00.000Z",
  },
  {
    userId: DEMO_USER_ID,
    skillCode: "articles",
    label: "Articles",
    zhLabel: "冠词使用",
    mastery: 68,
    errorCount: 5,
    correctCount: 21,
    lastSeenAt: "2026-06-15T11:00:00.000Z",
    lastPracticedAt: "2026-06-11T10:00:00.000Z",
    updatedAt: "2026-06-15T11:00:00.000Z",
  },
  {
    userId: DEMO_USER_ID,
    skillCode: "clarity",
    label: "Clarity & Cohesion",
    zhLabel: "表达清晰度",
    mastery: 72,
    errorCount: 4,
    correctCount: 22,
    lastSeenAt: "2026-06-16T11:00:00.000Z",
    lastPracticedAt: "2026-06-13T10:00:00.000Z",
    updatedAt: "2026-06-16T11:00:00.000Z",
  },
  {
    userId: DEMO_USER_ID,
    skillCode: "register",
    label: "Register & Tone",
    zhLabel: "语域与语气",
    mastery: 80,
    errorCount: 2,
    correctCount: 25,
    lastSeenAt: "2026-06-14T11:00:00.000Z",
    lastPracticedAt: "2026-06-09T10:00:00.000Z",
    updatedAt: "2026-06-14T11:00:00.000Z",
  },
]

export const mockErrors: EnglishError[] = [
  {
    id: "err-1",
    userId: DEMO_USER_ID,
    submissionId: "sub-latest",
    code: "verb_tense",
    category: "Verb Tense",
    severity: "high",
    originalText: "Yesterday I go to the meeting",
    correctedText: "Yesterday I went to the meeting",
    explanationZh: "句子中有明确的过去时间标志 “Yesterday”，因此动词必须使用过去式。go 的过去式是 went。",
    microLessonZh:
      "当句子里出现 yesterday、last week、ago 等过去时间词时，主要动词要用过去式。规则动词加 -ed（work → worked），不规则动词需要单独记忆（go → went, eat → ate, write → wrote）。",
    practiceGoal: "在含有过去时间标志的句子中正确使用一般过去时",
    createdAt: "2026-06-17T14:22:00.000Z",
  },
  {
    id: "err-2",
    userId: DEMO_USER_ID,
    submissionId: "sub-latest",
    code: "prepositions",
    category: "Prepositions",
    severity: "medium",
    originalText: "we discuss about the new project",
    correctedText: "we discussed the new project",
    explanationZh: "discuss 是及物动词，后面直接接宾语，不需要加介词 about。同时这里也应使用过去式 discussed。",
    microLessonZh:
      "一些动词本身已包含 “关于” 的含义，后面不能再加 about，例如 discuss、mention、explain。错误：discuss about the plan。正确：discuss the plan。",
    practiceGoal: "去掉及物动词后多余的介词",
    createdAt: "2026-06-17T14:22:00.000Z",
  },
  {
    id: "err-3",
    userId: DEMO_USER_ID,
    submissionId: "sub-latest",
    code: "subject_verb_agreement",
    category: "Subject-Verb Agreement",
    severity: "high",
    originalText: "there is many problems",
    correctedText: "there are many problems",
    explanationZh: "主语 problems 是复数，be 动词要用 are 而不是 is。there is 用于单数，there are 用于复数。",
    microLessonZh:
      "在 there is / there are 结构中，be 动词的单复数取决于其后的名词。单数或不可数：there is a problem / there is water。复数：there are many problems。",
    practiceGoal: "根据名词单复数选择 there is / there are",
    createdAt: "2026-06-17T14:22:00.000Z",
  },
  {
    id: "err-4",
    userId: DEMO_USER_ID,
    submissionId: "sub-latest",
    code: "subject_verb_agreement",
    category: "Subject-Verb Agreement",
    severity: "medium",
    originalText: "My manager say that",
    correctedText: "My manager says that",
    explanationZh: "主语 My manager 是第三人称单数，一般现在时的动词要加 -s，即 says。",
    microLessonZh:
      "一般现在时中，当主语是第三人称单数（he, she, it 或单个的人/物）时，动词要加 -s 或 -es：he works, she goes, my manager says。",
    practiceGoal: "第三人称单数主语后给动词加 -s",
    createdAt: "2026-06-17T14:22:00.000Z",
  },
  {
    id: "err-5",
    userId: DEMO_USER_ID,
    submissionId: "sub-latest",
    code: "vocabulary_range",
    category: "Vocabulary Range",
    severity: "low",
    originalText: "make a good result",
    correctedText: "achieve a good result",
    explanationZh: "result 与 make 搭配不自然，更地道的动词搭配是 achieve / get a good result。注意词语搭配（collocation）。",
    microLessonZh:
      "英语中很多名词有固定的动词搭配。result 常与 achieve、get、produce 搭配，而不是 make。多积累 collocation 能让表达更自然。",
    practiceGoal: "使用更自然的动词与名词搭配",
    createdAt: "2026-06-17T14:22:00.000Z",
  },
]

export const mockDiagnostic: DiagnosticResult = {
  cefrEstimate: "B1",
  overallScore: 64,
  summaryZh:
    "你的表达能够清楚传达意思，整体可读性不错，但在动词时态和主谓一致方面存在反复出现的问题。建议重点练习过去时和第三人称单数。",
  strengthsZh: [
    "句子结构完整，逻辑连贯，读者能够理解你的意图",
    "语气自然友好，适合职场沟通场景",
    "词汇量足够表达日常和工作话题",
  ],
  weaknessesZh: [
    "动词时态不一致，尤其是在描述过去事件时混用现在时",
    "主谓一致出错（there is/are、第三人称单数）",
    "部分动词与介词、名词的搭配不够地道",
  ],
  correctedText:
    "Yesterday I went to the meeting with my manager and we discussed the new project. " +
    "I think the project is very interesting and I am excited to start it. " +
    "However, there are many problems we need to solve first. " +
    "My manager says that I should improve my communication skills and write clearer emails. " +
    "I will try my best to do a good job and achieve a good result.",
  errors: mockErrors,
  skillUpdates: [
    {
      skillCode: "verb_tense",
      label: "Verb Tense",
      zhLabel: "动词时态",
      masteryDelta: -6,
      evidenceZh: "本次出现 2 处过去时错误，掌握度下降。",
    },
    {
      skillCode: "subject_verb_agreement",
      label: "Subject-Verb Agreement",
      zhLabel: "主谓一致",
      masteryDelta: -4,
      evidenceZh: "there is many 与 manager say 两处错误。",
    },
    {
      skillCode: "register",
      label: "Register & Tone",
      zhLabel: "语域与语气",
      masteryDelta: 3,
      evidenceZh: "邮件语气得体，掌握度小幅提升。",
    },
  ],
  recommendedNextActionsZh: [
    "完成 5 道一般过去时改错练习",
    "复习 there is / there are 的用法并做填空练习",
    "积累 10 个常见的动词 + 名词搭配（collocation）",
  ],
}

export const mockSubmissions: Submission[] = [
  {
    id: "sub-latest",
    userId: DEMO_USER_ID,
    mode: "writing",
    originalText: SAMPLE_PARAGRAPH,
    correctedText: mockDiagnostic.correctedText,
    cefrEstimate: "B1",
    summaryZh: "动词时态和主谓一致是本次的主要问题。",
    createdAt: "2026-06-17T14:22:00.000Z",
  },
  {
    id: "sub-2",
    userId: DEMO_USER_ID,
    mode: "writing",
    originalText:
      "I am writing to follow up on our conversation last week. Could you please send me the report when you have time?",
    correctedText:
      "I am writing to follow up on our conversation last week. Could you please send me the report when you have time?",
    cefrEstimate: "B2",
    summaryZh: "这封邮件几乎没有错误，语气专业，表现很好。",
    createdAt: "2026-06-15T09:30:00.000Z",
  },
  {
    id: "sub-3",
    userId: DEMO_USER_ID,
    mode: "practice",
    originalText: "She don't like coffee in the morning.",
    correctedText: "She doesn't like coffee in the morning.",
    cefrEstimate: "B1",
    summaryZh: "第三人称单数否定式应使用 doesn't。",
    createdAt: "2026-06-14T16:10:00.000Z",
  },
  {
    id: "sub-4",
    userId: DEMO_USER_ID,
    mode: "chat",
    originalText: "Last year I have visited three countries for work.",
    correctedText: "Last year I visited three countries for work.",
    cefrEstimate: "B1",
    summaryZh: "有明确过去时间时用一般过去时，而不是现在完成时。",
    createdAt: "2026-06-12T13:45:00.000Z",
  },
]

export const mockPlan: LearningPlan = {
  id: "plan-1",
  userId: DEMO_USER_ID,
  title: "7-Day Plan: Verb Tense & Agreement Focus",
  createdAt: "2026-06-17T15:00:00.000Z",
  updatedAt: "2026-06-17T15:00:00.000Z",
  days: [
    {
      day: 1,
      goalZh: "巩固一般过去时的基本规则",
      targetSkillCodes: ["verb_tense"],
      tasks: [
        {
          id: "p1-t1",
          titleZh: "规则动词过去式改错",
          descriptionZh: "改写 8 个句子，将现在时动词改为正确的过去式。",
          practiceType: "fix_sentence",
          estimatedMinutes: 10,
          completed: true,
        },
        {
          id: "p1-t2",
          titleZh: "不规则动词记忆",
          descriptionZh: "学习并测试 15 个常见不规则动词的过去式。",
          practiceType: "fill_blank",
          estimatedMinutes: 12,
          completed: false,
        },
      ],
    },
    {
      day: 2,
      goalZh: "区分一般过去时与现在完成时",
      targetSkillCodes: ["verb_tense"],
      tasks: [
        {
          id: "p2-t1",
          titleZh: "时态选择填空",
          descriptionZh: "根据时间状语选择正确的时态。",
          practiceType: "fill_blank",
          estimatedMinutes: 12,
          completed: false,
        },
        {
          id: "p2-t2",
          titleZh: "改写句子",
          descriptionZh: "把现在完成时句子改写为一般过去时。",
          practiceType: "rewrite_sentence",
          estimatedMinutes: 10,
          completed: false,
        },
      ],
    },
    {
      day: 3,
      goalZh: "掌握 there is / there are",
      targetSkillCodes: ["subject_verb_agreement"],
      tasks: [
        {
          id: "p3-t1",
          titleZh: "单复数判断填空",
          descriptionZh: "根据名词选择 is 或 are。",
          practiceType: "fill_blank",
          estimatedMinutes: 8,
          completed: false,
        },
        {
          id: "p3-t2",
          titleZh: "改错练习",
          descriptionZh: "找出并改正 there is/are 的错误。",
          practiceType: "fix_sentence",
          estimatedMinutes: 10,
          completed: false,
        },
      ],
    },
    {
      day: 4,
      goalZh: "第三人称单数动词变化",
      targetSkillCodes: ["subject_verb_agreement"],
      tasks: [
        {
          id: "p4-t1",
          titleZh: "动词加 -s 练习",
          descriptionZh: "为第三人称单数主语正确变化动词。",
          practiceType: "fix_sentence",
          estimatedMinutes: 10,
          completed: false,
        },
      ],
    },
    {
      day: 5,
      goalZh: "改进动词与介词搭配",
      targetSkillCodes: ["prepositions"],
      tasks: [
        {
          id: "p5-t1",
          titleZh: "去掉多余介词",
          descriptionZh: "改正 discuss about 等常见介词错误。",
          practiceType: "fix_sentence",
          estimatedMinutes: 10,
          completed: false,
        },
        {
          id: "p5-t2",
          titleZh: "介词填空",
          descriptionZh: "选择正确的介词完成句子。",
          practiceType: "fill_blank",
          estimatedMinutes: 8,
          completed: false,
        },
      ],
    },
    {
      day: 6,
      goalZh: "丰富动词与名词搭配",
      targetSkillCodes: ["vocabulary_range"],
      tasks: [
        {
          id: "p6-t1",
          titleZh: "Collocation 改写",
          descriptionZh: "用更地道的动词替换 make/do 等通用动词。",
          practiceType: "rewrite_sentence",
          estimatedMinutes: 12,
          completed: false,
        },
      ],
    },
    {
      day: 7,
      goalZh: "综合写作复盘",
      targetSkillCodes: ["verb_tense", "subject_verb_agreement", "vocabulary_range"],
      tasks: [
        {
          id: "p7-t1",
          titleZh: "写一段工作邮件",
          descriptionZh: "写一封 80-100 词的工作邮件，综合运用本周所学。",
          practiceType: "rewrite_sentence",
          estimatedMinutes: 15,
          completed: false,
        },
        {
          id: "p7-t2",
          titleZh: "自我改错",
          descriptionZh: "提交邮件并根据诊断报告复盘错误。",
          practiceType: "fix_sentence",
          estimatedMinutes: 10,
          completed: false,
        },
      ],
    },
  ],
}

const practiceBank: Record<string, PracticeExercise> = {
  verb_tense: {
    id: "ex-vt",
    userId: DEMO_USER_ID,
    type: "fix_sentence",
    targetSkillCode: "verb_tense",
    promptZh: "下面的句子有一个动词时态错误，请改正后写出完整的正确句子。",
    question: "Last weekend we go to the beach and swim in the sea.",
    answer: "Last weekend we went to the beach and swam in the sea.",
    explanationZh: "有明确的过去时间 “Last weekend”，go 应改为 went，swim 应改为 swam。",
    createdAt: "2026-06-17T15:30:00.000Z",
  },
  subject_verb_agreement: {
    id: "ex-sva",
    userId: DEMO_USER_ID,
    type: "fill_blank",
    targetSkillCode: "subject_verb_agreement",
    promptZh: "用括号中动词的正确形式填空。",
    question: "There ____ (be) several mistakes in this report that we need to fix.",
    answer: "There are several mistakes in this report that we need to fix.",
    explanationZh: "mistakes 为复数，be 动词用 are。",
    createdAt: "2026-06-17T15:30:00.000Z",
  },
  prepositions: {
    id: "ex-prep",
    userId: DEMO_USER_ID,
    type: "fix_sentence",
    targetSkillCode: "prepositions",
    promptZh: "改正下面句子中的介词错误。",
    question: "Let's discuss about the budget tomorrow morning.",
    answer: "Let's discuss the budget tomorrow morning.",
    explanationZh: "discuss 是及物动词，后面不加 about。",
    createdAt: "2026-06-17T15:30:00.000Z",
  },
  vocabulary_range: {
    id: "ex-vocab",
    userId: DEMO_USER_ID,
    type: "rewrite_sentence",
    targetSkillCode: "vocabulary_range",
    promptZh: "用更地道的动词替换句子中的通用动词，并重写句子。",
    question: "Our team made a very good result this quarter.",
    answer: "Our team achieved a very good result this quarter.",
    explanationZh: "result 常与 achieve 搭配，而不是 make。",
    createdAt: "2026-06-17T15:30:00.000Z",
  },
}

export function getMockExercise(targetSkillCode?: string): PracticeExercise {
  if (targetSkillCode && practiceBank[targetSkillCode]) {
    return { ...practiceBank[targetSkillCode], id: `${practiceBank[targetSkillCode].id}-${Date.now()}` }
  }
  const keys = Object.keys(practiceBank)
  const key = keys[Math.floor(Math.random() * keys.length)]
  return { ...practiceBank[key], id: `${practiceBank[key].id}-${Date.now()}` }
}

export function gradeMockAnswer(exercise: PracticeExercise, userAnswer: string): PracticeGrade {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[.,!?;:]/g, "")
      .replace(/\s+/g, " ")
      .trim()
  const expected = exercise.answer ?? ""
  const isCorrect = normalize(userAnswer) === normalize(expected)
  const partial = !isCorrect && normalize(userAnswer).length > 0
  return {
    isCorrect,
    score: isCorrect ? 100 : partial ? 55 : 0,
    feedbackZh: isCorrect
      ? "完全正确！你准确地运用了目标语法点，继续保持。"
      : `还差一点。参考答案：“${expected}”。请注意目标语法点：${exercise.explanationZh ?? ""}`,
    correctedAnswer: expected,
    skillMasteryDelta: isCorrect ? 5 : partial ? 1 : -2,
  }
}
