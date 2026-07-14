/**
 * API client seam.
 *
 * For the v0 preview these functions return mock data shaped exactly like the
 * types in `lib/types.ts`. To connect a real backend, set
 * `NEXT_PUBLIC_API_BASE_URL` and flip `USE_MOCK` to `false` (or remove the mock
 * branches). The real endpoints live under `${API_BASE_URL}/api/v1`.
 *
 * Contract:
 *  POST /diagnose          { userId, text }                  -> DiagnoseResponse
 *  GET  /profile/{userId}                                    -> ProfileResponse
 *  POST /plan              { userId, errorScope? }             -> { plan }
 *  GET  /plan/{userId}                                        -> { plan|null }
 *  POST /practice/generate { userId, targetSkillCode? }      -> { exercise }
 *  POST /practice/submit   { userId, exerciseId, userAnswer, clientAttemptId } -> PracticeSubmitResponse
 *  GET  /history/{userId}                                    -> HistoryResponse
 *  GET  /stats/daily/{userId}?timezone=<IANA>&days=7         -> DailyStatsResponse
 *  POST /input-learning/analyze { sourceType, title, ... }    -> { source }
 *  GET  /input-learning?pageSize=&cursor=                    -> { sources, count, nextCursor }
 *  GET  /chat/sessions?pageSize=&cursor=                     -> { sessions, count, nextCursor }
 */

import type {
  ChatImportAnalyzeResponse,
  ChatImportConversation,
  ChatMessage,
  ChatMessagesResponse,
  CoachMission,
  CoachMissionRequest,
  ChatSendResponse,
  ChatSession,
  RealtimeVoiceModel,
  TextChatModel,
  ChatSessionsResponse,
  DailyStatsResponse,
  DeleteSubmissionResponse,
  DiagnoseResponse,
  DiagnosisMode,
  HistoryResponse,
  InputAttentionMission,
  InputLearningAnalyzeRequest,
  InputLearningAnalyzeResponse,
  InputLearningItem,
  InputLearningSource,
  InputLearningSourcesResponse,
  InputLab2TranscriptMissionRequest,
  LearningPlan,
  MemoryItem,
  MemoryKind,
  MemoryPack,
  MemoryStatus,
  MemoryTrace,
  NextActionDecision,
  NotesResponse,
  PlanErrorScope,
  PlanResponse,
  PracticeExercise,
  PracticeGenerateResponse,
  PracticeGrade,
  PracticeSubmitResponse,
  PracticeType,
  ProfileResponse,
  RealtimeSessionResponse,
  SessionAnalysisResponse,
} from "./types"
import {
  DEMO_USER_ID,
  getMockExercise,
  gradeMockAnswer,
  mockDiagnostic,
  mockDailyStats,
  mockErrors,
  mockNotes,
  mockPlan,
  mockProfile,
  mockSkills,
  mockSubmissions,
} from "./mock-data"
import {
  getLLMProviderHeaders,
  QWEN_37_MAX_MODEL,
  QWEN_37_PLUS_MODEL,
  type ServerLLMModel,
} from "./llm-settings"
import { getOutputLanguage } from "./language"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL
const USE_MOCK = !API_BASE_URL

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const withOutputLanguage = <T extends Record<string, unknown>>(body: T) => ({
  ...body,
  outputLanguage: getOutputLanguage(),
})

async function getErrorMessage(res: Response, path: string) {
  try {
    const payload = await res.json()
    const detail = payload?.detail
    if (Array.isArray(detail)) {
      return detail
        .map((item) => {
          const location = Array.isArray(item.loc) ? item.loc.join(".") : undefined
          return [location, item.msg].filter(Boolean).join(": ")
        })
        .join("; ")
    }
    if (detail && typeof detail === "object" && !Array.isArray(detail) && typeof detail.message === "string") {
      return detail.message
    }
    if (typeof detail === "string") return detail
    if (payload?.message) return String(payload.message)
  } catch {
    // Fall through to the status-based message.
  }
  return `Request failed (${res.status}): ${path}`
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}/api/v1${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...getLLMProviderHeaders(),
      ...(init?.headers ?? {}),
    },
    ...init,
  })
  if (!res.ok) {
    const message = await getErrorMessage(res, path)
    if (res.status === 429 && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("weakspot:needauth", { detail: { message } }))
    }
    throw new Error(message)
  }
  const payload = await res.json()
  if (payload && typeof payload === "object" && !Array.isArray(payload) && "error" in payload && payload.error) {
    const detail = "detail" in payload ? payload.detail : undefined
    const message = typeof detail === "string"
      ? detail
      : "message" in payload
        ? String(payload.message)
        : `Request failed: ${path}`
    throw new Error(message)
  }
  return payload as T
}

const LEARNER_HISTORY_PAGE_SIZE = 100

function newestFirst<T extends { id: string; createdAt: string }>(left: T, right: T) {
  return right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id)
}

function nextPageCursor(nextCursor: string | null | undefined, seen: Set<string>) {
  if (!nextCursor) return undefined
  if (seen.has(nextCursor)) throw new Error("The server returned a repeated history cursor.")
  seen.add(nextCursor)
  return nextCursor
}

export async function getServerLLMModels(): Promise<ServerLLMModel[]> {
  if (USE_MOCK) {
    return [
      {
        id: "default",
        label: "Server default",
        provider: "Server",
        model: QWEN_37_MAX_MODEL,
        fastModel: QWEN_37_PLUS_MODEL,
        adaptive: true,
      },
      {
        id: "qwen-deep",
        label: "Qwen 3.7 Max",
        provider: "Qwen Model Studio",
        model: QWEN_37_MAX_MODEL,
        mode: "deep",
      },
      {
        id: "qwen-fast",
        label: "Qwen 3.7 Plus",
        provider: "Qwen Model Studio",
        model: QWEN_37_PLUS_MODEL,
        mode: "fast",
      },
      {
        id: "deepseek-deep",
        label: "DeepSeek · Deep",
        provider: "DeepSeek",
        model: "deepseek-v4-pro",
        mode: "deep",
      },
      {
        id: "deepseek-fast",
        label: "DeepSeek · Fast",
        provider: "DeepSeek",
        model: "deepseek-v4-flash",
        mode: "fast",
      },
    ]
  }
  const payload = await apiFetch<{ models: ServerLLMModel[] }>("/llm/models")
  return payload.models
}

/* In-memory exercise cache so submit() can grade against the generated item. */
const exerciseCache = new Map<string, PracticeExercise>()

