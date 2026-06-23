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
 *  POST /plan              { userId }                         -> { plan }
 *  GET  /plan/{userId}                                        -> { plan|null }
 *  POST /practice/generate { userId, targetSkillCode? }      -> { exercise }
 *  POST /practice/submit   { userId, exerciseId, userAnswer } -> PracticeSubmitResponse
 *  GET  /history/{userId}                                    -> HistoryResponse
 *  GET  /stats/daily/{userId}?timezone=<IANA>&days=7         -> DailyStatsResponse
 */

import type {
  ChatImportAnalyzeResponse,
  ChatImportConversation,
  ChatMessage,
  ChatMessagesResponse,
  ChatPredictResponse,
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
  LearningPlan,
  NotesResponse,
  PlanResponse,
  PracticeExercise,
  PracticeGenerateResponse,
  PracticeGrade,
  PracticeSubmitResponse,
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
import { getLLMProviderHeaders } from "./llm-settings"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL
const USE_MOCK = !API_BASE_URL

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

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
  return (await res.json()) as T
}

/* In-memory exercise cache so submit() can grade against the generated item. */
const exerciseCache = new Map<string, PracticeExercise>()

export async function diagnose(
  userId: string,
  text: string,
  diagnosisMode: DiagnosisMode = "fast",
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
    body: JSON.stringify({ userId, text, diagnosisMode }),
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
    body: JSON.stringify({ userId, sourceName, analysisMode, conversations }),
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

export async function getPlan(userId: string = DEMO_USER_ID): Promise<PlanResponse> {
  if (USE_MOCK) {
    await delay(500)
    return { plan: null }
  }
  return apiFetch<PlanResponse>(`/plan/${userId}`)
}

export async function generatePlan(userId: string = DEMO_USER_ID): Promise<LearningPlan> {
  if (USE_MOCK) {
    await delay(1600)
    return mockPlan
  }
  const { plan } = await apiFetch<{ plan: LearningPlan }>("/plan", {
    method: "POST",
    body: JSON.stringify({ userId }),
  })
  return plan
}

export async function generatePractice(
  userId: string = DEMO_USER_ID,
  targetSkillCode?: string,
): Promise<PracticeExercise> {
  if (USE_MOCK) {
    await delay(900)
    const exercise = getMockExercise(targetSkillCode)
    exerciseCache.set(exercise.id, exercise)
    return exercise
  }
  const { exercise } = await apiFetch<PracticeGenerateResponse>("/practice/generate", {
    method: "POST",
    body: JSON.stringify({ userId, targetSkillCode }),
  })
  return exercise
}

export async function submitPractice(
  userId: string = DEMO_USER_ID,
  exerciseId: string,
  userAnswer: string,
): Promise<PracticeGrade> {
  if (USE_MOCK) {
    await delay(900)
    const exercise = exerciseCache.get(exerciseId) ?? getMockExercise()
    return gradeMockAnswer(exercise, userAnswer)
  }
  const { grade } = await apiFetch<PracticeSubmitResponse>("/practice/submit", {
    method: "POST",
    body: JSON.stringify({ userId, exerciseId, userAnswer }),
  })
  return grade
}

export async function getHistory(userId: string = DEMO_USER_ID): Promise<HistoryResponse> {
  if (USE_MOCK) {
    await delay(600)
    return { submissions: mockSubmissions, errors: mockErrors }
  }
  return apiFetch<HistoryResponse>(`/history/${userId}`)
}

export async function deleteSubmission(
  submissionId: string,
  createdAt: string,
): Promise<DeleteSubmissionResponse> {
  if (USE_MOCK) {
    await delay(400)
    return { deleted: true, submissionId, removedErrors: 0, updatedSkills: [], profile: null }
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

/* ---- Chat ---- */

export async function createChatSession(
  userId: string = DEMO_USER_ID,
  topic?: string,
  textModel: TextChatModel = "deepseek-v4-flash",
): Promise<ChatSession> {
  if (USE_MOCK) {
    await delay(300)
    return {
      id: `cs-${Date.now()}`,
      userId,
      topic: topic ?? null,
      scenarioPrompt: null,
      textModel,
      messageCount: 0,
      summary: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  }
  const { session } = await apiFetch<{ session: ChatSession }>("/chat/sessions", {
    method: "POST",
    body: JSON.stringify({ userId, topic, textModel }),
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
  const { sessions } = await apiFetch<ChatSessionsResponse>("/chat/sessions")
  return sessions
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
            explanationZh: "描述过去的事情要用过去式，go 的过去式是 went。",
          },
        ],
        betterExpression: {
          original: "The food was very good",
          natural: "The food was amazing / The food was absolutely delicious",
          explanationZh: "用更具体生动的形容词比 very good 更地道自然。",
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

export async function predictChatCompletion(
  userId: string = DEMO_USER_ID,
  sessionId: string,
  partialText: string,
): Promise<string[]> {
  if (USE_MOCK) {
    await delay(800)
    return [
      "...if you could help me with this?",
      "...what the best way to do this is?",
      "...whether we should try something different.",
    ]
  }
  const { predictions } = await apiFetch<ChatPredictResponse>("/chat/predict", {
    method: "POST",
    body: JSON.stringify({ userId, sessionId, partialText }),
  })
  return predictions
}

/* ---- Session Analysis ---- */

export async function analyzeSession(
  sessionId: string,
): Promise<SessionAnalysisResponse> {
  if (USE_MOCK) {
    await delay(2000)
    return {
      analysis: {
        summaryZh: "你在这次对话中表现积极，主动使用英语交流。主要需要注意动词时态的使用和更自然的表达方式。",
        corrections: [
          {
            code: "grammar.verb_tense",
            category: "Verb tense",
            severity: "high",
            original: "I go there yesterday",
            corrected: "I went there yesterday",
            explanationZh: "描述过去的事情要用过去式，go 的过去式是 went。",
            microLessonZh: "看到 yesterday、last week 等过去时间词时，主要动词要变成过去式。",
            practiceGoal: "用过去式复述 5 件昨天做过的事情。",
          },
          {
            code: "grammar.verb_tense",
            category: "Verb tense",
            severity: "medium",
            original: "The food is very good",
            corrected: "The food was very good",
            explanationZh: "描述过去的体验用过去式 was，而不是现在式 is。",
            microLessonZh: "过去经历中的 be 动词通常用 was/were。",
            practiceGoal: "用 was/were 描述 5 个过去的体验。",
          },
        ],
        naturalExpressions: [
          {
            original: "The food was very good",
            natural: "The food was absolutely delicious",
            explanationZh: "用更具体生动的形容词比 very good 更地道自然。",
            context: "描述食物、体验等正面感受时使用",
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
            explanationZh: "多次在描述过去事件时使用现在时态，需要加强过去时态的练习。",
            practiceGoal: "用过去式复述5件昨天做的事情。",
          },
        ],
        strengthsZh: ["积极主动地使用英语交流", "词汇量基本满足日常对话需求"],
        recommendedNextActionsZh: ["练习过去时态的使用", "积累更多地道表达替换 very + adj 的模式"],
      },
      savedNotes: [],
      savedErrors: [],
      updatedSkills: [],
      sessionId,
    }
  }
  return apiFetch<SessionAnalysisResponse>(`/chat/sessions/${sessionId}/analyze`, {
    method: "POST",
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
    body: JSON.stringify({ userId, topic, model }),
  })
}

export async function saveVoiceTranscript(
  userId: string = DEMO_USER_ID,
  sessionId: string,
  messages: { role: string; content: string }[],
): Promise<{ saved: number }> {
  return apiFetch<{ saved: number }>(`/chat/sessions/${sessionId}/transcript`, {
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
