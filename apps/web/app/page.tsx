"use client"

import Link from "next/link"
import { Info } from "lucide-react"
import { useDiagnose } from "@/components/diagnose-provider"
import { DiagnosticInput } from "@/components/diagnostic-input"
import { DiagnosticReport } from "@/components/diagnostic-report"
import { DiagnosticLoading } from "@/components/loading-state"
import { useLanguage } from "@/components/language-provider"

export default function DiagnosePage() {
  const { text, setText, diagnosisMode, setDiagnosisMode, loading, result, originalText, isDuplicate, handleAnalyze } =
    useDiagnose()
  const { t } = useLanguage()
  const showLinks = !loading && !result

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-10">
      {!result ? (
        <header className="space-y-2">
          <h1 className="text-2xl font-medium tracking-tight text-foreground">
            {t.diagnose.minimal.title}
          </h1>
          <p className="text-sm text-muted-foreground">{t.diagnose.minimal.subtitle}</p>
        </header>
      ) : null}

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
            <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2.5 text-sm">
              <Info className="mt-0.5 size-4 shrink-0 text-warning" />
              <p className="text-foreground">{t.diagnose.duplicate}</p>
            </div>
          ) : null}
          <DiagnosticReport result={result} originalText={originalText} />
        </div>
      )}

      {showLinks ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/70 pt-6 text-sm">
          <span className="text-muted-foreground">{t.diagnose.minimal.or}</span>
          <Link href="/coach" className="text-foreground underline-offset-4 hover:underline">
            {t.diagnose.minimal.mission}
          </Link>
          <Link href="/chat" className="text-foreground underline-offset-4 hover:underline">
            {t.diagnose.minimal.chat}
          </Link>
          <Link href="/practice" className="text-foreground underline-offset-4 hover:underline">
            {t.diagnose.minimal.practice}
          </Link>
        </div>
      ) : null}
    </div>
  )
}