const memoryNow = new Date().toISOString()
let mockMemoryStore: MemoryItem[] = [
  {
    id: "mem-pref-business",
    userId: DEMO_USER_ID,
    kind: "preference",
    canonicalKey: "preference.learning_focus",
    content: "The learner wants to focus on business English.",
    evidence: "I want to practice business English for meetings.",
    confidence: 0.96,
    importance: 0.86,
    status: "active",
    pinned: true,
    sourceType: "chat",
    sourceId: "mock-chat",
    observationCount: 3,
    accessCount: 5,
    createdAt: memoryNow,
    updatedAt: memoryNow,
    expiresAt: null,
  },
  {
    id: "mem-goal-ielts",
    userId: DEMO_USER_ID,
    kind: "goal",
    canonicalKey: "goal.exam.ielts",
    content: "The learner is preparing for IELTS and is targeting stronger writing performance.",
    evidence: "I am preparing for IELTS writing.",
    confidence: 0.94,
    importance: 0.92,
    status: "active",
    pinned: false,
    sourceType: "diagnosis",
    sourceId: "mock-diagnosis",
    observationCount: 2,
    accessCount: 4,
    createdAt: memoryNow,
    updatedAt: memoryNow,
    expiresAt: new Date(Date.now() + 300 * 86400000).toISOString(),
  },
  {
    id: "mem-strategy-tense",
    userId: DEMO_USER_ID,
    kind: "strategy",
    canonicalKey: "strategy.practice.grammar.verb_tense.fix_sentence",
    content: "For grammar.verb_tense, fix_sentence has 6 attempts, an average score of 73, and a 67% success rate.",
    evidence: "Latest score: 82/100; correct=true.",
    confidence: 0.82,
    importance: 0.72,
    status: "active",
    pinned: false,
    sourceType: "practice",
    sourceId: "mock-attempt",
    observationCount: 6,
    accessCount: 2,
    createdAt: memoryNow,
    updatedAt: memoryNow,
    expiresAt: new Date(Date.now() + 180 * 86400000).toISOString(),
    stats: { skillCode: "grammar.verb_tense", exerciseType: "fix_sentence", attempts: 6, averageScore: 73, successRate: 0.67, lastScore: 82 },
  },
  {
    id: "mem-weak-tense",
    userId: DEMO_USER_ID,
    kind: "weakness",
    canonicalKey: "weakness.grammar.verb_tense",
    content: "The learner needs recurring practice with verb tense.",
    evidence: "Yesterday I go → Yesterday I went",
    confidence: 0.9,
    importance: 0.88,
    status: "active",
    pinned: false,
    sourceType: "diagnosis",
    sourceId: "mock-diagnosis",
    observationCount: 4,
    accessCount: 3,
    createdAt: memoryNow,
    updatedAt: memoryNow,
    expiresAt: new Date(Date.now() + 60 * 86400000).toISOString(),
  },
]

let mockInputLearningSources: InputLearningSource[] = []

export async function diagnose(
  userId: string,
  text: string,
  diagnosisMode: DiagnosisMode = "fast",
  analysisContext?: string,
): Promise<DiagnoseResponse> {
  if (USE_MOCK) {
    await delay(diagnosisMode === "fast" ? 700 : 1400)
    return {
      submission: {
        id: `sub-${Date.now()}`,
        userId,
        mode: "writing",
        originalText: text,
        correctedText: mockDiagnostic.correctedText,
        cefrEstimate: mockDiagnostic.cefrEstimate,
        summaryZh: mockDiagnostic.summaryZh,
        createdAt: new Date().toISOString(),
      },
      diagnostic: mockDiagnostic,
      updatedSkills: mockSkills,
      profile: mockProfile,
    }
  }
  return apiFetch<DiagnoseResponse>("/diagnose", {
    method: "POST",
    body: JSON.stringify(withOutputLanguage({
      userId,
      text,
      diagnosisMode,
      ...(analysisContext ? { analysisContext } : {}),
    })),
  })
}

export async function analyzeChatImport(
  userId: string,
  conversations: ChatImportConversation[],
  sourceName?: string,
  analysisMode: DiagnosisMode = "fast",
): Promise<ChatImportAnalyzeResponse> {
  if (USE_MOCK) {
    await delay(900)
    return {
      submission: {
        id: `chat-${Date.now()}`,
        userId,
        mode: "chat",
        originalText: conversations
          .flatMap((conversation) => conversation.messages.map((msg) => `${msg.role}: ${msg.text}`))
          .join("\n")
          .slice(0, 2200),
        correctedText:
          "The conversations show clear motivation to learn, but natural phrasing, the past tense, and word choice need focused practice.",
        cefrEstimate: "B1",
        summaryZh:
          "The conversations show clear motivation to learn, but natural phrasing, the past tense, and word choice need focused practice.",
        createdAt: new Date().toISOString(),
      },
      analysis: {
        cefrEstimate: "B1",
        overallScore: 66,
        summaryZh:
          "You actively use ChatGPT to practice English, but you often need the AI to turn your ideas into natural English for you.",
        strengthsZh: ["You actively ask for rewrites", "You practice around real tasks"],
        topBlindSpotsZh: ["Expression gaps", "Past tense", "Natural collocations"],
        weaknesses: [
          {
            code: "clarity.expression",
            category: "Expression gap",
            severity: "high",
            evidenceType: "expression_gap",
            evidenceQuote: "how can I say this",
            suggestedBetterEnglish: "How can I phrase this more naturally?",
            explanationZh:
              "This shows you have a clear idea but lack ready-made English phrase chunks you can reach for.",
            microLessonZh:
              "Turn common intentions into reusable English sentence patterns instead of translating word by word.",
            practiceGoal: "Collect 10 phrases for asking for help and requesting rewrites.",
            confidence: 0.88,
          },
          {
            code: "grammar.verb_tense",
            category: "Verb tense",
            severity: "high",
            evidenceType: "assistant_correction",
            evidenceQuote: "Assistant corrected: I go -> I went",
            suggestedBetterEnglish: "Yesterday I went...",
            explanationZh: "The AI already corrected the past tense, which confirms this is a known weakness.",
            microLessonZh:
              "When there is a past time word like yesterday or last week, the main verb must be in the past tense.",
            practiceGoal: "Retell 5 things you did yesterday using the simple past.",
            confidence: 0.92,
          },
        ],
        assistantConfirmedWeaknessesZh: [
          "Past-tense errors were explicitly corrected by the AI",
          "Requests for natural phrasing/rewrites appear repeatedly",
        ],
        recommendedNextActionsZh: [
          "Build expression-gap phrase flashcards",
          "Practice retelling events in the past tense",
          "Save the natural rewrites the AI gives you",
        ],
      },
      savedErrors: [],
      updatedSkills: mockSkills,
      profile: { ...mockProfile, totalSubmissions: mockProfile.totalSubmissions + 1 },
      importStats: {
        conversationCount: conversations.length,
        messageCount: conversations.reduce((sum, c) => sum + c.messages.length, 0),
        userMessageCount: conversations.reduce((sum, c) => sum + c.messages.filter((m) => m.role === "user").length, 0),
        assistantMessageCount: conversations.reduce(
          (sum, c) => sum + c.messages.filter((m) => m.role === "assistant").length,
          0,
        ),
      },
    }
  }
  return apiFetch<ChatImportAnalyzeResponse>("/chat-import/analyze", {
    method: "POST",
    body: JSON.stringify(withOutputLanguage({ userId, sourceName, analysisMode, conversations })),
  })
}

