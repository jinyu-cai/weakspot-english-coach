import type {
  DiagnoseResponse,
  EnglishError,
  HistoryResponse,
  LearnerProfile,
  LearningPlan,
  PracticeExercise,
  PracticeGrade,
  ProfileResponse,
  SkillState,
  Submission,
} from "./types"

export const DEMO_USER_ID = "demo-learner"

export const SAMPLE_PARAGRAPH =
  "Yesterday I go to the meeting with my team. We discussed about the new project and I think it will be very success. My manager say that I need improve my communication skill. I am agree with him because sometimes I cannot express my idea clearly. I want to become more better at writing emails too."

const now = Date.now()
const iso = (offsetMs: number) => new Date(now - offsetMs).toISOString()

export const mockProfile: LearnerProfile = {
  userId: DEMO_USER_ID,
  nativeLanguage: "Chinese",
  targetLanguage: "English",
  estimatedLevel: "B1",
  totalSubmissions: 14,
  totalPracticeAttempts: 37,
  createdAt: iso(1000 * 60 * 60 * 24 * 30),
  updatedAt: iso(1000 * 60 * 30),
}

export const mockSkills: SkillState[] = [
  {
    userId: DEMO_USER_ID,
    skillCode: "verb_tense",
    label: "Verb Tense",
    zhLabel: "动词时态",
    mastery: 38,
    errorCount: 12,
    correctCount: 7,
    lastSeenAt: iso(1000 * 60 * 30),
    lastPracticedAt: iso(1000 * 60 * 60 * 24),
    updatedAt: iso(1000 * 60 * 30),
  },
  {
    userId: DEMO_USER_ID,
    skillCode: "prepositions",
    label: "Prepositions",
    zhLabel: "介词搭配",
    mastery: 45,
    errorCount: 9,
    correctCount: 8,
    lastSeenAt: iso(1000 * 60 * 30),
    lastPracticedAt: iso(1000 * 60 * 60 * 48),
    updatedAt: iso(1000 * 60 * 30),
  },
  {
    userId: DEMO_USER_ID,
    skillCode: "word_choice",
    label: "Word Choice",
    zhLabel: "词汇选择",
    mastery: 52,
    errorCount: 7,
    correctCount: 9,
    lastSeenAt: iso(1000 * 60 * 60 * 5),
    lastPracticedAt: iso(1000 * 60 * 60 * 72),
    updatedAt: iso(1000 * 60 * 60 * 5),
  },
  {
    userId: DEMO_USER_ID,
    skillCode: "comparatives",
    label: "Comparatives",
    zhLabel: "比较级",
    mastery: 61,
    errorCount: 4,
    correctCount: 10,
    lastSeenAt: iso(1000 * 60 * 60 * 5),
    lastPracticedAt: iso(1000 * 60 * 60 * 96),
    updatedAt: iso(1000 * 60 * 60 * 5),
  },
  {
    userId: DEMO_USER_ID,
    skillCode: "register",
    label: "Register & Tone",
    zhLabel: "语域与语气",
    mastery: 68,
    errorCount: 3,
    correctCount: 11,
    lastSeenAt: iso(1000 * 60 * 60 * 12),
    lastPracticedAt: iso(1000 * 60 * 60 * 120),
    updatedAt: iso(1000 * 60 * 60 * 12),
  },
  {
    userId: DEMO_USER_ID,
    skillCode: "articles",
    label: "Articles",
    zhLabel: "冠词",
    mastery: 74,
    errorCount: 5,
    correctCount: 18,
    lastSeenAt: iso(1000 * 60 * 60 * 24),
    lastPracticedAt: iso(1000 * 60 * 60 * 144),
    updatedAt: iso(1000 * 60 * 60 * 24),
  },
  {
    userId: DEMO_USER_ID,
    skillCode: "clarity",
    label: "Clarity",
    zhLabel: "表达清晰度",
    mastery: 80,
    errorCount: 2,
    correctCount: 16,
    lastSeenAt: iso(1000 * 60 * 60 * 36),
    lastPracticedAt: iso(1000 * 60 * 60 * 168),
    updatedAt: iso(1000 * 60 * 60 * 36),
  },
  {
    userId: DEMO_USER_ID,
    skillCode: "subject_verb",
    label: "Subject-Verb Agreement",
    zhLabel: "主谓一致",
    mastery: 86,
    errorCount: 1,
    correctCount: 20,
    lastSeenAt: iso(1000 * 60 * 60 * 48),
    lastPracticedAt: iso(1000 * 60 * 60 * 192),
    updatedAt: iso(1000 * 60 * 60 * 48),
  },
]

