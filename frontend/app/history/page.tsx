"use client"

import useSWR from "swr"
import { FileText, History as HistoryIcon, AlertCircle } from "lucide-react"
import { getHistory } from "@/lib/api-client"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/empty-state"
import { SubmissionCard } from "@/components/submission-card"
import { ErrorCard } from "@/components/error-card"

export default function HistoryPage() {
  const { data, isLoading } = useSWR("history", () => getHistory())

  const submissions = data?.submissions ?? []
  const errors = data?.errors ?? []

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="font-heading text-3xl font-bold tracking-tight">History</h1>
        <p className="text-muted-foreground">Review all your submissions and flagged errors to track your progress.</p>
      </header>

      {isLoading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-10 w-64 rounded-lg" />
          <Skeleton className="h-36 w-full rounded-xl" />
          <Skeleton className="h-36 w-full rounded-xl" />
        </div>
      ) : (
        <Tabs defaultValue="submissions">
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
              submissions.map((s) => <SubmissionCard key={s.id} submission={s} />)
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
