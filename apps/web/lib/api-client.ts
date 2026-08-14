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
 *  POST /notes/from-chat    { sessionId, messageId, ... }     -> { note }
 *  POST /input-learning/analyze { sourceType, title, ... }    -> { source }
 *  GET  /input-learning?pageSize=&cursor=                    -> { sources, count, nextCursor }
 *  GET  /chat/sessions?pageSize=&cursor=                     -> { sessions, count, nextCursor }
 */

import type {
  ActivityRun,
  ActivityRunStatus,
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
  TextChatModelMode,
  ChatSessionsResponse,
  DailyStatsResponse,
  DeleteSubmissionResponse,
  DiagnoseResponse,
  DiagnoseLearningContext,
  DiagnosisMode,
  Ebook,
  EbookAnnotation,
  EbookComparisonLanguage,
  EbookLearningTarget,
  EbookPracticeAttempt,
  EbookPracticeSession,
  EbookStudyPack,
  EvidenceEvent,
  HistoryResponse,
  InputAttentionMission,
  InputLearningAnalyzeRequest,
  InputLearningAnalyzeResponse,
  InputLearningAttempt,
  InputLearningAttemptKind,
  InputLearningItem,
  InputLearningSource,
  InputLearningSourcesResponse,
  InputLab2TranscriptMissionRequest,
  LearningNote,
  LearningOverview,
  LearningPlan,
  LearningState,
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
  RealtimeSessionContext,
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
  DEEPSEEK_DS_V4_FLASH_0731_MODEL,
  OPENROUTER_56_LUNA_MODEL,
  OPENROUTER_56_LUNA_PRO_MODEL,
  QWEN_37_MAX_MODEL,
  QWEN_37_PLUS_MODEL,
  type ServerLLMModel,
} from "./llm-settings"
import { getOutputLanguage } from "./language"
import { fetchWithTotalTimeout } from "./timed-fetch"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL
const USE_MOCK = !API_BASE_URL
const DEFAULT_API_TIMEOUT_MS = 20_000
// Non-streaming model work commonly takes longer than an ordinary API request.
// Keep this below the backend proxy's 120-second read timeout.
const LLM_OPERATION_TIMEOUT_MS = 110_000
// Diagnose streams keepalive bytes while deep reasoning runs. Match the
// backend's 600-second upstream timeout instead of aborting a healthy stream at
// the ordinary LLM-operation deadline and leaving the server job in flight.
const DIAGNOSE_OPERATION_TIMEOUT_MS = 610_000
export const LEARNER_RESPONSE_MAX_CHARACTERS = 12_000
const DIAGNOSE_ANALYSIS_CONTEXT_MAX_CHARS = 2_400
const INPUT_RESPONSE_MAX_CHARS = 8_000
const CHAT_SELECTION_MAX_CHARS = 12_000
const CHAT_IMPORT_SOURCE_MAX_CHARS = 180
const REALTIME_TRANSCRIPT_REQUEST_MAX_MESSAGES = 8
const REALTIME_TRANSCRIPT_REQUEST_MAX_BYTES = 800_000
const REALTIME_TRANSCRIPT_MESSAGE_MAX_CHARS = 16_000

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const withOutputLanguage = <T extends Record<string, unknown>>(body: T) => ({
  ...body,
  outputLanguage: getOutputLanguage(),
})

function unicodeCharacters(value: string): string[] {
  return Array.from(value)
}

export function boundTextPreservingHeadTail(value: string, maxCharacters: number): string {
  const characters = unicodeCharacters(value)
  if (characters.length <= maxCharacters) return value
  if (maxCharacters <= 0) return ""
  if (maxCharacters === 1) return characters[0]

  const separator = "\n…\n"
  const separatorCharacters = unicodeCharacters(separator)
  if (maxCharacters <= separatorCharacters.length + 1) {
    return characters.slice(0, maxCharacters).join("")
  }
  const available = maxCharacters - separatorCharacters.length
  const headLength = Math.ceil(available * 0.6)
  const tailLength = available - headLength
  return [
    ...characters.slice(0, headLength),
    ...separatorCharacters,
    ...characters.slice(characters.length - tailLength),
  ].join("")
}

function boundTextPrefix(value: string, maxCharacters: number): string {
  return unicodeCharacters(value).slice(0, maxCharacters).join("")
}

export function learnerResponseCharacterCount(value: string): number {
  return unicodeCharacters(value).length
}

export function boundLearnerResponseText(value: string): string {
  return boundTextPrefix(value, LEARNER_RESPONSE_MAX_CHARACTERS)
}

function requireLearnerResponseWithinLimit(value: string): string {
  if (learnerResponseCharacterCount(value) > LEARNER_RESPONSE_MAX_CHARACTERS) {
    throw new Error(
      `Your response is longer than ${LEARNER_RESPONSE_MAX_CHARACTERS.toLocaleString()} characters.`,
    )
  }
  return value
}

export function boundedImportSourceName(sourceName?: string, suffix = ""): string | undefined {
  const normalized = sourceName?.trim()
  if (!normalized && !suffix) return undefined
  const boundedSuffix = boundTextPrefix(suffix, CHAT_IMPORT_SOURCE_MAX_CHARS)
  const suffixCharacters = unicodeCharacters(boundedSuffix)
  const available = Math.max(0, CHAT_IMPORT_SOURCE_MAX_CHARS - suffixCharacters.length)
  const boundedBase = normalized ? boundTextPreservingHeadTail(normalized, available) : ""
  return `${boundedBase}${boundedSuffix}`
}

