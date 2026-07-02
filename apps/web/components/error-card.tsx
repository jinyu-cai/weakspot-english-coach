"use client"

import { useState } from "react"
import { ArrowRight, BookOpen, ChevronDown, Target } from "lucide-react"
import { cn } from "@/lib/utils"
import type { EnglishError, Severity } from "@/lib/types"
import { Card, CardContent } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { useLanguage } from "@/components/language-provider"

const SEVERITY_STYLES: Record<Severity, { chip: string; label: string }> = {
  low: { chip: "border-success/30 bg-success/10 text-success", label: "Minor" },
  medium: { chip: "border-warning/40 bg-warning/15 text-warning", label: "Moderate" },
  high: { chip: "border-danger/30 bg-danger/10 text-danger", label: "Serious" },
}

export function ErrorCard({ error }: { error: EnglishError }) {
  const [open, setOpen] = useState(false)
  const { t } = useLanguage()
  const severity = SEVERITY_STYLES[error.severity] ?? {
    chip: "border-border bg-muted text-muted-foreground",
    label: "Unknown",
  }
  const severityLabel = t.diagnose.report.severity[error.severity] ?? t.diagnose.report.severity.unknown

  return (
    <Card className="overflow-hidden">
      <CardContent className="flex flex-col gap-4 pt-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-lg bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground">
            {error.category}
          </span>
          <span className={cn("rounded-lg border px-2 py-0.5 text-xs font-medium", severity.chip)}>
            {severityLabel}
          </span>
        </div>

        <div className="flex flex-col gap-2 rounded-xl bg-muted/50 p-3 text-sm sm:flex-row sm:items-center sm:gap-3">
          <span className="font-mono text-danger line-through decoration-danger/50">{error.originalText}</span>
          <ArrowRight className="hidden size-4 shrink-0 text-muted-foreground sm:block" />
          <span className="font-mono font-medium text-success">{error.correctedText}</span>
        </div>

        <p className="text-sm leading-relaxed text-foreground">{error.explanationZh}</p>

        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger
            className={cn(
              "flex w-full items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-muted",
            )}
          >
            <span className="flex items-center gap-2 text-foreground">
              <BookOpen className="size-4 text-primary" />
              {t.diagnose.report.microLesson}
            </span>
            <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
          </CollapsibleTrigger>
          <CollapsibleContent className="overflow-hidden data-ending-style:h-0 data-starting-style:h-0">
            <p className="mt-3 rounded-lg bg-accent/40 p-3 text-sm leading-relaxed text-foreground">
              {error.microLessonZh}
            </p>
          </CollapsibleContent>
        </Collapsible>

        <div className="flex items-center gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
          <Target className="size-3.5 text-primary" />
          <span>
            {t.diagnose.report.practiceGoal} <span className="text-foreground">{error.practiceGoal}</span>
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
