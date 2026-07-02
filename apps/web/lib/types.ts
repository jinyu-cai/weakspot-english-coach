export type CEFRLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2"
export type Severity = "low" | "medium" | "high"
export type PracticeType = "fix_sentence" | "fill_blank" | "rewrite_sentence"
export type DiagnosisMode = "fast" | "deep"
export type OutputLanguage = "en" | "zh-CN"
export type ChatImportEvidenceType = "user_error" | "expression_gap" | "assistant_correction" | "assistant_advice"
export type PlanErrorScope = "weekly" | "all"
export type TextChatModel = string
export type RealtimeVoiceModel = string

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

export interface ChatImportMessage {
  role: "user" | "assistant"
  text: string
  createdAt?: string | null
}

export interface ChatImportConversation {
  id?: string | null
  title?: string | null
  messages: ChatImportMessage[]
}

export interface ChatWeakness {
  code: string
  category: string
  severity: Severity
  evidenceType: ChatImportEvidenceType
  evidenceQuote: string
  suggestedBetterEnglish: string
  explanationZh: string
  microLessonZh: string
  practiceGoal: string
  confidence: number
}

export interface ChatImportAnalysis {
  cefrEstimate: CEFRLevel
  overallScore: number
  summaryZh: string
  strengthsZh: string[]
  topBlindSpotsZh: string[]
  weaknesses: ChatWeakness[]
  assistantConfirmedWeaknessesZh: string[]
  recommendedNextActionsZh: string[]
}

export interface ChatImportStats {
  conversationCount: number
  messageCount: number
  userMessageCount: number
  assistantMessageCount: number
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

export interface PlanExercise {
  id: string
  promptZh: string
  question: string
  answer: string
  explanationZh: string
}

export interface LearningPlanTask {
  id: string
  titleZh: string
  descriptionZh: string
  practiceType: PracticeType
  estimatedMinutes: number
  completed: boolean
  exercises: PlanExercise[]
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

export interface DailyStatsDay {
  date: string
  checkins: number
  practiceAttempts: number
  correctAttempts: number
  averageScore: number
  errorsFound: number
  minutesEstimated: number
  active: boolean
}

export interface DailyStatsSummary {
  days: number
  activeDays: number
  streakDays: number
  totalCheckins: number
  totalPracticeAttempts: number
  totalCorrectAttempts: number
  totalErrorsFound: number
  averageScore: number
  minutesEstimated: number
}

export interface DailyAchievement {
  id: string
  title: string
  description: string
  unlocked: boolean
  progress: number
  target: number
}

export interface NextBestAction {
  title: string
  description: string
  href: string
}

export type NoteType = "expression" | "vocabulary" | "grammar"

export interface LearningNote {
  id: string
  userId: string
  submissionId: string
  type: NoteType
  topic: string
  original: string
  natural: string
  explanation: string
  context: string
  examples: string[]
  createdAt: string
}

/* ---- Chat types ---- */

export interface ChatSession {
  id: string
  userId: string
  topic?: string | null
  scenarioPrompt?: string | null
  textModel?: TextChatModel | null
  voiceModel?: RealtimeVoiceModel | null
  messageCount: number
  summary?: string | null
  createdAt: string
  updatedAt: string
}

export interface ChatCorrection {
  original: string
  corrected: string
  explanationZh: string
}

export interface ChatBetterExpression {
  original: string
  natural: string
  explanationZh: string
}

export interface ChatMessage {
  id: string
  userId: string
  sessionId: string
  role: "user" | "assistant"
  content: string
  corrections?: ChatCorrection[] | null
  betterExpression?: ChatBetterExpression | null
  createdAt: string
}

export interface ChatSendResponse {
  userMessage: ChatMessage
  assistantMessage: ChatMessage
}

export interface ChatSessionsResponse {
  sessions: ChatSession[]
}

export interface ChatMessagesResponse {
  session: ChatSession
  messages: ChatMessage[]
}

/* ---- Voice / Realtime types ---- */

export interface VoiceCorrection {
  original: string
  corrected: string
  explanationZh: string
}

export interface VoiceCompletion {
  partialText: string
  suggestions: string[]
  hintZh: string
}

export interface VoiceBetterExpression {
  original: string
  natural: string
  explanationZh: string
}

export interface RealtimeSessionResponse {
  clientSecret: string
  sessionId: string
  model: RealtimeVoiceModel
  maxDurationSeconds?: number | null
  expiresAt?: number | null
}

/* ---- Session analysis types ---- */

export interface SessionCorrection {
  code: string
  category: string
  severity: Severity
  original: string
  corrected: string
  explanationZh: string
  microLessonZh: string
  practiceGoal: string
}

export interface SessionNaturalExpression {
  original: string
  natural: string
  explanationZh: string
  context: string
  examples: string[]
}

export interface SessionWeakness {
  code: string
  category: string
  severity: string
  evidenceQuote: string
  explanationZh: string
  practiceGoal: string
}

export interface SessionAnalysis {
  summaryZh: string
  corrections: SessionCorrection[]
  naturalExpressions: SessionNaturalExpression[]
  weaknesses: SessionWeakness[]
  strengthsZh: string[]
  recommendedNextActionsZh: string[]
}

export interface SessionAnalysisResponse {
  analysis: SessionAnalysis
  savedNotes: LearningNote[]
  savedErrors?: EnglishError[]
  updatedSkills: SkillState[]
  sessionId: string
  duplicate?: boolean
}

/* ---- Composite API response shapes ---- */

export interface DiagnoseResponse {
  submission: Submission
  diagnostic: DiagnosticResult
  updatedSkills: SkillState[]
  profile: LearnerProfile
  /** True when this exact text was already diagnosed; it was shown but not re-recorded. */
  duplicate?: boolean
  duplicateOf?: string | null
  notes?: LearningNote[]
}

export interface NotesResponse {
  notes: LearningNote[]
}

export interface DeleteSubmissionResponse {
  deleted: boolean
  submissionId: string
  removedErrors: number
  updatedSkills: SkillState[]
  profile: LearnerProfile | null
}

export interface ChatImportAnalyzeResponse {
  submission: Submission
  analysis: ChatImportAnalysis
  savedErrors: EnglishError[]
  updatedSkills: SkillState[]
  profile: LearnerProfile
  importStats: ChatImportStats
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
  notes?: LearningNote[]
}

export interface DailyStatsResponse {
  timezone: string
  today: DailyStatsDay
  weekly: DailyStatsDay[]
  summary: DailyStatsSummary
  achievements: DailyAchievement[]
  nextBestAction: NextBestAction
  generatedAt: string
}
