"use client"

import { useState } from "react"
import type { PracticeExercise, PracticeGrade } from "@/lib/types"
import { submitPractice } from "@/lib/api-client"
import { PRACTICE_TYPE_META, SKILL_LABELS } from "@/lib/practice"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"
import { CheckCircle2, XCircle, Lightbulb } from "lucide-react"

type Props = {
  exercise: PracticeExercise
  index: number
  total: number
  onGraded: (grade: PracticeGrade) => void
  onNext: () => void
  isLast: boolean
}

export function PracticeCard({ exercise, index, total, onGraded, onNext, isLast }: Props) {
  const [answer, setAnswer] = useState("")
  const [grade, setGrade] = useState<PracticeGrade | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const typeMeta = PRACTICE_TYPE_META[exercise.type]
  const skillLabel = SKILL_LABELS[exercise.targetSkillCode] ?? exercise.targetSkillCode

  async function handleSubmit() {
    if (submitting || grade) return
    setSubmitting(true)
    try {
      const result = await submitPractice(exercise.userId, exercise.id, answer)
      setGrade(result)
      onGraded(result)
    } finally {
      setSubmitting(false)
    }
  }

  function handleNext() {
    setAnswer("")
    setGrade(null)
    onNext()
  }

  const canSubmit = answer.trim().length > 0

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{typeMeta.zhLabel}</Badge>
            <Badge variant="outline">{skillLabel}</Badge>
          </div>
          <span className="text-sm text-muted-foreground tabular-nums">
            {index + 1} / {total}
          </span>
        </div>
        <CardTitle className="text-pretty text-base leading-relaxed">{exercise.promptZh}</CardTitle>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <p className="rounded-xl border border-border bg-muted/50 px-4 py-3 text-pretty font-mono text-sm leading-relaxed">
          {exercise.question}
        </p>

        <Textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          disabled={!!grade || submitting}
          placeholder="在此输入你的答案……"
          className="min-h-28 resize-none"
        />

        {grade ? (
          <>
            <Separator />
            <Alert variant={grade.isCorrect ? "default" : "destructive"}>
              {grade.isCorrect ? <CheckCircle2 /> : <XCircle />}
              <AlertTitle className="flex items-center gap-2">
                {grade.isCorrect ? "回答正确" : "还需改进"}
                <Badge variant="outline" className="tabular-nums">
                  {grade.score} 分
                </Badge>
              </AlertTitle>
              <AlertDescription>{grade.feedbackZh}</AlertDescription>
            </Alert>
            {!grade.isCorrect ? (
              <Alert>
                <Lightbulb />
                <AlertTitle>参考答案</AlertTitle>
                <AlertDescription>{grade.correctedAnswer}</AlertDescription>
              </Alert>
            ) : null}
          </>
        ) : null}
      </CardContent>

      <CardFooter className="justify-end gap-2">
        {!grade ? (
          <Button onClick={handleSubmit} disabled={!canSubmit || submitting}>
            {submitting ? (
              <>
                <Spinner data-icon="inline-start" />
                批改中
              </>
            ) : (
              "提交答案"
            )}
          </Button>
        ) : (
          <Button onClick={handleNext}>{isLast ? "完成本轮练习" : "下一题"}</Button>
        )}
      </CardFooter>
    </Card>
  )
}
