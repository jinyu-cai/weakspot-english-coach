"use client"

import useSWR, { mutate } from "swr"
import { toast } from "sonner"
import { BookOpen, Lightbulb, BookA, GraduationCap, Download } from "lucide-react"
import { deleteNote, getNotes } from "@/lib/api-client"
import type { LearningNote } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EmptyState } from "@/components/empty-state"
import { NoteCard } from "@/components/note-card"
import { useLanguage } from "@/components/language-provider"

export default function NotebookPage() {
  const { data, isLoading } = useSWR("notes", () => getNotes())
  const notes = data?.notes ?? []
  const { language, t } = useLanguage()

  const expressionNotes = notes.filter((n) => n.type === "expression")
  const vocabularyNotes = notes.filter((n) => n.type === "vocabulary")
  const grammarNotes = notes.filter((n) => n.type === "grammar")

  function exportNotes() {
    if (!notes.length) return

    const sections: [string, LearningNote[]][] = [
      [t.notebook.expression, expressionNotes],
      [t.notebook.vocabulary, vocabularyNotes],
      [t.notebook.grammar, grammarNotes],
    ]

    const locale = language === "zh-CN" ? "zh-CN" : "en-US"
    let md = `# ${t.notebook.exportTitle}\n\n`
    md += `> ${t.notebook.exportedOn} ${new Date().toLocaleDateString(locale, { year: "numeric", month: "long", day: "numeric" })} · ${notes.length} ${t.notebook.totalNotes}\n\n---\n\n`

    for (const [title, items] of sections) {
      if (!items.length) continue
      md += `## ${title} (${items.length})\n\n`
      for (const note of items) {
        md += `### ${note.topic}\n\n`
        md += `- **${t.notebook.original}:** ${note.original}\n`
        md += `- **${t.notebook.natural}:** ${note.natural}\n`
        md += `- **${t.notebook.explanation}:** ${note.explanation}\n`
        if (note.context) md += `- **${t.notebook.contextTone}:** ${note.context}\n`
        if (note.examples.length) {
          md += `- **${t.notebook.examples}:**\n`
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

  function NoteList({ items }: { items: LearningNote[] }) {
    if (!items.length) {
      return <EmptyState icon={BookOpen} title={t.notebook.noNotes} description={t.notebook.noNotesDescription} />
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
          <h1 className="font-heading text-3xl font-bold tracking-tight">{t.notebook.title}</h1>
          {notes.length > 0 && (
            <Button variant="outline" size="sm" onClick={exportNotes}>
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
        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">
              <BookOpen data-icon="inline-start" />
              {t.notebook.all}
              <Badge variant="secondary" className="ml-1 tabular-nums">{notes.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="expression">
              <Lightbulb data-icon="inline-start" />
              {t.notebook.expression}
              <Badge variant="secondary" className="ml-1 tabular-nums">{expressionNotes.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="vocabulary">
              <BookA data-icon="inline-start" />
              {t.notebook.vocabulary}
              <Badge variant="secondary" className="ml-1 tabular-nums">{vocabularyNotes.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="grammar">
              <GraduationCap data-icon="inline-start" />
              {t.notebook.grammar}
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