export const mockErrors: EnglishError[] = [
  {
    id: "err-1",
    userId: DEMO_USER_ID,
    submissionId: "sub-1",
    code: "verb_tense_past_simple",
    category: "Verb Tense",
    severity: "high",
    originalText: "Yesterday I go to the meeting",
    correctedText: "Yesterday I went to the meeting",
    explanationZh: "句中有明确的过去时间状语 “Yesterday”，动词必须使用过去式。“go” 的过去式是 “went”。",
    microLessonZh:
      "当句子里出现 yesterday、last week、in 2019 等表示过去的时间词时，谓语动词要用过去式。规则动词加 -ed，不规则动词需要单独记忆，例如 go → went、have → had、make → made。",
    practiceGoal: "在含有过去时间状语的句子中正确使用一般过去时",
    createdAt: iso(1000 * 60 * 30),
  },
  {
    id: "err-2",
    userId: DEMO_USER_ID,
    submissionId: "sub-1",
    code: "prep_discuss",
    category: "Prepositions",
    severity: "medium",
    originalText: "We discussed about the new project",
    correctedText: "We discussed the new project",
    explanationZh: "“discuss” 是及物动词，后面直接接宾语，不需要加介词 “about”。",
    microLessonZh:
      "一些动词本身已包含介词含义，后面不再加介词，例如 discuss something、enter a room、marry someone、contact someone。记住这些 “假朋友” 可以避免中式英语。",
    practiceGoal: "掌握 discuss、enter、contact 等及物动词的正确用法",
    createdAt: iso(1000 * 60 * 30),
  },
  {
    id: "err-3",
    userId: DEMO_USER_ID,
    submissionId: "sub-1",
    code: "word_choice_success",
    category: "Word Choice",
    severity: "medium",
    originalText: "it will be very success",
    correctedText: "it will be very successful",
    explanationZh: "这里需要形容词来修饰，应使用 “successful”，而 “success” 是名词。",
    microLessonZh:
      "注意名词与形容词的区别：success（名词）→ successful（形容词）；danger → dangerous；care → careful。be 动词后通常接形容词描述主语状态。",
    practiceGoal: "区分常见名词与对应形容词形式",
    createdAt: iso(1000 * 60 * 30),
  },
  {
    id: "err-4",
    userId: DEMO_USER_ID,
    submissionId: "sub-1",
    code: "subject_verb_say",
    category: "Subject-Verb Agreement",
    severity: "high",
    originalText: "My manager say that I need improve",
    correctedText: "My manager says that I need to improve",
    explanationZh: "主语 “My manager” 是第三人称单数，动词要加 -s 变为 “says”；同时 “need” 后接动词不定式 “to improve”。",
    microLessonZh:
      "第三人称单数（he/she/it 及单数名词）在一般现在时中谓语动词加 -s/-es。另外 need to do something 表示需要做某事，注意保留 to。",
    practiceGoal: "在一般现在时中正确处理第三人称单数与不定式",
    createdAt: iso(1000 * 60 * 30),
  },
  {
    id: "err-5",
    userId: DEMO_USER_ID,
    submissionId: "sub-1",
    code: "verb_form_agree",
    category: "Verb Tense",
    severity: "medium",
    originalText: "I am agree with him",
    correctedText: "I agree with him",
    explanationZh: "“agree” 本身是动词，表示 “同意”，不需要 be 动词。“I am agree” 是常见的中式英语错误。",
    microLessonZh:
      "agree 是实义动词，直接说 I agree / I don't agree。类似的还有 I think、I know，都不能加 am/is/are。",
    practiceGoal: "避免在实义动词前误加 be 动词",
    createdAt: iso(1000 * 60 * 30),
  },
  {
    id: "err-6",
    userId: DEMO_USER_ID,
    submissionId: "sub-1",
    code: "comparative_double",
    category: "Comparatives",
    severity: "low",
    originalText: "become more better",
    correctedText: "become better",
    explanationZh: "“better” 已经是 “good” 的比较级，不能再加 “more” 构成双重比较级。",
    microLessonZh:
      "比较级不能叠加：不要说 more better、more easier。短形容词直接加 -er（fast → faster），长形容词用 more（more important）。",
    practiceGoal: "避免双重比较级，正确构造形容词比较形式",
    createdAt: iso(1000 * 60 * 30),
  },
]