function errorWithTrace(message: string, res: Response): string {
  const traceId = res.headers.get("x-request-id")
  if (!traceId || message.includes(traceId)) return message
  return `${message} [request ${traceId}]`
}

async function getErrorMessage(res: Response, path: string) {
  try {
    const payload = await res.json()
    const detail = payload?.detail
    if (Array.isArray(detail)) {
      return errorWithTrace(detail
        .map((item) => {
          const location = Array.isArray(item.loc) ? item.loc.join(".") : undefined
          return [location, item.msg].filter(Boolean).join(": ")
        })
        .join("; "), res)
    }
    if (detail && typeof detail === "object" && !Array.isArray(detail) && typeof detail.message === "string") {
      return errorWithTrace(detail.message, res)
    }
    if (typeof detail === "string") return errorWithTrace(detail, res)
    if (payload?.message) return errorWithTrace(String(payload.message), res)
  } catch {
    // Fall through to the status-based message.
  }
  return errorWithTrace(`Request failed (${res.status}): ${path}`, res)
}

async function apiFetch<T>(
  path: string,
  init?: RequestInit,
  timeoutMs = DEFAULT_API_TIMEOUT_MS,
): Promise<T> {
  return fetchWithTotalTimeout(
    `${API_BASE_URL}/api/v1${path}`,
    {
      ...init,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...getLLMProviderHeaders(),
        ...(init?.headers ?? {}),
      },
    },
    timeoutMs,
    async (res) => {
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
    },
  )
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

async function apiUpload<T>(path: string, body: FormData, timeoutMs: number | null = DEFAULT_API_TIMEOUT_MS): Promise<T> {
  const input = `${API_BASE_URL}/api/v1${path}`
  const init: RequestInit = {
    method: "POST",
    body,
    credentials: "include",
    headers: getLLMProviderHeaders(),
  }
  const consume = async (res: Response) => {
    if (!res.ok) throw new Error(await getErrorMessage(res, path))
    return (await res.json()) as T
  }
  if (timeoutMs === null) {
    return consume(await fetch(input, init))
  }
  return fetchWithTotalTimeout(input, init, timeoutMs, consume)
}

export async function getServerLLMModels(): Promise<ServerLLMModel[]> {
  if (USE_MOCK) {
    return [
      {
        id: "default",
        label: "Server default",
        provider: "Server",
        model: OPENROUTER_56_LUNA_PRO_MODEL,
        fastModel: DEEPSEEK_DS_V4_FLASH_0731_MODEL,
        adaptive: true,
      },
      {
        id: "openrouter-deep",
        label: "GPT-5.6 Luna Pro",
        provider: "OpenRouter",
        model: OPENROUTER_56_LUNA_PRO_MODEL,
        mode: "deep",
      },
      {
        id: "openrouter-fast",
        label: "GPT-5.6 Luna",
        provider: "OpenRouter",
        model: OPENROUTER_56_LUNA_MODEL,
        mode: "fast",
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
        label: "DS V4 Flash 0731",
        provider: "DeepSeek Official",
        model: DEEPSEEK_DS_V4_FLASH_0731_MODEL,
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
    id: "mem-goal-communication",
    userId: DEMO_USER_ID,
    kind: "goal",
    canonicalKey: "goal.communication.natural_expression",
    content: "The learner wants to communicate more naturally at work and in everyday life.",
    evidence: "I want to communicate more naturally at work and in everyday life.",
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
  learningContext?: DiagnoseLearningContext,
): Promise<DiagnoseResponse> {
  const validatedText = requireLearnerResponseWithinLimit(text)
  if (USE_MOCK) {
    await delay(diagnosisMode === "fast" ? 700 : 1400)
    return {
      submission: {
        id: `sub-${Date.now()}`,
        userId,
        mode: "writing",
        originalText: validatedText,
        correctedText: mockDiagnostic.correctedText,
        naturalRewrite: mockDiagnostic.naturalRewrite,
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
      text: validatedText,
      diagnosisMode,
      ...(analysisContext
        ? { analysisContext: boundTextPreservingHeadTail(analysisContext, DIAGNOSE_ANALYSIS_CONTEXT_MAX_CHARS) }
        : {}),
      ...(learningContext ? { learningContext } : {}),
    })),
  }, DIAGNOSE_OPERATION_TIMEOUT_MS)
}

export async function analyzeChatImport(
  userId: string,
  conversations: ChatImportConversation[],
  sourceName?: string,
  analysisMode: DiagnosisMode = "fast",
  sourceSuffix = "",
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
    body: JSON.stringify(withOutputLanguage({
      userId,
      sourceName: boundedImportSourceName(sourceName, sourceSuffix),
      analysisMode,
      conversations,
    })),
  }, LLM_OPERATION_TIMEOUT_MS)
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
    let weaknessDetailCount = 0
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
      .filter((item) => {
        if (item.kind !== "weakness") return true
        if (weaknessDetailCount >= 3) return false
        weaknessDetailCount += 1
        return true
      })
      .slice(0, 6)
    const activeWeaknesses = active.filter((item) => item.kind === "weakness")
    const weaknessIndex = activeWeaknesses.map((item) => item.canonicalKey.replace(/^weakness[.:]/, "")).join("; ")
    const detailText = ranked.map((item) => `- [${item.kind} | ${item.id}] ${item.content}`).join("\n")
    const text = [
      weaknessIndex ? `Active weaknesses (complete compact historical index):\n- ${weaknessIndex}` : "",
      detailText,
    ].filter(Boolean).join("\nMost relevant memory details:\n")
    return {
      text,
      items: ranked,
      estimatedTokens: Math.min(tokenBudget, Math.ceil(text.length / 4)),
      tokenBudget,
      totalCandidates: active.length,
      traceId: `mtr-${Date.now()}`,
      weaknessOverview: {
        totalActive: activeWeaknesses.length,
        includedCount: activeWeaknesses.length,
        complete: true,
        format: activeWeaknesses.length ? "index" : "none",
        estimatedTokens: Math.ceil(weaknessIndex.length / 4),
        memoryIds: activeWeaknesses.map((item) => item.id),
        suppressed: false,
      },
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
      weaknessOverview: {
        totalActive: 1,
        includedCount: 1,
        complete: true,
        format: "index",
        estimatedTokens: 8,
        memoryIds: ["mem-weak-tense"],
        suppressed: false,
      },
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
  }, LLM_OPERATION_TIMEOUT_MS)
  return plan
}

