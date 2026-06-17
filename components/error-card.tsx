"use client"

import { useState } from "react"
import { ArrowRight, ChevronDown, Target } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import { SEVERITY_META } from "@/lib/severity"
import type { EnglishError } from "@/lib/types"

export function ErrorCard({ error }: { error: EnglishError }) {
  const [open, setOpen] = useState(false)
  const severity = SEVERITY_META[error.severity]

  return (
    <Card className="overflow-hidden">
      <CardContent className="flex flex-col gap-4 pt-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={cn("gap-1.5 rounded-full", severity.badgeClass)}>
            <span className={cn("size-1.5 rounded-full", severity.dotClass)} />
            {error.category}
          </Badge>
          <span className="text-xs text-muted-foreground">严重程度：{severity.labelZh}</span>
        </div>

        <div className="flex flex-col gap-2 rounded-xl bg-muted/50 p-3 text-sm sm:flex-row sm:items-center">
          <span className="font-mono text-destructive line-through decoration-destructive/50">
            {error.originalText}
          </span>
          <ArrowRight className="hidden size-4 shrink-0 text-muted-foreground sm:block" />
          <span className="font-mono font-medium text-success">{error.correctedText}</span>
        </div>

        <p className="text-sm leading-relaxed text-card-foreground">{error.explanationZh}</p>

        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger
            render={<Button variant="ghost" size="sm" className="h-8 w-fit gap-1.5 px-2 text-primary" />}
          >
            微课讲解
            <ChevronDown
              className={cn("transition-transform", open && "rotate-180")}
              data-icon="inline-end"
            />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <p className="mt-2 rounded-xl border border-border bg-accent/40 p-3 text-sm leading-relaxed text-accent-foreground">
              {error.microLessonZh}
            </p>
          </CollapsibleContent>
        </Collapsible>

        <div className="flex items-start gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
          <Target className="mt-0.5 size-3.5 shrink-0 text-primary" />
          <span>练习目标：{error.practiceGoal}</span>
        </div>
      </CardContent>
    </Card>
  )
}
