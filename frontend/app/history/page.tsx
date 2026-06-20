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
        <p className="text-muted-foreground">回顾你的所有提交记录和被标记的错误，复盘进步轨迹。</p>
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
              提交记录
              <Badge variant="secondary" className="ml-1 tabular-nums">
                {submissions.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="errors">
              <AlertCircle data-icon="inline-start" />
              错误集
              <Badge variant="secondary" className="ml-1 tabular-nums">
                {errors.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="submissions" className="mt-6 flex flex-col gap-4">
            {submissions.length ? (
              submissions.map((s) => <SubmissionCard key={s.id} submission={s} />)
            ) : (
              <EmptyState icon={HistoryIcon} title="暂无提交记录" description="完成一次诊断后，你的提交会出现在这里。" />
            )}
          </TabsContent>

          <TabsContent value="errors" className="mt-6 flex flex-col gap-4">
            {errors.length ? (
              errors.map((e) => <ErrorCard key={e.id} error={e} />)
            ) : (
              <EmptyState icon={AlertCircle} title="暂无错误记录" description="太棒了！目前没有被标记的错误。" />
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
