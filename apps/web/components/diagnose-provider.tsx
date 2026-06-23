"use client"

import { createContext, useCallback, useContext, useState, type ReactNode } from "react"
import { toast } from "sonner"
import { diagnose } from "@/lib/api-client"
import { DEMO_USER_ID } from "@/lib/mock-data"
import type { DiagnosisMode, DiagnosticResult } from "@/lib/types"

interface DiagnoseContextValue {
  text: string
  setText: (value: string) => void
  diagnosisMode: DiagnosisMode
  setDiagnosisMode: (mode: DiagnosisMode) => void
  loading: boolean
  result: DiagnosticResult | null
  isDuplicate: boolean
  handleAnalyze: () => Promise<void>
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
  const [text, setText] = useState("")
  const [diagnosisMode, setDiagnosisMode] = useState<DiagnosisMode>("fast")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<DiagnosticResult | null>(null)
  const [isDuplicate, setIsDuplicate] = useState(false)

  const handleAnalyze = useCallback(async () => {
    setLoading(true)
    setResult(null)
    setIsDuplicate(false)
    try {
      const res = await diagnose(DEMO_USER_ID, text, diagnosisMode)
      setResult(res.diagnostic)
      const duplicate = Boolean(res.duplicate)
      setIsDuplicate(duplicate)
      if (duplicate) {
        toast.info("Already diagnosed", {
          description:
            "This exact text was analyzed before — showing your previous result. It wasn't counted again, so your weakness profile stays accurate.",
        })
      } else {
        toast.success("Diagnosis complete", {
          description:
            diagnosisMode === "fast"
              ? "Your quick English weakness report is ready."
              : "Your deep English weakness report is ready.",
        })
      }
    } catch (error) {
      toast.error("Analysis failed", {
        description: error instanceof Error ? error.message : "Please try again shortly.",
      })
    } finally {
      setLoading(false)
    }
  }, [text, diagnosisMode])

  return (
    <DiagnoseContext.Provider
      value={{ text, setText, diagnosisMode, setDiagnosisMode, loading, result, isDuplicate, handleAnalyze }}
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
