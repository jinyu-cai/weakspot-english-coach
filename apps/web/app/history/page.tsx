"use client"

import useSWR, { mutate } from "swr"
import { toast } from "sonner"
import { AlertCircle, FileText, History as HistoryIcon, RefreshCcw } from "lucide-react"
import { deleteSubmission, getHistory } from "@/lib/api-client"
import type { HistoryResponse, LearningNote, Submission } from "@/lib/types"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/empty-state"
import { SubmissionCard } from "@/components/submission-card"
import { ErrorCard } from "@/components/error-card"
import { useLanguage } from "@/components/language-provider"

const EMPTY_HISTORY: HistoryResponse = { submissions: [], errors: [], notes: [] }

function removeSubmissionFromHistory(
  history: HistoryResponse | undefined,
  submissionId: string,
): HistoryResponse {
  if (!history) return EMPTY_HISTORY

  return {
    submissions: history.submissions.filter((submission) => submission.id !== submissionId),
    errors: history.errors.filter((error) => error.submissionId !== submissionId),
    notes: (history.notes ?? []).filter((note) => note.submissionId !== submissionId),
  }
}

export default function HistoryPage() {
  const {
    data,
    error,
    isLoading,
    mutate: refreshHistory,
  } = useSWR<HistoryResponse>("history", () => getHistory(), {
    keepPreviousData: true,
  })

  const submissions = data?.submissions ?? []
  const errors = data?.errors ?? []
  const notes = data?.notes ?? []
  const { t } = useLanguage()
  const errorMessage = error instanceof Error ? error.message : t.import.tryShortly

  async function handleDelete(submission: Submission) {
    if (!submission.createdAt) {
      toast.error(t.history.deleteFailed, {
        description: t.history.deleteMissing,
      })
      return
    }

    let removedErrors = 0

    try {
      await refreshHistory(
        async (currentHistory) => {
          const res = await deleteSubmission(submission.id, submission.createdAt)
          removedErrors = res.removedErrors
          return removeSubmissionFromHistory(currentHistory, submission.id)
        },
        {
          optimisticData: (currentHistory) => removeSubmissionFromHistory(currentHistory, submission.id),
          populateCache: true,
          rollbackOnError: true,
          revalidate: false,
        },
      )

      toast.success(t.history.deleted, {
        description:
          removedErrors > 0
            ? `${t.history.rolledBack} ${removedErrors} ${t.history.fromProfile}`
            : t.history.removedHistory,
      })
      // Refresh history (submissions + error log) and the dashboard profile/skills.
      void refreshHistory()
      void mutate("profile")
    } catch (error) {
      toast.error(t.history.deleteFailed, {
        description: error instanceof Error ? error.message : t.import.tryShortly,
      })
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="font-heading text-3xl font-bold tracking-tight">{t.history.title}</h1>
        <p className="text-muted-foreground">{t.history.description}</p>
      </header>

      {error && !data ? (
        <EmptyState icon={AlertCircle} title={t.history.loadFailed} description={errorMessage}>
          <Button variant="outline" onClick={() => void refreshHistory()}>
            <RefreshCcw data-icon="inline-start" />
            {t.common.tryAgain}
          </Button>
        </EmptyState>
      ) : isLoading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-10 w-64 rounded-lg" />
          <Skeleton className="h-36 w-full rounded-xl" />
          <Skeleton className="h-36 w-full rounded-xl" />
        </div>
      ) : (
        <Tabs defaultValue="submissions">
          {error ? (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          ) : null}

          <TabsList>
            <TabsTrigger value="submissions">
              <FileText data-icon="inline-start" />
              {t.history.submissions}
              <Badge variant="secondary" className="ml-1 tabular-nums">
                {submissions.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="errors">
              <AlertCircle data-icon="inline-start" />
              {t.history.errorLog}
              <Badge variant="secondary" className="ml-1 tabular-nums">
                {errors.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="submissions" className="mt-6 flex flex-col gap-4">
            {submissions.length ? (
              submissions.map((s) => (
                <SubmissionCard
                  key={s.id}
                  submission={s}
                  errors={errors.filter((e) => e.submissionId === s.id)}
                  notes={notes.filter((n) => n.submissionId === s.id)}
                  onDelete={handleDelete}
                />
              ))
            ) : (
              <EmptyState icon={HistoryIcon} title={t.history.noSubmissions} description={t.history.noSubmissionsDescription} />
            )}
          </TabsContent>

          <TabsContent value="errors" className="mt-6 flex flex-col gap-4">
            {errors.length ? (
              errors.map((e) => <ErrorCard key={e.id} error={e} />)
            ) : (
              <EmptyState icon={AlertCircle} title={t.history.noErrors} description={t.history.noErrorsDescription} />
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
