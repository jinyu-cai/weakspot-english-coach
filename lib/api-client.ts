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
 */

import type {
  DiagnoseResponse,
  HistoryResponse,
  LearningPlan,
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
  mockErrors,
  mockPlan,
  mockProfile,
  mockSkills,
  mockSubmissions,
} from "./mock-data"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL
const USE_MOCK = !API_BASE_URL

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}/api/v1${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  })
  if (!res.ok) {
    throw new Error(`Request failed (${res.status}): ${path}`)
  }
  return (await res.json()) as T
}

/* In-memory exercise cache so submit() can grade against the generated item. */
const exerciseCache = new Map<string, PracticeExercise>()

export async function diagnose(userId: string, text: string): Promise<DiagnoseResponse> {
  if (USE_MOCK) {
    await delay(1400)
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
    body: JSON.stringify({ userId, text }),
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
