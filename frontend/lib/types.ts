export type CEFRLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2"
export type Severity = "low" | "medium" | "high"
export type PracticeType = "fix_sentence" | "fill_blank" | "rewrite_sentence"
export type DiagnosisMode = "fast" | "deep"

export interface LearnerProfile {
  userId: string
  nativeLanguage: string
  targetLanguage: "English"
  estimatedLevel: CEFRLevel
  totalSubmissions: number
  totalPracticeAttempts: number
  createdAt: string
  updatedAt: string
}

export interface SkillState {
  userId: string
  skillCode: string
  label: string
  zhLabel: string
  mastery: number
  errorCount: number
  correctCount: number
  lastSeenAt?: string | null
  lastPracticedAt?: string | null
  updatedAt: string
}

export interface EnglishError {
  id: string
  userId: string
  submissionId: string
  code: string
  category: string
  severity: Severity
  originalText: string
  correctedText: string
  explanationZh: string
  microLessonZh: string
  practiceGoal: string
  createdAt: string
}

export interface SkillUpdate {
  skillCode: string
  label: string
  zhLabel: string
  masteryDelta: number
  evidenceZh: string
}

export interface Submission {
  id: string
  userId: string
  mode: "writing" | "chat" | "practice"
  originalText: string
  correctedText?: string | null
  cefrEstimate?: CEFRLevel | null
  summaryZh?: string | null
  createdAt: string
}

export interface DiagnosticResult {
  cefrEstimate: CEFRLevel
  overallScore: number
  summaryZh: string
  strengthsZh: string[]
  weaknessesZh: string[]
  correctedText: string
  errors: EnglishError[]
  skillUpdates: SkillUpdate[]
  recommendedNextActionsZh: string[]
}

export interface LearningPlanTask {
  id: string
  titleZh: string
  descriptionZh: string
  practiceType: PracticeType
  estimatedMinutes: number
  completed: boolean
}

export interface LearningPlanDay {
  day: number
  goalZh: string
  targetSkillCodes: string[]
  tasks: LearningPlanTask[]
}

export interface LearningPlan {
  id: string
  userId: string
  title: string
  days: LearningPlanDay[]
  createdAt: string
  updatedAt: string
}

export interface PracticeExercise {
  id: string
  userId: string
  type: PracticeType
  targetSkillCode: string
  promptZh: string
  question: string
  answer?: string
  explanationZh?: string
  createdAt: string
}

export interface PracticeGrade {
  isCorrect: boolean
  score: number
  feedbackZh: string
  correctedAnswer: string
  skillMasteryDelta: number
}

/* ---- Composite API response shapes ---- */

export interface DiagnoseResponse {
  submission: Submission
  diagnostic: DiagnosticResult
  updatedSkills: SkillState[]
  profile: LearnerProfile
}

export interface ProfileResponse {
  profile: LearnerProfile
  skills: SkillState[]
  recentErrors: EnglishError[]
  recentSubmissions: Submission[]
}

export interface PlanResponse {
  plan: LearningPlan | null
}

export interface PracticeGenerateResponse {
  exercise: PracticeExercise
}

export interface PracticeSubmitResponse {
  grade: PracticeGrade
  attempt: {
    id: string
    exerciseId: string
    userAnswer: string
    createdAt: string
  }
  updatedSkill: SkillState
}

export interface HistoryResponse {
  submissions: Submission[]
  errors: EnglishError[]
}