export async function getProfile(userId: string = DEMO_USER_ID): Promise<ProfileResponse> {
  if (USE_MOCK) {
    await delay(600)
    return {
      profile: mockProfile,
      skills: mockSkills,
      recentErrors: mockErrors,
      recentSubmissions: mockSubmissions,
    }
  }
  return apiFetch<ProfileResponse>(`/profile/${userId}`)
}

/* ---- MemoryAgent ---- */

export async function getMemories(
  status: MemoryStatus | "all" = "all",
): Promise<{ memories: MemoryItem[]; count: number; activeCount: number }> {
  if (USE_MOCK) {
    await delay(250)
    const memories = status === "all" ? mockMemoryStore : mockMemoryStore.filter((item) => item.status === status)
    return {
      memories,
      count: memories.length,
      activeCount: mockMemoryStore.filter((item) => item.status === "active").length,
    }
  }
  return apiFetch<{ memories: MemoryItem[]; count: number; activeCount: number }>(`/memory?status=${status}`)
}

export async function createMemory(input: {
  kind: MemoryKind
  content: string
  canonicalKey?: string
  evidence?: string
  pinned?: boolean
  importance?: number
}): Promise<MemoryItem> {
  if (USE_MOCK) {
    await delay(250)
    const now = new Date().toISOString()
    const memory: MemoryItem = {
      id: `mem-${Date.now()}`,
      userId: DEMO_USER_ID,
      kind: input.kind,
      canonicalKey: input.canonicalKey ?? `${input.kind}.manual-${Date.now()}`,
      content: input.content,
      evidence: input.evidence ?? "Added by the learner.",
      confidence: 1,
      importance: input.importance ?? 0.8,
      status: "active",
      pinned: input.pinned ?? false,
      sourceType: "manual",
      sourceId: `manual-${Date.now()}`,
      observationCount: 1,
      accessCount: 0,
      createdAt: now,
      updatedAt: now,
      expiresAt: input.pinned || input.kind === "preference" ? null : new Date(Date.now() + 365 * 86400000).toISOString(),
    }
    mockMemoryStore = [memory, ...mockMemoryStore]
    return memory
  }
  const { memory } = await apiFetch<{ memory: MemoryItem }>("/memory", {
    method: "POST",
    body: JSON.stringify({ userId: DEMO_USER_ID, ...input }),
  })
  return memory
}

export async function updateMemory(
  memoryId: string,
  fields: Partial<Pick<MemoryItem, "content" | "evidence" | "confidence" | "importance" | "pinned">>,
): Promise<MemoryItem> {
  if (USE_MOCK) {
    await delay(200)
    let updated: MemoryItem | undefined
    mockMemoryStore = mockMemoryStore.map((item) => {
      if (item.id !== memoryId) return item
      updated = {
        ...item,
        ...fields,
        expiresAt: fields.pinned === true ? null : item.expiresAt,
        updatedAt: new Date().toISOString(),
      }
      return updated
    })
    if (!updated) throw new Error("Memory not found")
    return updated
  }
  const { memory } = await apiFetch<{ memory: MemoryItem }>(`/memory/${memoryId}`, {
    method: "PATCH",
    body: JSON.stringify(fields),
  })
  return memory
}

export async function forgetMemory(memoryId: string): Promise<MemoryItem> {
  if (USE_MOCK) {
    await delay(200)
    let forgotten: MemoryItem | undefined
    mockMemoryStore = mockMemoryStore.map((item) => {
      if (item.id !== memoryId) return item
      forgotten = { ...item, status: "forgotten", pinned: false, updatedAt: new Date().toISOString() }
      return forgotten
    })
    if (!forgotten) throw new Error("Memory not found")
    return forgotten
  }
  const { memory } = await apiFetch<{ memory: MemoryItem }>(`/memory/${memoryId}`, { method: "DELETE" })
  return memory
}

export async function retrieveMemories(query: string, tokenBudget = 700): Promise<MemoryPack> {
  if (USE_MOCK) {
    await delay(350)
    const terms = query.toLowerCase().split(/\W+/).filter(Boolean)
    const active = mockMemoryStore.filter((item) => item.status === "active")
    const ranked = active
      .map((item) => {
        const haystack = `${item.kind} ${item.canonicalKey} ${item.content} ${item.evidence}`.toLowerCase()
        const lexical = terms.length ? terms.filter((term) => haystack.includes(term)).length / terms.length : 0
        const critical = item.kind === "preference" || item.kind === "goal" ? 1 : 0
        const retrievalScore = Math.min(1, 0.5 * lexical + 0.25 * item.importance + 0.15 * critical + (item.pinned ? 0.1 : 0))
        return {
          ...item,
          retrievalScore,
          scoreBreakdown: {
            semantic: lexical,
            lexical,
            importance: item.importance,
            recency: 1,
            frequency: Math.min(1, item.accessCount / 10),
            critical,
          },
        }
      })
      .sort((a, b) => (b.retrievalScore ?? 0) - (a.retrievalScore ?? 0))
      .slice(0, 6)
    const text = ranked.map((item) => `- [${item.kind} | ${item.id}] ${item.content}`).join("\n")
    return {
      text,
      items: ranked,
      estimatedTokens: Math.min(tokenBudget, Math.ceil(text.length / 4)),
      tokenBudget,
      totalCandidates: active.length,
      traceId: `mtr-${Date.now()}`,
    }
  }
  const { memoryPack } = await apiFetch<{ memoryPack: MemoryPack }>("/memory/retrieve", {
    method: "POST",
    body: JSON.stringify({ userId: DEMO_USER_ID, query, tokenBudget, limit: 6 }),
  })
  return memoryPack
}

export async function getMemoryTraces(): Promise<MemoryTrace[]> {
  if (USE_MOCK) {
    await delay(200)
    return [{
      id: "mtr-demo",
      purpose: "practice_generation",
      queryPreview: "Generate the next verb tense exercise",
      selectedMemoryIds: ["mem-pref-business", "mem-strategy-tense", "mem-weak-tense"],
      selected: mockMemoryStore.slice(0, 3).map((item, index) => ({
        id: item.id,
        kind: item.kind,
        content: item.content,
        score: 0.92 - index * 0.08,
        scoreBreakdown: { semantic: 0.85 - index * 0.1, lexical: 0.7, importance: item.importance, recency: 1, frequency: 0.4, critical: index === 0 ? 1 : 0 },
      })),
      totalCandidates: mockMemoryStore.length,
      estimatedTokens: 126,
      tokenBudget: 700,
      createdAt: memoryNow,
    }]
  }
  const { traces } = await apiFetch<{ traces: MemoryTrace[] }>("/memory/traces?limit=20")
  return traces
}

