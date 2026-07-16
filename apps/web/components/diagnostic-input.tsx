"use client"

import { Microscope, Sparkles, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Spinner } from "@/components/ui/spinner"
import type { DiagnosisMode } from "@/lib/types"
import { countWords } from "@/lib/text-count"
import { useLanguage } from "@/components/language-provider"
import { cn } from "@/lib/utils"

const MIN_DIAGNOSE_WORDS = 5
const EXAMPLE_TEXTS = [
  "Hi Sarah, I want to ask if we can move tomorrow meeting to Friday because I need more time finish the report.",
  "Yesterday I go to a new cafe with my friend and we talked about what we want to do in summer.",
  "Many people thinks online learning is more convenient, but it also make students feel isolated. This essay will discuss both sides.",
] as const

export function DiagnosticInput({
  value,
  onChange,
  onAnalyze,
  loading,
  diagnosisMode,
  onDiagnosisModeChange,
}: {
  value: string
  onChange: (value: string) => void
  onAnalyze: () => void
  loading: boolean
  diagnosisMode: DiagnosisMode
  onDiagnosisModeChange: (mode: DiagnosisMode) => void
}) {
  const { t } = useLanguage()
  const wordCount = countWords(value)
  const ready = wordCount >= MIN_DIAGNOSE_WORDS

  return (
    <div className="study-editor overflow-hidden rounded-2xl">
      {/* Document-like writing area — larger, calmer, primary focus */}
      <div className="border-b border-border/70 px-4 py-2.5 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground">{t.diagnose.inputLabel}</span>
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {wordCount} {wordCount === 1 ? t.diagnose.word : t.diagnose.words}
            {!ready ? ` · ${t.diagnose.onboarding.minimumHint}` : ""}
          </span>
        </div>
      </div>

      <label htmlFor="diagnose-input" className="sr-only">
        {t.diagnose.inputLabel}
      </label>
      <Textarea
        id="diagnose-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t.diagnose.placeholder}
        rows={12}
        disabled={loading}
        className="min-h-[18rem] resize-y rounded-none border-0 bg-transparent px-4 py-5 text-[1.05rem] leading-8 shadow-none focus-visible:ring-0 sm:px-6 sm:text-base sm:leading-8"
      />

      <div className="flex flex-col gap-3 border-t border-border/70 bg-muted/25 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex flex-wrap gap-1.5">
          {t.diagnose.onboarding.exampleLabels.map((label, index) => (
            <button
              key={label}
              type="button"
              disabled={loading}
              onClick={() => onChange(EXAMPLE_TEXTS[index] ?? EXAMPLE_TEXTS[0])}
              className="rounded-md border border-border/80 bg-card px-2.5 py-1 text-[11px] text-muted-foreground transition hover:border-primary/30 hover:text-foreground disabled:opacity-50"
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            role="radiogroup"
            aria-label={t.diagnose.modeLabel}
            className="inline-flex rounded-lg border border-border bg-card p-0.5"
          >
            <button
              type="button"
              role="radio"
              aria-checked={diagnosisMode === "fast"}
              disabled={loading}
              onClick={() => onDiagnosisModeChange("fast")}
              className={cn(
                "inline-flex h-8 items-center gap-1 rounded-md px-2.5 text-xs font-medium transition",
                diagnosisMode === "fast"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Zap className="size-3.5" />
              {t.diagnose.quick}
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={diagnosisMode === "deep"}
              disabled={loading}
              onClick={() => onDiagnosisModeChange("deep")}
              className={cn(
                "inline-flex h-8 items-center gap-1 rounded-md px-2.5 text-xs font-medium transition",
                diagnosisMode === "deep"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Microscope className="size-3.5" />
              {t.diagnose.deep}
            </button>
          </div>

          <Button onClick={onAnalyze} disabled={loading || !ready} className="h-9 px-4">
            {loading ? <Spinner /> : <Sparkles data-icon="inline-start" />}
            {loading ? t.diagnose.analyzing : t.diagnose.analyze}
          </Button>
        </div>
      </div>
    </div>
  )
}
