"use client"

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react"
import { getCopy, type AppCopy } from "@/lib/i18n"
import {
  DEFAULT_LANGUAGE,
  getStoredLanguage,
  setStoredLanguage,
  type OutputLanguage,
} from "@/lib/language"

type LanguageContextValue = {
  language: OutputLanguage
  setLanguage: (language: OutputLanguage) => void
  t: AppCopy
}

const LanguageContext = createContext<LanguageContextValue | null>(null)
const LANGUAGE_CHANGE_EVENT = "weakspot:language-change"

let clientLanguage: OutputLanguage | undefined

function getClientLanguage() {
  if (clientLanguage === undefined) {
    clientLanguage = getStoredLanguage()
  }
  return clientLanguage
}

function getServerLanguage(): OutputLanguage {
  return DEFAULT_LANGUAGE
}

function subscribeToLanguage(listener: () => void) {
  if (typeof window === "undefined") return () => {}
  window.addEventListener(LANGUAGE_CHANGE_EVENT, listener)
  return () => window.removeEventListener(LANGUAGE_CHANGE_EVENT, listener)
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const language = useSyncExternalStore(subscribeToLanguage, getClientLanguage, getServerLanguage)

  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  const value = useMemo<LanguageContextValue>(() => {
    function setLanguage(next: OutputLanguage) {
      clientLanguage = next
      setStoredLanguage(next)
      window.dispatchEvent(new Event(LANGUAGE_CHANGE_EVENT))
    }

    return {
      language,
      setLanguage,
      t: getCopy(language),
    }
  }, [language])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error("useLanguage must be used inside LanguageProvider")
  }
  return context
}