export async function getNextActionDecision(): Promise<NextActionDecision> {
  if (USE_MOCK) {
    await delay(200)
    return {
      targetSkillCode: "grammar.verb_tense",
      practiceType: "fix_sentence",
      reason: "Verb tense has the strongest learning need. Fix sentence is in the productive difficulty range based on 6 prior attempts.",
      skillReason: "Verb tense has the strongest current learning need.",
      practiceTypeReason: "Fix sentence balances learning need and observed effectiveness.",
      supportingMemoryIds: ["mem-strategy-tense"],
      policy: "hybrid-need-effectiveness-exploration-v1",
      generatedAt: memoryNow,
      skillScores: [{ skillCode: "grammar.verb_tense", score: 0.82, mastery: 43, recentErrorCount: 4, attemptCount: 6, averagePracticeScore: 73 }],
      practiceTypeScores: [{ practiceType: "fix_sentence", score: 0.78, attemptCount: 6, averageScore: 73, memoryId: "mem-strategy-tense" }],
    }
  }
  const { decision } = await apiFetch<{ decision: NextActionDecision }>("/memory/next-action")
  return decision
}

export async function getPlan(userId: string = DEMO_USER_ID): Promise<PlanResponse> {
  if (USE_MOCK) {
    await delay(500)
    return { plan: null }
  }
  return apiFetch<PlanResponse>(`/plan/${userId}`)
}

export async function generatePlan(
  userId: string = DEMO_USER_ID,
  errorScope: PlanErrorScope = "weekly",
): Promise<LearningPlan> {
  if (USE_MOCK) {
    await delay(1600)
    return mockPlan
  }
  const { plan } = await apiFetch<{ plan: LearningPlan }>("/plan", {
    method: "POST",
    body: JSON.stringify(withOutputLanguage({ userId, errorScope })),
  })
  return plan
}

export async function generatePractice(
  userId: string = DEMO_USER_ID,
  targetSkillCode?: string,
  practiceType?: PracticeType,
): Promise<PracticeExercise> {
  if (USE_MOCK) {
    await delay(900)
    const exercise = { ...getMockExercise(targetSkillCode), ...(practiceType ? { type: practiceType } : {}) }
    exerciseCache.set(exercise.id, exercise)
    return exercise
  }
  const { exercise } = await apiFetch<PracticeGenerateResponse>("/practice/generate", {
    method: "POST",
    body: JSON.stringify(withOutputLanguage({ userId, targetSkillCode, practiceType })),
  })
  return exercise
}

/**
 * Grade an ad-hoc exercise that isn't a stored PracticeExercise — used by the
 * plan-exercise practice runner. The question and model answer travel with the
 * request, and a wrong answer is recorded to the weakness library server-side.
 */
export async function gradePracticeAdhoc(
  userId: string = DEMO_USER_ID,
  params: {
    clientAttemptId: string
    targetSkillCode: string
    question: string
    expectedAnswer: string
    userAnswer: string
    exerciseType?: PracticeType
    promptZh?: string
    explanationZh?: string
  },
): Promise<PracticeGrade> {
  if (USE_MOCK) {
    await delay(900)
    return gradeMockAnswer(
      {
        id: "adhoc",
        userId,
        type: params.exerciseType ?? "fix_sentence",
        targetSkillCode: params.targetSkillCode,
        promptZh: params.promptZh ?? "",
        question: params.question,
        answer: params.expectedAnswer,
        explanationZh: params.explanationZh,
        createdAt: new Date().toISOString(),
      },
      params.userAnswer,
    )
  }
  const { grade } = await apiFetch<{ grade: PracticeGrade }>("/practice/grade", {
    method: "POST",
    body: JSON.stringify(withOutputLanguage({ userId, ...params })),
  })
  return grade
}

export async function submitPractice(
  userId: string = DEMO_USER_ID,
  exerciseId: string,
  userAnswer: string,
  clientAttemptId: string,
): Promise<PracticeGrade> {
  if (USE_MOCK) {
    await delay(900)
    const exercise = exerciseCache.get(exerciseId) ?? getMockExercise()
    return gradeMockAnswer(exercise, userAnswer)
  }
  const { grade } = await apiFetch<PracticeSubmitResponse>("/practice/submit", {
    method: "POST",
    body: JSON.stringify(withOutputLanguage({ userId, exerciseId, userAnswer, clientAttemptId })),
  })
  return grade
}

export async function getHistory(userId: string = DEMO_USER_ID): Promise<HistoryResponse> {
  if (USE_MOCK) {
    await delay(600)
    return { submissions: mockSubmissions, errors: mockErrors, notes: mockNotes }
  }
  return apiFetch<HistoryResponse>(`/history/${userId}`)
}

export async function deleteSubmission(
  submissionId: string,
  createdAt: string,
): Promise<DeleteSubmissionResponse> {
  if (USE_MOCK) {
    await delay(400)
    return { deleted: true, submissionId, removedErrors: 0, removedNotes: 0, updatedSkills: [], profile: null }
  }
  const params = new URLSearchParams({ createdAt })
  return apiFetch<DeleteSubmissionResponse>(`/history/${submissionId}?${params.toString()}`, {
    method: "DELETE",
  })
}

export async function getNotes(): Promise<NotesResponse> {
  if (USE_MOCK) {
    await delay(400)
    return { notes: mockNotes }
  }
  return apiFetch<NotesResponse>("/notes")
}

export async function deleteNote(noteId: string, createdAt: string): Promise<{ deleted: boolean; noteId: string }> {
  if (USE_MOCK) {
    await delay(300)
    return { deleted: true, noteId }
  }
  const params = new URLSearchParams({ createdAt })
  return apiFetch<{ deleted: boolean; noteId: string }>(`/notes/${noteId}?${params.toString()}`, {
    method: "DELETE",
  })
}

/* ---- Input Learning ---- */

