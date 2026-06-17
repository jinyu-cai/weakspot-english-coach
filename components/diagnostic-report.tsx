import { CheckCircle2, AlertTriangle, FileText, ListChecks, Sparkles } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CefrBadge } from "@/components/cefr-badge"
import { ScoreRing } from "@/components/score-ring"
import { ErrorCard } from "@/components/error-card"
import type { DiagnosticResult } from "@/lib/types"

export function DiagnosticReport({ result }: { result: DiagnosticResult }) {
  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <Card>
        <CardContent className="flex flex-col gap-6 pt-6 sm:flex-row sm:items-center">
          <div className="flex items-center gap-5">
            <CefrBadge level={result.cefrEstimate} size="lg" />
            <ScoreRing score={result.overallScore} />
          </div>
          <div className="flex flex-1 flex-col gap-2 border-t border-border pt-4 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
            <div className="flex items-center gap-2 text-sm font-medium text-primary">
              <Sparkles className="size-4" />
              诊断总结
            </div>
            <p className="text-lg leading-relaxed text-pretty">{result.summaryZh}</p>
          </div>
        </CardContent>
      </Card>

      {/* Strengths + Weaknesses */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="size-5 text-success" />
              优势 Strengths
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-3">
              {result.strengthsZh.map((s, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm leading-relaxed">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-5 text-warning" />
              待改进 Weaknesses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-3">
              {result.weaknessesZh.map((w, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm leading-relaxed">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Corrected text */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="size-5 text-primary" />
            修改后的版本 Corrected text
          </CardTitle>
          <CardDescription>对照你的原文，体会修改前后的差异。</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="rounded-xl bg-muted/50 p-4 text-sm leading-relaxed text-card-foreground">
            {result.correctedText}
          </p>
        </CardContent>
      </Card>

      {/* Error cards */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">逐条错误分析 Error breakdown</h2>
          <span className="text-sm text-muted-foreground">{result.errors.length} 处</span>
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
            建议的下一步 Recommended next actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-2.5">
            {result.recommendedNextActionsZh.map((action, i) => (
              <li key={i} className="flex items-start gap-3 text-sm leading-relaxed">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {i + 1}
                </span>
                <span>{action}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
