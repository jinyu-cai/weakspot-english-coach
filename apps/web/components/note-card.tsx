"use client"

import { useState } from "react"
import { Archive, Lightbulb, BookA, GraduationCap, MessageSquareText, Trash2 } from "lucide-react"
import type { LearningNote, NoteType } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useLanguage } from "@/components/language-provider"
import { skillLabel } from "@/lib/practice"

export const NOTE_META: Record<NoteType, { label: string; icon: typeof Lightbulb; variant: "default" | "secondary" | "outline" }> = {
  expression: { label: "Expression", icon: Lightbulb, variant: "default" },
  vocabulary: { label: "Vocabulary", icon: BookA, variant: "secondary" },
  grammar: { label: "Grammar", icon: GraduationCap, variant: "outline" },
}

function formatDate(iso: string, locale: string) {
  return new Date(iso).toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" })
}

export function NoteCard({ note, onDelete }: { note: LearningNote; onDelete?: (note: LearningNote) => void }) {
  const meta = NOTE_META[note.type]
  const Icon = meta.icon
  const [deleting, setDeleting] = useState(false)
  const { language, t } = useLanguage()
  const localizedType = t.notebook[note.type]
  const isChatSelection = note.sourceType === "chat_selection"
  const locale = language === "zh-CN" ? "zh-CN" : "en-US"
  const resolvedSkills = [...new Set(
    (note.relatedWeaknesses ?? [])
      .filter((weakness) => weakness.status === "resolved")
      .map((weakness) => skillLabel(weakness.skillCode, language)),
  )]

  async function handleDelete() {
    if (!onDelete) return
    setDeleting(true)
    try {
      await onDelete(note)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-6">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <Badge variant={meta.variant}>
              <Icon className="mr-1 size-3" />
              {localizedType}
            </Badge>
            {isChatSelection ? (
              <Badge variant="outline">
                <MessageSquareText className="mr-1 size-3" />
                {t.notebook.chatSelection}
              </Badge>
            ) : null}
            {note.topic ? (
              <span className="min-w-0 break-words font-medium [overflow-wrap:anywhere]">{note.topic}</span>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <span className="text-xs text-muted-foreground">{formatDate(note.createdAt, locale)}</span>
            {onDelete ? (
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground hover:text-danger"
                disabled={deleting}
                onClick={handleDelete}
                aria-label={t.notebook.deleteNote}
              >
                <Trash2 className="size-4" />
              </Button>
            ) : null}
          </div>
        </div>

        {note.learningState === "previous" ? (
          <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            <Archive className="mt-0.5 size-3.5 shrink-0" />
            <div className="min-w-0 [overflow-wrap:anywhere]">
              <div className="font-medium text-foreground">{t.notebook.previousBadge}</div>
              <div className="mt-0.5 leading-relaxed">{t.notebook.previousCardDescription}</div>
              {resolvedSkills.length ? (
                <div className="mt-1 font-medium text-foreground/80">
                  {t.notebook.relatedResolved}: {resolvedSkills.join(" · ")}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {isChatSelection ? (
          <div className="rounded-xl bg-muted/50 p-3">
            <div className="text-xs font-medium text-muted-foreground">{t.notebook.savedText}</div>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed [overflow-wrap:anywhere]">{note.original}</p>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-2 rounded-xl bg-muted/50 p-3 text-sm leading-relaxed">
              <div className="flex items-start gap-2">
                <span className="shrink-0 text-xs font-medium text-muted-foreground">{t.notebook.original}</span>
                <span className="min-w-0 text-danger [overflow-wrap:anywhere]">{note.original}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="shrink-0 text-xs font-medium text-muted-foreground">{t.notebook.natural}</span>
                <span className="min-w-0 text-success [overflow-wrap:anywhere]">{note.natural}</span>
              </div>
            </div>

            <p className="text-sm leading-relaxed text-foreground [overflow-wrap:anywhere]">{note.explanation}</p>

            <div className="rounded-lg border border-border p-3">
              <div className="text-xs font-medium text-muted-foreground">{t.notebook.contextTone}</div>
              <p className="mt-1 text-sm leading-relaxed [overflow-wrap:anywhere]">{note.context}</p>
            </div>
          </>
        )}

        {isChatSelection ? (
          <div className="rounded-lg border border-border p-3">
            <div className="text-xs font-medium text-muted-foreground">{t.notebook.source}</div>
            <p className="mt-1 text-sm leading-relaxed">
              {note.sourceRole === "user" ? t.notebook.fromYou : t.notebook.fromCoach}
            </p>
            {note.context && note.context.trim() !== note.original.trim() ? (
              <div className="mt-3 border-t border-border pt-3">
                <div className="text-xs font-medium text-muted-foreground">{t.notebook.messageContext}</div>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed [overflow-wrap:anywhere]">{note.context}</p>
              </div>
            ) : null}
          </div>
        ) : null}

        {note.examples.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">{t.notebook.examples}</span>
            <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
              {note.examples.map((ex) => (
                <li key={ex} className="flex items-start gap-2">
                  <span className="mt-1 block size-1.5 shrink-0 rounded-full bg-primary/60" />
                  <span className="min-w-0 italic [overflow-wrap:anywhere]">{ex}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