const mockSubmissions: Submission[] = [
  {
    id: "sub-1",
    userId: DEMO_USER_ID,
    mode: "writing",
    originalText: SAMPLE_PARAGRAPH,
    correctedText:
      "Yesterday I went to the meeting with my team. We discussed the new project, and I think it will be very successful. My manager says that I need to improve my communication skills. I agree with him because sometimes I cannot express my ideas clearly. I also want to become better at writing emails.",
    cefrEstimate: "B1",
    summaryZh: "整体表达清晰，主要问题集中在动词时态和介词搭配上。",
    createdAt: iso(1000 * 60 * 30),
  },
  {
    id: "sub-2",
    userId: DEMO_USER_ID,
    mode: "chat",
    originalText: "Can you tell me how to write a formal email to my boss for asking a day off?",
    correctedText:
      "Could you tell me how to write a formal email to my boss to request a day off?",
    cefrEstimate: "B1",
    summaryZh: "语气可以更正式，“asking” 改为 “to request” 更符合书面语域。",
    createdAt: iso(1000 * 60 * 60 * 6),
  },
  {
    id: "sub-3",
    userId: DEMO_USER_ID,
    mode: "writing",
    originalText: "Last month our company have launched a new product and the feedbacks was good.",
    correctedText:
      "Last month our company launched a new product, and the feedback was good.",
    cefrEstimate: "A2",
    summaryZh: "注意 feedback 是不可数名词，且主谓一致需要修正。",
    createdAt: iso(1000 * 60 * 60 * 30),
  },
  {
    id: "sub-4",
    userId: DEMO_USER_ID,
    mode: "practice",
    originalText: "She don't likes coffee in the morning.",
    correctedText: "She doesn't like coffee in the morning.",
    cefrEstimate: "A2",
    summaryZh: "第三人称单数否定句应使用 doesn't，且其后动词用原形。",
    createdAt: iso(1000 * 60 * 60 * 52),
  },
]

export const mockDiagnostic: DiagnoseResponse = {
  submission: mockSubmissions[0],
  diagnostic: {
    cefrEstimate: "B1",
    overallScore: 64,
    summaryZh: "你的表达整体可以被理解，但动词时态和介词搭配的错误较多，建议优先突破这两项。",
    strengthsZh: [
      "句子结构完整，逻辑连贯，读者容易理解你的意思。",
      "词汇量适中，能够表达工作场景下的基本想法。",
      "敢于尝试较复杂的句型，如原因从句 because...。",
    ],
    weaknessesZh: [
      "动词时态不稳定，过去时与现在时混用。",
      "介词搭配错误，出现 discuss about 等中式英语。",
      "名词与形容词形式混淆，如 success 与 successful。",
    ],
    correctedText: mockSubmissions[0].correctedText as string,
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
        skillCode: "prepositions",
        label: "Prepositions",
        zhLabel: "介词搭配",
        masteryDelta: -4,
        evidenceZh: "discuss about 属于典型介词冗余错误。",
      },
      {
        skillCode: "word_choice",
        label: "Word Choice",
        zhLabel: "词汇选择",
        masteryDelta: -3,
        evidenceZh: "success/successful 混用，词性判断有待加强。",
      },
    ],
    recommendedNextActionsZh: [
      "完成一组 “一般过去时” 的改错练习。",
      "复习 discuss、enter、contact 等及物动词的用法。",
      "整理名词转形容词的常见词表并记忆。",
      "生成 7 天个性化计划，系统性地攻克薄弱项。",
    ],
  },
  updatedSkills: mockSkills,
  profile: mockProfile,
}

