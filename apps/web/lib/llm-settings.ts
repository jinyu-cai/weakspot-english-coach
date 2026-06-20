export type LLMSettings = {
  apiKey: string
  baseUrl: string
  model: string
  fastModel: string
}

export const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1"

const STORAGE_KEY = "weakspot.llmSettings.v1"

const defaultSettings: LLMSettings = {
  apiKey: "",
  baseUrl: DEFAULT_OPENAI_BASE_URL,
  model: "",
  fastModel: "",
}

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined"
}

export function loadLLMSettings(): LLMSettings {
  if (!canUseStorage()) return defaultSettings

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultSettings
    const parsed = JSON.parse(raw) as Partial<LLMSettings>
    return {
      apiKey: parsed.apiKey ?? "",
      baseUrl: parsed.baseUrl || DEFAULT_OPENAI_BASE_URL,
      model: parsed.model ?? "",
      fastModel: parsed.fastModel ?? "",
    }
  } catch {
    return defaultSettings
  }
}

export function saveLLMSettings(settings: LLMSettings) {
  if (!canUseStorage()) return
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      apiKey: settings.apiKey.trim(),
      baseUrl: (settings.baseUrl || DEFAULT_OPENAI_BASE_URL).trim().replace(/\/+$/, ""),
      model: settings.model.trim(),
      fastModel: settings.fastModel.trim(),
    }),
  )
}

export function clearLLMSettings() {
  if (!canUseStorage()) return
  window.localStorage.removeItem(STORAGE_KEY)
}

export function hasCustomLLMSettings() {
  const settings = loadLLMSettings()
  return Boolean(settings.apiKey && settings.model)
}

export function getLLMProviderHeaders(): Record<string, string> {
  const settings = loadLLMSettings()
  if (!settings.apiKey || !settings.model) return {}

  const headers: Record<string, string> = {
    "X-LLM-API-Key": settings.apiKey,
    "X-LLM-Base-URL": (settings.baseUrl || DEFAULT_OPENAI_BASE_URL).replace(/\/+$/, ""),
    "X-LLM-Model": settings.model,
  }
  if (settings.fastModel) {
    headers["X-LLM-Fast-Model"] = settings.fastModel
  }
  return headers
}
