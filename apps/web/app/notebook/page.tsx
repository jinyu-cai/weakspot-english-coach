"use client"

import { useState } from "react"
import useSWR, { mutate } from "swr"
import { toast } from "sonner"
import { Archive, BookOpen, Lightbulb, BookA, GraduationCap, Download } from "lucide-react"
import { deleteNote, getNotes } from "@/lib/api-client"
import type { LearningNote } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { EmptyState } from "@/components/empty-state"
import { NoteCard } from "@/components/note-card"
import { useLanguage } from "@/components/language-provider"

const notebookTabClass = "h-auto min-h-10 w-full flex-none gap-1 px-2 py-1.5 text-xs whitespace-nowrap [overflow-wrap:normal] sm:text-sm"
const notebookCountClass = "ml-0.5 px-1.5 tabular-nums"

export default function NotebookPage() {
  const { data, isLoading } = useSWR("notes", () => getNotes())
  const notes = data?.notes ?? []
  const { language, t } = useLanguage()
  const [noteView, setNoteView] = useState<"current" | "previous" | "all">("current")

  const currentNotes = notes.filter((note) => note.learningState !== "previous")
  const previousNotes = notes.filter((note) => note.learningState === "previous")
  const visibleNotes = noteView === "all" ? notes : noteView === "previous" ? previousNotes : currentNotes
  const expressionNotes = visibleNotes.filter((n) => n.type === "expression")
  const vocabularyNotes = visibleNotes.filter((n) => n.type === "vocabulary")
  const grammarNotes = visibleNotes.filter((n) => n.type === "grammar")

  function exportNotes() {
    if (!notes.length) return

    const sections: [string, LearningNote[]][] = [
      [t.notebook.expression, notes.filter((note) => note.type === "expression")],
      [t.notebook.vocabulary, notes.filter((note) => note.type === "vocabulary")],
      [t.notebook.grammar, notes.filter((note) => note.type === "grammar")],
    ]

    const locale = language === "zh-CN" ? "zh-CN" : "en-US"
    let md = `# ${t.notebook.exportTitle}\n\n`
    md += `> ${t.notebook.exportedOn} ${new Date().toLocaleDateString(locale, { year: "numeric", month: "long", day: "numeric" })} · ${notes.length} ${t.notebook.totalNotes}\n\n---\n\n`

    for (const [title, items] of sections) {
      if (!items.length) continue
      md += `## ${title} (${items.length})\n\n`
      for (const note of items) {
        md += `### ${note.topic || (note.sourceType === "chat_selection" ? t.notebook.chatSelection : "")}\n\n`
        if (note.sourceType === "chat_selection") {
          md += `- **${t.notebook.savedText}:** ${note.original}\n`
          md += `- **${t.notebook.source}:** ${note.sourceRole === "user" ? t.notebook.fromYou : t.notebook.fromCoach}\n`
          if (note.context) md += `- **${t.notebook.messageContext}:** ${note.context}\n`
        } else {
          md += `- **${t.notebook.original}:** ${note.original}\n`
          md += `- **${t.notebook.natural}:** ${note.natural}\n`
          md += `- **${t.notebook.explanation}:** ${note.explanation}\n`
          if (note.context) md += `- **${t.notebook.contextTone}:** ${note.context}\n`
          if (note.examples.length) {
            md += `- **${t.notebook.examples}:**\n`
            for (const ex of note.examples) md += `  - _${ex}_\n`
          }
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
    toast.success(t.notebook.exported, { description: `${notes.length} ${t.notebook.exportedDescription}` })
  }

  async function handleDelete(note: LearningNote) {
    try {
      await deleteNote(note.id, note.createdAt)
      toast.success(t.notebook.deleteSuccess)
      mutate("notes")
    } catch (error) {
      toast.error(t.notebook.deleteFailed, {
        description: error instanceof Error ? error.message : t.import.tryShortly,
      })
    }
  }

  function renderNoteList(items: LearningNote[]) {
    if (!items.length) {
      return (
        <EmptyState
          icon={noteView === "previous" ? Archive : BookOpen}
          title={noteView === "previous" ? t.notebook.noPreviousNotes : t.notebook.noNotes}
          description={noteView === "previous" ? t.notebook.noPreviousNotesDescription : t.notebook.noNotesDescription}
        />
      )
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
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="min-w-0 break-words font-heading text-3xl font-bold tracking-tight">{t.notebook.title}</h1>
          {notes.length > 0 && (
            <Button variant="outline" size="sm" className="shrink-0" onClick={exportNotes}>
              <Download data-icon="inline-start" />
              {t.notebook.export}
            </Button>
          )}
        </div>
        <p className="text-muted-foreground">
          {t.notebook.description}
        </p>
      </header>

      {isLoading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-10 w-64 rounded-lg" />
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="text-sm font-medium">{t.notebook.viewLabel}</div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t.notebook.viewDescription}</p>
            </div>
            <ToggleGroup
              value={[noteView]}
              onValueChange={(values) => {
                const selected = values.find((value) => value === "current" || value === "previous" || value === "all")
                if (selected) setNoteView(selected)
              }}
              size="sm"
              className="grid w-full grid-cols-1 sm:flex sm:w-fit"
            >
              <ToggleGroupItem className="w-full justify-start sm:w-auto sm:justify-center" value="current">
                {t.notebook.currentView} · {currentNotes.length}
              </ToggleGroupItem>
              <ToggleGroupItem className="w-full justify-start sm:w-auto sm:justify-center" value="previous">
                {t.notebook.previousView} · {previousNotes.length}
              </ToggleGroupItem>
              <ToggleGroupItem className="w-full justify-start sm:w-auto sm:justify-center" value="all">
                {t.notebook.allView} · {notes.length}
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {noteView === "previous" ? (
            <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
              <Archive className="mt-0.5 size-5 shrink-0 text-primary" />
              <div className="min-w-0">
                <div className="font-medium">{t.notebook.previousInfoTitle}</div>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t.notebook.previousInfoDescription}</p>
              </div>
            </div>
          ) : null}

          <Tabs defaultValue="all">
            <TabsList className="grid w-full grid-cols-2 gap-1 group-data-horizontal/tabs:h-auto md:grid-cols-4">
              <TabsTrigger className={notebookTabClass} value="all">
                <BookOpen data-icon="inline-start" />
                {t.notebook.all}
                <Badge variant="secondary" className={notebookCountClass}>{visibleNotes.length}</Badge>
              </TabsTrigger>
              <TabsTrigger className={notebookTabClass} value="expression">
                <Lightbulb data-icon="inline-start" />
                {t.notebook.expression}
                <Badge variant="secondary" className={notebookCountClass}>{expressionNotes.length}</Badge>
              </TabsTrigger>
              <TabsTrigger className={notebookTabClass} value="vocabulary">
                <BookA data-icon="inline-start" />
                {t.notebook.vocabulary}
                <Badge variant="secondary" className={notebookCountClass}>{vocabularyNotes.length}</Badge>
              </TabsTrigger>
              <TabsTrigger className={notebookTabClass} value="grammar">
                <GraduationCap data-icon="inline-start" />
                {t.notebook.grammar}
                <Badge variant="secondary" className={notebookCountClass}>{grammarNotes.length}</Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-6">{renderNoteList(visibleNotes)}</TabsContent>
            <TabsContent value="expression" className="mt-6">{renderNoteList(expressionNotes)}</TabsContent>
            <TabsContent value="vocabulary" className="mt-6">{renderNoteList(vocabularyNotes)}</TabsContent>
            <TabsContent value="grammar" className="mt-6">{renderNoteList(grammarNotes)}</TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  )
}
