"use client"

import { Lightbulb, Microscope, ShieldCheck, Sparkles, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Spinner } from "@/components/ui/spinner"
import type { DiagnosisMode } from "@/lib/types"
import { useLanguage } from "@/components/language-provider"

const MIN_DIAGNOSE_CHARACTERS = 20
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
  const characterCount = value.trim().length

  return (
    <Card className="border border-primary/20 shadow-sm ring-primary/10">
      <CardContent className="flex flex-col gap-5 pt-6 sm:pt-7">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
            <Lightbulb className="size-4.5" />
          </span>
          <div className="min-w-0">
            <h2 className="font-heading text-lg font-semibold">{t.diagnose.onboarding.promptTitle}</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {t.diagnose.onboarding.promptHint}
            </p>
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
          rows={7}
          disabled={loading}
          className="min-h-48 resize-y border-border/80 bg-background text-base leading-relaxed shadow-none focus-visible:border-primary/45"
        />

        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground">{t.diagnose.onboarding.examplesLabel}</span>
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
        </div>
      </CardContent>

      <CardFooter className="flex flex-col items-stretch gap-4 border-t border-border/70 bg-muted/25 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-2 text-xs text-muted-foreground">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="tabular-nums">
              {characterCount} {t.diagnose.characters}
            </span>
            {characterCount < MIN_DIAGNOSE_CHARACTERS ? (
              <span className="text-warning-foreground">{t.diagnose.onboarding.minimumHint}</span>
            ) : null}
          </div>
          <span className="flex items-start gap-1.5 leading-relaxed">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-success" />
            {t.diagnose.onboarding.privacyNote}
          </span>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
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
            disabled={loading || characterCount < MIN_DIAGNOSE_CHARACTERS}
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