export async function analyzeInputLearning(
  input: Omit<InputLearningAnalyzeRequest, "outputLanguage">,
): Promise<InputLearningSource> {
  if (USE_MOCK) {
    await delay(1100)
    const now = new Date().toISOString()
    const id = `input-${Date.now()}`
    const material = [input.content?.trim(), input.transcript?.trim()].filter(Boolean).join("\n\n")
    const grounded = Boolean(material)
    const language = getOutputLanguage()
    const sampleItems: Array<Omit<InputLearningItem, "id" | "sourceId" | "position" | "memoryId" | "createdAt">> = [
      {
        kind: "phrase",
        expression: "It turns out that...",
        meaning: language === "zh-CN" ? "结果发现……；原来……" : "Used when the real result is different from what you expected.",
        whyUseful: language === "zh-CN" ? "能让你讲经历时更自然地制造转折。" : "It gives stories a natural turn and helps you explain discoveries.",
        personalizedReason: language === "zh-CN" ? "它能替代你常用的简单 but 转折。" : "It expands beyond the simple contrast words you usually rely on.",
        example: "It turns out that the meeting had been moved to Friday.",
        sourceEvidence: null,
        grounded: false,
      },
      {
        kind: "collocation",
        expression: "raise a concern",
        meaning: language === "zh-CN" ? "提出担忧或问题" : "To mention a worry or possible problem for discussion.",
        whyUseful: language === "zh-CN" ? "适合工作会议和礼貌表达异议。" : "A useful, diplomatic phrase for meetings and professional conversations.",
        personalizedReason: language === "zh-CN" ? "与你的职场英语目标直接相关。" : "It directly supports your workplace-English goal.",
        example: "I'd like to raise a concern about the current timeline.",
        sourceEvidence: null,
        grounded: false,
      },
      {
        kind: "word",
        expression: "awkward",
        meaning: language === "zh-CN" ? "尴尬的；不自然的；棘手的" : "Uncomfortable, difficult, or not smooth and natural.",
        whyUseful: language === "zh-CN" ? "可以精确描述社交场面、措辞或局面。" : "It precisely describes social moments, wording, and difficult situations.",
        personalizedReason: language === "zh-CN" ? "帮助你减少 very bad 这类宽泛表达。" : "It helps you replace broad phrases such as very bad.",
        example: "There was an awkward silence after the question.",
        sourceEvidence: null,
        grounded: false,
      },
      {
        kind: "grammar_pattern",
        expression: "I wish I had + past participle",
        meaning: language === "zh-CN" ? "表达对过去事情的遗憾" : "A pattern for expressing regret about a past action or event.",
        whyUseful: language === "zh-CN" ? "能让复盘经历时的表达更准确。" : "It makes reflection on past experiences more precise.",
        personalizedReason: language === "zh-CN" ? "顺带强化你对过去时间的表达。" : "It also reinforces your control of past-time forms.",
        example: "I wish I had prepared a clearer answer.",
        sourceEvidence: null,
        grounded: false,
      },
      {
        kind: "phrase",
        expression: "What do you make of it?",
        meaning: language === "zh-CN" ? "你怎么看？你如何理解这件事？" : "A natural way to ask for someone's opinion or interpretation.",
        whyUseful: language === "zh-CN" ? "比 What do you think 更有变化。" : "It adds variety beyond What do you think?",
        personalizedReason: language === "zh-CN" ? "适合你想加强的自然对话。" : "It supports your goal of sounding more natural in conversation.",
        example: "The client changed the brief again. What do you make of it?",
        sourceEvidence: null,
        grounded: false,
      },
      {
        kind: "pronunciation",
        expression: "going to → gonna (casual speech)",
        meaning: language === "zh-CN" ? "非正式口语中 going to 的常见弱读" : "A common reduced form of going to in informal speech.",
        whyUseful: language === "zh-CN" ? "有助于听懂快速自然对白，但正式写作中不要使用。" : "It helps you follow fast dialogue, but should not be used in formal writing.",
        personalizedReason: language === "zh-CN" ? "训练真实语速下的听力识别。" : "It trains recognition at natural speaking speed.",
        example: "What are you gonna do?",
        sourceEvidence: null,
        grounded: false,
      },
    ]
    const stopwords = new Set([
      "about", "after", "again", "because", "before", "could", "from", "have", "into",
      "just", "more", "other", "should", "that", "their", "then", "there", "these", "they",
      "this", "those", "very", "want", "were", "what", "when", "where", "which", "while",
      "with", "would", "your",
    ])
    const seenExpressions = new Set<string>()
    const groundedItems: typeof sampleItems = []
    for (const match of material.matchAll(/[A-Za-z][A-Za-z'-]{3,}/g)) {
      const expression = match[0]
      const normalized = expression.toLowerCase()
      if (stopwords.has(normalized) || seenExpressions.has(normalized)) continue
      seenExpressions.add(normalized)
      const start = Math.max(0, (match.index ?? 0) - 80)
      const end = Math.min(material.length, (match.index ?? 0) + expression.length + 120)
      groundedItems.push({
        kind: "word",
        expression,
        meaning: language === "zh-CN"
          ? "这是你提供的素材中值得结合上下文理解并复用的词。"
          : "A useful word from your material to understand and reuse in context.",
        whyUseful: language === "zh-CN"
          ? "它确实出现在原文中；观察周围搭配会比孤立背诵更容易迁移。"
          : "It appears in your source; noticing the surrounding words makes it easier to transfer.",
        personalizedReason: language === "zh-CN"
          ? "先用自己的句子复述原场景，再在下一次对话中主动用一次。"
          : "Retell the original moment in your own words, then reuse it once in a later conversation.",
        example: language === "zh-CN"
          ? `试着用 ${expression} 写一句与你生活相关的新句子。`
          : `Write a new sentence with ${expression} that relates to your life.`,
        sourceEvidence: material.slice(start, end).trim(),
        grounded: true,
      })
      if (groundedItems.length >= input.targetItemCount) break
    }
    const selectedItems = grounded ? groundedItems : sampleItems.slice(0, input.targetItemCount)
    const items = selectedItems.map((item, index) => ({
      ...item,
      id: `${id}-item-${index + 1}`,
      sourceId: id,
      position: index + 1,
      memoryId: `memory-${id}-${index + 1}`,
      createdAt: now,
    }))
    const attentionMission: InputAttentionMission | null = grounded
      ? null
      : {
          objective: language === "zh-CN"
            ? `观看或阅读《${input.title}》时，找到能替代你常用简单表达的真实英语。`
            : `While enjoying ${input.title}, notice real English that can replace your usual simple wording.`,
          beforeYouStart: language === "zh-CN"
            ? ["先预测故事或内容中可能出现的三个场景。", "不要暂停查每一个生词。"]
            : ["Predict three situations that may appear.", "Do not pause to look up every unknown word."],
          focusTargets: ["a phrase for disagreement", "one past-tense story", "a useful word repeated twice"],
          whileConsuming: language === "zh-CN"
            ? ["听到目标表达时只记一句上下文。", "留意人物在什么语气和关系中使用它。"]
            : ["Save one line of context when you notice a target.", "Notice the speaker's tone and relationship."],
          afterYouFinish: language === "zh-CN"
            ? ["用英文复述最重要的一幕。", "回来粘贴 3–8 句对白或写下笔记，生成个性化表达。"]
            : ["Retell the most important moment in English.", "Come back with 3–8 lines or your notes to capture personalized expressions."],
        }
    const source: InputLearningSource = {
      id,
      sourceType: input.sourceType,
      title: input.title,
      goal: input.goal ?? null,
      mode: grounded ? "grounded_capture" : "attention_mission",
      outputLanguage: language,
      summary: grounded
        ? language === "zh-CN"
          ? "已从你提供的真实内容中挑选出少量高价值表达，并结合薄弱项说明它们为何值得学。"
          : "A small set of high-value expressions was selected from your real input and connected to your learning needs."
        : language === "zh-CN"
          ? "这不是词表，而是一项看剧、阅读或收听前的注意力任务：先带着目标享受内容，再回来收集真实表达。"
          : "This is an attention mission, not a vocabulary list: enjoy the content with a few targets, then return to capture real expressions.",
      contentProvided: grounded,
      contentCharacters: (input.content?.length ?? 0) + (input.transcript?.length ?? 0),
      itemCount: items.length,
      createdAt: now,
      updatedAt: now,
      memoryRecall: { traceId: `trace-${Date.now()}`, memoryIds: ["mem-pref-business", "mem-weak-tense"] },
      savedMemoryIds: items.map((item) => item.memoryId).filter((memoryId): memoryId is string => Boolean(memoryId)),
      items,
      attentionMission,
    }
    mockInputLearningSources = [source, ...mockInputLearningSources]
    return source
  }

  const payload = await apiFetch<InputLearningAnalyzeResponse>("/input-learning/analyze", {
    method: "POST",
    body: JSON.stringify({ ...input, outputLanguage: getOutputLanguage() }),
  })
  return payload.source
}

export async function getInputLearningSources(): Promise<InputLearningSourcesResponse> {
  if (USE_MOCK) {
    await delay(350)
    return {
      sources: mockInputLearningSources.map(({ items: _items, ...source }) => source),
      count: mockInputLearningSources.length,
    }
  }
  const sources = new Map<string, InputLearningSource>()
  const seenCursors = new Set<string>()
  let cursor: string | undefined
  do {
    const params = new URLSearchParams({ pageSize: String(LEARNER_HISTORY_PAGE_SIZE) })
    if (cursor) params.set("cursor", cursor)
    const page = await apiFetch<InputLearningSourcesResponse>(`/input-learning?${params.toString()}`)
    for (const source of page.sources) sources.set(source.id, source)
    cursor = nextPageCursor(page.nextCursor, seenCursors)
  } while (cursor)
  const completeHistory = [...sources.values()].sort(newestFirst)
  return { sources: completeHistory, count: completeHistory.length, nextCursor: null }
}

export async function getInputLearningSource(sourceId: string): Promise<InputLearningSource> {
  if (USE_MOCK) {
    await delay(250)
    const source = mockInputLearningSources.find((item) => item.id === sourceId)
    if (!source) throw new Error("Input source not found")
    return source
  }
  const payload = await apiFetch<InputLearningAnalyzeResponse>(`/input-learning/${sourceId}`)
  return payload.source
}

export async function deleteInputLearningSource(sourceId: string): Promise<{ deleted: boolean; id: string }> {
  if (USE_MOCK) {
    await delay(250)
    mockInputLearningSources = mockInputLearningSources.filter((source) => source.id !== sourceId)
    return { deleted: true, id: sourceId }
  }
  return apiFetch<{ deleted: boolean; id: string }>(`/input-learning/${sourceId}`, { method: "DELETE" })
}

/* ---- Coach missions ---- */

const MOCK_COACH_MISSIONS: Record<CoachMission["type"], CoachMission> = {
  guided_scene: {
    id: "mission-preview-scene",
    type: "guided_scene",
    title: "The last seat on the train",
    eyebrow: "A small real-life moment",
    briefing: "You are travelling to a new city. Another passenger thinks the empty seat beside you is reserved, but your ticket says otherwise.",
    estimatedMinutes: 5,
    difficulty: "Gentle stretch",
    targetSkills: ["polite clarification", "explaining evidence"],
    taskPrompt: "Clarify the situation politely and reach an agreement without sounding confrontational.",
    successCriteria: ["Explain what your ticket shows", "Ask one polite question", "Respond to a small change in the situation"],
    hints: ["Start by acknowledging the other passenger.", "Useful phrase: I may be mistaken, but…", "Try: Excuse me, I may be mistaken, but my ticket shows seat 18A."],
    scene: {
      setting: "A busy train just before departure",
      userRole: "A passenger holding a ticket for seat 18A",
      aiRole: "A polite but uncertain passenger",
      goal: "Resolve the seat mix-up calmly",
      scenarioPrompt: "Role-play a passenger on a busy train. The learner has a ticket for seat 18A, but you believe it is reserved for your friend. Begin uncertain but polite. After the learner explains, reveal that your friend's ticket is actually for the next carriage. Stay in role, let the learner drive the resolution, and do not correct their English during the conversation.",
      starterMessage: "Oh—sorry, I think this seat is saved for my friend. Are you sure this is your seat?",
      scenarioFamily: "travel_disruption",
      scenarioKey: "travel_disruption:mock",
    },
  },
  picture_story: {
    id: "mission-preview-picture",
    type: "picture_story",
    title: "A rainy wait",
    eyebrow: "Notice, describe, then infer",
    briefing: "Look at the scene for a moment. Describe what is happening, then make one reasonable guess about what might happen next.",
    estimatedMinutes: 5,
    difficulty: "Gentle stretch",
    targetSkills: ["present continuous", "position and place", "making inferences"],
    taskPrompt: "Write 3–5 English sentences: two things you can clearly see and one careful inference.",
    successCriteria: ["Describe at least two visible actions", "Use one place expression", "Mark your guess as a possibility, not a fact"],
    hints: ["Separate what you see from what you think.", "Useful words: shelter, puddle, across from, might", "Try: A woman is standing under the shelter while…"],
    picture: { assetKey: "rainy_bus_stop" },
  },
  listen_retell: {
    id: "mission-preview-listen",
    type: "listen_retell",
    title: "The forgotten lunch",
    eyebrow: "Listen for meaning, not every word",
    briefing: "Listen to a short original story. Then retell the important events in your own English without trying to repeat it word for word.",
    estimatedMinutes: 5,
    difficulty: "Gentle stretch",
    targetSkills: ["past tense", "event sequence", "key-detail recall"],
    taskPrompt: "Listen once or twice, then retell what happened in 3–5 sentences.",
    successCriteria: ["State the main problem", "Include two events in order", "Explain how the situation ended"],
    hints: ["Think: problem → action → result.", "Useful connectors: at first, so, in the end", "Try: On her way to work, Maya realized that…"],
    listening: {
      script: "On her way to work, Maya realized that she had left her lunch on the kitchen table. She did not have time to turn back, so she sent a message to her neighbor. At noon, the neighbor surprised her by bringing the lunch to the office reception desk.",
      playLimit: 2,
    },
  },
  decision_response: {
    id: "mission-preview-decision",
    type: "decision_response",
    title: "Choose a fair meeting plan",
    eyebrow: "Decide and explain",
    briefing: "Two teammates have competing schedules. Make a workable choice and communicate it with care.",
    estimatedMinutes: 5,
    difficulty: "Gentle stretch",
    targetSkills: ["clarity.expression", "style.register", "discourse.coherence"],
    taskPrompt: "Write the short message you would send after choosing a plan.",
    successCriteria: ["State the decision clearly", "Acknowledge both constraints", "Offer one practical next step"],
    hints: ["Lead with the decision, then give the reason.", "Useful frame: Given that…, the fairest option is…", "Try: I suggest that we… because…"],
    decision: {
      situation: "A project review must happen today, but one teammate is available early and another only late.",
      userRole: "The project coordinator",
      audience: "Two teammates with competing schedules",
      decisionGoal: "Choose a time and preserve cooperation",
      constraints: ["The review must happen today", "Neither teammate can attend for more than 30 minutes"],
    },
  },
  vocabulary_in_action: {
    id: "mission-preview-vocabulary",
    type: "vocabulary_in_action",
    title: "Explain a delayed handoff precisely",
    eyebrow: "Vocabulary in action",
    briefing: "Use your own words to explain a small delay without sounding vague or defensive.",
    estimatedMinutes: 5,
    difficulty: "Gentle stretch",
    targetSkills: ["vocab.word_choice", "style.register", "clarity.expression"],
    taskPrompt: "Write a concise update to the colleague waiting for your work.",
    successCriteria: ["Name the cause precisely", "Distinguish a delay from a cancellation", "Use a professional but warm tone"],
    hints: ["Think about the exact relationship between cause, delay, and next step.", "Useful chunks: held up by, on track to, revised handoff time", "Try: The handoff has been delayed because…"],
    vocabulary: {
      situation: "A dependency arrived late, so your work will be ready two hours after the original handoff time.",
      communicativeGoal: "Explain the delay and set an accurate expectation",
      audience: "A colleague waiting to continue the project",
      tone: "Professional, accountable, and calm",
      conceptsToExpress: ["external dependency", "limited delay", "new expected time"],
    },
  },
}

export async function generateCoachMission(input: CoachMissionRequest): Promise<CoachMission> {
  if (USE_MOCK) {
    await delay(input.generationMode === "deep" ? 1200 : 700)
    const types: CoachMission["type"][] = [
      "guided_scene",
      "picture_story",
      "listen_retell",
      "decision_response",
      "vocabulary_in_action",
    ]
    const type = input.preferredType ?? types[Math.floor(Date.now() / 1000) % types.length]
    const mission = MOCK_COACH_MISSIONS[type]
    return {
      ...mission,
      id: `${mission.id}-${Date.now()}`,
      estimatedMinutes: input.durationMinutes,
      difficulty: input.energy === "light" ? "Gentle stretch" : input.energy === "challenge" ? "Challenge" : "Balanced",
    }
  }
  const payload = await apiFetch<{ mission: CoachMission }>("/coach/missions", {
    method: "POST",
    body: JSON.stringify(withOutputLanguage({ ...input })),
  })
  return payload.mission
}

export async function generateInputLab2TranscriptMission(
  input: InputLab2TranscriptMissionRequest,
): Promise<CoachMission> {
  if (USE_MOCK) {
    await delay(650)
    return {
      ...MOCK_COACH_MISSIONS.listen_retell,
      id: `owner-transcript-${Date.now()}`,
      title: input.title,
      estimatedMinutes: input.durationMinutes,
      listening: {
        script: input.transcript.trim(),
        playLimit: 2,
      },
    }
  }
  const payload = await apiFetch<{ mission: CoachMission }>("/coach/input-lab-2/transcript-missions", {
    method: "POST",
    body: JSON.stringify(withOutputLanguage({ ...input })),
  })
  return payload.mission
}

export async function synthesizeCoachSpeech(
  text: string,
  style: "gentle" | "natural" | "challenge" = "natural",
): Promise<Blob> {
  if (USE_MOCK) throw new Error("AI speech is unavailable in mock mode.")
  const path = "/coach/speech"
  const res = await fetch(`${API_BASE_URL}/api/v1${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, style }),
  })
  if (!res.ok) throw new Error(await getErrorMessage(res, path))
  return res.blob()
}

/* ---- Chat ---- */

export async function createChatSession(
  userId: string = DEMO_USER_ID,
  topic?: string,
  textModel?: TextChatModel,
  scenarioPrompt?: string,
  starterMessage?: string,
  scenarioFamily?: string,
  scenarioKey?: string,
): Promise<ChatSession> {
  if (USE_MOCK) {
    await delay(300)
    return {
      id: `cs-${Date.now()}`,
      userId,
      topic: topic ?? null,
      scenarioPrompt: scenarioPrompt ?? null,
      starterMessage: starterMessage ?? null,
      scenarioFamily: scenarioFamily ?? null,
      scenarioKey: scenarioKey ?? null,
      textModel: textModel ?? "Server default",
      messageCount: 0,
      summary: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  }
  const { session } = await apiFetch<{ session: ChatSession }>("/chat/sessions", {
    method: "POST",
    body: JSON.stringify({
      userId,
      topic,
      ...(textModel ? { textModel } : {}),
      ...(scenarioPrompt ? { scenarioPrompt } : {}),
      ...(starterMessage ? { starterMessage } : {}),
      ...(scenarioFamily ? { scenarioFamily } : {}),
      ...(scenarioKey ? { scenarioKey } : {}),
    }),
  })
  return session
}

export async function getChatSessions(
  userId: string = DEMO_USER_ID,
): Promise<ChatSession[]> {
  if (USE_MOCK) {
    await delay(300)
    return []
  }
  const sessions = new Map<string, ChatSession>()
  const seenCursors = new Set<string>()
  let cursor: string | undefined
  do {
    const params = new URLSearchParams({ pageSize: String(LEARNER_HISTORY_PAGE_SIZE) })
    if (cursor) params.set("cursor", cursor)
    const page = await apiFetch<ChatSessionsResponse>(`/chat/sessions?${params.toString()}`)
    for (const session of page.sessions) sessions.set(session.id, session)
    cursor = nextPageCursor(page.nextCursor, seenCursors)
  } while (cursor)
  return [...sessions.values()].sort(newestFirst)
}

export async function getChatMessages(
  sessionId: string,
  userId: string = DEMO_USER_ID,
): Promise<ChatMessagesResponse> {
  if (USE_MOCK) {
    await delay(300)
    return {
      session: {
        id: sessionId,
        userId,
        topic: null,
        scenarioPrompt: null,
        starterMessage: null,
        textModel: "deepseek-v4-flash",
        messageCount: 0,
        summary: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      messages: [],
    }
  }
  return apiFetch<ChatMessagesResponse>(`/chat/sessions/${sessionId}/messages`)
}

export async function sendChatMessage(
  userId: string = DEMO_USER_ID,
  sessionId: string,
  text: string,
): Promise<ChatSendResponse> {
  if (USE_MOCK) {
    await delay(1200)
    const now = new Date().toISOString()
    return {
      userMessage: {
        id: `cm-${Date.now()}-u`,
        userId,
        sessionId,
        role: "user",
        content: text,
        corrections: null,
        betterExpression: null,
        createdAt: now,
      },
      assistantMessage: {
        id: `cm-${Date.now()}-a`,
        userId,
        sessionId,
        role: "assistant",
        content: "That sounds interesting! Could you tell me more about it? I'd love to hear the details.",
        corrections: [
          {
            original: "I go there yesterday",
            corrected: "I went there yesterday",
            explanationZh: "Past events need the simple past, so 'go' becomes 'went'.",
          },
        ],
        betterExpression: {
          original: "The food was very good",
          natural: "The food was amazing / The food was absolutely delicious",
          explanationZh: "A more specific adjective sounds more natural than 'very good'.",
        },
        createdAt: now,
      },
    }
  }
  return apiFetch<ChatSendResponse>("/chat/send", {
    method: "POST",
    body: JSON.stringify({ userId, sessionId, text }),
  })
}

/* ---- Session Analysis ---- */

export async function analyzeSession(
  sessionId: string,
  hintLevel: number = 0,
): Promise<SessionAnalysisResponse> {
  if (USE_MOCK) {
    await delay(2000)
    return {
      analysis: {
        summaryZh: "You participated actively and used English throughout the conversation. The main focus areas are verb tense and more natural phrasing.",
        corrections: [
          {
            code: "grammar.verb_tense",
            category: "Verb tense",
            severity: "high",
            original: "I go there yesterday",
            corrected: "I went there yesterday",
            explanationZh: "Past events need the simple past, so 'go' becomes 'went'.",
            microLessonZh: "When you see past-time words like yesterday or last week, the main verb usually needs the past tense.",
            practiceGoal: "Retell five things you did yesterday using the simple past.",
          },
          {
            code: "grammar.verb_tense",
            category: "Verb tense",
            severity: "medium",
            original: "The food is very good",
            corrected: "The food was very good",
            explanationZh: "Past experiences need the past form 'was', not the present form 'is'.",
            microLessonZh: "When describing past experiences, use was/were for the verb be.",
            practiceGoal: "Describe five past experiences using was/were.",
          },
        ],
        naturalExpressions: [
          {
            original: "The food was very good",
            natural: "The food was absolutely delicious",
            explanationZh: "A more specific adjective sounds more natural than 'very good'.",
            context: "Use this when describing food, experiences, or other positive impressions.",
            examples: [
              "The pasta was absolutely delicious — I'd definitely order it again.",
              "Have you tried their coffee? It's absolutely delicious.",
            ],
          },
        ],
        weaknesses: [
          {
            code: "grammar.verb_tense",
            category: "Verb tense",
            severity: "high",
            evidenceQuote: "I go there yesterday",
            explanationZh: "You repeatedly used present-tense verbs for past events, so past-tense practice should be a priority.",
            practiceGoal: "Retell five things you did yesterday using the past tense.",
          },
        ],
        strengthsZh: ["You actively used English to communicate", "Your vocabulary is enough for basic daily conversation"],
        recommendedNextActionsZh: ["Practice past-tense forms", "Collect more natural alternatives to the very + adjective pattern"],
      },
      savedNotes: [],
      savedErrors: [],
      updatedSkills: [],
      sessionId,
      stealthPractice: {
        targetSkillCode: "grammar.verb_tense",
        outcome: hintLevel > 0 ? "hinted_success" : "success",
        opportunityPresent: true,
        evidenceQuote: hintLevel > 0
          ? "You described a past event after opening a hint."
          : "You described a past event with “went” and “was” without a correction or hint.",
        hintLevel,
        nextReviewAt: new Date(Date.now() + 4 * 86400000).toISOString(),
      },
    }
  }
  return apiFetch<SessionAnalysisResponse>(`/chat/sessions/${sessionId}/analyze`, {
    method: "POST",
    body: JSON.stringify(withOutputLanguage({ hintLevel })),
  })
}

/* ---- Voice / Realtime ---- */

export async function createRealtimeSession(
  userId: string = DEMO_USER_ID,
  topic?: string,
  model: RealtimeVoiceModel = "gpt-realtime-mini-2025-12-15",
): Promise<RealtimeSessionResponse> {
  return apiFetch<RealtimeSessionResponse>("/chat/realtime/session", {
    method: "POST",
    body: JSON.stringify(withOutputLanguage({ userId, topic, model })),
  })
}

export async function attachRealtimeSideband(
  sessionId: string,
  callId: string,
): Promise<{ sessionId: string; callId: string; sidebandStatus: string; activeSideband: boolean }> {
  return apiFetch<{ sessionId: string; callId: string; sidebandStatus: string; activeSideband: boolean }>(
    `/chat/realtime/${sessionId}/sideband`,
    {
      method: "POST",
      body: JSON.stringify({ callId }),
    },
  )
}

export async function kickRealtimeSession(
  sessionId: string,
  reason = "manual",
): Promise<{ sessionId: string; kickRequested: boolean; activeSideband: boolean; kickSent: boolean }> {
  return apiFetch<{ sessionId: string; kickRequested: boolean; activeSideband: boolean; kickSent: boolean }>(
    `/chat/realtime/${sessionId}/kick`,
    {
      method: "POST",
      body: JSON.stringify({ reason }),
    },
  )
}

export async function saveVoiceTranscript(
  userId: string = DEMO_USER_ID,
  sessionId: string,
  messages: { role: "user" | "assistant"; content: string; clientMessageId?: string }[],
): Promise<{ saved: number; skippedDuplicates: number; sessionId: string }> {
  return apiFetch<{ saved: number; skippedDuplicates: number; sessionId: string }>(`/chat/sessions/${sessionId}/transcript`, {
    method: "POST",
    body: JSON.stringify({ userId, messages }),
  })
}

/* ---- Admin (owner-only) ---- */

export interface AccessRole {
  identifier: string
  role: "owner" | "member"
  createdAt: string
  updatedAt: string
  updatedBy: string
}

export async function listAccessRoles(): Promise<AccessRole[]> {
  const { accessRoles } = await apiFetch<{ accessRoles: AccessRole[] }>("/admin/access-roles")
  return accessRoles
}

export async function upsertAccessRole(identifier: string, role: "owner" | "member"): Promise<AccessRole> {
  const { accessRole } = await apiFetch<{ accessRole: AccessRole }>("/admin/access-roles", {
    method: "POST",
    body: JSON.stringify({ identifier, role }),
  })
  return accessRole
}

export async function deleteAccessRole(identifier: string): Promise<{ deleted: boolean; identifier: string }> {
  return apiFetch<{ deleted: boolean; identifier: string }>(`/admin/access-roles/${encodeURIComponent(identifier)}`, {
    method: "DELETE",
  })
}

/* ---- Stats ---- */

export async function getDailyStats(
  userId: string = DEMO_USER_ID,
  timezone?: string,
  days = 7,
): Promise<DailyStatsResponse> {
  if (USE_MOCK) {
    await delay(500)
    return mockDailyStats
  }

  const browserTimezone =
    timezone ?? (typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC")
  const params = new URLSearchParams({
    timezone: browserTimezone || "UTC",
    days: String(days),
  })
  return apiFetch<DailyStatsResponse>(`/stats/daily/${userId}?${params.toString()}`)
}
