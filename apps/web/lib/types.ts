export type CEFRLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2"
export type Severity = "low" | "medium" | "high"
export type PracticeType = "fix_sentence" | "fill_blank" | "rewrite_sentence"
export type DiagnosisMode = "fast" | "deep"
export type OutputLanguage = "en" | "zh-CN"
export type ChatImportEvidenceType = "user_error" | "expression_gap" | "assistant_correction" | "assistant_advice"
export type PlanErrorScope = "weekly" | "all"
export type TextChatModel = string
export type TextChatModelMode = "fast" | "deep"
export type RealtimeVoiceModel = string
export type MemoryKind = "preference" | "goal" | "strategy" | "weakness" | "episode"
export type MemoryStatus = "active" | "resolved" | "superseded" | "expired" | "forgotten"
export type InputLearningSourceType =
  | "series"
  | "movie"
  | "video"
  | "podcast"
  | "article"
  | "book"
  | "work"
  | "conversation"
  | "other"

export type CoachMissionType =
  | "guided_scene"
  | "picture_story"
  | "listen_retell"
  | "decision_response"
  | "vocabulary_in_action"
export type CoachMissionModality = "text" | "voice"
export type CoachMissionEnergy = "light" | "normal" | "challenge"
export type CoachGenerationMode = "fast" | "deep"

export interface CoachSceneMission {
  setting: string
  userRole: string
  aiRole: string
  goal: string
  scenarioPrompt: string
  starterMessage: string
  scenarioFamily: string
  scenarioKey: string
}

export interface CoachPictureMission {
  assetKey: "market_morning" | "rainy_bus_stop" | "kitchen_surprise"
}

export interface CoachListeningMission {
  script: string
  playLimit: number
}

export interface CoachDecisionMission {
  situation: string
  userRole: string
  audience: string
  decisionGoal: string
  constraints: string[]
}

export interface CoachVocabularyMission {
  situation: string
  communicativeGoal: string
  audience: string
  tone: string
  conceptsToExpress: string[]
}

export interface CoachPlannerInsight {
  whyNow: string
  evidenceUsed: string[]
  adaptation: string
  evaluationFocus: string[]
}

export interface CoachGenerationMetadata {
  provider: "OpenAI"
  model: string
  api: "responses"
  reasoningEffort: "none" | "low" | "medium" | "high" | "xhigh" | "max"
  feature: "adaptive_mission_planner_v1"
}

export interface CoachMission {
  id: string
  type: CoachMissionType
  title: string
  eyebrow: string
  briefing: string
  estimatedMinutes: 5 | 10 | 15
  difficulty: string
  targetSkills: string[]
  taskPrompt: string
  successCriteria: string[]
  hints: string[]
  activityRunId?: string | null
  schedulerDecision?: {
    targetSkills: string[]
    recommendedType: CoachMissionType
    reason: string
    policy: string
    generatedAt: string
    skillScores?: Array<Record<string, unknown>>
    missionTypeScores?: Array<Record<string, unknown>>
  } | null
  plannerInsight?: CoachPlannerInsight | null
  generation?: CoachGenerationMetadata | null
  scene?: CoachSceneMission | null
  picture?: CoachPictureMission | null
  listening?: CoachListeningMission | null
  decision?: CoachDecisionMission | null
  vocabulary?: CoachVocabularyMission | null
}

export interface CoachMissionRequest {
  durationMinutes: 5 | 10 | 15
  modality: CoachMissionModality
  energy: CoachMissionEnergy
  generationMode?: CoachGenerationMode
  preferredType?: CoachMissionType
}

export interface InputLab2TranscriptMissionRequest extends Omit<CoachMissionRequest, "preferredType" | "generationMode"> {
  title: string
  transcript: string
  rightsBasis: string
}

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
  analysisContext?: string | null
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
  targetEvidence?: TargetEvidence[]
}

export interface TargetEvidence {
  skillCode: string
  opportunityPresent: boolean
  outcome: "success" | "failure" | "avoided" | "no_opportunity"
  evidenceQuote: string
  confidence: number
}

export interface DiagnoseLearningContext {
  activityRunId: string
  missionType: string
  targetSkills: string[]
  modality: string
  hintLevel: number
  playCount: number
  contextKey?: string
  taskDifficulty?: number
  delayed?: boolean
  novelContext?: boolean
}

export type ActivityRunStatus = "assigned" | "started" | "completed" | "abandoned" | "skipped"