export async function updatePlanTask(
  taskId: string,
  status: "assigned" | "started" | "completed" | "skipped",
  score?: number,
): Promise<LearningPlan> {
  if (USE_MOCK) {
    await delay(150)
    return mockPlan
  }
  const { plan } = await apiFetch<{ plan: LearningPlan }>(`/plan/tasks/${taskId}`, {
    method: "PATCH",
    body: JSON.stringify({ status, score }),
  })
  return plan
}

export async function generatePractice(
  userId: string = DEMO_USER_ID,
  targetSkillCode?: string,
  practiceType?: PracticeType,
  session?: {
    sessionId?: string
    sequenceIndex?: number
    previousSkillCodes?: string[]
    previousPracticeTypes?: PracticeType[]
    parentRunId?: string
    sessionSlot?: number
    sessionSize?: number
  },
): Promise<PracticeExercise> {
  if (USE_MOCK) {
    await delay(900)
    const exercise = { ...getMockExercise(targetSkillCode), ...(practiceType ? { type: practiceType } : {}) }
    exerciseCache.set(exercise.id, exercise)
    return exercise
  }
  const { exercise } = await apiFetch<PracticeGenerateResponse>("/practice/generate", {
    method: "POST",
    body: JSON.stringify(withOutputLanguage({ userId, targetSkillCode, practiceType, ...session })),
  }, LLM_OPERATION_TIMEOUT_MS)
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
    activityRunId?: string
    completeActivityRun?: boolean
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
  }, LLM_OPERATION_TIMEOUT_MS)
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
  }, LLM_OPERATION_TIMEOUT_MS)
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

export async function saveChatSelectionToNote(input: {
  sessionId: string
  messageId: string
  messageCreatedAt: string
  selectedText: string
  sourceRole: "user" | "assistant"
  topic?: string | null
}): Promise<LearningNote> {
  if (USE_MOCK) {
    await delay(250)
    const note: LearningNote = {
      id: `note-chat-${Date.now()}`,
      userId: DEMO_USER_ID,
      submissionId: input.messageId,
      type: "expression",
      topic: input.topic?.trim() ?? "",
      original: input.selectedText.trim(),
      natural: input.selectedText.trim(),
      explanation: "",
      context: "",
      examples: [],
      sourceType: "chat_selection",
      sourceRole: input.sourceRole,
      sessionId: input.sessionId,
      messageId: input.messageId,
      createdAt: new Date().toISOString(),
      learningState: "current",
      relatedWeaknesses: [],
    }
    mockNotes.unshift(note)
    return note
  }
  const { note } = await apiFetch<{ note: LearningNote }>("/notes/from-chat", {
    method: "POST",
    body: JSON.stringify({
      sessionId: input.sessionId,
      messageId: input.messageId,
      messageCreatedAt: input.messageCreatedAt,
      // Keep this a contiguous prefix so the server can still verify that the
      // selection belongs to the original message.
      selectedText: boundTextPrefix(input.selectedText.trim(), CHAT_SELECTION_MAX_CHARS),
    }),
  })
  return note
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
  }, LLM_OPERATION_TIMEOUT_MS)
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

export async function submitInputLearningAttempt(
  sourceId: string,
  input: {
    kind: InputLearningAttemptKind
    responseText: string
    targetItemIds?: string[]
    clientAttemptId: string
    hintUsed?: boolean
  },
): Promise<InputLearningAttempt> {
  if (USE_MOCK) {
    await delay(500)
    return {
      id: `input-attempt-${Date.now()}`,
      kind: input.kind,
      passed: input.responseText.trim().split(/\s+/).length >= 8,
      feedback: "Your production attempt was recorded.",
      wordCount: input.responseText.trim().split(/\s+/).length,
      matchedExpressions: [],
      requiredExpressions: [],
      delayedEligible: input.kind === "delayed_retrieval",
      countedAsDelayed: input.kind === "delayed_retrieval",
      activityRunId: `run-mock-${Date.now()}`,
      createdAt: new Date().toISOString(),
    }
  }
  const { attempt } = await apiFetch<{ attempt: InputLearningAttempt }>(`/input-learning/${sourceId}/attempts`, {
    method: "POST",
    body: JSON.stringify({
      ...input,
      responseText: boundTextPreservingHeadTail(input.responseText.trim(), INPUT_RESPONSE_MAX_CHARS),
    }),
  })
  return attempt
}

