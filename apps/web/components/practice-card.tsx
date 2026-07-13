"use client"

import { useRef, useState } from "react"
import { toast } from "sonner"
import type { PracticeExercise, PracticeGrade } from "@/lib/types"
import { submitPractice } from "@/lib/api-client"
import { practiceTypeLabel, skillLabel as localizedSkillLabel } from "@/lib/practice"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { CheckCircle2, XCircle, Lightbulb } from "lucide-react"
import { useLanguage } from "@/components/language-provider"

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
  const clientAttemptIdRef = useRef<string | null>(null)
  const { language, t } = useLanguage()

  const typeLabel = practiceTypeLabel(exercise.type, language)
  const skillLabel = localizedSkillLabel(exercise.targetSkillCode, language)

  async function handleSubmit() {
    if (submitting || grade) return
    setSubmitting(true)
    try {
      const clientAttemptId = clientAttemptIdRef.current ?? crypto.randomUUID()
      clientAttemptIdRef.current = clientAttemptId
      const result = await submitPractice(exercise.userId, exercise.id, answer, clientAttemptId)
      setGrade(result)
      onGraded(result)
    } catch {
      toast.error(t.plan.gradeFailed)
    } finally {
      setSubmitting(false)
    }
  }

  function handleNext() {
    setAnswer("")
    setGrade(null)
    clientAttemptIdRef.current = null
    onNext()
  }

  const canSubmit = answer.trim().length > 0

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{typeLabel}</Badge>
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
          onChange={(e) => {
            setAnswer(e.target.value)
            clientAttemptIdRef.current = null
          }}
          disabled={!!grade || submitting}
          placeholder={t.common.typeAnswer}
          className="min-h-28 resize-none"
        />

        {grade ? (
          <>
            <Separator />
            <Alert variant={grade.isCorrect ? "default" : "destructive"}>
              {grade.isCorrect ? <CheckCircle2 /> : <XCircle />}
              <AlertTitle className="flex items-center gap-2">
                {grade.isCorrect ? t.common.correct : t.common.needsImprovement}
                <Badge variant="outline" className="tabular-nums">
                  {grade.score} {t.common.points}
                </Badge>
              </AlertTitle>
              <AlertDescription>{grade.feedbackZh}</AlertDescription>
            </Alert>
            {!grade.isCorrect ? (
              <Alert>
                <Lightbulb />
                <AlertTitle>{t.common.referenceAnswer}</AlertTitle>
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
                {t.common.grading}
              </>
            ) : (
              t.common.submitAnswer
            )}
          </Button>
        ) : (
          <Button onClick={handleNext}>{isLast ? t.common.finishSession : t.common.nextQuestion}</Button>
        )}
      </CardFooter>
    </Card>
  )
}
