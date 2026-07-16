"use client"

import { useMemo, useState } from "react"
import { CheckCircle2, AlertTriangle, FileText, ListChecks, CircleAlert } from "lucide-react"
import { cn } from "@/lib/utils"
import type { DiagnosticResult } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CefrBadge } from "@/components/cefr-badge"
import { ScoreRing } from "@/components/score-ring"
import { ErrorCard } from "@/components/error-card"
import { DiffView } from "@/components/diff-view"
import { SessionWin } from "@/components/session-win"
import { sessionWinFromDiagnose } from "@/lib/session-win"
import { useLanguage } from "@/components/language-provider"

export function DiagnosticReport({
  result,
  originalText,
  showSessionWin = true,
}: {
  result: DiagnosticResult
  originalText: string
  /** Coach free-response feedback already renders its own SessionWin. */
  showSessionWin?: boolean
}) {
  const [showDiff, setShowDiff] = useState(true)
  const hasDiff = Boolean(originalText) && originalText !== result.correctedText
  const { language, t } = useLanguage()
  const win = useMemo(
    () => sessionWinFromDiagnose(result, t, language),
    [result, t, language],
  )

  return (
    <div className="flex flex-col gap-6">
      {showSessionWin ? <SessionWin model={win} /> : null}

      {/* Header */}
      <Card>
        <CardContent className="flex flex-col gap-6 pt-6 sm:flex-row sm:items-center">
          <ScoreRing score={result.overallScore} label={t.common.score} />
          <div className="flex flex-1 flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <CefrBadge level={result.cefrEstimate} size="lg" />
              <span className="text-sm text-muted-foreground">{t.diagnose.report.estimatedLevel}</span>
            </div>
            <p className="text-pretty text-sm leading-relaxed text-foreground">{result.summaryZh}</p>
          </div>
        </CardContent>
      </Card>

      {/* Strengths & weaknesses */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="size-5 text-success" />
              {t.diagnose.report.strengths}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {result.strengthsZh.map((item, i) => (
              <div key={i} className="flex items-start gap-2.5 text-sm leading-relaxed">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                <span>{item}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-5 text-warning" />
              {t.diagnose.report.weaknesses}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {result.weaknessesZh.map((item, i) => (
              <div key={i} className="flex items-start gap-2.5 text-sm leading-relaxed">
                <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
                <span>{item}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Corrected text */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="size-5 text-primary" />
            {t.diagnose.report.correctedText}
          </CardTitle>
          {hasDiff ? (
            <div className="flex rounded-lg border border-border bg-muted/40 p-0.5 text-xs font-medium">
              <button
                type="button"
                onClick={() => setShowDiff(true)}
                className={cn(
                  "rounded-md px-2.5 py-1 transition-colors",
                  showDiff ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t.diagnose.report.diff}
              </button>
              <button
                type="button"
                onClick={() => setShowDiff(false)}
                className={cn(
                  "rounded-md px-2.5 py-1 transition-colors",
                  !showDiff ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t.diagnose.report.polished}
              </button>
            </div>
          ) : null}
        </CardHeader>
        <CardContent>
          {hasDiff && showDiff ? (
            <DiffView original={originalText} corrected={result.correctedText} />
          ) : (
            <p className="rounded-xl bg-muted/50 p-4 text-sm leading-relaxed text-foreground">
              {result.correctedText}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Error cards */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold">{t.diagnose.report.errorBreakdown}</h2>
          <span className="text-sm text-muted-foreground">
            {result.errors.length} {t.diagnose.report.issuesFound}
          </span>
        </div>
        <div className="grid gap-4">
          {result.errors.map((error) => (
            <ErrorCard key={error.id} error={error} />
          ))}
        </div>
      </div>

      {/* Recommended next actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ListChecks className="size-5 text-primary" />
            {t.diagnose.report.recommendedNextActions}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {result.recommendedNextActionsZh.map((action, i) => (
            <div key={i} className="flex items-start gap-3 text-sm leading-relaxed">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">
                {i + 1}
              </span>
              <span className="pt-0.5">{action}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
