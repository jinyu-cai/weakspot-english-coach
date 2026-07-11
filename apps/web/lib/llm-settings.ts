export type LLMSettings = {
  apiKey: string
  baseUrl: string
  model: string
  fastModel: string
  serverModelId: string
}

export type ServerLLMModel = {
  id: string
  label: string
  provider: string
  model: string
  fastModel?: string
  adaptive?: boolean
}

export type ServerModelLabels = {
  automatic: string
  deep: string
  fast: string
}

export function formatServerModelOption(
  model: ServerLLMModel,
  labels: ServerModelLabels,
): string {
  const name = model.adaptive ? labels.automatic : model.label
  if (!model.model) return name
  if (!model.adaptive) return `${name} · ${model.model}`

  const fastModel = model.fastModel || model.model
  if (fastModel === model.model) return `${name} · ${model.model}`
  return `${name} · ${labels.deep}: ${model.model} / ${labels.fast}: ${fastModel}`
}

export const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1"
export const QWEN_MODEL_STUDIO_INTERNATIONAL_BASE_URL = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
export const QWEN_37_MAX_MODEL = "qwen3.7-max"
export const QWEN_37_PLUS_MODEL = "qwen3.7-plus"
export const SERVER_DEFAULT_MODEL_ID = "default"
export const LLM_SETTINGS_CHANGE_EVENT = "weakspot:llm-settings-change"

const STORAGE_KEY = "weakspot.llmSettings.v1"

const defaultSettings: LLMSettings = {
  apiKey: "",
  baseUrl: DEFAULT_OPENAI_BASE_URL,
  model: "",
  fastModel: "",
  serverModelId: SERVER_DEFAULT_MODEL_ID,
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
      serverModelId: parsed.serverModelId || SERVER_DEFAULT_MODEL_ID,
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
      serverModelId: settings.serverModelId.trim() || SERVER_DEFAULT_MODEL_ID,
    }),
  )
  window.dispatchEvent(new Event(LLM_SETTINGS_CHANGE_EVENT))
}

export function clearLLMSettings() {
  if (!canUseStorage()) return
  window.localStorage.removeItem(STORAGE_KEY)
  window.dispatchEvent(new Event(LLM_SETTINGS_CHANGE_EVENT))
}

export function hasCustomLLMSettings() {
  const settings = loadLLMSettings()
  return Boolean(settings.apiKey && settings.model)
}

export function getLLMProviderHeaders(): Record<string, string> {
  const settings = loadLLMSettings()
  if (!settings.apiKey || !settings.model) {
    return settings.serverModelId && settings.serverModelId !== SERVER_DEFAULT_MODEL_ID
      ? { "X-LLM-Server-Model": settings.serverModelId }
      : {}
  }

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
