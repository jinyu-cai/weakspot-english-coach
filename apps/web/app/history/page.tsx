"use client"

import useSWR, { mutate } from "swr"
import { toast } from "sonner"
import { AlertCircle, FileText, History as HistoryIcon, RefreshCcw } from "lucide-react"
import { deleteSubmission, getHistory } from "@/lib/api-client"
import type { HistoryResponse, Submission } from "@/lib/types"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/empty-state"
import { SubmissionCard } from "@/components/submission-card"
import { ErrorCard } from "@/components/error-card"

const EMPTY_HISTORY: HistoryResponse = { submissions: [], errors: [] }

function removeSubmissionFromHistory(
  history: HistoryResponse | undefined,
  submissionId: string,
): HistoryResponse {
  if (!history) return EMPTY_HISTORY

  return {
    submissions: history.submissions.filter((submission) => submission.id !== submissionId),
    errors: history.errors.filter((error) => error.submissionId !== submissionId),
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
  const errorMessage = error instanceof Error ? error.message : "Please try again shortly."

  async function handleDelete(submission: Submission) {
    if (!submission.createdAt) {
      toast.error("Could not delete entry", {
        description: "This entry is missing its timestamp, so it cannot be safely deleted.",
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

      toast.success("Entry deleted", {
        description:
          removedErrors > 0
            ? `Rolled back ${removedErrors} error${removedErrors === 1 ? "" : "s"} from your weakness profile.`
            : "Removed from your history.",
      })
      // Refresh history (submissions + error log) and the dashboard profile/skills.
      void refreshHistory()
      void mutate("profile")
    } catch (error) {
      toast.error("Could not delete entry", {
        description: error instanceof Error ? error.message : "Please try again shortly.",
      })
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="font-heading text-3xl font-bold tracking-tight">History</h1>
        <p className="text-muted-foreground">Review all your submissions and flagged errors to track your progress.</p>
      </header>

      {error && !data ? (
        <EmptyState icon={AlertCircle} title="History could not load" description={errorMessage}>
          <Button variant="outline" onClick={() => void refreshHistory()}>
            <RefreshCcw data-icon="inline-start" />
            Try again
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
              Submissions
              <Badge variant="secondary" className="ml-1 tabular-nums">
                {submissions.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="errors">
              <AlertCircle data-icon="inline-start" />
              Error log
              <Badge variant="secondary" className="ml-1 tabular-nums">
                {errors.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="submissions" className="mt-6 flex flex-col gap-4">
            {submissions.length ? (
              submissions.map((s) => <SubmissionCard key={s.id} submission={s} onDelete={handleDelete} />)
            ) : (
              <EmptyState icon={HistoryIcon} title="No submissions yet" description="Once you run a diagnosis, your submissions will appear here." />
            )}
          </TabsContent>

          <TabsContent value="errors" className="mt-6 flex flex-col gap-4">
            {errors.length ? (
              errors.map((e) => <ErrorCard key={e.id} error={e} />)
            ) : (
              <EmptyState icon={AlertCircle} title="No errors logged" description="Great job! There are no flagged errors right now." />
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
