"use client"

import { useState } from "react"
import { ArrowRight, ChevronDown, Dumbbell, FileText, Lightbulb, MessageSquare, PenLine, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { EnglishError, LearningNote, Submission } from "@/lib/types"
import { CefrBadge } from "@/components/cefr-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ErrorCard } from "@/components/error-card"
import { NoteCard } from "@/components/note-card"

const MODE_META: Record<Submission["mode"], { label: string; icon: typeof PenLine }> = {
  writing: { label: "Writing", icon: PenLine },
  chat: { label: "Chat", icon: MessageSquare },
  practice: { label: "Practice", icon: Dumbbell },
}

function formatDate(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "Unknown date"
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
}

export function SubmissionCard({
  submission,
  errors,
  notes,
  onDelete,
}: {
  submission: Submission
  errors?: EnglishError[]
  notes?: LearningNote[]
  onDelete?: (submission: Submission) => void | Promise<void>
}) {
  const mode = MODE_META[submission.mode] ?? { label: "Entry", icon: FileText }
  const ModeIcon = mode.icon
  const changed = submission.correctedText && submission.correctedText !== submission.originalText
  const [deleting, setDeleting] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const errorCount = errors?.length ?? 0
  const noteCount = notes?.length ?? 0
  const hasDetails = errorCount > 0 || noteCount > 0

  async function handleDelete() {
    if (!onDelete) return
    setDeleting(true)
    try {
      await onDelete(submission)
    } finally {
      setDeleting(false)
    }
  }

  const detailParts: string[] = []
  if (errorCount > 0) detailParts.push(`${errorCount} correction${errorCount === 1 ? "" : "s"}`)
  if (noteCount > 0) detailParts.push(`${noteCount} note${noteCount === 1 ? "" : "s"}`)

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2 rounded-lg bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground">
            <ModeIcon className="size-3.5" />
            {mode.label}
          </span>
          <div className="flex items-center gap-2">
            {submission.cefrEstimate ? <CefrBadge level={submission.cefrEstimate} size="sm" showLabel={false} /> : null}
            <span className="text-xs text-muted-foreground">{formatDate(submission.createdAt)}</span>
            {onDelete ? (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground hover:text-danger"
                      aria-label="Delete submission"
                      disabled={deleting}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  }
                />
                <DropdownMenuContent align="end" className="max-w-64">
                  <DropdownMenuLabel>Delete this entry?</DropdownMenuLabel>
                  <p className="px-1.5 pb-1 text-xs leading-snug text-muted-foreground">
                    Removes it from history and rolls back its effect on your weakness profile.
                  </p>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={handleDelete}>
                    <Trash2 />
                    Delete permanently
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
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

        {hasDetails ? (
          <Collapsible open={expanded} onOpenChange={setExpanded}>
            <CollapsibleTrigger
              className={cn(
                "flex w-full items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-muted",
              )}
            >
              <span className="flex items-center gap-2 text-foreground">
                <Lightbulb className="size-4 text-primary" />
                {detailParts.join(" · ")}
              </span>
              <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", expanded && "rotate-180")} />
            </CollapsibleTrigger>
            <CollapsibleContent className="overflow-hidden data-ending-style:h-0 data-starting-style:h-0">
              <div className="mt-3 flex flex-col gap-3">
                {errorCount > 0 && (
                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-medium text-muted-foreground">Corrections</span>
                    {errors!.map((e) => (
                      <ErrorCard key={e.id} error={e} />
                    ))}
                  </div>
                )}
                {noteCount > 0 && (
                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-medium text-muted-foreground">Notes</span>
                    {notes!.map((n) => (
                      <NoteCard key={n.id} note={n} />
                    ))}
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        ) : null}
      </CardContent>
    </Card>
  )
}
