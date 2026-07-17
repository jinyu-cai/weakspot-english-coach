"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import useSWR from "swr"
import { toast } from "sonner"
import { ArrowLeft, CheckCircle2, Dumbbell, Lightbulb, RefreshCw, Trophy, XCircle } from "lucide-react"
import { generatePractice, getPlan, gradePracticeAdhoc, updatePlanTask } from "@/lib/api-client"
import { DEMO_USER_ID } from "@/lib/mock-data"
import { practiceTypeLabel, skillLabel as localizedSkillLabel } from "@/lib/practice"
import type {
  LearningPlanDay,
  LearningPlanTask,
  PlanExercise,
  PracticeExercise,
  PracticeGrade,
  PracticeType,
} from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/empty-state"
import { ScoreRing } from "@/components/score-ring"
import { useLanguage } from "@/components/language-provider"

const DEFAULT_SKILL = "grammar.verb_tense"

type RunnerSession = {
  task: LearningPlanTask
  day: LearningPlanDay
  exercises: PlanExercise[]
}

function findPlanTask(plan: { days: LearningPlanDay[] } | null, taskId: string | null) {
  if (!plan || !taskId) return null
  for (const day of plan.days) {
    const task = day.tasks.find((item) => item.id === taskId)
    if (task) return { day, task }
  }
  return null
}

/** One gradeable exercise card: input box + AI grading + reference answer. */
function RunnerCard({
  exercise,
  skillCode,
  practiceType,
  index,
  total,
  onGraded,
  onNext,
  onRegenerate,
  regenerating,
  isLast,
}: {
  exercise: PlanExercise
  skillCode: string
  practiceType: PracticeType
  index: number
  total: number
  onGraded: (grade: PracticeGrade) => void
  onNext: () => void | Promise<void>
  onRegenerate: () => void
  regenerating: boolean
  isLast: boolean
}) {
  const [answer, setAnswer] = useState("")
  const [grade, setGrade] = useState<PracticeGrade | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [advancing, setAdvancing] = useState(false)
  const clientAttemptIdRef = useRef<string | null>(null)
  const { language, t } = useLanguage()

  const skillLabel = localizedSkillLabel(skillCode, language)
  const typeLabel = practiceTypeLabel(practiceType, language)

  async function handleSubmit() {
    if (submitting || grade) return
    setSubmitting(true)
    try {
      const clientAttemptId = clientAttemptIdRef.current ?? crypto.randomUUID()
      clientAttemptIdRef.current = clientAttemptId
      const result = await gradePracticeAdhoc(DEMO_USER_ID, {
        clientAttemptId,
        targetSkillCode: skillCode,
        question: exercise.question,
        expectedAnswer: exercise.answer,
        userAnswer: answer,
        exerciseType: practiceType,
        promptZh: exercise.promptZh,
        explanationZh: exercise.explanationZh,
        activityRunId: exercise.activityRunId ?? undefined,
      })
      setGrade(result)
      onGraded(result)
    } catch {
      toast.error(t.plan.gradeFailed)
    } finally {
      setSubmitting(false)
    }
  }

  const canSubmit = answer.trim().length > 0

  async function handleNext() {
    if (advancing) return
    setAdvancing(true)
    try {
      await onNext()
    } catch {
      toast.error(t.plan.freshFailed)
    } finally {
      setAdvancing(false)
    }
  }

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
              <>
                <Alert>
                  <Lightbulb />
                  <AlertTitle>{t.common.referenceAnswer}</AlertTitle>
                  <AlertDescription>{grade.correctedAnswer}</AlertDescription>
                </Alert>
                <p className="text-xs text-muted-foreground">
                  {t.plan.savedLibrary}
                </p>
              </>
            ) : null}
          </>
        ) : null}
      </CardContent>

      <CardFooter className="flex flex-wrap justify-end gap-2">
        {!grade && (
          <Button variant="outline" onClick={onRegenerate} disabled={submitting || regenerating}>
            {regenerating ? <Spinner data-icon="inline-start" /> : <RefreshCw data-icon="inline-start" />}
            {t.plan.newSameType}
          </Button>
        )}
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
          <Button onClick={handleNext} disabled={advancing}>
            {advancing ? <Spinner data-icon="inline-start" /> : null}
            {isLast ? t.common.finishSession : t.common.nextQuestion}
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}

