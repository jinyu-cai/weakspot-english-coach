export type ExperienceEventName =
  | "first_action"
  | "task_started"
  | "task_completed"
  | "task_abandoned"
  | "loading_failed"
  | "retry_succeeded"

export interface ExperienceEvent {
  name: ExperienceEventName
  at: string
  feature?: string
  step?: string
  durationMs?: number
  reason?: "timeout" | "offline" | "request"
}

const STORAGE_KEY = "weakspot-experience-events-v1"
const SESSION_START_KEY = "weakspot-session-start"
const MAX_EVENTS = 100

/**
 * Stores only product-flow metadata. Learning text, prompts, answers, model
 * output, user identifiers, and free-form error messages are intentionally not
 * accepted by this API.
 */
export function trackExperience(
  name: ExperienceEventName,
  metadata: Omit<ExperienceEvent, "name" | "at"> = {},
) {
  if (typeof window === "undefined") return
  const event: ExperienceEvent = {
    name,
    at: new Date().toISOString(),
    ...(metadata.feature ? { feature: metadata.feature } : {}),
    ...(metadata.step ? { step: metadata.step } : {}),
    ...(typeof metadata.durationMs === "number" ? { durationMs: Math.max(0, Math.round(metadata.durationMs)) } : {}),
    ...(metadata.reason ? { reason: metadata.reason } : {}),
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const existing = raw ? JSON.parse(raw) as ExperienceEvent[] : []
    const next = [...(Array.isArray(existing) ? existing : []), event].slice(-MAX_EVENTS)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Analytics must never interrupt learning, including in private mode.
  }
  window.dispatchEvent(new CustomEvent("weakspot:experience", { detail: event }))
}

export function markFirstAction(feature: string) {
  if (typeof window === "undefined") return
  try {
    const existing = window.sessionStorage.getItem(SESSION_START_KEY)
    const startedAt = existing
      ? Number(existing)
      : typeof performance !== "undefined" && Number.isFinite(performance.timeOrigin)
        ? Math.round(performance.timeOrigin)
        : Date.now()
    if (!existing) window.sessionStorage.setItem(SESSION_START_KEY, String(startedAt))
    const firstActionKey = `${SESSION_START_KEY}:recorded`
    if (window.sessionStorage.getItem(firstActionKey)) return
    window.sessionStorage.setItem(firstActionKey, "1")
    trackExperience("first_action", { feature, durationMs: Date.now() - startedAt })
  } catch {
    // Session storage is optional.
  }
}
