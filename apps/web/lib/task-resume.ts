"use client"

import { useSyncExternalStore } from "react"
import { markFirstAction, trackExperience } from "@/lib/experience"

export type LearningFeature =
  | "diagnose"
  | "coach"
  | "chat"
  | "practice"
  | "plan"
  | "input"
  | "import"
  | "vocabulary"

export interface LearningTaskResume {
  feature: LearningFeature
  href: string
  taskId: string
  title: string
  step: string
  draft?: unknown
  scrollY: number
  updatedAt: string
}

const STORAGE_KEY = "weakspot-active-learning-task-v1"
const RECENT_PATH_KEY = "weakspot-recent-learning-path-v1"
const CHANGE_EVENT = "weakspot:task-resume-change"
let cachedRaw: string | null | undefined
let cachedState: LearningTaskResume | null = null

function validTask(value: unknown): value is LearningTaskResume {
  if (!value || typeof value !== "object") return false
  const task = value as Partial<LearningTaskResume>
  return Boolean(
    task.feature
    && typeof task.href === "string"
    && typeof task.taskId === "string"
    && typeof task.title === "string"
    && typeof task.step === "string"
    && typeof task.updatedAt === "string",
  )
}

export function loadTaskResume(): LearningTaskResume | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw === cachedRaw) return cachedState
    cachedRaw = raw
    if (!raw) {
      cachedState = null
      return null
    }
    const parsed: unknown = JSON.parse(raw)
    cachedState = validTask(parsed) ? parsed : null
    return cachedState
  } catch {
    cachedRaw = null
    cachedState = null
    return null
  }
}

function emitChange() {
  cachedRaw = undefined
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

export function startTaskResume(
  task: Omit<LearningTaskResume, "updatedAt" | "scrollY"> & Partial<Pick<LearningTaskResume, "scrollY">>,
) {
  if (typeof window === "undefined") return
  const next: LearningTaskResume = {
    ...task,
    scrollY: task.scrollY ?? 0,
    updatedAt: new Date().toISOString(),
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    window.localStorage.setItem(RECENT_PATH_KEY, next.href)
    emitChange()
  } catch {
    // Local recovery is best-effort in private browsing modes.
  }
  markFirstAction(task.feature)
  trackExperience("task_started", { feature: task.feature, step: task.step })
}

export function updateTaskResume(
  patch: Partial<Omit<LearningTaskResume, "feature" | "taskId">>,
  expected?: Pick<LearningTaskResume, "feature" | "taskId">,
) {
  if (typeof window === "undefined") return
  const current = loadTaskResume()
  if (!current) return
  if (expected && (current.feature !== expected.feature || current.taskId !== expected.taskId)) return
  const next: LearningTaskResume = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    window.localStorage.setItem(RECENT_PATH_KEY, next.href)
    emitChange()
  } catch {
    // Keep the in-memory learning flow usable when persistence is unavailable.
  }
}

export function finishTaskResume(
  feature: LearningFeature,
  outcome: "completed" | "abandoned" = "completed",
) {
  if (typeof window === "undefined") return
  const current = loadTaskResume()
  if (!current || current.feature !== feature) return
  try {
    window.localStorage.removeItem(STORAGE_KEY)
    window.localStorage.setItem(RECENT_PATH_KEY, current.href)
    emitChange()
  } catch {
    // Completion must not depend on storage.
  }
  trackExperience(outcome === "completed" ? "task_completed" : "task_abandoned", {
    feature,
    step: current.step,
  })
}

export function getRecentLearningPath() {
  if (typeof window === "undefined") return "/coach"
  try {
    return window.localStorage.getItem(RECENT_PATH_KEY) || "/coach"
  } catch {
    return "/coach"
  }
}

function subscribe(listener: () => void) {
  if (typeof window === "undefined") return () => {}
  window.addEventListener(CHANGE_EVENT, listener)
  window.addEventListener("storage", listener)
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener)
    window.removeEventListener("storage", listener)
  }
}

export function useTaskResume() {
  return useSyncExternalStore(subscribe, loadTaskResume, () => null)
}
