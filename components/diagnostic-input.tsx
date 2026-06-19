"use client"

import { Microscope, Sparkles, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Spinner } from "@/components/ui/spinner"
import type { DiagnosisMode } from "@/lib/types"

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
  return (
    <Card>
      <CardContent className="pt-6">
        <label htmlFor="diagnose-input" className="sr-only">
          Your English writing
        </label>
        <Textarea
          id="diagnose-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Write or paste a paragraph in English. The coach will diagnose your specific weaknesses..."
          rows={7}
          disabled={loading}
          className="resize-none text-base leading-relaxed"
        />
      </CardContent>
      <CardFooter className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-xs text-muted-foreground">{value.trim().length} characters</span>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <div
            role="radiogroup"
            aria-label="Diagnosis mode"
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
              快速
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
              深度
            </button>
          </div>
          <Button onClick={onAnalyze} disabled={loading || value.trim().length < MIN_DIAGNOSE_CHARACTERS} size="lg">
            {loading ? <Spinner /> : <Sparkles data-icon="inline-start" />}
            {loading ? "Analyzing..." : "Analyze My English"}
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}
