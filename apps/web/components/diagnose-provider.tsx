"use client"

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react"
import { toast } from "sonner"
import { diagnose } from "@/lib/api-client"
import { DEMO_USER_ID } from "@/lib/mock-data"
import type { DiagnosisMode, DiagnosticResult } from "@/lib/types"
import { useLanguage } from "@/components/language-provider"
import {
  finishTaskResume,
  loadTaskResume,
  startTaskResume,
  updateTaskResume,
} from "@/lib/task-resume"

interface DiagnoseContextValue {
  text: string
  setText: (value: string) => void
  diagnosisMode: DiagnosisMode
  setDiagnosisMode: (mode: DiagnosisMode) => void
  loading: boolean
  error: unknown
  result: DiagnosticResult | null
  originalText: string
  isDuplicate: boolean
  handleAnalyze: () => Promise<boolean>
}

const DiagnoseContext = createContext<DiagnoseContextValue | null>(null)

/**
 * Holds the diagnose/analyze state above the route boundary so it survives
 * navigation. Mounted in the root layout, this provider stays mounted while the
 * user switches tabs (e.g. Diagnose -> Notebook), so an in-flight analysis keeps
 * running and its result is still here when they come back instead of being lost
 * when the page component unmounts.
 */
export function DiagnoseProvider({ children }: { children: ReactNode }) {
  const [text, setTextState] = useState("")
  const [diagnosisMode, setDiagnosisMode] = useState<DiagnosisMode>("deep")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<DiagnosticResult | null>(null)
  const [originalText, setOriginalText] = useState("")
  const [isDuplicate, setIsDuplicate] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const { t } = useLanguage()

  useEffect(() => {
    const resume = loadTaskResume()
    if (resume?.feature !== "diagnose" || typeof resume.draft !== "string") return
    const timer = window.setTimeout(() => setTextState(resume.draft as string), 0)
    return () => window.clearTimeout(timer)
  }, [])

  const setText = useCallback((value: string) => {
    setTextState(value)
    if (!value.trim()) return
    const current = loadTaskResume()
    if (current?.feature === "diagnose") {
      updateTaskResume({ draft: value, step: "draft" }, { feature: "diagnose", taskId: current.taskId })
      return
    }
    startTaskResume({
      feature: "diagnose",
      href: "/",
      taskId: `diagnose-${Date.now()}`,
      title: t.nav.items.diagnose[0],
      step: "draft",
      draft: value,
    })
  }, [t.nav.items.diagnose])

  const handleAnalyze = useCallback(async () => {
    setLoading(true)
    setIsDuplicate(false)
    setError(null)
    const current = loadTaskResume()
    if (current?.feature === "diagnose") {
      updateTaskResume({ draft: text, step: "analyzing" }, { feature: "diagnose", taskId: current.taskId })
    } else {
      startTaskResume({
        feature: "diagnose",
        href: "/",
        taskId: `diagnose-${Date.now()}`,
        title: t.nav.items.diagnose[0],
        step: "analyzing",
        draft: text,
      })
    }
    try {
      const res = await diagnose(DEMO_USER_ID, text, diagnosisMode)
      setResult(res.diagnostic)
      setOriginalText(res.submission.originalText)
      const duplicate = Boolean(res.duplicate)
      setIsDuplicate(duplicate)
      finishTaskResume("diagnose", "completed")
      if (duplicate) {
        toast.info(t.diagnose.alreadyDiagnosed, {
          description: t.diagnose.duplicate,
        })
      } else {
        toast.success(t.diagnose.complete, {
          description:
            diagnosisMode === "fast"
              ? t.diagnose.readyFast
              : t.diagnose.readyDeep,
        })
      }
      return true
    } catch (error) {
      setError(error)
      toast.error(t.diagnose.failed, {
        description: error instanceof Error ? error.message : t.import.tryShortly,
      })
      return false
    } finally {
      setLoading(false)
    }
  }, [diagnosisMode, t, text])

  return (
    <DiagnoseContext.Provider
      value={{ text, setText, diagnosisMode, setDiagnosisMode, loading, error, result, originalText, isDuplicate, handleAnalyze }}
    >
      {children}
    </DiagnoseContext.Provider>
  )
}

export function useDiagnose() {
  const ctx = useContext(DiagnoseContext)
  if (!ctx) {
    throw new Error("useDiagnose must be used within a DiagnoseProvider")
  }
  return ctx
}