function PlanPracticeFlow() {
  const searchParams = useSearchParams()
  const taskId = searchParams.get("task")
  const { data, isLoading } = useSWR("plan", () => getPlan())
  const plan = data?.plan ?? null

  const located = findPlanTask(plan, taskId)

  const [session, setSession] = useState<RunnerSession | null>(null)
  const [current, setCurrent] = useState(0)
  const [grades, setGrades] = useState<PracticeGrade[]>([])
  const [phase, setPhase] = useState<"active" | "summary">("active")
  const [regenerating, setRegenerating] = useState(false)
  const [generatingBatch, setGeneratingBatch] = useState(false)
  const { language, t } = useLanguage()

  const seededRef = useRef<string | null>(null)
  const sessionIdRef = useRef<string | null>(null)

  function mapGeneratedExercise(fresh: PracticeExercise): PlanExercise {
    return {
      id: fresh.id,
      promptZh: fresh.promptZh,
      question: fresh.question,
      answer: fresh.answer ?? "",
      explanationZh: fresh.explanationZh ?? "",
      activityRunId: fresh.activityRunId,
    }
  }

  async function seedJustInTimeTask(nextLocated: { day: LearningPlanDay; task: LearningPlanTask }) {
    const sessionId = crypto.randomUUID()
    sessionIdRef.current = sessionId
    setGeneratingBatch(true)
    try {
      await updatePlanTask(nextLocated.task.id, "started")
      const skillCode = nextLocated.day.targetSkillCodes?.[0] ?? DEFAULT_SKILL
      const sessionSize = nextLocated.task.exercises.length || 3
      const fresh = await generatePractice(DEMO_USER_ID, skillCode, nextLocated.task.practiceType, {
        sessionId,
        sequenceIndex: 0,
        previousSkillCodes: [],
        previousPracticeTypes: [],
        parentRunId: nextLocated.task.activityRunId ?? undefined,
        sessionSlot: 0,
        sessionSize,
      })
      setSession({ task: nextLocated.task, day: nextLocated.day, exercises: [mapGeneratedExercise(fresh)] })
    } catch {
      setSession({
        task: nextLocated.task,
        day: nextLocated.day,
        exercises: nextLocated.task.exercises ?? [],
      })
      toast.error(t.plan.freshFailed)
    } finally {
      setGeneratingBatch(false)
    }
  }

  useEffect(() => {
    if (!plan || !taskId || seededRef.current === taskId) return
    const nextLocated = findPlanTask(plan, taskId)
    if (!nextLocated) return

    seededRef.current = taskId
    setSession({ task: nextLocated.task, day: nextLocated.day, exercises: [] })
    setCurrent(0)
    setGrades([])
    setPhase("active")
    void seedJustInTimeTask(nextLocated)
  // seedJustInTimeTask intentionally runs once per task id.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, taskId])

  function handleGraded(grade: PracticeGrade) {
    setGrades((prev) => [...prev, grade])
  }

  async function handleNext() {
    if (!session) return
    const total = session.task.exercises.length || 3
    if (current + 1 >= total) {
      const average = grades.length
        ? Math.round(grades.reduce((sum, item) => sum + item.score, 0) / grades.length)
        : undefined
      await updatePlanTask(session.task.id, "completed", average)
      setPhase("summary")
      return
    }
    const skillCode = session.day.targetSkillCodes?.[0] ?? DEFAULT_SKILL
    const next = await generatePractice(DEMO_USER_ID, skillCode, session.task.practiceType, {
      sessionId: sessionIdRef.current ?? crypto.randomUUID(),
      sequenceIndex: current + 1,
      previousSkillCodes: session.exercises.map((item) => skillCode),
      previousPracticeTypes: session.exercises.map(() => session.task.practiceType),
      parentRunId: session.task.activityRunId ?? undefined,
      sessionSlot: current + 1,
      sessionSize: total,
    })
    setSession((value) => value ? { ...value, exercises: [...value.exercises, mapGeneratedExercise(next)] } : value)
    setCurrent((value) => value + 1)
  }

  async function handleRegenerate() {
    if (!session) return
    const skillCode = session.day.targetSkillCodes?.[0] ?? DEFAULT_SKILL
    setRegenerating(true)
    try {
      const fresh = await generatePractice(DEMO_USER_ID, skillCode, session.task.practiceType, {
        sessionId: sessionIdRef.current ?? crypto.randomUUID(),
        sequenceIndex: current,
        previousSkillCodes: session.exercises.map(() => skillCode),
        previousPracticeTypes: session.exercises.map(() => session.task.practiceType),
        parentRunId: session.task.activityRunId ?? undefined,
        sessionSlot: current,
        sessionSize: session.task.exercises.length || 3,
      })
      const mapped = mapGeneratedExercise(fresh)
      setSession((prev) =>
        prev ? { ...prev, exercises: prev.exercises.map((ex, i) => (i === current ? mapped : ex)) } : prev,
      )
      toast.success(t.plan.freshReady, { description: t.plan.freshDescription })
    } catch {
      toast.error(t.plan.freshFailed)
    } finally {
      setRegenerating(false)
    }
  }

  // Start a new adaptive set; later questions are generated after each grade.
  async function generateNewSet() {
    if (!session) return
    const skillCode = session.day.targetSkillCodes?.[0] ?? DEFAULT_SKILL
    setGeneratingBatch(true)
    try {
      const sessionId = crypto.randomUUID()
      sessionIdRef.current = sessionId
      const fresh = await generatePractice(DEMO_USER_ID, skillCode, session.task.practiceType, {
        sessionId,
        sequenceIndex: 0,
        previousSkillCodes: [],
        previousPracticeTypes: [],
        parentRunId: session.task.activityRunId ?? undefined,
        sessionSlot: 0,
        sessionSize: session.task.exercises.length || 3,
      })
      setSession((prev) => (prev ? { ...prev, exercises: [mapGeneratedExercise(fresh)] } : prev))
      setCurrent(0)
      setGrades([])
      setPhase("active")
      toast.success("New questions ready", {
        description: `1 ${practiceTypeLabel(session.task.practiceType, language)} ${t.plan.sameType}`,
      })
    } catch {
      toast.error(t.plan.newFailed)
    } finally {
      setGeneratingBatch(false)
    }
  }

  const backToPlan = (
    <Button
      nativeButton={false}
      render={<Link href="/plan" />}
      variant="ghost"
      size="sm"
      className="w-fit gap-1 px-2"
    >
      <ArrowLeft className="size-4" />
      {t.plan.backToPlan}
    </Button>
  )

  const notFound = (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      {backToPlan}
      <EmptyState
        icon={Dumbbell}
        title={t.plan.noExercises}
        description={t.plan.noExercisesDescription}
      >
        <Button nativeButton={false} render={<Link href="/plan" />}>
          {t.plan.goToPlan}
        </Button>
      </EmptyState>
    </div>
  )

  if (!session) {
    if (isLoading || located) {
      return (
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
          <Skeleton className="h-8 w-40 rounded-lg" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      )
    }
    return notFound
  }

  const skillCode = session.day.targetSkillCodes?.[0] ?? DEFAULT_SKILL
  const practiceType: PracticeType = session.task.practiceType
  const sourceExercises = session.exercises

  if (sourceExercises.length === 0 && generatingBatch) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        {backToPlan}
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }
  if (sourceExercises.length === 0) return notFound

  if (phase === "summary") {
    const correct = grades.filter((g) => g.isCorrect).length
    const avgScore = grades.length ? Math.round(grades.reduce((sum, g) => sum + g.score, 0) / grades.length) : 0
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        {backToPlan}
        <Card>
          <CardHeader className="items-center text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10">
              <Trophy className="size-7 text-primary" />
            </div>
            <CardTitle className="font-heading text-2xl">{t.plan.taskComplete}</CardTitle>
            <CardDescription>
              {t.plan.workedThrough} {grades.length} {t.plan.gradedAnswers}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-6">
            <ScoreRing score={avgScore} label={t.common.avgScore} />
            <div className="grid w-full grid-cols-2 gap-3">
              <div className="flex flex-col items-center gap-1 rounded-xl border border-border p-4">
                <span className="text-2xl font-bold tabular-nums text-success">{correct}</span>
                <span className="text-xs text-muted-foreground">{t.common.correct}</span>
              </div>
              <div className="flex flex-col items-center gap-1 rounded-xl border border-border p-4">
                <span className="text-2xl font-bold tabular-nums">{Math.max(0, grades.length - correct)}</span>
                <span className="text-xs text-muted-foreground">{t.plan.savedWeakSpots}</span>
              </div>
            </div>
            <div className="flex w-full flex-col gap-2 sm:flex-row">
              <Button className="flex-1" onClick={generateNewSet} disabled={generatingBatch}>
                {generatingBatch ? <Spinner data-icon="inline-start" /> : <RefreshCw data-icon="inline-start" />}
                {generatingBatch ? t.plan.generating : t.plan.generateNew}
              </Button>
              <Button nativeButton={false} render={<Link href="/plan" />} variant="outline" className="flex-1">
                {t.plan.backToPlan}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const exercise = sourceExercises[Math.min(current, sourceExercises.length - 1)]
  const expectedTotal = session.task.exercises.length || 3
  const progress = (current / expectedTotal) * 100

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        {backToPlan}
        <h1 className="font-heading text-2xl font-bold tracking-tight">{session.task.titleZh}</h1>
        <p className="text-sm text-muted-foreground">
          {t.common.day} {session.day.day} · {session.day.goalZh}
        </p>
        <Progress value={progress} className="mt-1 h-2" />
      </div>

      <RunnerCard
        key={`${current}:${exercise.id}:${exercise.question}`}
        exercise={exercise}
        skillCode={skillCode}
        practiceType={practiceType}
        index={current}
        total={expectedTotal}
        onGraded={handleGraded}
        onNext={handleNext}
        onRegenerate={handleRegenerate}
        regenerating={regenerating}
        isLast={current + 1 >= expectedTotal}
      />
    </div>
  )
}

export default function PlanPracticePage() {
  return (
    <Suspense fallback={<div className="mx-auto h-64 w-full max-w-2xl animate-pulse rounded-xl bg-muted" />}>
      <PlanPracticeFlow />
    </Suspense>
  )
}
