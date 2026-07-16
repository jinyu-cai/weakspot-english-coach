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
    <div className="flex flex-col gap-4">
      <label htmlFor="diagnose-input" className="sr-only">
        {t.diagnose.inputLabel}
      </label>
      <Textarea
        id="diagnose-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t.diagnose.placeholder}
        rows={8}
        disabled={loading}
        className="min-h-44 resize-y rounded-xl border-border bg-card text-base leading-relaxed shadow-none focus-visible:border-primary/40"
      />

      <div className="flex flex-wrap gap-2">
        {t.diagnose.onboarding.exampleLabels.map((label, index) => (
          <button
            key={label}
            type="button"
            disabled={loading}
            onClick={() => onChange(EXAMPLE_TEXTS[index] ?? EXAMPLE_TEXTS[0])}
            className="rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground transition hover:border-foreground/20 hover:text-foreground disabled:opacity-50"
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="tabular-nums">
            {wordCount} {wordCount === 1 ? t.diagnose.word : t.diagnose.words}
          </span>
          {!ready ? <span>{t.diagnose.onboarding.minimumHint}</span> : null}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div
            role="radiogroup"
            aria-label={t.diagnose.modeLabel}
            className="inline-flex rounded-lg border border-border p-0.5"
          >
            <button
              type="button"
              role="radio"
              aria-checked={diagnosisMode === "fast"}
              disabled={loading}
              onClick={() => onDiagnosisModeChange("fast")}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition",
                diagnosisMode === "fast"
                  ? "bg-foreground text-background"
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
                "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition",
                diagnosisMode === "deep"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Microscope className="size-3.5" />
              {t.diagnose.deep}
            </button>
          </div>

          <Button
            onClick={onAnalyze}
            disabled={loading || !ready}
            className="h-9 px-4"
          >
            {loading ? <Spinner /> : <Sparkles data-icon="inline-start" />}
            {loading ? t.diagnose.analyzing : t.diagnose.analyze}
          </Button>
        </div>
      </div>
    </div>
  )
}
