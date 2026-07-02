"use client"

import { useState } from "react"
import useSWR from "swr"
import { toast } from "sonner"
import { CalendarRange, Sparkles } from "lucide-react"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { generatePlan, getPlan } from "@/lib/api-client"
import type { LearningPlan, PlanErrorScope } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/empty-state"
import { LearningPlanCard } from "@/components/learning-plan-card"
import { useLanguage } from "@/components/language-provider"

export default function PlanPage() {
  const { data, isLoading, mutate } = useSWR("plan", () => getPlan())
  const [plan, setPlan] = useState<LearningPlan | null>(null)
  const [generating, setGenerating] = useState(false)
  const [errorScope, setErrorScope] = useState<PlanErrorScope>("weekly")
  const { t } = useLanguage()

  const activePlan = plan ?? data?.plan ?? null

  async function handleGenerate() {
    setGenerating(true)
    try {
      const newPlan = await generatePlan(undefined, errorScope)
      setPlan(newPlan)
      mutate({ plan: newPlan }, { revalidate: false })
      toast.success(t.plan.generated, { description: t.plan.generatedDescription })
    } catch {
      toast.error(t.plan.generateFailed)
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
        <h1 className="font-heading text-3xl font-bold tracking-tight">{t.plan.title}</h1>
        <p className="text-muted-foreground">{t.plan.description}</p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">{t.plan.errorSource}</span>
          <ToggleGroup
            value={[errorScope]}
            onValueChange={(value) => {
              const selected = value.find((item) => item === "weekly" || item === "all")
              if (selected) setErrorScope(selected)
            }}
            size="sm"
          >
            <ToggleGroupItem value="weekly">{t.plan.pastWeek}</ToggleGroupItem>
            <ToggleGroupItem value="all">{t.plan.allErrors}</ToggleGroupItem>
          </ToggleGroup>
        </div>
      </header>

      {isLoading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      ) : activePlan ? (
        <>
          <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 p-4">
            <p className="font-heading text-sm font-semibold text-primary">{activePlan.title}</p>
            <Button variant="outline" size="sm" onClick={handleGenerate} disabled={generating}>
              {generating ? <Spinner /> : <Sparkles data-icon="inline-start" />}
              {generating ? t.plan.regenerating : t.plan.regenerate}
            </Button>
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
          title={t.plan.noPlan}
          description={t.plan.noPlanDescription}
        >
          <Button size="lg" onClick={handleGenerate} disabled={generating}>
            {generating ? <Spinner /> : <Sparkles data-icon="inline-start" />}
            {generating ? t.plan.generating : t.plan.generate}
          </Button>
        </EmptyState>
      )}
    </div>
  )
}
