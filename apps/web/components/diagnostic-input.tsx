"use client"

import { Microscope, Sparkles, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Spinner } from "@/components/ui/spinner"
import type { DiagnosisMode } from "@/lib/types"
import { useLanguage } from "@/components/language-provider"

const MIN_DIAGNOSE_CHARACTERS = 20

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

  return (
    <Card>
      <CardContent className="pt-6">
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
          className="resize-none text-base leading-relaxed"
        />
      </CardContent>
      <CardFooter className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-xs text-muted-foreground">
          {value.trim().length} {t.diagnose.characters}
        </span>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <div
            role="radiogroup"
            aria-label={t.diagnose.modeLabel}
            className="grid grid-cols-2 overflow-hidden rounded-lg border border-input bg-background p-1"
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
          <Button onClick={onAnalyze} disabled={loading || value.trim().length < MIN_DIAGNOSE_CHARACTERS} size="lg">
            {loading ? <Spinner /> : <Sparkles data-icon="inline-start" />}
            {loading ? t.diagnose.analyzing : t.diagnose.analyze}
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}
