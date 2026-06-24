"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight, Clock, Eye, EyeOff } from "lucide-react"
import { cn } from "@/lib/utils"
import type { LearningPlanDay, PlanExercise } from "@/lib/types"
import { PRACTICE_TYPE_META, SKILL_LABELS } from "@/lib/practice"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

function ExerciseItem({ exercise, index }: { exercise: PlanExercise; index: number }) {
  const [showAnswer, setShowAnswer] = useState(false)

  return (
    <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
      <div className="mb-1 text-xs font-medium text-muted-foreground">
        #{index + 1} · {exercise.promptZh}
      </div>
      <p className="text-sm font-medium">{exercise.question}</p>
      <div className="mt-2 flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-xs"
          onClick={() => setShowAnswer(!showAnswer)}
        >
          {showAnswer ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
          {showAnswer ? "Hide answer" : "Show answer"}
        </Button>
      </div>
      {showAnswer && (
        <div className="mt-2 space-y-1.5 rounded-md border border-primary/20 bg-primary/5 p-2.5">
          <p className="text-sm font-medium text-primary">{exercise.answer}</p>
          <p className="text-xs leading-relaxed text-muted-foreground">{exercise.explanationZh}</p>
        </div>
      )}
    </div>
  )
}

export function LearningPlanCard({
  day,
  onToggleTask,
}: {
  day: LearningPlanDay
  onToggleTask: (taskId: string, completed: boolean) => void
}) {
  const completedCount = day.tasks.filter((t) => t.completed).length
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set())
  const totalMinutes = day.tasks.reduce((sum, t) => sum + t.estimatedMinutes, 0)

  function toggleExpand(taskId: string) {
    setExpandedTasks((prev) => {
      const next = new Set(prev)
      if (next.has(taskId)) next.delete(taskId)
      else next.add(taskId)
      return next
    })
  }

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
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="size-3" />
                {totalMinutes} min
              </span>
              <span className="text-xs text-muted-foreground">
                {completedCount}/{day.tasks.length} done
              </span>
            </div>
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
          {day.tasks.map((task) => {
            const isExpanded = expandedTasks.has(task.id)
            const hasExercises = task.exercises && task.exercises.length > 0

            return (
              <div key={task.id} className="rounded-xl border border-border transition-colors">
                <label className="flex cursor-pointer items-start gap-3 p-3 hover:bg-muted/50">
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
                      {hasExercises && (
                        <span className="text-xs text-muted-foreground">
                          · {task.exercises.length} exercises
                        </span>
                      )}
                    </div>
                  </div>
                  {hasExercises && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-0.5 h-7 w-7 shrink-0 p-0"
                      onClick={(e) => {
                        e.preventDefault()
                        toggleExpand(task.id)
                      }}
                    >
                      {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                    </Button>
                  )}
                </label>
                {isExpanded && hasExercises && (
                  <div className="flex flex-col gap-2 border-t border-border/60 p-3">
                    {task.exercises.map((ex, i) => (
                      <ExerciseItem key={ex.id} exercise={ex} index={i} />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}
