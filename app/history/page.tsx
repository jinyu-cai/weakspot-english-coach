"use client"

import useSWR from "swr"
import { History as HistoryIcon } from "lucide-react"
import { AppShell } from "@/components/app-shell"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SubmissionList, ErrorList } from "@/components/submission-history"
import { EmptyState } from "@/components/empty-state"
import { ListLoading } from "@/components/loading-state"
import { getHistory } from "@/lib/api-client"

export default function HistoryPage() {
  const { data, isLoading } = useSWR("history", () => getHistory())

  return (
    <AppShell
      title="学习历史"
      description="回顾你提交过的内容与所有被纠正的错误。"
    >
      <Tabs defaultValue="submissions" className="gap-6">
        <TabsList>
          <TabsTrigger value="submissions">
            提交记录
            {data ? ` (${data.submissions.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="corrections">
            错误纠正
            {data ? ` (${data.errors.length})` : ""}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="submissions">
          {isLoading ? (
            <ListLoading rows={4} />
          ) : data && data.submissions.length > 0 ? (
            <SubmissionList submissions={data.submissions} />
          ) : (
            <EmptyState
              icon={HistoryIcon}
              title="还没有提交记录"
              description="去「诊断」页面提交一段英文，开始积累你的学习历史。"
            />
          )}
        </TabsContent>

        <TabsContent value="corrections">
          {isLoading ? (
            <ListLoading rows={4} />
          ) : data && data.errors.length > 0 ? (
            <ErrorList errors={data.errors} />
          ) : (
            <EmptyState
              icon={HistoryIcon}
              title="还没有纠正记录"
              description="提交内容后，系统找出的每个错误都会归档在这里方便复习。"
            />
          )}
        </TabsContent>
      </Tabs>
    </AppShell>
  )
}
