import {
  DEMO_USER_ID,
  mockExerciseFor,
  mockGradeFor,
  mockHistory,
  mockDiagnostic,
  mockPlan,
  mockProfileResponse,
} from "./mock-data"
import type {
  DiagnoseResponse,
  GeneratePracticeResponse,
  HistoryResponse,
  PlanResponse,
  ProfileResponse,
  SubmitPracticeResponse,
} from "./types"

/**
 * API client seam.
 *
 * For the v0 preview, every function returns mock data shaped exactly like the
 * real API contract. To connect a backend, set NEXT_PUBLIC_API_BASE_URL and flip
 * USE_MOCK to false (or remove the mock branches). The real endpoints live under
 * `${API_BASE}/api/v1`.
 */
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? ""
const USE_MOCK = !API_BASE

// Simulate realistic network latency in the mock environment.
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}/api/v1${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  })
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${res.statusText}`)
  }
  return res.json() as Promise<T>
}

export async function diagnose(text: string, userId = DEMO_USER_ID): Promise<DiagnoseResponse> {
  if (USE_MOCK) {
    await delay(1400)
    return {
      ...mockDiagnostic,
      submission: { ...mockDiagnostic.submission, originalText: text },
    }
  }
  return request<DiagnoseResponse>("/diagnose", {
    method: "POST",
    body: JSON.stringify({ userId, text }),
  })
}

export async function getProfile(userId = DEMO_USER_ID): Promise<ProfileResponse> {
  if (USE_MOCK) {
    await delay(600)
    return mockProfileResponse
  }
  return request<ProfileResponse>(`/profile/${userId}`)
}

export async function getPlan(userId = DEMO_USER_ID): Promise<PlanResponse> {
  if (USE_MOCK) {
    await delay(500)
    return { plan: mockPlan }
  }
  return request<PlanResponse>(`/plan/${userId}`)
}

export async function generatePlan(userId = DEMO_USER_ID): Promise<PlanResponse> {
  if (USE_MOCK) {
    await delay(1600)
    return { plan: mockPlan }
  }
  return request<PlanResponse>("/plan", {
    method: "POST",
    body: JSON.stringify({ userId }),
  })
}

export async function generatePractice(
  targetSkillCode?: string,
  userId = DEMO_USER_ID,
): Promise<GeneratePracticeResponse> {
  if (USE_MOCK) {
    await delay(900)
    return { exercise: mockExerciseFor(targetSkillCode) }
  }
  return request<GeneratePracticeResponse>("/practice/generate", {
    method: "POST",
    body: JSON.stringify({ userId, targetSkillCode }),
  })
}

export async function submitPractice(
  exerciseId: string,
  userAnswer: string,
  userId = DEMO_USER_ID,
): Promise<SubmitPracticeResponse> {
  if (USE_MOCK) {
    await delay(1100)
    const grade = mockGradeFor(exerciseId, userAnswer)
    return {
      grade,
      attempt: {
        id: `attempt-${Math.random().toString(36).slice(2, 8)}`,
        exerciseId,
        userAnswer,
        createdAt: new Date().toISOString(),
      },
      updatedSkill: mockProfileResponse.skills[0],
    }
  }
  return request<SubmitPracticeResponse>("/practice/submit", {
    method: "POST",
    body: JSON.stringify({ userId, exerciseId, userAnswer }),
  })
}

export async function getHistory(userId = DEMO_USER_ID): Promise<HistoryResponse> {
  if (USE_MOCK) {
    await delay(500)
    return mockHistory
  }
  return request<HistoryResponse>(`/history/${userId}`)
}
