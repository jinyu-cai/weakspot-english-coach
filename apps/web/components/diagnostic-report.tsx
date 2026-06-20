import { CheckCircle2, AlertTriangle, FileText, ListChecks, CircleAlert } from "lucide-react"
import type { DiagnosticResult } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CefrBadge } from "@/components/cefr-badge"
import { ScoreRing } from "@/components/score-ring"
import { ErrorCard } from "@/components/error-card"

export function DiagnosticReport({ result }: { result: DiagnosticResult }) {
  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <Card>
        <CardContent className="flex flex-col gap-6 pt-6 sm:flex-row sm:items-center">
          <ScoreRing score={result.overallScore} />
          <div className="flex flex-1 flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <CefrBadge level={result.cefrEstimate} size="lg" />
              <span className="text-sm text-muted-foreground">Estimated level</span>
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
              Strengths
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
              Weaknesses
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
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="size-5 text-primary" />
            Corrected text
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="rounded-xl bg-muted/50 p-4 text-sm leading-relaxed text-foreground">
            {result.correctedText}
          </p>
        </CardContent>
      </Card>

      {/* Error cards */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold">Error breakdown</h2>
          <span className="text-sm text-muted-foreground">{result.errors.length} issues found</span>
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
            Recommended next actions
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
