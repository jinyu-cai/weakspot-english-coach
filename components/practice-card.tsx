"use client"

import { CheckCircle2, XCircle, TrendingUp, TrendingDown, ArrowRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"
import { PRACTICE_TYPE_META, SKILL_LABELS } from "@/lib/labels"
import type { PracticeExercise, PracticeGrade } from "@/lib/types"

export function PracticeCard({
  exercise,
  answer,
  onAnswerChange,
  onSubmit,
  submitting,
  grade,
  onNext,
}: {
  exercise: PracticeExercise
  answer: string
  onAnswerChange: (value: string) => void
  onSubmit: () => void
  submitting: boolean
  grade: PracticeGrade | null
  onNext: () => void
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="rounded-full">
            {PRACTICE_TYPE_META[exercise.type].labelZh}
          </Badge>
          <Badge variant="outline" className="rounded-full">
            {SKILL_LABELS[exercise.targetSkillCode] ?? exercise.targetSkillCode}
          </Badge>
        </div>
        <CardTitle className="pt-2 text-base font-medium text-muted-foreground">
          {exercise.promptZh}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="rounded-xl bg-muted/50 p-4 font-mono text-base leading-relaxed">
          {exercise.question}
        </p>

        <Textarea
          value={answer}
          onChange={(e) => onAnswerChange(e.target.value)}
          placeholder="Type your answer in English..."
          className="min-h-28 resize-y text-base"
          disabled={submitting || !!grade}
        />

        {!grade ? (
          <Button onClick={onSubmit} disabled={submitting || answer.trim().length < 2} className="w-fit">
            {submitting ? (
              <>
                <Spinner data-icon="inline-start" />
                Grading...
              </>
            ) : (
              "Submit Answer"
            )}
          </Button>
        ) : (
          <GradeResult grade={grade} onNext={onNext} />
        )}
      </CardContent>
    </Card>
  )
}

function GradeResult({ grade, onNext }: { grade: PracticeGrade; onNext: () => void }) {
  const positive = grade.skillMasteryDelta >= 0
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-accent/30 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <Badge
          className={cn(
            "gap-1.5 rounded-full border-transparent text-sm",
            grade.isCorrect
              ? "bg-success/15 text-success"
              : "bg-destructive/10 text-destructive",
          )}
        >
          {grade.isCorrect ? (
            <CheckCircle2 className="size-4" />
          ) : (
            <XCircle className="size-4" />
          )}
          {grade.isCorrect ? "正确" : "再接再厉"}
        </Badge>
        <span className="text-sm font-semibold tabular-nums">得分 {grade.score}</span>
        <span
          className={cn(
            "flex items-center gap-1 text-sm font-medium",
            positive ? "text-success" : "text-destructive",
          )}
        >
          {positive ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
          掌握度 {positive ? "+" : ""}
          {grade.skillMasteryDelta}
        </span>
      </div>

      <p className="text-sm leading-relaxed">{grade.feedbackZh}</p>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">参考答案</span>
        <p className="rounded-lg bg-background p-3 font-mono text-sm text-success">
          {grade.correctedAnswer}
        </p>
      </div>

      <Button onClick={onNext} variant="outline" className="w-fit">
        Next exercise
        <ArrowRight data-icon="inline-end" />
      </Button>
    </div>
  )
}
