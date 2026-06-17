"use client"

import { ArrowRight, MessageSquare, PenLine, Dumbbell } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { CefrBadge } from "@/components/cefr-badge"
import { cn } from "@/lib/utils"
import { SEVERITY_META } from "@/lib/severity"
import type { EnglishError, Submission } from "@/lib/types"

function formatTime(iso: string) {
  const date = new Date(iso)
  const diff = Date.now() - date.getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))
  if (hours < 1) return "刚刚"
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  return `${days} 天前`
}

const MODE_META: Record<Submission["mode"], { icon: typeof PenLine; label: string }> = {
  writing: { icon: PenLine, label: "Writing" },
  chat: { icon: MessageSquare, label: "Chat" },
  practice: { icon: Dumbbell, label: "Practice" },
}

export function SubmissionList({ submissions }: { submissions: Submission[] }) {
  return (
    <div className="flex flex-col gap-3">
      {submissions.map((sub) => {
        const mode = MODE_META[sub.mode]
        const Icon = mode.icon
        return (
          <Card key={sub.id}>
            <CardContent className="flex flex-col gap-3 pt-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="gap-1.5 rounded-full">
                    <Icon className="size-3.5" />
                    {mode.label}
                  </Badge>
                  {sub.cefrEstimate && (
                    <CefrBadge level={sub.cefrEstimate} size="sm" showLabel={false} />
                  )}
                </div>
                <span className="text-xs text-muted-foreground">{formatTime(sub.createdAt)}</span>
              </div>

              <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-start">
                <p className="flex-1 rounded-lg bg-muted/40 p-2.5 text-muted-foreground">
                  {sub.originalText}
                </p>
                {sub.correctedText && (
                  <>
                    <ArrowRight className="hidden size-4 shrink-0 self-center text-muted-foreground sm:block" />
                    <p className="flex-1 rounded-lg bg-success/10 p-2.5 text-card-foreground">
                      {sub.correctedText}
                    </p>
                  </>
                )}
              </div>

              {sub.summaryZh && (
                <p className="text-xs leading-relaxed text-muted-foreground">{sub.summaryZh}</p>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

export function ErrorList({ errors }: { errors: EnglishError[] }) {
  return (
    <div className="flex flex-col gap-3">
      {errors.map((err) => {
        const sev = SEVERITY_META[err.severity]
        return (
          <Card key={err.id}>
            <CardContent className="flex flex-col gap-2 pt-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge variant="outline" className={cn("gap-1.5 rounded-full", sev.badgeClass)}>
                  <span className={cn("size-1.5 rounded-full", sev.dotClass)} />
                  {err.category}
                </Badge>
                <span className="text-xs text-muted-foreground">{formatTime(err.createdAt)}</span>
              </div>
              <div className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:gap-3">
                <span className="font-mono text-destructive line-through decoration-destructive/50">
                  {err.originalText}
                </span>
                <ArrowRight className="hidden size-4 shrink-0 text-muted-foreground sm:block" />
                <span className="font-mono font-medium text-success">{err.correctedText}</span>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">{err.explanationZh}</p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
