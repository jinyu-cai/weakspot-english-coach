"use client"

import { useState } from "react"
import { Lightbulb, BookA, GraduationCap, Trash2 } from "lucide-react"
import type { LearningNote, NoteType } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useLanguage } from "@/components/language-provider"

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
  const locale = language === "zh-CN" ? "zh-CN" : "en-US"

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
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge variant={meta.variant}>
              <Icon className="mr-1 size-3" />
              {localizedType}
            </Badge>
            <span className="font-medium">{note.topic}</span>
          </div>
          <div className="flex items-center gap-2">
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

        <div className="flex flex-col gap-2 rounded-xl bg-muted/50 p-3 text-sm leading-relaxed">
          <div className="flex items-start gap-2">
            <span className="shrink-0 text-xs font-medium text-muted-foreground">{t.notebook.original}</span>
            <span className="text-danger">{note.original}</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="shrink-0 text-xs font-medium text-muted-foreground">{t.notebook.natural}</span>
            <span className="text-success">{note.natural}</span>
          </div>
        </div>

        <p className="text-sm leading-relaxed text-foreground">{note.explanation}</p>

        <div className="rounded-lg border border-border p-3">
          <div className="text-xs font-medium text-muted-foreground">{t.notebook.contextTone}</div>
          <p className="mt-1 text-sm leading-relaxed">{note.context}</p>
        </div>

        {note.examples.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">{t.notebook.examples}</span>
            <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
              {note.examples.map((ex) => (
                <li key={ex} className="flex items-start gap-2">
                  <span className="mt-1 block size-1.5 shrink-0 rounded-full bg-primary/60" />
                  <span className="italic">{ex}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
