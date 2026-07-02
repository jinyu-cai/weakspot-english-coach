"use client"

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
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

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<OutputLanguage>(DEFAULT_LANGUAGE)

  useEffect(() => {
    const stored = getStoredLanguage()
    setLanguageState(stored)
    document.documentElement.lang = stored
  }, [])

  const value = useMemo<LanguageContextValue>(() => {
    function setLanguage(next: OutputLanguage) {
      setLanguageState(next)
      setStoredLanguage(next)
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
