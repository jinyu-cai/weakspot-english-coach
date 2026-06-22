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
