"use client"

import useSWR, { mutate } from "swr"
import { toast } from "sonner"
import { BookOpen, Lightbulb, BookA, GraduationCap } from "lucide-react"
import { deleteNote, getNotes } from "@/lib/api-client"
import type { LearningNote } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EmptyState } from "@/components/empty-state"
import { NoteCard } from "@/components/note-card"

export default function NotebookPage() {
  const { data, isLoading } = useSWR("notes", () => getNotes())
  const notes = data?.notes ?? []

  const expressionNotes = notes.filter((n) => n.type === "expression")
  const vocabularyNotes = notes.filter((n) => n.type === "vocabulary")
  const grammarNotes = notes.filter((n) => n.type === "grammar")

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
        <h1 className="font-heading text-3xl font-bold tracking-tight">Notebook</h1>
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