export const mockPlan: LearningPlan = {
  id: "plan-1",
  userId: DEMO_USER_ID,
  title: "7-Day Plan: Verb Tense & Prepositions Focus",
  createdAt: iso(1000 * 60 * 60 * 24),
  updatedAt: iso(1000 * 60 * 60 * 2),
  days: [
    {
      day: 1,
      goalZh: "巩固一般过去时的基本规则",
      targetSkillCodes: ["verb_tense"],
      tasks: [
        {
          id: "t1-1",
          titleZh: "改错练习：过去时间状语",
          descriptionZh: "完成 8 个含 yesterday/last week 的句子改错。",
          practiceType: "fix_sentence",
          estimatedMinutes: 10,
          completed: true,
        },
        {
          id: "t1-2",
          titleZh: "不规则动词记忆",
          descriptionZh: "记忆并默写 15 个高频不规则动词的过去式。",
          practiceType: "fill_blank",
          estimatedMinutes: 8,
          completed: true,
        },
      ],
    },
    {
      day: 2,
      goalZh: "掌握及物动词的介词用法",
      targetSkillCodes: ["prepositions"],
      tasks: [
        {
          id: "t2-1",
          titleZh: "删除多余介词",
          descriptionZh: "改写含 discuss about、enter into 等错误的句子。",
          practiceType: "fix_sentence",
          estimatedMinutes: 10,
          completed: false,
        },
        {
          id: "t2-2",
          titleZh: "介词填空",
          descriptionZh: "完成 10 道动词后介词搭配填空题。",
          practiceType: "fill_blank",
          estimatedMinutes: 9,
          completed: false,
        },
      ],
    },
    {
      day: 3,
      goalZh: "区分名词与形容词形式",
      targetSkillCodes: ["word_choice"],
      tasks: [
        {
          id: "t3-1",
          titleZh: "词性改写",
          descriptionZh: "将句中的名词改为正确的形容词形式。",
          practiceType: "rewrite_sentence",
          estimatedMinutes: 12,
          completed: false,
        },
        {
          id: "t3-2",
          titleZh: "词表记忆",
          descriptionZh: "整理 success/successful 等 12 组词。",
          practiceType: "fill_blank",
          estimatedMinutes: 7,
          completed: false,
        },
      ],
    },
    {
      day: 4,
      goalZh: "现在时第三人称单数与主谓一致",
      targetSkillCodes: ["subject_verb", "verb_tense"],
      tasks: [
        {
          id: "t4-1",
          titleZh: "主谓一致改错",
          descriptionZh: "修正第三人称单数动词缺 -s 的句子。",
          practiceType: "fix_sentence",
          estimatedMinutes: 10,
          completed: false,
        },
        {
          id: "t4-2",
          titleZh: "句子重写",
          descriptionZh: "将复数主语句改写为单数主语句并调整动词。",
          practiceType: "rewrite_sentence",
          estimatedMinutes: 11,
          completed: false,
        },
      ],
    },
    {
      day: 5,
      goalZh: "比较级与最高级",
      targetSkillCodes: ["comparatives"],
      tasks: [
        {
          id: "t5-1",
          titleZh: "比较级改错",
          descriptionZh: "修正 more better 等双重比较级错误。",
          practiceType: "fix_sentence",
          estimatedMinutes: 9,
          completed: false,
        },
        {
          id: "t5-2",
          titleZh: "比较级造句",
          descriptionZh: "用给定形容词造 6 个比较级句子。",
          practiceType: "rewrite_sentence",
          estimatedMinutes: 10,
          completed: false,
        },
      ],
    },
    {
      day: 6,
      goalZh: "提升正式邮件的语域与语气",
      targetSkillCodes: ["register", "clarity"],
      tasks: [
        {
          id: "t6-1",
          titleZh: "口语转书面",
          descriptionZh: "将随意口语句改写为正式邮件用语。",
          practiceType: "rewrite_sentence",
          estimatedMinutes: 13,
          completed: false,
        },
        {
          id: "t6-2",
          titleZh: "礼貌请求表达",
          descriptionZh: "练习 Could you / Would it be possible 等句型。",
          practiceType: "fill_blank",
          estimatedMinutes: 8,
          completed: false,
        },
      ],
    },
    {
      day: 7,
      goalZh: "综合复习并完成一次写作诊断",
      targetSkillCodes: ["verb_tense", "prepositions", "word_choice"],
      tasks: [
        {
          id: "t7-1",
          titleZh: "综合改错",
          descriptionZh: "完成一段含多种错误类型的综合改错。",
          practiceType: "fix_sentence",
          estimatedMinutes: 15,
          completed: false,
        },
        {
          id: "t7-2",
          titleZh: "写作复诊",
          descriptionZh: "写一段 100 词短文并提交诊断，对比第一天的进步。",
          practiceType: "rewrite_sentence",
          estimatedMinutes: 20,
          completed: false,
        },
      ],
    },
  ],
}

