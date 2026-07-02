export type OutputLanguage = "en" | "zh-CN"

export const DEFAULT_LANGUAGE: OutputLanguage = "en"
export const LANGUAGE_STORAGE_KEY = "weakspot-language"

export function normalizeLanguage(value: unknown): OutputLanguage {
  return value === "zh-CN" ? "zh-CN" : "en"
}

export function getStoredLanguage(): OutputLanguage {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE
  try {
    return normalizeLanguage(window.localStorage.getItem(LANGUAGE_STORAGE_KEY))
  } catch {
    return DEFAULT_LANGUAGE
  }
}

export function setStoredLanguage(language: OutputLanguage) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
    document.documentElement.lang = language
  } catch {
    // Ignore storage failures; the in-memory provider state still updates.
  }
}

export function getOutputLanguage(): OutputLanguage {
  return getStoredLanguage()
}