export async function deleteInputLearningSource(sourceId: string): Promise<{ deleted: boolean; id: string }> {
  if (USE_MOCK) {
    await delay(250)
    mockInputLearningSources = mockInputLearningSources.filter((source) => source.id !== sourceId)
    return { deleted: true, id: sourceId }
  }
  return apiFetch<{ deleted: boolean; id: string }>(`/input-learning/${sourceId}`, { method: "DELETE" })
}

/* ---- Private ebook learning ---- */

let mockEbooks: Ebook[] = []
let mockStudyPacks: EbookStudyPack[] = []
let mockEbookTargets: EbookLearningTarget[] = []
const mockEbookPracticeSessions = new Map<string, EbookPracticeSession>()

export async function importEbook(
  file: File,
  comparisonLanguage: EbookComparisonLanguage,
): Promise<Ebook> {
  if (USE_MOCK) {
    await delay(450)
    const id = `book_${Date.now()}`
    const now = new Date().toISOString()
    const book: Ebook = {
      id,
      title: file.name.replace(/\.(epub|pdf)$/i, ""),
      author: null,
      format: file.name.toLowerCase().endsWith(".pdf") ? "pdf" : "epub",
      status: "ready",
      comparisonLanguage,
      comparisonMode: comparisonLanguage === "zh-CN" ? "translation" : "plain_english",
      fileSizeBytes: file.size,
      pageCount: 24,
      wordCount: 7200,
      lastStudiedPage: null,
      lastStudyRange: null,
      createdAt: now,
      updatedAt: now,
    }
    mockEbooks = [book, ...mockEbooks]
    return book
  }
  const body = new FormData()
  body.set("file", file)
  body.set("comparisonLanguage", comparisonLanguage)
  body.set("rightsConfirmed", "true")
  const { book } = await apiUpload<{ book: Ebook }>("/ebooks/import", body, null)
  return book
}

export async function getEbooks(): Promise<Ebook[]> {
  if (USE_MOCK) return mockEbooks
  const { books } = await apiFetch<{ books: Ebook[]; count: number }>("/ebooks")
  return books
}

export async function getEbook(bookId: string): Promise<Ebook> {
  if (USE_MOCK) {
    const book = mockEbooks.find((row) => row.id === bookId)
    if (!book) throw new Error("Ebook not found")
    return book
  }
  const { book } = await apiFetch<{ book: Ebook }>(`/ebooks/${bookId}`)
  return book
}

export async function updateEbookLanguage(
  bookId: string,
  comparisonLanguage: EbookComparisonLanguage,
): Promise<Ebook> {
  if (USE_MOCK) {
    const book = await getEbook(bookId)
    Object.assign(book, {
      comparisonLanguage,
      comparisonMode: comparisonLanguage === "zh-CN" ? "translation" : "plain_english",
    })
    return book
  }
  const { book } = await apiFetch<{ book: Ebook }>(`/ebooks/${bookId}`, {
    method: "PATCH",
    body: JSON.stringify({ comparisonLanguage }),
  })
  return book
}

export async function deleteEbook(bookId: string): Promise<void> {
  if (USE_MOCK) {
    mockEbooks = mockEbooks.filter((row) => row.id !== bookId)
    mockStudyPacks = mockStudyPacks.filter((row) => row.bookId !== bookId)
    const removedTargetIds = new Set(mockEbookTargets.filter((row) => row.bookId === bookId).map((row) => row.id))
    mockEbookTargets = mockEbookTargets.filter((row) => row.bookId !== bookId)
    for (const [sessionId, session] of mockEbookPracticeSessions) {
      if (removedTargetIds.has(session.targetId)) mockEbookPracticeSessions.delete(sessionId)
    }
    return
  }
  await apiFetch(`/ebooks/${bookId}`, { method: "DELETE" })
}

