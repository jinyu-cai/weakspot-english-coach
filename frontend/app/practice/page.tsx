"use client"

import { Suspense, useState } from "react"
import { useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { Dumbbell, RotateCcw, Target, Trophy } from "lucide-react"
import { generatePractice } from "@/lib/api-client"
import { DEMO_USER_ID } from "@/lib/mock-data"
import { SKILL_LABELS } from "@/lib/practice"
import type { PracticeExercise, PracticeGrade } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { Progress } from "@/components/ui/progress"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { PracticeCard } from "@/components/practice-card"
import { ScoreRing } from "@/components/score-ring"

const SESSION_LENGTH = 4

type Phase = "setup" | "active" | "summary"

function PracticeFlow() {
  const searchParams = useSearchParams()
  const initialSkill = searchParams.get("skill") ?? "all"

  const [phase, setPhase] = useState<Phase>("setup")
  const [skill, setSkill] = useState<string>(initialSkill)
  const [loading, setLoading] = useState(false)
  const [exercises, setExercises] = useState<PracticeExercise[]>([])
  const [current, setCurrent] = useState(0)
  const [grades, setGrades] = useState<PracticeGrade[]>([])

  const skillOptions = ["all", ...Object.keys(SKILL_LABELS)]

  async function startSession() {
    setLoading(true)
    try {
      const target = skill === "all" ? undefined : skill
      const generated = await Promise.all(
        Array.from({ length: SESSION_LENGTH }, () => generatePractice(DEMO_USER_ID, target)),
      )
      setExercises(generated)
      setCurrent(0)
      setGrades([])
      setPhase("active")
    } catch {
      toast.error("Couldn't load exercises. Please try again shortly.")
    } finally {
      setLoading(false)
    }
  }

  function handleGraded(grade: PracticeGrade) {
    setGrades((prev) => [...prev, grade])
  }

  function handleNext() {
    if (current + 1 >= exercises.length) {
      setPhase("summary")
    } else {
      setCurrent((c) => c + 1)
    }
  }

  function reset() {
    setPhase("setup")
    setExercises([])
    setGrades([])
    setCurrent(0)
  }

  if (phase === "active" && exercises[current]) {
    const progress = (current / exercises.length) * 100
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <Target className="size-4 text-primary" />
              {skill === "all" ? "Mixed practice" : SKILL_LABELS[skill]}
            </span>
            <span className="tabular-nums">
              {current + 1} / {exercises.length}
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <PracticeCard
          key={exercises[current].id}
          exercise={exercises[current]}
          index={current}
          total={exercises.length}
          onGraded={handleGraded}
          onNext={handleNext}
          isLast={current + 1 >= exercises.length}
        />
      </div>
    )
  }

  if (phase === "summary") {
    const correct = grades.filter((g) => g.isCorrect).length
    const avgScore = grades.length ? Math.round(grades.reduce((sum, g) => sum + g.score, 0) / grades.length) : 0
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <Card>
          <CardHeader className="items-center text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10">
              <Trophy className="size-7 text-primary" />
            </div>
            <CardTitle className="font-heading text-2xl">Session complete</CardTitle>
            <CardDescription>You completed {exercises.length} targeted exercises.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-6">
            <ScoreRing score={avgScore} label="Avg. score" />
            <div className="grid w-full grid-cols-2 gap-3">
              <div className="flex flex-col items-center gap-1 rounded-xl border border-border p-4">
                <span className="text-2xl font-bold tabular-nums text-success">{correct}</span>
                <span className="text-xs text-muted-foreground">Correct</span>
              </div>
              <div className="flex flex-col items-center gap-1 rounded-xl border border-border p-4">
                <span className="text-2xl font-bold tabular-nums">{exercises.length - correct}</span>
                <span className="text-xs text-muted-foreground">To review</span>
              </div>
            </div>
            <div className="flex w-full flex-col gap-2 sm:flex-row">
              <Button className="flex-1" onClick={startSession} disabled={loading}>
                {loading ? <Spinner data-icon="inline-start" /> : <RotateCcw data-icon="inline-start" />}
                Practice again
              </Button>
              <Button variant="outline" className="flex-1" onClick={reset}>
                Change skill
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // setup
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="font-heading text-3xl font-bold tracking-tight">Practice</h1>
        <p className="text-muted-foreground">Pick a target skill and start {SESSION_LENGTH} targeted exercises.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Dumbbell className="size-5 text-primary" />
            Choose a skill to practice
          </CardTitle>
          <CardDescription>We generate fix-it, fill-in-the-blank, and rewrite tasks based on your weak spots.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <ToggleGroup
            value={[skill]}
            onValueChange={(value) => value[0] && setSkill(value[0])}
            className="flex flex-wrap justify-start gap-2"
          >
            {skillOptions.map((code) => (
              <ToggleGroupItem key={code} value={code} className="rounded-full">
                {code === "all" ? "Mixed practice" : SKILL_LABELS[code]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>

          {skill !== "all" ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="secondary">Selected</Badge>
              <span>{SKILL_LABELS[skill]}</span>
            </div>
          ) : null}

          <Button size="lg" onClick={startSession} disabled={loading}>
            {loading ? (
              <>
                <Spinner data-icon="inline-start" />
                Generating exercises
              </>
            ) : (
              <>
                <Target data-icon="inline-start" />
                Start practice
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

export default function PracticePage() {
  return (
    <Suspense fallback={<div className="mx-auto h-64 w-full max-w-2xl animate-pulse rounded-xl bg-muted" />}>
      <PracticeFlow />
    </Suspense>
  )
}