const exercisePool: Record<string, PracticeExercise> = {
  verb_tense: {
    id: "ex-vt",
    userId: DEMO_USER_ID,
    type: "fix_sentence",
    targetSkillCode: "verb_tense",
    promptZh: "下面的句子有一个动词时态错误，请改正整句。",
    question: "Last weekend we go to the beach and swim in the sea.",
    createdAt: iso(0),
  },
  prepositions: {
    id: "ex-prep",
    userId: DEMO_USER_ID,
    type: "fill_blank",
    targetSkillCode: "prepositions",
    promptZh: "选择并填入正确的介词（若不需要介词请留空）。",
    question: "We will discuss ___ the budget at tomorrow's meeting.",
    createdAt: iso(0),
  },
  word_choice: {
    id: "ex-wc",
    userId: DEMO_USER_ID,
    type: "rewrite_sentence",
    targetSkillCode: "word_choice",
    promptZh: "改写句子，使用正确的形容词形式。",
    question: "The launch was a very success event for our team.",
    createdAt: iso(0),
  },
  default: {
    id: "ex-default",
    userId: DEMO_USER_ID,
    type: "fix_sentence",
    targetSkillCode: "verb_tense",
    promptZh: "下面的句子有一处语法错误，请改正整句。",
    question: "She don't likes to wake up early on weekdays.",
    createdAt: iso(0),
  },
}

export function mockExerciseFor(skillCode?: string): PracticeExercise {
  const exercise = (skillCode && exercisePool[skillCode]) || exercisePool.default
  return { ...exercise, id: `${exercise.id}-${Math.random().toString(36).slice(2, 8)}` }
}

export function mockGradeFor(exerciseId: string, userAnswer: string): PracticeGrade {
  const answer = userAnswer.trim().toLowerCase()
  const isCorrect =
    answer.includes("went") ||
    answer.includes("doesn't like") ||
    answer.includes("successful") ||
    (answer.length > 10 && !answer.includes("discuss about"))
  return {
    isCorrect,
    score: isCorrect ? 92 : 48,
    feedbackZh: isCorrect
      ? "很好！你正确地修正了核心错误，时态与用词都准确。继续保持。"
      : "还差一点。请注意核心语法点——重点检查动词形式与介词搭配，再试一次。",
    correctedAnswer: "Last weekend we went to the beach and swam in the sea.",
    skillMasteryDelta: isCorrect ? 6 : -2,
  }
}

export const mockProfileResponse: ProfileResponse = {
  profile: mockProfile,
  skills: mockSkills,
  recentErrors: mockErrors,
  recentSubmissions: mockSubmissions,
}

export const mockHistory: HistoryResponse = {
  submissions: mockSubmissions,
  errors: mockErrors,
}
