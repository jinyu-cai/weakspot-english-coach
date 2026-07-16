"use client"

import { Microscope, Sparkles, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Spinner } from "@/components/ui/spinner"
import type { DiagnosisMode } from "@/lib/types"
import { countWords } from "@/lib/text-count"
import { useLanguage } from "@/components/language-provider"

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

  return (
    <Card className="border border-primary/20 shadow-sm ring-primary/10">
      <CardContent className="flex flex-col gap-4 pt-6">
        <div className="min-w-0">
          <h2 className="font-heading text-lg font-semibold">{t.diagnose.onboarding.promptTitle}</h2>
        </div>

        <label htmlFor="diagnose-input" className="sr-only">
          {t.diagnose.inputLabel}
        </label>
        <Textarea
          id="diagnose-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t.diagnose.placeholder}
          rows={7}
          disabled={loading}
          className="min-h-44 resize-y border-border/80 bg-background text-base leading-relaxed shadow-none focus-visible:border-primary/45"
        />

        <div className="flex flex-wrap gap-2">
          {t.diagnose.onboarding.exampleLabels.map((label, index) => (
            <button
              key={label}
              type="button"
              disabled={loading}
              onClick={() => onChange(EXAMPLE_TEXTS[index] ?? EXAMPLE_TEXTS[0])}
              className="rounded-full border border-border bg-secondary/65 px-3 py-1.5 text-xs font-medium text-secondary-foreground transition hover:border-primary/35 hover:bg-primary/10 disabled:pointer-events-none disabled:opacity-50"
            >
              {label}
            </button>
          ))}
        </div>
      </CardContent>

      <CardFooter className="flex flex-col items-stretch gap-3 border-t border-border/70 bg-muted/25 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-xs tabular-nums text-muted-foreground">
          {wordCount} {wordCount === 1 ? t.diagnose.word : t.diagnose.words}
          {wordCount < MIN_DIAGNOSE_WORDS ? ` · ${t.diagnose.onboarding.minimumHint}` : ""}
        </span>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <div
            role="radiogroup"
            aria-label={t.diagnose.modeLabel}
            className="grid w-full grid-cols-2 overflow-hidden rounded-lg border border-input bg-background p-1 sm:w-auto"
          >
            <button
              type="button"
              role="radio"
              aria-checked={diagnosisMode === "fast"}
              disabled={loading}
              onClick={() => onDiagnosisModeChange("fast")}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition data-[active=true]:bg-primary data-[active=true]:text-primary-foreground disabled:pointer-events-none disabled:opacity-50"
              data-active={diagnosisMode === "fast"}
            >
              <Zap className="size-4" />
              {t.diagnose.quick}
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={diagnosisMode === "deep"}
              disabled={loading}
              onClick={() => onDiagnosisModeChange("deep")}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition data-[active=true]:bg-primary data-[active=true]:text-primary-foreground disabled:pointer-events-none disabled:opacity-50"
              data-active={diagnosisMode === "deep"}
            >
              <Microscope className="size-4" />
              {t.diagnose.deep}
            </button>
          </div>
          <Button
            onClick={onAnalyze}
            disabled={loading || wordCount < MIN_DIAGNOSE_WORDS}
            size="lg"
            className="h-11 w-full px-5 text-sm shadow-sm sm:w-auto"
          >
            {loading ? <Spinner /> : <Sparkles data-icon="inline-start" />}
            {loading ? t.diagnose.analyzing : t.diagnose.analyze}
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}
