export type LLMSettings = {
  apiKey: string
  baseUrl: string
  model: string
  fastModel: string
  serverDeepModelId: string
  serverFastModelId: string
}

export type ServerLLMModel = {
  id: string
  label: string
  provider: string
  model: string
  fastModel?: string
  adaptive?: boolean
  mode?: "deep" | "fast"
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

export function formatServerModelSelection(model: ServerLLMModel): string {
  const provider = model.provider.trim()
  const modelName = model.model.trim()
  if (provider && modelName) return `${provider} · ${modelName}`
  return modelName || provider || model.label || model.id
}

export const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1"
export const QWEN_MODEL_STUDIO_INTERNATIONAL_BASE_URL = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
export const QWEN_37_MAX_MODEL = "qwen3.7-max"
export const QWEN_37_PLUS_MODEL = "qwen3.7-plus"
export const SERVER_DEFAULT_MODEL_ID = "default"
export const DEFAULT_SERVER_DEEP_MODEL_ID = "qwen-deep"
export const DEFAULT_SERVER_FAST_MODEL_ID = "qwen-fast"
export const LLM_SETTINGS_CHANGE_EVENT = "weakspot:llm-settings-change"

const STORAGE_KEY = "weakspot.llmSettings.v1"

const defaultSettings: LLMSettings = {
  apiKey: "",
  baseUrl: DEFAULT_OPENAI_BASE_URL,
  model: "",
  fastModel: "",
  serverDeepModelId: DEFAULT_SERVER_DEEP_MODEL_ID,
  serverFastModelId: DEFAULT_SERVER_FAST_MODEL_ID,
}

type StoredLLMSettings = Partial<LLMSettings> & { serverModelId?: string }

function legacyServerPair(serverModelId?: string): Pick<LLMSettings, "serverDeepModelId" | "serverFastModelId"> {
  const legacyId = (serverModelId || "").trim()
  if (!legacyId || legacyId === SERVER_DEFAULT_MODEL_ID) {
    return {
      serverDeepModelId: DEFAULT_SERVER_DEEP_MODEL_ID,
      serverFastModelId: DEFAULT_SERVER_FAST_MODEL_ID,
    }
  }
  const providerPrefix = legacyId.replace(/-(deep|fast)$/, "")
  return {
    serverDeepModelId: `${providerPrefix}-deep`,
    serverFastModelId: `${providerPrefix}-fast`,
  }
}

export function serverModelsForMode(
  models: ServerLLMModel[],
  mode: "deep" | "fast",
): ServerLLMModel[] {
  return models.filter((model) => (
    model.mode === mode
    || (!model.adaptive && !model.mode && model.id.endsWith(`-${mode}`))
  ))
}

export function normalizeServerModelSettings(
  settings: LLMSettings,
  models: ServerLLMModel[],
): LLMSettings {
  const deepModels = serverModelsForMode(models, "deep")
  const fastModels = serverModelsForMode(models, "fast")
  const preferredDeep = deepModels.find((model) => model.id === DEFAULT_SERVER_DEEP_MODEL_ID)?.id
    || deepModels[0]?.id
    || DEFAULT_SERVER_DEEP_MODEL_ID
  const preferredFast = fastModels.find((model) => model.id === DEFAULT_SERVER_FAST_MODEL_ID)?.id
    || fastModels[0]?.id
    || DEFAULT_SERVER_FAST_MODEL_ID
  return {
    ...settings,
    serverDeepModelId: deepModels.some((model) => model.id === settings.serverDeepModelId)
      ? settings.serverDeepModelId
      : preferredDeep,
    serverFastModelId: fastModels.some((model) => model.id === settings.serverFastModelId)
      ? settings.serverFastModelId
      : preferredFast,
  }
}

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined"
}

export function loadLLMSettings(): LLMSettings {
  if (!canUseStorage()) return defaultSettings

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultSettings
    const parsed = JSON.parse(raw) as StoredLLMSettings
    const legacyPair = legacyServerPair(parsed.serverModelId)
    return {
      apiKey: parsed.apiKey ?? "",
      baseUrl: parsed.baseUrl || DEFAULT_OPENAI_BASE_URL,
      model: parsed.model ?? "",
      fastModel: parsed.fastModel ?? "",
      serverDeepModelId: parsed.serverDeepModelId || legacyPair.serverDeepModelId,
      serverFastModelId: parsed.serverFastModelId || legacyPair.serverFastModelId,
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
      serverDeepModelId: settings.serverDeepModelId.trim() || DEFAULT_SERVER_DEEP_MODEL_ID,
      serverFastModelId: settings.serverFastModelId.trim() || DEFAULT_SERVER_FAST_MODEL_ID,
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
    const isQwenDefault = (
      settings.serverDeepModelId === DEFAULT_SERVER_DEEP_MODEL_ID
      && settings.serverFastModelId === DEFAULT_SERVER_FAST_MODEL_ID
    )
    return isQwenDefault
      ? {}
      : {
        "X-LLM-Server-Deep-Model": settings.serverDeepModelId,
        "X-LLM-Server-Fast-Model": settings.serverFastModelId,
      }
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
