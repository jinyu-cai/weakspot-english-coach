"use client"

import { Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import type { LearningPlanDay } from "@/lib/types"
import { PRACTICE_TYPE_META, SKILL_LABELS } from "@/lib/practice"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"

export function LearningPlanCard({
  day,
  onToggleTask,
}: {
  day: LearningPlanDay
  onToggleTask: (taskId: string, completed: boolean) => void
}) {
  const completedCount = day.tasks.filter((t) => t.completed).length

  return (
    <div className="relative flex gap-4">
      {/* Timeline rail */}
      <div className="flex flex-col items-center">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground">
          {day.day}
        </span>
        <span className="mt-2 w-px flex-1 bg-border" aria-hidden="true" />
      </div>

      <Card className="mb-6 flex-1">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">
              Day {day.day} · {day.goalZh}
            </CardTitle>
            <span className="text-xs text-muted-foreground">
              {completedCount}/{day.tasks.length} done
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {day.targetSkillCodes.map((code) => (
              <Badge key={code} variant="secondary">
                {SKILL_LABELS[code] ?? code}
              </Badge>
            ))}
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {day.tasks.map((task) => (
            <label
              key={task.id}
              className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3 transition-colors hover:bg-muted/50"
            >
              <Checkbox
                checked={task.completed}
                onCheckedChange={(checked) => onToggleTask(task.id, checked === true)}
                className="mt-0.5"
              />
              <div className="flex flex-1 flex-col gap-1">
                <span className={cn("text-sm font-medium", task.completed && "text-muted-foreground line-through")}>
                  {task.titleZh}
                </span>
                <span className="text-xs leading-relaxed text-muted-foreground">{task.descriptionZh}</span>
                <div className="flex items-center gap-2 pt-1">
                  <Badge variant="outline">{PRACTICE_TYPE_META[task.practiceType].zhLabel}</Badge>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="size-3" />~{task.estimatedMinutes} min
                  </span>
                </div>
              </div>
            </label>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
