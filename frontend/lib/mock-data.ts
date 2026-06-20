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
    zhLabel: "Verb Tense",
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
    zhLabel: "Prepositions",
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
    zhLabel: "Subject-Verb Agreement",
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
    zhLabel: "Vocabulary Range",
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
    zhLabel: "Articles",
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
    zhLabel: "Clarity & Cohesion",
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
    zhLabel: "Register & Tone",
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
    explanationZh:
      'The sentence has a clear past-time marker, "Yesterday," so the verb must be in the past tense. The past tense of "go" is "went."',
    microLessonZh:
      "When a sentence contains past-time words like yesterday, last week, or ago, the main verb must be in the past tense. Regular verbs add -ed (work -> worked); irregular verbs must be memorized individually (go -> went, eat -> ate, write -> wrote).",
    practiceGoal: "Use the simple past correctly in sentences with past-time markers",
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
    explanationZh:
      '"Discuss" is a transitive verb, so it takes a direct object without the preposition "about." The past tense "discussed" is also needed here.',
    microLessonZh:
      'Some verbs already include the meaning of "about," so you cannot add "about" after them, e.g. discuss, mention, explain. Wrong: discuss about the plan. Correct: discuss the plan.',
    practiceGoal: "Remove unnecessary prepositions after transitive verbs",
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
    explanationZh:
      'The subject "problems" is plural, so the verb "be" must be "are," not "is." Use "there is" for singular and "there are" for plural.',
    microLessonZh:
      'In the "there is / there are" structure, the verb "be" agrees with the noun that follows it. Singular or uncountable: there is a problem / there is water. Plural: there are many problems.',
    practiceGoal: 'Choose "there is" or "there are" based on the noun number',
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
    explanationZh:
      'The subject "My manager" is third-person singular, so the simple-present verb takes -s: "says."',
    microLessonZh:
      "In the simple present, when the subject is third-person singular (he, she, it, or a single person/thing), the verb adds -s or -es: he works, she goes, my manager says.",
    practiceGoal: "Add -s to verbs after third-person singular subjects",
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
    explanationZh:
      '"Result" does not collocate naturally with "make." The more idiomatic verbs are "achieve" or "get" a good result. Pay attention to collocations.',
    microLessonZh:
      'Many English nouns have fixed verb collocations. "Result" commonly pairs with achieve, get, or produce rather than make. Building up your collocations makes your English sound more natural.',
    practiceGoal: "Use more natural verb-noun collocations",
    createdAt: "2026-06-17T14:22:00.000Z",
  },
]