export async function createEbookStudyPack(
  bookId: string,
  startPage: number,
  endPage: number,
): Promise<EbookStudyPack> {
  if (USE_MOCK) {
    await delay(600)
    const book = await getEbook(bookId)
    const now = new Date().toISOString()
    const pageNumbers = Array.from({ length: endPage - startPage + 1 }, (_, index) => startPage + index)
    const pack: EbookStudyPack = {
      id: `epack_${Date.now()}`,
      bookId,
      bookTitle: book.title,
      startPage,
      endPage,
      comparisonLanguage: book.comparisonLanguage,
      comparisonMode: book.comparisonMode,
      status: "ready",
      totalPageCount: pageNumbers.length,
      completedPageCount: pageNumbers.length,
      failedPages: [],
      pages: pageNumbers.map((pageNumber) => {
        const unitId = `p${pageNumber}_u0`
        const sourceText = "Although the plan looked simple at first, it turned out to require more patience than anyone expected."
        const annotationId = `eann_${bookId}_${pageNumber}`
        return {
          id: `ecache_${bookId}_${pageNumber}`,
          cacheId: `ecache_${bookId}_${pageNumber}`,
          bookId,
          pageNumber,
          chapterTitle: "Sample chapter",
          comparisonLanguage: book.comparisonLanguage,
          comparisonMode: book.comparisonMode,
          units: [{
            id: unitId,
            unitId,
            pageNumber,
            position: 0,
            paragraphIndex: 0,
            sentenceIndex: 0,
            unitType: "sentence",
            sourceText,
            counterpartText: book.comparisonLanguage === "zh-CN"
              ? "虽然这个计划起初看起来很简单，但事实证明它需要比任何人预想的更多耐心。"
              : "The plan seemed easy, but it actually needed much more patience than expected.",
          }],
          annotations: [{
            id: annotationId,
            bookId,
            pageNumber,
            unitId,
            sourceText,
            selectedText: "it turned out to require",
            startOffset: sourceText.indexOf("it turned out to require"),
            endOffset: sourceText.indexOf("it turned out to require") + "it turned out to require".length,
            kind: "grammar_pattern",
            title: "it turned out to require",
            meaningInContext: "结果发现确实需要……",
            structure: "turn out to + verb 表示最终发现的结果。",
            usage: "用来对比最初判断和后来发现的事实。",
            collocations: ["turn out to be", "turn out to need"],
            usageRegister: "neutral",
            commonPitfalls: ["Do not use an -ing form directly after to."],
            patternTemplate: "It turned out to + verb",
            clauseBreakdown: [],
            simplifiedParaphrase: "",
            examples: ["The task turned out to be easier than expected."],
            transferPrompt: "Describe something whose real difficulty surprised you.",
            skillCode: "grammar.verb_form",
            createdAt: now,
          }],
        }
      }),
      createdAt: now,
      updatedAt: now,
    }
    mockStudyPacks = [pack, ...mockStudyPacks]
    return pack
  }
  const { studyPack } = await apiFetch<{ studyPack: EbookStudyPack }>(`/ebooks/${bookId}/study-packs`, {
    method: "POST",
    body: JSON.stringify({ startPage, endPage }),
  }, LLM_OPERATION_TIMEOUT_MS)
  return studyPack
}

export async function getEbookStudyPack(packId: string): Promise<EbookStudyPack> {
  if (USE_MOCK) {
    const pack = mockStudyPacks.find((row) => row.id === packId)
    if (!pack) throw new Error("Study pack not found")
    return pack
  }
  const { studyPack } = await apiFetch<{ studyPack: EbookStudyPack }>(`/ebook-study-packs/${packId}`)
  return studyPack
}

export async function waitForEbookStudyPack(initial: EbookStudyPack): Promise<EbookStudyPack> {
  if (initial.status !== "processing") return initial
  let current = initial
  for (let attempt = 0; attempt < 120; attempt += 1) {
    await delay(2_500)
    current = await getEbookStudyPack(initial.id)
    if (current.status !== "processing") return current
  }
  throw new Error("The ebook study pack is still processing. Open it again shortly.")
}

export async function createEbookAnnotation(
  packId: string,
  input: { unitId: string; startOffset: number; endOffset: number },
): Promise<EbookAnnotation> {
  if (USE_MOCK) {
    const pack = await getEbookStudyPack(packId)
    const page = pack.pages?.find((row) => row.units.some((unit) => unit.unitId === input.unitId))
    const unit = page?.units.find((row) => row.unitId === input.unitId)
    if (!page || !unit) throw new Error("Sentence not found")
    const selectedText = unit.sourceText.slice(input.startOffset, input.endOffset)
    const annotation: EbookAnnotation = {
      id: `eann_${Date.now()}`,
      bookId: pack.bookId,
      studyPackId: packId,
      pageNumber: unit.pageNumber,
      unitId: unit.unitId,
      sourceText: unit.sourceText,
      selectedText,
      startOffset: input.startOffset,
      endOffset: input.endOffset,
      kind: selectedText.split(/\s+/).length > 8 ? "complex_sentence" : "phrase",
      title: selectedText,
      meaningInContext: "Meaning in this exact sentence.",
      structure: "Notice the reusable structure and its fixed word order.",
      usage: "Use it when the same relationship between ideas is needed.",
      collocations: [],
      usageRegister: "neutral",
      commonPitfalls: [],
      patternTemplate: selectedText,
      clauseBreakdown: [],
      simplifiedParaphrase: "",
      examples: [],
      transferPrompt: "Use this in a new situation.",
      skillCode: "sentence.structure",
      createdAt: new Date().toISOString(),
    }
    page.annotations.push(annotation)
    return annotation
  }
  const { annotation } = await apiFetch<{ annotation: EbookAnnotation }>(`/ebook-study-packs/${packId}/annotations`, {
    method: "POST",
    body: JSON.stringify(input),
  }, LLM_OPERATION_TIMEOUT_MS)
  return annotation
}

