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
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { ErrorCard } from "@/components/error-card"
import { NoteCard } from "@/components/note-card"
import { useLanguage } from "@/components/language-provider"

const MODE_META: Record<Submission["mode"], { label: string; icon: typeof PenLine }> = {
  writing: { label: "Writing", icon: PenLine },
  chat: { label: "Chat", icon: MessageSquare },
  practice: { label: "Practice", icon: Dumbbell },
}

function formatDate(iso: string, locale: string, unknownDate: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return unknownDate
  return date.toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" })
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
  const { language, t } = useLanguage()
  const mode = MODE_META[submission.mode] ?? { label: "Entry", icon: FileText }
  const ModeIcon = mode.icon
  const changed = submission.correctedText && submission.correctedText !== submission.originalText
  const [deleting, setDeleting] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const errorCount = errors?.length ?? 0
  const noteCount = notes?.length ?? 0
  const hasDetails = errorCount > 0 || noteCount > 0

  async function handleDelete() {
    if (!onDelete) return
    setDeleting(true)
    try {
      await onDelete(submission)
      setDeleteOpen(false)
    } catch {
      // The page owns the error toast; keep this dialog open for a retry.
    } finally {
      setDeleting(false)
    }
  }

  const detailParts: string[] = []
  const locale = language === "zh-CN" ? "zh-CN" : "en-US"
  if (errorCount > 0) {
    detailParts.push(
      language === "zh-CN"
        ? `${errorCount} ${t.history.correction}`
        : `${errorCount} ${t.history.correction}${errorCount === 1 ? "" : "s"}`,
    )
  }
  if (noteCount > 0) {
    detailParts.push(
      language === "zh-CN"
        ? `${noteCount} ${t.history.note}`
        : `${noteCount} ${t.history.note}${noteCount === 1 ? "" : "s"}`,
    )
  }
  const modeLabel =
    submission.mode === "writing"
      ? t.history.writing
      : submission.mode === "chat"
        ? t.history.chat
        : submission.mode === "practice"
          ? t.history.practice
          : t.history.entry

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2 rounded-lg bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground">
            <ModeIcon className="size-3.5" />
            {modeLabel}
          </span>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            {submission.cefrEstimate ? <CefrBadge level={submission.cefrEstimate} size="sm" showLabel={false} /> : null}
            <span className="text-xs text-muted-foreground">{formatDate(submission.createdAt, locale, t.common.unknownDate)}</span>
            {onDelete ? (
              <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <DialogTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground hover:text-danger"
                      aria-label={t.history.deleteSubmission}
                      disabled={deleting}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  }
                />
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t.history.deleteEntry}</DialogTitle>
                    <DialogDescription>{t.history.deleteDescription}</DialogDescription>
                  </DialogHeader>
                  {detailParts.length ? (
                    <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive [overflow-wrap:anywhere]">
                      <span className="font-medium">{t.history.deleteIncludes}</span> {detailParts.join(" · ")}
                    </div>
                  ) : null}
                  <DialogFooter>
                    <DialogClose render={<Button variant="outline" disabled={deleting} />}>
                      {t.common.cancel}
                    </DialogClose>
                    <Button variant="destructive" disabled={deleting} onClick={handleDelete}>
                      <Trash2 />
                      {deleting ? t.common.removing : t.history.deletePermanently}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-2 rounded-xl bg-muted/50 p-3 text-sm leading-relaxed">
          <p className={cn("[overflow-wrap:anywhere]", changed ? "text-danger" : "text-foreground")}>
            {submission.originalText}
          </p>
          {changed ? (
            <>
              <ArrowRight className="size-4 text-muted-foreground" />
              <p className="text-success [overflow-wrap:anywhere]">{submission.correctedText}</p>
            </>
          ) : null}
        </div>

        {submission.summaryZh ? (
          <p className="text-sm leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">{submission.summaryZh}</p>
        ) : null}

        {hasDetails ? (
          <Collapsible open={expanded} onOpenChange={setExpanded}>
            <CollapsibleTrigger
              className={cn(
                "flex w-full items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium transition-colors hover:bg-muted",
              )}
            >
              <span className="flex min-w-0 items-center gap-2 text-left text-foreground [overflow-wrap:anywhere]">
                <Lightbulb className="size-4 shrink-0 text-primary" />
                {detailParts.join(" · ")}
              </span>
              <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")} />
            </CollapsibleTrigger>
            <CollapsibleContent className="overflow-hidden data-ending-style:h-0 data-starting-style:h-0">
              <div className="mt-3 flex flex-col gap-3">
                {errorCount > 0 && (
                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-medium text-muted-foreground">{t.history.corrections}</span>
                    {errors!.map((e) => (
                      <ErrorCard key={e.id} error={e} />
                    ))}
                  </div>
                )}
                {noteCount > 0 && (
                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-medium text-muted-foreground">{t.history.notes}</span>
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
