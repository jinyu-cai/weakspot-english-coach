"use client"

import { useState } from "react"
import {
  ArrowRight,
  BookOpen,
  Clock3,
  CheckCircle2,
  ChevronDown,
  Lightbulb,
  Sparkles,
  Target,
  TrendingUp,
  Wrench,
  X,
} from "lucide-react"
import type { SessionAnalysis, StealthPracticeResult } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/components/language-provider"

interface SessionSummaryProps {
  analysis: SessionAnalysis | null
  stealthPractice?: StealthPracticeResult | null
  analyzing: boolean
  onClose: () => void
}

export function SessionSummary({ analysis, stealthPractice, analyzing, onClose }: SessionSummaryProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>("corrections")
  const { language, t } = useLanguage()

  if (analyzing) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <Spinner className="size-8" />
        <div className="flex flex-col items-center gap-1 text-center">
          <p className="text-sm font-medium">{t.chat.summary.loading}</p>
          <p className="text-xs text-muted-foreground">
            {t.chat.summary.loadingSub}
          </p>
        </div>
      </div>
    )
  }

  if (!analysis) return null

  const sections = [
    {
      id: "corrections",
      label: t.chat.summary.corrections,
      icon: Wrench,
      count: analysis.corrections.length,
      color: "text-orange-500",
    },
    {
      id: "expressions",
      label: t.chat.summary.expressions,
      icon: Sparkles,
      count: analysis.naturalExpressions.length,
      color: "text-primary",
    },
    {
      id: "weaknesses",
      label: t.chat.summary.weaknesses,
      icon: Target,
      count: analysis.weaknesses.length,
      color: "text-destructive",
    },
  ]

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="size-5 text-success" />
          <span className="text-sm font-medium">{t.chat.summary.title}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          aria-label={t.chat.summary.close}
          title={t.chat.summary.close}
        >
          <X className="size-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Summary */}
        <div className="border-b border-border bg-muted/20 px-4 py-3">
          <p className="text-sm leading-relaxed">{analysis.summaryZh}</p>
          {analysis.strengthsZh.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {analysis.strengthsZh.map((s, i) => (
                <Badge key={i} variant="secondary" className="gap-1 text-[10px]">
                  <TrendingUp className="size-3" />
                  {s}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {stealthPractice && (
          <div className="border-b border-border bg-primary/5 px-4 py-4">
            <div className="rounded-xl border border-primary/20 bg-background p-3.5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="flex items-center gap-1.5 text-sm font-medium">
                    <Target className="size-4 text-primary" />
                    {t.chat.summary.stealthTitle}
                  </p>
                  <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted-foreground">
                    {t.chat.summary.stealthDescription}
                  </p>
                </div>
                <Badge
                  variant={stealthPractice.outcome === "failure" ? "destructive" : "secondary"}
                  className="shrink-0"
                >
                  {t.chat.summary.stealthOutcomes[stealthPractice.outcome]}
                </Badge>
              </div>
              <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">
                    {t.labels.skills[stealthPractice.targetSkillCode as keyof typeof t.labels.skills]
                      ?? stealthPractice.targetSkillCode}
                  </Badge>
                </div>
                {stealthPractice.evidenceQuote && (
                  <p className="leading-relaxed text-muted-foreground">
                    <span className="font-medium text-foreground">{t.chat.summary.stealthEvidence}: </span>
                    {stealthPractice.evidenceQuote}
                  </p>
                )}
                {stealthPractice.nextReviewAt && (
                  <p className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock3 className="size-3.5 text-primary" />
                    <span className="font-medium text-foreground">{t.chat.summary.stealthNext}:</span>
                    {new Date(stealthPractice.nextReviewAt).toLocaleDateString(
                      language === "zh-CN" ? "zh-CN" : "en-US",
                      { year: "numeric", month: "short", day: "numeric" },
                    )}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Section tabs */}
        <div className="flex border-b border-border">
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => setExpandedSection(expandedSection === s.id ? null : s.id)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 px-2 py-2.5 text-xs transition-colors",
                expandedSection === s.id
                  ? "border-b-2 border-primary font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <s.icon className={cn("size-3.5", expandedSection === s.id && s.color)} />
              {s.label}
              {s.count > 0 && (
                <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                  {s.count}
                </Badge>
              )}
            </button>
          ))}
        </div>

        {/* Corrections */}
        {expandedSection === "corrections" && (
          <div className="flex flex-col gap-3 p-4">
            {analysis.corrections.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground">{t.chat.summary.noErrors}</p>
            ) : (
              analysis.corrections.map((c, i) => (
                <div key={i} className="rounded-xl border border-border bg-background p-3">
                  <div className="flex items-start gap-2">
                    <Wrench className="mt-0.5 size-4 shrink-0 text-orange-500" />
                    <div className="flex flex-col gap-1">
                      <div className="text-sm">
                        <span className="text-destructive/70 line-through">{c.original}</span>
                        <span className="mx-1.5 text-muted-foreground">&rarr;</span>
                        <span className="font-medium text-success">{c.corrected}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{c.explanationZh}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Natural Expressions */}
        {expandedSection === "expressions" && (
          <div className="flex flex-col gap-3 p-4">
            {analysis.naturalExpressions.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground">{t.chat.summary.natural}</p>
            ) : (
              analysis.naturalExpressions.map((e, i) => (
                <div key={i} className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                  <div className="flex items-start gap-2">
                    <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
                    <div className="flex flex-col gap-1.5">
                      <div className="text-sm">
                        <span className="text-muted-foreground">{e.original}</span>
                        <span className="mx-1.5 text-muted-foreground">&rarr;</span>
                        <span className="font-medium">{e.natural}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{e.explanationZh}</span>
                      {e.context && (
                        <span className="text-xs italic text-muted-foreground/70">{e.context}</span>
                      )}
                      {e.examples.length > 0 && (
                        <div className="mt-1 flex flex-col gap-0.5 border-t border-border pt-1.5">
                          {e.examples.map((ex, j) => (
                            <div key={j} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                              <BookOpen className="mt-0.5 size-3 shrink-0" />
                              <span>{ex}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <Badge variant="secondary" className="mt-1 w-fit gap-1 text-[10px]">
                        <CheckCircle2 className="size-3" />
                        {t.chat.summary.saved}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Weaknesses */}
        {expandedSection === "weaknesses" && (
          <div className="flex flex-col gap-3 p-4">
            {analysis.weaknesses.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground">{t.chat.summary.noPatterns}</p>
            ) : (
              analysis.weaknesses.map((w, i) => (
                <div key={i} className="rounded-xl border border-border bg-background p-3">
                  <div className="flex items-start gap-2">
                    <Target className="mt-0.5 size-4 shrink-0 text-destructive" />
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{w.category}</span>
                        <Badge
                          variant={w.severity === "high" ? "destructive" : "secondary"}
                          className="h-4 px-1 text-[10px]"
                        >
                          {w.severity}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        &ldquo;{w.evidenceQuote}&rdquo;
                      </div>
                      <span className="text-xs text-muted-foreground">{w.explanationZh}</span>
                      <div className="mt-1 flex items-center gap-1 text-xs text-primary">
                        <Lightbulb className="size-3" />
                        {w.practiceGoal}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Next Actions */}
        {analysis.recommendedNextActionsZh.length > 0 && (
          <div className="border-t border-border bg-muted/20 px-4 py-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">{t.chat.summary.nextSteps}</p>
            <div className="flex flex-col gap-1.5">
              {analysis.recommendedNextActionsZh.map((a, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <ArrowRight className="size-3.5 text-primary" />
                  {a}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