export async function markEbookAnnotationUnfamiliar(annotationId: string): Promise<EbookLearningTarget> {
  if (USE_MOCK) {
    const annotation = mockStudyPacks.flatMap((pack) => pack.pages ?? []).flatMap((page) => page.annotations).find((row) => row.id === annotationId)
    if (!annotation) throw new Error("Annotation not found")
    const existing = mockEbookTargets.find((row) => row.annotationId === annotationId)
    if (existing) return existing
    const book = await getEbook(annotation.bookId)
    const now = new Date().toISOString()
    const target: EbookLearningTarget = {
      id: `etarget_${Date.now()}`,
      bookId: book.id,
      bookTitle: book.title,
      pageNumber: annotation.pageNumber,
      annotationId,
      kind: annotation.kind,
      expression: annotation.selectedText,
      sourceText: annotation.sourceText,
      meaningInContext: annotation.meaningInContext,
      patternTemplate: annotation.patternTemplate,
      transferPrompt: annotation.transferPrompt,
      comparisonLanguage: book.comparisonLanguage,
      skillCode: annotation.skillCode,
      status: "provisional",
      attemptCount: 0,
      dueAt: now,
      createdAt: now,
      updatedAt: now,
    }
    mockEbookTargets = [target, ...mockEbookTargets]
    return target
  }
  const { target } = await apiFetch<{ target: EbookLearningTarget }>(`/ebook-annotations/${annotationId}/learning-target`, { method: "PUT" })
  return target
}

export async function getEbookLearningTargets(dueOnly = false): Promise<EbookLearningTarget[]> {
  if (USE_MOCK) return mockEbookTargets.filter((row) => !dueOnly || (row.status !== "mastered" && row.status !== "archived"))
  const { targets } = await apiFetch<{ targets: EbookLearningTarget[] }>(`/ebook-learning-targets?dueOnly=${dueOnly}`)
  return targets
}

export async function startEbookPractice(targetId: string): Promise<EbookPracticeSession> {
  if (USE_MOCK) {
    const target = mockEbookTargets.find((row) => row.id === targetId)
    if (!target) throw new Error("Learning target not found")
    const now = new Date().toISOString()
    const session: EbookPracticeSession = {
      id: `epractice_${Date.now()}`,
      bookId: target.bookId,
      targetId,
      status: "active",
      currentStep: 1,
      delayedReview: false,
      attempts: [],
      exercise: {
        step: 1,
        title: "Understand",
        question: `Explain what “${target.expression}” means here and when it is appropriate.`,
        targetExpression: target.expression,
        requiresTarget: false,
        sourceSentenceVisible: true,
        sourceText: target.sourceText,
      },
      createdAt: now,
      updatedAt: now,
    }
    mockEbookPracticeSessions.set(session.id, session)
    return session
  }
  const { session } = await apiFetch<{ session: EbookPracticeSession }>(`/ebook-learning-targets/${targetId}/practice-sessions`, { method: "POST" })
  return session
}

export async function submitEbookPractice(
  sessionId: string,
  input: { responseText: string; clientAttemptId: string; hintUsed: boolean },
): Promise<{ attempt: EbookPracticeAttempt; session: EbookPracticeSession; target: EbookLearningTarget }> {
  if (USE_MOCK) {
    const current = mockEbookPracticeSessions.get(sessionId)
    const target = mockEbookTargets.find((row) => row.id === current?.targetId)
    if (!target) throw new Error("Learning target not found")
    const now = new Date().toISOString()
    const passed = input.responseText.trim().length >= 8
    const attempt: EbookPracticeAttempt = {
      id: `eattempt_${Date.now()}`,
      clientAttemptId: input.clientAttemptId,
      step: current?.currentStep ?? 1,
      responseText: input.responseText,
      hintUsed: input.hintUsed,
      passed,
      score: passed ? 88 : 45,
      feedback: passed ? "This step meets the requirement." : "Add a fuller explanation.",
      correctedAnswer: input.responseText,
      createdAt: now,
    }
    if (!current) throw new Error("Practice session not found")
    const session = { ...current, attempts: [...current.attempts, attempt], updatedAt: now }
    if (passed && current.currentStep < 3) {
      const next = (current.currentStep + 1) as 2 | 3
      session.currentStep = next
      session.exercise = {
        step: next,
        title: next === 2 ? "Guided use" : "Independent transfer",
        question: next === 2
          ? `Write a new sentence using “${target.expression}” naturally.`
          : `Use “${target.expression}” independently in 2–4 sentences for a new situation.`,
        targetExpression: target.expression,
        requiresTarget: true,
        sourceSentenceVisible: next < 3,
        sourceText: next < 3 ? target.sourceText : null,
      }
    } else if (passed && current.currentStep === 3) {
      session.status = "complete"
      session.exercise = null
      target.status = "learning"
      target.dueAt = new Date(Date.now() + 86400000).toISOString()
    }
    mockEbookPracticeSessions.set(sessionId, session)
    return { attempt, session, target }
  }
  return apiFetch(`/ebook-practice-sessions/${sessionId}/attempts`, {
    method: "POST",
    body: JSON.stringify(input),
  }, LLM_OPERATION_TIMEOUT_MS)
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
    taskPrompt: "Write a concise update to the colleague waiting for your work and use “accountable” naturally.",
    successCriteria: ["Name the cause precisely", "Distinguish a delay from a cancellation", "Use a professional but warm tone"],
    hints: ["Think about the exact relationship between cause, delay, and next step.", "Useful chunks: held up by, on track to, revised handoff time", "Try: The handoff has been delayed because…"],
    vocabulary: {
      targetWord: "accountable",
      wordForms: ["accountable"],
      partOfSpeech: "adjective",
      meaning: "Willing to take responsibility for what you do and explain the result.",
      recognitionTip: "Someone who is accountable does not hide from the result; they own it and explain what happens next.",
      usageNote: "Often used with “for” to name the result or responsibility: accountable for the delay.",
      collocations: ["be accountable for", "hold someone accountable", "fully accountable"],
      exampleSentences: [
        "I am accountable for delivering the revised draft by Friday.",
        "A good project lead keeps the team informed and remains accountable for the outcome.",
      ],
      commonMistake: "Do not use accountable to mean only “reliable.” It specifically includes responsibility for actions or results.",
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
      activityRunId: `run_mock_${Date.now()}`,
      estimatedMinutes: input.durationMinutes,
      difficulty: input.energy === "light" ? "Gentle stretch" : input.energy === "challenge" ? "Challenge" : "Balanced",
    }
  }
  const payload = await apiFetch<{ mission: CoachMission }>("/coach/missions", {
    method: "POST",
    body: JSON.stringify(withOutputLanguage({ ...input })),
  }, LLM_OPERATION_TIMEOUT_MS)
  return payload.mission
}