export interface ActivityRun {
  id: string
  userId: string
  activityType: "diagnose" | "coach" | "practice" | "plan" | "input_learning" | "chat" | "vocabulary"
  sourceId?: string | null
  parentRunId?: string | null
  title?: string | null
  taskType?: string | null
  goal?: string | null
  targetSkills: string[]
  modality?: string | null
  difficulty?: string | null
  estimatedMinutes?: number | null
  status: ActivityRunStatus
  hintLevel: number
  playCount: number
  attemptCount: number
  completedCriteria: number[]
  assignedAt: string
  startedAt?: string | null
  completedAt?: string | null
  abandonedAt?: string | null
  skippedAt?: string | null
  createdAt: string
  updatedAt: string
  version: number
}

export interface LearningState {
  userId: string
  skillCode: string
  label: string
  zhLabel: string
  abilityMean: number | null
  abilityUncertainty: number
  coverageStatus: "unassessed" | "exploring" | "enough_evidence"
  opportunityCount: number
  independentSuccessCount: number
  hintedSuccessCount: number
  failureCount: number
  avoidedCount: number
  noOpportunityCount: number
  delayedIndependentTransferCount: number
  contexts: string[]
  taskTypes: string[]
  modalities: Record<string, {
    abilityMean: number | null
    opportunityCount: number
    lastOutcome?: string
  }>
  retentionStabilityDays?: number | null
  retentionDifficulty?: number | null
  dueAt?: string | null
  lastEvidenceAt?: string | null
  lastIndependentUseAt?: string | null
  lastOutcome?: string | null
}

export interface EvidenceEvent {
  id: string
  clientEventId: string
  userId: string
  runId?: string | null
  sourceId?: string | null
  skillCode: string
  outcome: "success" | "hinted_success" | "failure" | "avoided" | "no_opportunity"
  opportunityPresent: boolean
  supportLevel: number
  modality: string
  taskType: string
  taskDifficulty: number
  evaluatorConfidence: number
  evidenceWeight: number
  contextKey?: string | null
  novelContext: boolean
  delayed: boolean
  evidenceQuote: string
  createdAt: string
}

export interface LearningOverview {
  states: LearningState[]
  recentRuns: ActivityRun[]
  recentEvidence: EvidenceEvent[]
  generatedAt: string
}

export interface PlanExercise {
  id: string
  promptZh: string
  question: string
  answer: string
  explanationZh: string
  activityRunId?: string | null
}

