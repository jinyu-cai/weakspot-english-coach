"use client"

import { useState } from "react"
import useSWR, { mutate } from "swr"
import { toast } from "sonner"
import { BookOpen, Lightbulb, BookA, GraduationCap, Trash2, Download } from "lucide-react"
import { deleteNote, getNotes } from "@/lib/api-client"
import type { LearningNote, NoteType } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EmptyState } from "@/components/empty-state"

const NOTE_META: Record<NoteType, { label: string; icon: typeof Lightbulb; variant: "default" | "secondary" | "outline" }> = {
  expression: { label: "Expression", icon: Lightbulb, variant: "default" },
  vocabulary: { label: "Vocabulary", icon: BookA, variant: "secondary" },
  grammar: { label: "Grammar", icon: GraduationCap, variant: "outline" },
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
}

function NoteCard({ note, onDelete }: { note: LearningNote; onDelete: (note: LearningNote) => void }) {
  const meta = NOTE_META[note.type]
  const Icon = meta.icon
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
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
              {meta.label}
            </Badge>
            <span className="font-medium">{note.topic}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{formatDate(note.createdAt)}</span>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-danger"
              disabled={deleting}
              onClick={handleDelete}
              aria-label="Delete note"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-2 rounded-xl bg-muted/50 p-3 text-sm leading-relaxed">
          <div className="flex items-start gap-2">
            <span className="shrink-0 text-xs font-medium text-muted-foreground">Original</span>
            <span className="text-danger">{note.original}</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="shrink-0 text-xs font-medium text-muted-foreground">Natural</span>
            <span className="text-success">{note.natural}</span>
          </div>
        </div>

        <p className="text-sm leading-relaxed text-foreground">{note.explanation}</p>

        <div className="rounded-lg border border-border p-3">
          <div className="text-xs font-medium text-muted-foreground">Context & Tone</div>
          <p className="mt-1 text-sm leading-relaxed">{note.context}</p>
        </div>

        {note.examples.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">Examples</span>
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

export default function NotebookPage() {
  const { data, isLoading } = useSWR("notes", () => getNotes())
  const notes = data?.notes ?? []

  const expressionNotes = notes.filter((n) => n.type === "expression")
  const vocabularyNotes = notes.filter((n) => n.type === "vocabulary")
  const grammarNotes = notes.filter((n) => n.type === "grammar")

  function exportNotes() {
    if (!notes.length) return

    const sections: [string, LearningNote[]][] = [
      ["Expression", expressionNotes],
      ["Vocabulary", vocabularyNotes],
      ["Grammar", grammarNotes],
    ]

    let md = `# WeakSpot Notebook Export\n\n`
    md += `> Exported on ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })} · ${notes.length} notes total\n\n---\n\n`

    for (const [title, items] of sections) {
      if (!items.length) continue
      md += `## ${title} (${items.length})\n\n`
      for (const note of items) {
        md += `### ${note.topic}\n\n`
        md += `- **Original:** ${note.original}\n`
        md += `- **Natural:** ${note.natural}\n`
        md += `- **Explanation:** ${note.explanation}\n`
        if (note.context) md += `- **Context:** ${note.context}\n`
        if (note.examples.length) {
          md += `- **Examples:**\n`
          for (const ex of note.examples) md += `  - _${ex}_\n`
        }
        md += `\n`
      }
      md += `---\n\n`
    }

    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `weakspot-notebook-${new Date().toISOString().slice(0, 10)}.md`
    a.click()
    URL.revokeObjectURL(url)
    toast.success("Notebook exported", { description: `${notes.length} notes saved as Markdown.` })
  }

  async function handleDelete(note: LearningNote) {
    try {
      await deleteNote(note.id, note.createdAt)
      toast.success("Note deleted")
      mutate("notes")
    } catch (error) {
      toast.error("Could not delete note", {
        description: error instanceof Error ? error.message : "Please try again.",
      })
    }
  }

  function NoteList({ items }: { items: LearningNote[] }) {
    if (!items.length) {
      return <EmptyState icon={BookOpen} title="No notes yet" description="Notes are generated automatically when you run a diagnosis." />
    }
    return (
      <div className="flex flex-col gap-4">
        {items.map((note) => (
          <NoteCard key={note.id} note={note} onDelete={handleDelete} />
        ))}
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <header className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h1 className="font-heading text-3xl font-bold tracking-tight">Notebook</h1>
          {notes.length > 0 && (
            <Button variant="outline" size="sm" onClick={exportNotes}>
              <Download data-icon="inline-start" />
              Export
            </Button>
          )}
        </div>
        <p className="text-muted-foreground">
          Natural expressions, vocabulary, and grammar patterns collected from your diagnoses.
        </p>
      </header>

      {isLoading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-10 w-64 rounded-lg" />
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      ) : (
        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">
              <BookOpen data-icon="inline-start" />
              All
              <Badge variant="secondary" className="ml-1 tabular-nums">{notes.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="expression">
              <Lightbulb data-icon="inline-start" />
              Expression
              <Badge variant="secondary" className="ml-1 tabular-nums">{expressionNotes.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="vocabulary">
              <BookA data-icon="inline-start" />
              Vocabulary
              <Badge variant="secondary" className="ml-1 tabular-nums">{vocabularyNotes.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="grammar">
              <GraduationCap data-icon="inline-start" />
              Grammar
              <Badge variant="secondary" className="ml-1 tabular-nums">{grammarNotes.length}</Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-6"><NoteList items={notes} /></TabsContent>
          <TabsContent value="expression" className="mt-6"><NoteList items={expressionNotes} /></TabsContent>
          <TabsContent value="vocabulary" className="mt-6"><NoteList items={vocabularyNotes} /></TabsContent>
          <TabsContent value="grammar" className="mt-6"><NoteList items={grammarNotes} /></TabsContent>
        </Tabs>
      )}
    </div>
  )
}