export const mockDiagnostic: DiagnosticResult = {
  cefrEstimate: "B1",
  overallScore: 64,
  summaryZh:
    "Your writing communicates your meaning clearly and is generally easy to read, but you have recurring problems with verb tense and subject-verb agreement. Focus your practice on the past tense and third-person singular forms.",
  strengthsZh: [
    "Your sentences are complete and logically connected, so readers can follow your intent",
    "Your tone is natural and friendly, well suited to workplace communication",
    "Your vocabulary is sufficient to discuss everyday and work topics",
  ],
  weaknessesZh: [
    "Inconsistent verb tenses, especially mixing in the present tense when describing past events",
    "Subject-verb agreement errors (there is/are, third-person singular)",
    "Some verb-preposition and verb-noun collocations are not idiomatic",
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
      zhLabel: "Verb Tense",
      masteryDelta: -6,
      evidenceZh: "2 past-tense errors this time, so mastery decreased.",
    },
    {
      skillCode: "subject_verb_agreement",
      label: "Subject-Verb Agreement",
      zhLabel: "Subject-Verb Agreement",
      masteryDelta: -4,
      evidenceZh: 'Two errors: "there is many" and "manager say."',
    },
    {
      skillCode: "register",
      label: "Register & Tone",
      zhLabel: "Register & Tone",
      masteryDelta: 3,
      evidenceZh: "Appropriate email tone, so mastery increased slightly.",
    },
  ],
  recommendedNextActionsZh: [
    "Complete 5 simple-past error-correction exercises",
    'Review the use of "there is / there are" and do fill-in-the-blank practice',
    "Collect 10 common verb + noun collocations",
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
    summaryZh: "Verb tense and subject-verb agreement were the main issues this time.",
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
    summaryZh: "This email has almost no errors, the tone is professional, and it reads very well.",
    createdAt: "2026-06-15T09:30:00.000Z",
  },
  {
    id: "sub-3",
    userId: DEMO_USER_ID,
    mode: "practice",
    originalText: "She don't like coffee in the morning.",
    correctedText: "She doesn't like coffee in the morning.",
    cefrEstimate: "B1",
    summaryZh: 'The third-person singular negative should use "doesn\'t."',
    createdAt: "2026-06-14T16:10:00.000Z",
  },
  {
    id: "sub-4",
    userId: DEMO_USER_ID,
    mode: "chat",
    originalText: "Last year I have visited three countries for work.",
    correctedText: "Last year I visited three countries for work.",
    cefrEstimate: "B1",
    summaryZh: "Use the simple past, not the present perfect, when there is a clear past time reference.",
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
      goalZh: "Reinforce the basic rules of the simple past",
      targetSkillCodes: ["verb_tense"],
      tasks: [
        {
          id: "p1-t1",
          titleZh: "Regular verb past-tense correction",
          descriptionZh: "Rewrite 8 sentences, changing present-tense verbs into the correct past tense.",
          practiceType: "fix_sentence",
          estimatedMinutes: 10,
          completed: true,
        },
        {
          id: "p1-t2",
          titleZh: "Irregular verb memorization",
          descriptionZh: "Learn and test the past tense of 15 common irregular verbs.",
          practiceType: "fill_blank",
          estimatedMinutes: 12,
          completed: false,
        },
      ],
    },
    {
      day: 2,
      goalZh: "Distinguish the simple past from the present perfect",
      targetSkillCodes: ["verb_tense"],
      tasks: [
        {
          id: "p2-t1",
          titleZh: "Tense-selection fill-in-the-blank",
          descriptionZh: "Choose the correct tense based on the time expression.",
          practiceType: "fill_blank",
          estimatedMinutes: 12,
          completed: false,
        },
        {
          id: "p2-t2",
          titleZh: "Rewrite sentences",
          descriptionZh: "Rewrite present-perfect sentences in the simple past.",
          practiceType: "rewrite_sentence",
          estimatedMinutes: 10,
          completed: false,
        },
      ],
    },
    {
      day: 3,
      goalZh: 'Master "there is / there are"',
      targetSkillCodes: ["subject_verb_agreement"],
      tasks: [
        {
          id: "p3-t1",
          titleZh: "Singular/plural fill-in-the-blank",
          descriptionZh: 'Choose "is" or "are" based on the noun.',
          practiceType: "fill_blank",
          estimatedMinutes: 8,
          completed: false,
        },
        {
          id: "p3-t2",
          titleZh: "Error-correction practice",
          descriptionZh: 'Find and fix "there is/are" errors.',
          practiceType: "fix_sentence",
          estimatedMinutes: 10,
          completed: false,
        },
      ],
    },
    {
      day: 4,
      goalZh: "Third-person singular verb forms",
      targetSkillCodes: ["subject_verb_agreement"],
      tasks: [
        {
          id: "p4-t1",
          titleZh: 'Adding "-s" to verbs',
          descriptionZh: "Correctly conjugate verbs for third-person singular subjects.",
          practiceType: "fix_sentence",
          estimatedMinutes: 10,
          completed: false,
        },
      ],
    },
    {
      day: 5,
      goalZh: "Improve verb-preposition collocations",
      targetSkillCodes: ["prepositions"],
      tasks: [
        {
          id: "p5-t1",
          titleZh: "Remove unnecessary prepositions",
          descriptionZh: 'Fix common preposition errors like "discuss about."',
          practiceType: "fix_sentence",
          estimatedMinutes: 10,
          completed: false,
        },
        {
          id: "p5-t2",
          titleZh: "Preposition fill-in-the-blank",
          descriptionZh: "Choose the correct preposition to complete each sentence.",
          practiceType: "fill_blank",
          estimatedMinutes: 8,
          completed: false,
        },
      ],
    },
    {
      day: 6,
      goalZh: "Enrich verb-noun collocations",
      targetSkillCodes: ["vocabulary_range"],
      tasks: [
        {
          id: "p6-t1",
          titleZh: "Collocation rewriting",
          descriptionZh: "Replace generic verbs like make/do with more idiomatic verbs.",
          practiceType: "rewrite_sentence",
          estimatedMinutes: 12,
          completed: false,
        },
      ],
    },
    {
      day: 7,
      goalZh: "Comprehensive writing review",
      targetSkillCodes: ["verb_tense", "subject_verb_agreement", "vocabulary_range"],
      tasks: [
        {
          id: "p7-t1",
          titleZh: "Write a work email",
          descriptionZh: "Write an 80-100 word work email that applies everything you learned this week.",
          practiceType: "rewrite_sentence",
          estimatedMinutes: 15,
          completed: false,
        },
        {
          id: "p7-t2",
          titleZh: "Self error-correction",
          descriptionZh: "Submit the email and review your errors using the diagnostic report.",
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
    promptZh: "The sentence below has a verb-tense error. Correct it and write out the full, correct sentence.",
    question: "Last weekend we go to the beach and swim in the sea.",
    answer: "Last weekend we went to the beach and swam in the sea.",
    explanationZh: 'There is a clear past time, "Last weekend," so "go" becomes "went" and "swim" becomes "swam."',
    createdAt: "2026-06-17T15:30:00.000Z",
  },
  subject_verb_agreement: {
    id: "ex-sva",
    userId: DEMO_USER_ID,
    type: "fill_blank",
    targetSkillCode: "subject_verb_agreement",
    promptZh: "Fill in the blank with the correct form of the verb in parentheses.",
    question: "There ____ (be) several mistakes in this report that we need to fix.",
    answer: "There are several mistakes in this report that we need to fix.",
    explanationZh: '"Mistakes" is plural, so the verb "be" is "are."',
    createdAt: "2026-06-17T15:30:00.000Z",
  },
  prepositions: {
    id: "ex-prep",
    userId: DEMO_USER_ID,
    type: "fix_sentence",
    targetSkillCode: "prepositions",
    promptZh: "Correct the preposition error in the sentence below.",
    question: "Let's discuss about the budget tomorrow morning.",
    answer: "Let's discuss the budget tomorrow morning.",
    explanationZh: '"Discuss" is a transitive verb, so do not add "about" after it.',
    createdAt: "2026-06-17T15:30:00.000Z",
  },
  vocabulary_range: {
    id: "ex-vocab",
    userId: DEMO_USER_ID,
    type: "rewrite_sentence",
    targetSkillCode: "vocabulary_range",
    promptZh: "Replace the generic verb in the sentence with a more idiomatic one, and rewrite the sentence.",
    question: "Our team made a very good result this quarter.",
    answer: "Our team achieved a very good result this quarter.",
    explanationZh: '"Result" commonly pairs with "achieve" rather than "make."',
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
      ? "Perfect! You applied the target grammar point accurately. Keep it up."
      : `Almost there. Reference answer: "${expected}". Focus on the target grammar point: ${exercise.explanationZh ?? ""}`,
    correctedAnswer: expected,
    skillMasteryDelta: isCorrect ? 5 : partial ? 1 : -2,
  }
}