export interface LearningPlanTask {
  id: string
  titleZh: string
  descriptionZh: string
  practiceType: PracticeType
  estimatedMinutes: number
  completed: boolean
  status?: "assigned" | "started" | "completed" | "skipped"
  activityRunId?: string | null
  score?: number | null
  startedAt?: string | null
  completedAt?: string | null
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
  version?: number
  policy?: string
  currentDay?: number
  nextTaskId?: string | null
  progress?: {
    completedTasks: number
    totalTasks: number
    percent: number
  }
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
  activityRunId?: string | null
  sessionId?: string | null
  sequenceIndex?: number
  decision?: {
    reason?: string
    progressionStage?: string
    sessionPolicy?: string
    sequenceIndex?: number
  }
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
  minutesTracked?: number
  completedActivities?: number
  learningOpportunities?: number
  independentSuccesses?: number
  assistedSuccesses?: number
  failedOpportunities?: number
  noOpportunities?: number
  delayedTransfers?: number
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
  minutesTracked?: number
  completedActivities?: number
  learningOpportunities?: number
  independentSuccesses?: number
  assistedSuccesses?: number
  failedOpportunities?: number
  noOpportunities?: number
  delayedTransfers?: number
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

/* ---- MemoryAgent types ---- */

export interface MemoryScoreBreakdown {
  semantic: number
  lexical: number
  importance: number
  recency: number
  frequency: number
  critical: number
  verification?: "candidate" | "observed" | "confirmed" | "contradicted" | "legacy"
  verificationFactor?: number
}

export interface MemoryVerification {
  state: "candidate" | "observed" | "confirmed" | "contradicted"
  reason?: string
  independentSourceCount?: number
  needsConfirmation?: boolean
  updatedAt?: string
  contradictedAt?: string
  contradictedBy?: string
}

export interface WeaknessRetention {
  stabilityDays: number
  difficulty: number
  dueAt?: string | null
  lastColdRecallAt?: string | null
  lastReviewedAt?: string | null
  lastOutcome?: string
  attempts?: number
  successes?: number
  hintedSuccesses?: number
  failures?: number
  avoided?: number
  observedErrors?: number
  relapseRisk?: number
}

export interface ModalityMasteryState {
  mastery: number
  attempts?: number
  coldSuccesses?: number
  hintedSuccesses?: number
  failures?: number
  avoided?: number
  lastOutcome?: string
  lastEvidenceAt?: string
}

export interface WeaknessGraduation {
  policy: string
  state: "collecting" | "eligible" | "resolved"
  eligible: boolean
  progress?: number
  attempts?: number
  successfulAttempts?: number
  distinctDays?: number
  spanDays?: number
  recentSuccessRate?: number
  recentAverageScore?: number
  mastery?: number
  exerciseTypeCount?: number
  daysSinceLastObserved?: number
  lastObservedAt?: string | null
  criteria?: Record<string, boolean>
  thresholds?: {
    minAttempts: number
    minDistinctDays: number
    minSpanDays: number
    recentWindow: number
    minRecentSuccessRate: number
    recentAverageWindow: number
    minRecentAverageScore: number
    minMastery: number
    minExerciseTypes: number
    recurrenceFreeDays: number
  }
}

export interface MemoryItem {
  id: string
  userId: string
  kind: MemoryKind
  canonicalKey: string
  content: string
  evidence: string
  confidence: number
  importance: number
  status: MemoryStatus
  pinned: boolean
  sourceType: string
  sourceId: string
  observationCount: number
  accessCount: number
  lastAccessedAt?: string | null
  createdAt: string
  updatedAt: string
  expiresAt?: string | null
  supersededBy?: string | null
  resolvedAt?: string | null
  resolutionReason?: string | null
  reopenedCount?: number
  graduation?: WeaknessGraduation
  verification?: MemoryVerification
  retention?: WeaknessRetention
  modalityMastery?: Record<string, ModalityMasteryState>
  progressionStage?: "replay" | "variation" | "transfer"
  transferContexts?: string[]
  errorFingerprint?: {
    skillCode?: string
    originalExamples?: string[]
    correctedExamples?: string[]
    contexts?: string[]
    description?: string
  } | string
  retrievalScore?: number
  scoreBreakdown?: MemoryScoreBreakdown
  stats?: {
    skillCode?: string
    exerciseType?: PracticeType
    attempts?: number
    averageScore?: number
    successRate?: number
    lastScore?: number
  }
}

export interface MemoryPack {
  text: string
  items: MemoryItem[]
  estimatedTokens: number
  tokenBudget: number
  totalCandidates: number
  traceId?: string | null
  weaknessOverview: WeaknessOverview
}

export interface WeaknessOverview {
  totalActive: number
  includedCount: number
  complete: boolean
  format: "none" | "metrics" | "index" | "partial_index" | "omitted"
  estimatedTokens: number
  memoryIds: string[]
  suppressed: boolean
}

export interface MemoryTraceSelection {
  id: string
  kind: MemoryKind
  content: string
  score: number
  scoreBreakdown: MemoryScoreBreakdown
}

export interface MemoryTrace {
  id: string
  purpose: string
  queryPreview: string
  selectedMemoryIds: string[]
  selected: MemoryTraceSelection[]
  totalCandidates: number
  estimatedTokens: number
  tokenBudget: number
  createdAt: string
  weaknessOverview?: WeaknessOverview
}

export interface NextActionDecision {
  targetSkillCode: string
  practiceType: PracticeType
  reason: string
  skillReason: string
  practiceTypeReason: string
  supportingMemoryIds: string[]
  policy: string
  generatedAt: string
  skillScores: Array<{
    skillCode: string
    score: number
    mastery: number
    recentErrorCount: number
    attemptCount: number
    averagePracticeScore?: number | null
  }>
  practiceTypeScores: Array<{
    practiceType: PracticeType
    score: number
    attemptCount: number
    averageScore?: number | null
    memoryId?: string | null
  }>
}

export type NoteType = "expression" | "vocabulary" | "grammar"
export type NoteLearningState = "current" | "previous"

export interface NoteRelatedWeakness {
  id?: string | null
  skillCode: string
  status: "active" | "resolved"
  resolvedAt?: string | null
}

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
  sourceType?: "chat_selection"
  sourceRole?: "user" | "assistant"
  sessionId?: string
  messageId?: string
  learningState?: NoteLearningState
  relatedWeaknesses?: NoteRelatedWeakness[]
}

/* ---- Input Learning types ---- */

export type InputLearningMode = "grounded_capture" | "attention_mission"
export type InputLearningItemKind =
  | "word"
  | "phrase"
  | "collocation"
  | "grammar_pattern"
  | "pronunciation"
  | "culture"

