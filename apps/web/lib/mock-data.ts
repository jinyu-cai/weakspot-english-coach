import type {
  DiagnosticResult,
  DailyStatsResponse,
  EnglishError,
  LearnerProfile,
  LearningNote,
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

export const mockDailyStats: DailyStatsResponse = {
  timezone: "America/Los_Angeles",
  generatedAt: "2026-06-20T17:00:00.000Z",
  today: {
    date: "2026-06-20",
    checkins: 1,
    practiceAttempts: 4,
    correctAttempts: 3,
    averageScore: 82,
    errorsFound: 5,
    minutesEstimated: 16,
    active: true,
  },
  weekly: [
    {
      date: "2026-06-14",
      checkins: 1,
      practiceAttempts: 2,
      correctAttempts: 1,
      averageScore: 68,
      errorsFound: 3,
      minutesEstimated: 10,
      active: true,
    },
    {
      date: "2026-06-15",
      checkins: 1,
      practiceAttempts: 3,
      correctAttempts: 2,
      averageScore: 74,
      errorsFound: 2,
      minutesEstimated: 13,
      active: true,
    },
    {
      date: "2026-06-16",
      checkins: 0,
      practiceAttempts: 2,
      correctAttempts: 1,
      averageScore: 70,
      errorsFound: 0,
      minutesEstimated: 6,
      active: true,
    },
    {
      date: "2026-06-17",
      checkins: 2,
      practiceAttempts: 4,
      correctAttempts: 3,
      averageScore: 79,
      errorsFound: 5,
      minutesEstimated: 20,
      active: true,
    },
    {
      date: "2026-06-18",
      checkins: 0,
      practiceAttempts: 0,
      correctAttempts: 0,
      averageScore: 0,
      errorsFound: 0,
      minutesEstimated: 0,
      active: false,
    },
    {
      date: "2026-06-19",
      checkins: 1,
      practiceAttempts: 3,
      correctAttempts: 2,
      averageScore: 77,
      errorsFound: 4,
      minutesEstimated: 13,
      active: true,
    },
    {
      date: "2026-06-20",
      checkins: 1,
      practiceAttempts: 4,
      correctAttempts: 3,
      averageScore: 82,
      errorsFound: 5,
      minutesEstimated: 16,
      active: true,
    },
  ],
  summary: {
    days: 7,
    activeDays: 6,
    streakDays: 2,
    totalCheckins: 6,
    totalPracticeAttempts: 18,
    totalCorrectAttempts: 12,
    totalErrorsFound: 19,
    averageScore: 76,
    minutesEstimated: 78,
  },
  achievements: [
    {
      id: "first-checkin",
      title: "First Check-in",
      description: "Complete one English check-in.",
      unlocked: true,
      progress: 1,
      target: 1,
    },
    {
      id: "three-day-streak",
      title: "3-Day Warm Streak",
      description: "Learn on three days in a row.",
      unlocked: false,
      progress: 2,
      target: 3,
    },
    {
      id: "practice-spark",
      title: "Practice Spark",
      description: "Finish five practice attempts.",
      unlocked: true,
      progress: 5,
      target: 5,
    },
    {
      id: "sunny-score",
      title: "Sunny Score",
      description: "Reach an average practice score of 80.",
      unlocked: false,
      progress: 76,
      target: 80,
    },
    {
      id: "today-winner",
      title: "Today’s Win",
      description: "Do any check-in or practice today.",
      unlocked: true,
      progress: 1,
      target: 1,
    },
  ],
  nextBestAction: {
    title: "Turn today’s clues into practice",
    description: "Do a short targeted exercise while the pattern is fresh.",
    href: "/practice",
  },
}

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
          estimatedMinutes: 15,
          completed: true,
          exercises: [
            { id: "pex_001", promptZh: "Find and correct the verb-tense error.", question: "Yesterday I walk to the park and play with my dog.", answer: "Yesterday I walked to the park and played with my dog.", explanationZh: "\"Yesterday\" signals past time, so regular verbs take -ed: walk -> walked, play -> played." },
            { id: "pex_002", promptZh: "Find and correct the verb-tense error.", question: "She finish her homework before dinner last night.", answer: "She finished her homework before dinner last night.", explanationZh: "\"Last night\" is a past-time phrase, so use finished." },
            { id: "pex_003", promptZh: "Find and correct the verb-tense error.", question: "They arrive at the airport two hours early and wait for their flight.", answer: "They arrived at the airport two hours early and waited for their flight.", explanationZh: "The whole sentence describes a past event, so arrive and wait become arrived and waited." },
            { id: "pex_004", promptZh: "Find and correct the verb-tense error.", question: "Last summer we travel to Japan and visit many temples.", answer: "Last summer we traveled to Japan and visited many temples.", explanationZh: "\"Last summer\" places the action in the past, so use traveled and visited." },
            { id: "pex_005", promptZh: "Find and correct the verb-tense error.", question: "The meeting start at 9 AM and end at noon yesterday.", answer: "The meeting started at 9 AM and ended at noon yesterday.", explanationZh: "\"Yesterday\" signals past time, so start and end become started and ended." },
            { id: "pex_006", promptZh: "Find and correct the verb-tense error.", question: "He promise to help me but then he change his mind.", answer: "He promised to help me but then he changed his mind.", explanationZh: "Both actions happened in the past, so promise and change become promised and changed." },
            { id: "pex_007", promptZh: "Find and correct the verb-tense error.", question: "We move to this city five years ago and like it very much.", answer: "We moved to this city five years ago and liked it very much.", explanationZh: "\"Five years ago\" clearly refers to the past, so use moved and liked." },
            { id: "pex_008", promptZh: "Find and correct the verb-tense error.", question: "The students study hard and pass the exam last month.", answer: "The students studied hard and passed the exam last month.", explanationZh: "\"Last month\" is a past-time phrase, so study becomes studied and pass becomes passed." },
            { id: "pex_009", promptZh: "Find and correct the verb-tense error.", question: "I call my mother and talk to her for an hour this morning.", answer: "I called my mother and talked to her for an hour this morning.", explanationZh: "If this morning is already finished, use the simple past: called and talked." },
            { id: "pex_010", promptZh: "Find and correct the verb-tense error.", question: "She open the door, look outside, and close it again.", answer: "She opened the door, looked outside, and closed it again.", explanationZh: "For a sequence of past actions, use past-tense verbs: opened, looked, and closed." },
          ],
        },
        {
          id: "p1-t2",
          titleZh: "Irregular verb memorization",
          descriptionZh: "Learn and test the past tense of 15 common irregular verbs.",
          practiceType: "fill_blank",
          estimatedMinutes: 15,
          completed: false,
          exercises: [
            { id: "pex_011", promptZh: "Fill in each blank with the past form of the verb.", question: "I ____ (go) to the supermarket and ____ (buy) some groceries.", answer: "I went to the supermarket and bought some groceries.", explanationZh: "Go -> went and buy -> bought are irregular past-tense forms." },
            { id: "pex_012", promptZh: "Fill in each blank with the past form of the verb.", question: "She ____ (write) a letter and ____ (send) it to her friend.", answer: "She wrote a letter and sent it to her friend.", explanationZh: "Write -> wrote and send -> sent are irregular past-tense forms." },
            { id: "pex_013", promptZh: "Fill in each blank with the past form of the verb.", question: "The children ____ (run) to the playground and ____ (begin) to play.", answer: "The children ran to the playground and began to play.", explanationZh: "Run -> ran and begin -> began change their vowel sounds in the past tense." },
            { id: "pex_014", promptZh: "Fill in each blank with the past form of the verb.", question: "He ____ (take) the bus and ____ (get) off at the wrong stop.", answer: "He took the bus and got off at the wrong stop.", explanationZh: "Take -> took and get -> got are common irregular past-tense forms." },
            { id: "pex_015", promptZh: "Fill in each blank with the past form of the verb.", question: "We ____ (eat) dinner and then ____ (drink) some coffee.", answer: "We ate dinner and then drank some coffee.", explanationZh: "Eat -> ate and drink -> drank are irregular past-tense forms." },
            { id: "pex_016", promptZh: "Fill in each blank with the past form of the verb.", question: "She ____ (speak) to the manager and ____ (tell) him the problem.", answer: "She spoke to the manager and told him the problem.", explanationZh: "Speak -> spoke and tell -> told are irregular past-tense forms." },
            { id: "pex_017", promptZh: "Fill in each blank with the past form of the verb.", question: "They ____ (swim) in the lake and ____ (catch) some fish.", answer: "They swam in the lake and caught some fish.", explanationZh: "Swim -> swam and catch -> caught are irregular past-tense forms." },
            { id: "pex_018", promptZh: "Fill in each blank with the past form of the verb.", question: "I ____ (think) about it and ____ (make) my decision.", answer: "I thought about it and made my decision.", explanationZh: "Think -> thought and make -> made are irregular past-tense forms." },
            { id: "pex_019", promptZh: "Fill in each blank with the past form of the verb.", question: "The teacher ____ (give) us homework and ____ (leave) the classroom.", answer: "The teacher gave us homework and left the classroom.", explanationZh: "Give -> gave and leave -> left are irregular past-tense forms." },
            { id: "pex_020", promptZh: "Fill in each blank with the past form of the verb.", question: "He ____ (find) his keys and ____ (put) them in his pocket.", answer: "He found his keys and put them in his pocket.", explanationZh: "Find -> found is irregular, while put stays the same in the past tense." },
          ],
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
          exercises: [],
        },
        {
          id: "p2-t2",
          titleZh: "Rewrite sentences",
          descriptionZh: "Rewrite present-perfect sentences in the simple past.",
          practiceType: "rewrite_sentence",
          estimatedMinutes: 10,
          completed: false,
          exercises: [],
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
          exercises: [],
        },
        {
          id: "p3-t2",
          titleZh: "Error-correction practice",
          descriptionZh: 'Find and fix "there is/are" errors.',
          practiceType: "fix_sentence",
          estimatedMinutes: 10,
          completed: false,
          exercises: [],
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
          exercises: [],
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
          exercises: [],
        },
        {
          id: "p5-t2",
          titleZh: "Preposition fill-in-the-blank",
          descriptionZh: "Choose the correct preposition to complete each sentence.",
          practiceType: "fill_blank",
          estimatedMinutes: 8,
          completed: false,
          exercises: [],
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
          exercises: [],
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
          exercises: [],
        },
        {
          id: "p7-t2",
          titleZh: "Self error-correction",
          descriptionZh: "Submit the email and review your errors using the diagnostic report.",
          practiceType: "fix_sentence",
          estimatedMinutes: 10,
          completed: false,
          exercises: [],
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

export const mockNotes: LearningNote[] = [
  {
    id: "note-1",
    userId: DEMO_USER_ID,
    submissionId: "sub-latest",
    type: "expression",
    topic: "Talking about past activities",
    original: "Yesterday I go to my university",
    natural: "Yesterday I went to my university",
    explanation: "When telling a story about the past, use past-tense verbs to sound natural.",
    context: "Casual conversation or writing about past events; any register.",
    examples: ["I went to the gym after work yesterday.", "We visited our grandparents last weekend."],
    createdAt: "2026-06-20T10:00:00.000Z",
  },
  {
    id: "note-2",
    userId: DEMO_USER_ID,
    submissionId: "sub-latest",
    type: "vocabulary",
    topic: "Alternatives for 'good'",
    original: "good",
    natural: "great / solid / effective / impressive",
    explanation: "English has many synonyms for 'good' that carry different shades of meaning.",
    context: "Use 'great' for enthusiasm, 'solid' for reliability, 'effective' for results, 'impressive' for admiration.",
    examples: ["That was a solid presentation.", "The results were impressive."],
    createdAt: "2026-06-20T10:00:00.000Z",
  },
  {
    id: "note-3",
    userId: DEMO_USER_ID,
    submissionId: "sub-2",
    type: "grammar",
    topic: "Subject-verb agreement with 'there is/are'",
    original: "there is many problems",
    natural: "there are many problems",
    explanation: "'Many problems' is plural, so you need 'are' instead of 'is'.",
    context: "Formal and informal writing; especially common in academic and business English.",
    examples: ["There are several options to consider.", "There is only one solution left."],
    createdAt: "2026-06-19T14:30:00.000Z",
  },
]
