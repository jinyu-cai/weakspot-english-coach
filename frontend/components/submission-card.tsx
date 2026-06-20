"use client"

import { ArrowRight, MessageSquare, PenLine, Dumbbell } from "lucide-react"
import type { Submission } from "@/lib/types"
import { CefrBadge } from "@/components/cefr-badge"
import { Card, CardContent } from "@/components/ui/card"

const MODE_META: Record<Submission["mode"], { label: string; icon: typeof PenLine }> = {
  writing: { label: "Writing", icon: PenLine },
  chat: { label: "Chat", icon: MessageSquare },
  practice: { label: "Practice", icon: Dumbbell },
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
}

export function SubmissionCard({ submission }: { submission: Submission }) {
  const mode = MODE_META[submission.mode]
  const ModeIcon = mode.icon
  const changed = submission.correctedText && submission.correctedText !== submission.originalText

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2 rounded-lg bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground">
            <ModeIcon className="size-3.5" />
            {mode.label}
          </span>
          <div className="flex items-center gap-3">
            {submission.cefrEstimate ? <CefrBadge level={submission.cefrEstimate} size="sm" showLabel={false} /> : null}
            <span className="text-xs text-muted-foreground">{formatDate(submission.createdAt)}</span>
          </div>
        </div>

        <div className="flex flex-col gap-2 rounded-xl bg-muted/50 p-3 text-sm leading-relaxed">
          <p className={changed ? "text-danger" : "text-foreground"}>{submission.originalText}</p>
          {changed ? (
            <>
              <ArrowRight className="size-4 text-muted-foreground" />
              <p className="text-success">{submission.correctedText}</p>
            </>
          ) : null}
        </div>

        {submission.summaryZh ? (
          <p className="text-sm leading-relaxed text-muted-foreground">{submission.summaryZh}</p>
        ) : null}
      </CardContent>
    </Card>
  )
}