export interface InputLearningItem {
  id: string
  sourceId: string
  position: number
  memoryId?: string | null
  kind: InputLearningItemKind
  expression: string
  meaning: string
  whyUseful: string
  personalizedReason?: string | null
  example: string
  sourceEvidence?: string | null
  grounded: boolean
  createdAt: string
  /** Compatibility with early versions of the Input Learning API. */
  register?: string | null
  difficulty?: string | null
  examples?: string[]
  tags?: string[]
}

export interface InputAttentionMission {
  objective: string
  beforeYouStart: string[]
  focusTargets: string[]
  whileConsuming: string[]
  afterYouFinish: string[]
}

export interface InputLearningSource {
  id: string
  sourceType: InputLearningSourceType
  title: string
  goal?: string | null
  mode: InputLearningMode
  status?: "processing" | "complete"
  outputLanguage: OutputLanguage
  summary: string
  contentProvided: boolean
  contentCharacters: number
  itemCount: number
  createdAt: string
  updatedAt: string
  memoryRecall?: {
    traceId?: string | null
    memoryIds: string[]
    estimatedTokens?: number
  } | null
  savedMemoryIds?: string[]
  items?: InputLearningItem[]
  attentionMission?: InputAttentionMission | null
  activityRunId?: string | null
  productionAttemptCount?: number
  delayedReviewDueAt?: string | null
  lastProductionAt?: string | null
}

export type InputLearningAttemptKind = "retell" | "required_reuse" | "delayed_retrieval"

export interface InputLearningAttempt {
  id: string
  kind: InputLearningAttemptKind
  passed: boolean
  feedback: string
  wordCount: number
  matchedExpressions: string[]
  requiredExpressions: string[]
  delayedEligible: boolean
  countedAsDelayed: boolean
  dueAt?: string | null
  activityRunId: string
  createdAt: string
  duplicate?: boolean
}

export interface InputLearningAnalyzeRequest {
  sourceType: InputLearningSourceType
  title: string
  content?: string
  transcript?: string
  notes?: string
  goal?: string
  targetItemCount: number
  outputLanguage: OutputLanguage
}

export interface InputLearningSourcesResponse {
  sources: InputLearningSource[]
  count: number
  nextCursor?: string | null
}

export interface InputLearningAnalyzeResponse {
  source: InputLearningSource
}

/* ---- Chat types ---- */

export interface ChatSession {
  id: string
  userId: string
  mode?: "text" | "voice"
  topic?: string | null
  scenarioPrompt?: string | null
  starterMessage?: string | null
  scenarioFamily?: string | null
  scenarioKey?: string | null
  missionRunId?: string | null
  missionType?: string | null
  missionTargetSkills?: string[]
  learningRunId?: string | null
  textModel?: TextChatModel | null
  textModelMode?: TextChatModelMode | null
  llmServerModelId?: string | null
  voiceModel?: RealtimeVoiceModel | null
  messageCount: number
  summary?: string | null
  analysis?: SessionAnalysis | null
  stealthPractice?: StealthPracticeResult | null
  stealthPractices?: StealthPracticeResult[]
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
  count?: number
  nextCursor?: string | null
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

export type StealthPracticeOutcome =
  | "success"
  | "hinted_success"
  | "failure"
  | "avoided"
  | "no_opportunity"

export interface StealthPracticeResult {
  probeId?: string | null
  probeKind?: "weakness" | "discovery" | null
  memoryId?: string | null
  targetSkillCode: string
  targetDescription?: string | null
  modality?: string | null
  context?: string | null
  elicitationStrategy?: string | null
  interactionMove?: string | null
  progressionStage?: string | null
  outcome: StealthPracticeOutcome
  messageZh?: string | null
  opportunityPresent?: boolean
  evidenceQuote?: string | null
  rationale?: string | null
  confidence?: number
  hintLevel?: number
  stateChanged?: boolean
  nextReviewAt?: string | null
  masteryBefore?: number | null
  masteryAfter?: number | null
}

export interface SessionAnalysisResponse {
  analysis: SessionAnalysis
  stealthPractice?: StealthPracticeResult | null
  stealthPractices?: StealthPracticeResult[]
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
  removedNotes: number
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
  learning?: {
    coverage: {
      unassessed: number
      exploring: number
      enoughEvidence: number
      tracked: number
      total: number
    }
    assistanceRate: number
    independentSuccesses: number
    assistedSuccesses: number
    failedOpportunities: number
    noOpportunities: number
    delayedTransfers: number
  }
  generatedAt: string
}
