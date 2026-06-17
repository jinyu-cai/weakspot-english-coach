"use client"

import { useEffect, useState } from "react"
import { CalendarCheck, CalendarPlus, Sparkles } from "lucide-react"
import { AppShell } from "@/components/app-shell"
import { LearningPlanCard } from "@/components/learning-plan-card"
import { EmptyState } from "@/components/empty-state"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { generatePlan, getPlan } from "@/lib/api-client"
import type { LearningPlan } from "@/lib/types"

export default function PlanPage() {
  const [plan, setPlan] = useState<LearningPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    getPlan()
      .then((res) => setPlan(res.plan))
      .finally(() => setLoading(false))
  }, [])

  async function handleGenerate() {
    setGenerating(true)
    try {
      const res = await generatePlan()
      setPlan(res.plan)
    } finally {
      setGenerating(false)
    }
  }

  function toggleTask(taskId: string) {
    setPlan((prev) =>
      prev
        ? {
            ...prev,
            days: prev.days.map((d) => ({
              ...d,
              tasks: d.tasks.map((t) =>
                t.id === taskId ? { ...t, completed: !t.completed } : t,
              ),
            })),
          }
        : prev,
    )
  }

  const allTasks = plan?.days.flatMap((d) => d.tasks) ?? []
  const completed = allTasks.filter((t) => t.completed).length
  const progress = allTasks.length ? Math.round((completed / allTasks.length) * 100) : 0

  return (
    <AppShell>
      <div className="flex flex-col gap-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">7-Day Plan</h1>
          <p className="text-muted-foreground">
            根据你的薄弱点自动生成的个性化学习计划，每天循序渐进。
          </p>
        </header>

        {loading ? (
          <div className="flex flex-col gap-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-40 w-full rounded-2xl" />
            ))}
          </div>
        ) : !plan ? (
          <EmptyState
            icon={CalendarPlus}
            title="还没有学习计划"
            description="根据你最近的诊断结果，生成一份为期 7 天、聚焦薄弱项的个性化学习计划。"
            action={
              <Button onClick={handleGenerate} disabled={generating}>
                {generating ? (
                  <>
                    <Spinner data-icon="inline-start" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles data-icon="inline-start" />
                    Generate 7-Day Plan
                  </>
                )}
              </Button>
            }
          />
        ) : (
          <>
            <Card>
              <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                    <CalendarCheck className="size-5" />
                  </span>
                  <div className="flex flex-col">
                    <span className="font-semibold">{plan.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {completed} / {allTasks.length} 项任务已完成
                    </span>
                  </div>
                </div>
                <div className="flex w-full max-w-xs flex-col gap-1.5">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>进度</span>
                    <span className="tabular-nums">{progress}%</span>
                  </div>
                  <Progress value={progress} />
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-col">
              {plan.days.map((day, i) => (
                <LearningPlanCard
                  key={day.day}
                  day={day}
                  isLast={i === plan.days.length - 1}
                  onToggleTask={toggleTask}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}