export async function updateActivityRun(
  runId: string,
  update: {
    status?: ActivityRunStatus
    hintLevel?: number
    playCount?: number
    attemptCount?: number
    completedCriteria?: number[]
    skipReason?: string
    abandonReason?: string
    selfReportedDifficulty?: "too_easy" | "right" | "too_hard"
  },
): Promise<ActivityRun> {
  if (USE_MOCK) {
    const now = new Date().toISOString()
    return {
      id: runId,
      userId: DEMO_USER_ID,
      activityType: "coach",
      targetSkills: [],
      status: update.status ?? "started",
      hintLevel: update.hintLevel ?? 0,
      playCount: update.playCount ?? 0,
      attemptCount: update.attemptCount ?? 0,
      completedCriteria: update.completedCriteria ?? [],
      assignedAt: now,
      createdAt: now,
      updatedAt: now,
      version: 1,
    }
  }
  const payload = await apiFetch<{ run: ActivityRun }>(`/learning/runs/${runId}`, {
    method: "PATCH",
    body: JSON.stringify(update),
  })
  return payload.run
}

export async function recordLearningEvidence(input: {
  clientEventId: string
  runId?: string
  sourceId?: string
  skillCode: string
  outcome: "success" | "hinted_success" | "failure" | "avoided" | "no_opportunity"
  opportunityPresent: boolean
  supportLevel?: number
  modality?: string
  taskType?: string
  taskDifficulty?: number
  evaluatorConfidence?: number
  contextKey?: string
  novelContext?: boolean
  delayed?: boolean
  evidenceQuote?: string
}): Promise<{ event: EvidenceEvent; state: LearningState; duplicate: boolean }> {
  return apiFetch<{ event: EvidenceEvent; state: LearningState; duplicate: boolean }>("/learning/evidence", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export async function getLearningOverview(): Promise<LearningOverview> {
  if (USE_MOCK) {
    return { states: [], recentRuns: [], recentEvidence: [], generatedAt: new Date().toISOString() }
  }
  return apiFetch<LearningOverview>("/learning/overview")
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
  }, LLM_OPERATION_TIMEOUT_MS)
  return payload.mission
}

export async function synthesizeCoachSpeech(
  text: string,
  style: "gentle" | "natural" | "challenge" = "natural",
): Promise<Blob> {
  if (USE_MOCK) throw new Error("AI speech is unavailable in mock mode.")
  const path = "/coach/speech"
  return fetchWithTotalTimeout(
    `${API_BASE_URL}/api/v1${path}`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, style }),
    },
    LLM_OPERATION_TIMEOUT_MS,
    async (res) => {
      if (!res.ok) throw new Error(await getErrorMessage(res, path))
      return res.blob()
    },
  )
}

/* ---- Chat ---- */

export interface CreateChatSessionRequest {
  userId?: string
  topic?: string
  textModel?: TextChatModel
  scenarioPrompt?: string
  starterMessage?: string
  scenarioFamily?: string
  scenarioKey?: string
  textModelMode?: TextChatModelMode
  missionRunId?: string
  missionType?: string
  missionTargetSkills?: string[]
}

export async function createChatSession(input: CreateChatSessionRequest = {}): Promise<ChatSession> {
  const {
    userId = DEMO_USER_ID,
    topic,
    textModel,
    scenarioPrompt,
    starterMessage,
    scenarioFamily,
    scenarioKey,
    textModelMode,
    missionRunId,
    missionType,
    missionTargetSkills,
  } = input
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
      missionRunId: missionRunId ?? null,
      missionType: missionType ?? null,
      missionTargetSkills: missionTargetSkills ?? [],
      textModel: textModel ?? "Server default",
      textModelMode: textModelMode ?? "fast",
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
      ...(textModelMode ? { textModelMode } : {}),
      ...(missionRunId ? { missionRunId } : {}),
      ...(missionType ? { missionType } : {}),
      ...(missionTargetSkills?.length ? { missionTargetSkills } : {}),
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
        textModel: DEEPSEEK_DS_V4_FLASH_0731_MODEL,
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

export interface SendChatMessageRequest {
  userId?: string
  sessionId: string
  text: string
  clientMessageId: string
}

export async function sendChatMessage(input: SendChatMessageRequest): Promise<ChatSendResponse> {
  const {
    userId = DEMO_USER_ID,
    sessionId,
    text: unvalidatedText,
    clientMessageId,
  } = input
  const text = requireLearnerResponseWithinLimit(unvalidatedText)
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
        clientMessageId,
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
    body: JSON.stringify({ userId, sessionId, text, clientMessageId }),
  }, LLM_OPERATION_TIMEOUT_MS)
}

