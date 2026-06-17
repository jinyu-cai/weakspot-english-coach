"use client"

import { Clock, Target } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import { PRACTICE_TYPE_META, SKILL_LABELS } from "@/lib/labels"
import type { LearningPlanDay } from "@/lib/types"

export function LearningPlanCard({
  day,
  isLast,
  onToggleTask,
}: {
  day: LearningPlanDay
  isLast: boolean
  onToggleTask: (taskId: string) => void
}) {
  const total = day.tasks.length
  const done = day.tasks.filter((t) => t.completed).length
  const allDone = done === total

  return (
    <div className="flex gap-4">
      {/* Timeline rail */}
      <div className="flex flex-col items-center">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold",
            allDone
              ? "border-success bg-success text-success-foreground"
              : "border-primary bg-primary/10 text-primary",
          )}
        >
          {day.day}
        </span>
        {!isLast && <span className="my-1 w-0.5 flex-1 bg-border" />}
      </div>

      <Card className="mb-2 flex-1">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="text-xs font-medium text-muted-foreground">Day {day.day}</span>
              {day.goalZh}
            </CardTitle>
            <Badge variant={allDone ? "default" : "secondary"} className="rounded-full">
              {done}/{total}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {day.targetSkillCodes.map((code) => (
              <Badge key={code} variant="outline" className="gap-1 rounded-full text-xs">
                <Target className="size-3" />
                {SKILL_LABELS[code] ?? code}
              </Badge>
            ))}
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {day.tasks.map((task) => (
            <label
              key={task.id}
              htmlFor={task.id}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3 transition-colors hover:bg-accent/40",
                task.completed && "bg-muted/40",
              )}
            >
              <Checkbox
                id={task.id}
                checked={task.completed}
                onCheckedChange={() => onToggleTask(task.id)}
                className="mt-0.5"
              />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span
                  className={cn(
                    "text-sm font-medium",
                    task.completed && "text-muted-foreground line-through",
                  )}
                >
                  {task.titleZh}
                </span>
                <span className="text-xs leading-relaxed text-muted-foreground">
                  {task.descriptionZh}
                </span>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Badge variant="secondary" className="rounded-full text-xs">
                    {PRACTICE_TYPE_META[task.practiceType].labelZh}
                  </Badge>
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
