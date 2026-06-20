"use client"

import { useState } from "react"
import useSWR from "swr"
import { toast } from "sonner"
import { CalendarRange, Sparkles } from "lucide-react"
import { generatePlan, getPlan } from "@/lib/api-client"
import type { LearningPlan } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/empty-state"
import { LearningPlanCard } from "@/components/learning-plan-card"

export default function PlanPage() {
  const { data, isLoading, mutate } = useSWR("plan", () => getPlan())
  const [plan, setPlan] = useState<LearningPlan | null>(null)
  const [generating, setGenerating] = useState(false)

  const activePlan = plan ?? data?.plan ?? null

  async function handleGenerate() {
    setGenerating(true)
    try {
      const newPlan = await generatePlan()
      setPlan(newPlan)
      mutate({ plan: newPlan }, { revalidate: false })
      toast.success("已生成 7 天学习计划", { description: "根据你的薄弱技能定制。" })
    } catch {
      toast.error("生成计划失败，请稍后重试。")
    } finally {
      setGenerating(false)
    }
  }

  function toggleTask(taskId: string, completed: boolean) {
    if (!activePlan) return
    const updated: LearningPlan = {
      ...activePlan,
      days: activePlan.days.map((d) => ({
        ...d,
        tasks: d.tasks.map((t) => (t.id === taskId ? { ...t, completed } : t)),
      })),
    }
    setPlan(updated)
    mutate({ plan: updated }, { revalidate: false })
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="font-heading text-3xl font-bold tracking-tight">7-Day Plan</h1>
        <p className="text-muted-foreground">A personalized study plan built from your weakness profile.</p>
      </header>

      {isLoading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      ) : activePlan ? (
        <>
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
            <p className="font-heading text-sm font-semibold text-primary">{activePlan.title}</p>
          </div>
          <div className="flex flex-col">
            {activePlan.days.map((day) => (
              <LearningPlanCard key={day.day} day={day} onToggleTask={toggleTask} />
            ))}
          </div>
        </>
      ) : (
        <EmptyState
          icon={CalendarRange}
          title="No plan yet"
          description="生成一个为期 7 天的个性化计划，针对你最薄弱的技能逐日突破。"
        >
          <Button size="lg" onClick={handleGenerate} disabled={generating}>
            {generating ? <Spinner /> : <Sparkles data-icon="inline-start" />}
            {generating ? "Generating..." : "Generate 7-Day Plan"}
          </Button>
        </EmptyState>
      )}
    </div>
  )
}