export async function predictChatCompletion(
  sessionId: string,
  unvalidatedPartialText: string,
  userId: string = DEMO_USER_ID,
): Promise<string[]> {
  const partialText = requireLearnerResponseWithinLimit(unvalidatedPartialText)
  if (USE_MOCK) {
    await delay(500)
    return ["Could you tell me more?", "What happened next?"]
  }
  const payload = await apiFetch<{ predictions: string[] }>("/chat/predict", {
    method: "POST",
    body: JSON.stringify({ userId, sessionId, partialText }),
  }, LLM_OPERATION_TIMEOUT_MS)
  return payload.predictions
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
  type AnalysisJobResponse = Partial<SessionAnalysisResponse> & {
    status: "idle" | "processing" | "completed"
    sessionId: string
  }

  const completedResult = (payload: AnalysisJobResponse) => {
    if (payload.status !== "completed" || !payload.analysis) return null
    return payload as SessionAnalysisResponse
  }

  const started = await apiFetch<AnalysisJobResponse>(`/chat/sessions/${sessionId}/analysis-jobs`, {
    method: "POST",
    body: JSON.stringify(withOutputLanguage({ hintLevel })),
  })
  const immediate = completedResult(started)
  if (immediate) return immediate

  let lastReadError: unknown
  for (let attempt = 0; attempt < 72; attempt += 1) {
    await delay(5_000)
    try {
      const status = await apiFetch<AnalysisJobResponse>(`/chat/sessions/${sessionId}/analysis`)
      const completed = completedResult(status)
      if (completed) return completed
      if (status.status === "idle" && attempt >= 2) {
        throw new Error("Session analysis stopped before completing. Please try again.")
      }
    } catch (error) {
      lastReadError = error
      if (error instanceof Error && /stopped before completing/i.test(error.message)) throw error
    }
  }
  throw lastReadError instanceof Error
    ? lastReadError
    : new Error("Session analysis is still processing. Please check this conversation again shortly.")
}

/* ---- Voice / Realtime ---- */

export async function createRealtimeSession(
  userId: string = DEMO_USER_ID,
  topic?: string,
  model: RealtimeVoiceModel = "gpt-realtime-mini-2025-12-15",
  context?: RealtimeSessionContext,
): Promise<RealtimeSessionResponse> {
  return apiFetch<RealtimeSessionResponse>("/chat/realtime/session", {
    method: "POST",
    body: JSON.stringify(withOutputLanguage({
      ...context,
      userId,
      topic,
      model,
    })),
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

export interface VoiceTranscriptMessage {
  role: "user" | "assistant"
  content: string
  clientMessageId?: string
  createdAt?: string
}

function voiceTranscriptRequestBytes(
  userId: string,
  messages: VoiceTranscriptMessage[],
): number {
  return new TextEncoder().encode(JSON.stringify({ userId, messages })).byteLength
}

export function chunkVoiceTranscriptMessages(
  userId: string,
  messages: VoiceTranscriptMessage[],
): VoiceTranscriptMessage[][] {
  const batches: VoiceTranscriptMessage[][] = []
  let batch: VoiceTranscriptMessage[] = []
  for (const message of messages) {
    const candidate = [...batch, message]
    if (
      batch.length
      && (
        candidate.length > REALTIME_TRANSCRIPT_REQUEST_MAX_MESSAGES
        || voiceTranscriptRequestBytes(userId, candidate) > REALTIME_TRANSCRIPT_REQUEST_MAX_BYTES
      )
    ) {
      batches.push(batch)
      batch = [message]
    } else {
      batch = candidate
    }
    if (voiceTranscriptRequestBytes(userId, batch) > REALTIME_TRANSCRIPT_REQUEST_MAX_BYTES) {
      throw new Error("One transcript message is too large to upload safely.")
    }
  }
  if (batch.length) batches.push(batch)
  return batches
}

export async function saveVoiceTranscript(
  userId: string = DEMO_USER_ID,
  sessionId: string,
  messages: VoiceTranscriptMessage[],
): Promise<{ saved: number; skippedDuplicates: number; sessionId: string }> {
  const boundedMessages = messages.flatMap((message) => {
    const content = boundTextPreservingHeadTail(message.content.trim(), REALTIME_TRANSCRIPT_MESSAGE_MAX_CHARS)
    if (!content) return []
    return [{
      ...message,
      content,
      ...(message.clientMessageId
        ? { clientMessageId: boundTextPrefix(message.clientMessageId, 160) }
        : {}),
      ...(message.createdAt
        ? { createdAt: boundTextPrefix(message.createdAt, 64) }
        : {}),
    }]
  })
  let saved = 0
  let skippedDuplicates = 0
  const batches = chunkVoiceTranscriptMessages(userId, boundedMessages)
  for (const batch of batches) {
    const result = await apiFetch<{ saved: number; skippedDuplicates: number; sessionId: string }>(
      `/chat/sessions/${sessionId}/transcript`,
      {
        method: "POST",
        body: JSON.stringify({ userId, messages: batch }),
      },
    )
    saved += result.saved
    skippedDuplicates += result.skippedDuplicates
  }
  return { saved, skippedDuplicates, sessionId }
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
