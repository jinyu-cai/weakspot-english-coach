"use client"

import { Info } from "lucide-react"
import { useDiagnose } from "@/components/diagnose-provider"
import { DiagnosticInput } from "@/components/diagnostic-input"
import { DiagnosticReport } from "@/components/diagnostic-report"
import { DiagnosticLoading } from "@/components/loading-state"

export default function DiagnosePage() {
  const { text, setText, diagnosisMode, setDiagnosisMode, loading, result, isDuplicate, handleAnalyze } = useDiagnose()

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
      <header className="flex flex-col gap-3">
        <span className="w-fit rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          ✨ Adaptive diagnosis
        </span>
        <h1 className="text-balance font-heading text-3xl font-bold tracking-tight sm:text-4xl">
          Discover what you need to practice
        </h1>
        <p className="max-w-2xl text-pretty leading-relaxed text-muted-foreground">
          {
            "Instead of asking what you want to practice, WeakSpot diagnoses your real English writing — verb tense, agreement, vocabulary, clarity and more — then builds an evolving weakness profile."
          }
        </p>
      </header>

      <DiagnosticInput
        value={text}
        onChange={setText}
        onAnalyze={handleAnalyze}
        loading={loading}
        diagnosisMode={diagnosisMode}
        onDiagnosisModeChange={setDiagnosisMode}
      />

      {loading && <DiagnosticLoading />}
      {!loading && result && (
        <div className="flex flex-col gap-4">
          {isDuplicate ? (
            <div className="flex items-start gap-2.5 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
              <Info className="mt-0.5 size-4 shrink-0 text-warning" />
              <p className="leading-relaxed text-foreground">
                This is identical to a previous submission, so it wasn&apos;t recorded again — your weakness
                profile stays accurate. Edit the text to analyze something new.
              </p>
            </div>
          ) : null}
          <DiagnosticReport result={result} />
        </div>
      )}
    </div>
  )
}
