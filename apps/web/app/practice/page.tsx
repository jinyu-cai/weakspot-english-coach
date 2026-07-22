"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Dumbbell, ListTree, RotateCcw, Sparkles, Target, Trophy } from "lucide-react"
import { generatePractice, getNextActionDecision } from "@/lib/api-client"
import { DEMO_USER_ID } from "@/lib/mock-data"
import { SKILL_LABELS, skillLabel as localizedSkillLabel } from "@/lib/practice"
import type { PracticeExercise, PracticeGrade } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { Progress } from "@/components/ui/progress"
import { PracticeCard } from "@/components/practice-card"
import { ScoreRing } from "@/components/score-ring"
import { SessionWin } from "@/components/session-win"
import { AsyncErrorState, useLoadingTimeout } from "@/components/async-state"
import { sessionWinFromPractice } from "@/lib/session-win"
import { useLanguage } from "@/components/language-provider"
import {
  finishTaskResume,
  loadTaskResume,
  startTaskResume,
  updateTaskResume,
} from "@/lib/task-resume"
import { cn } from "@/lib/utils"
import { useNextExercise } from "@/lib/use-next-exercise"

const SESSION_LENGTH = 4

type Phase = "setup" | "active" | "summary"
type PracticeChoice = "recommended" | "mixed" | "custom"

interface PracticeSnapshot {
  phase: Phase
  choice: PracticeChoice
  skill: string
  exercises: PracticeExercise[]
  current: number
  grades: PracticeGrade[]
  answers: Record<number, string>
  sessionId: string | null
}

function restoredPractice(): PracticeSnapshot | null {
  const resume = loadTaskResume()
  if (resume?.feature !== "practice" || !resume.draft || typeof resume.draft !== "object") return null
  const value = resume.draft as Partial<PracticeSnapshot>
  if (!Array.isArray(value.exercises) || !Array.isArray(value.grades)) return null
  return {
    phase: value.phase === "active" ? "active" : "setup",
    choice: value.choice === "custom" || value.choice === "mixed" ? value.choice : "recommended",
    skill: typeof value.skill === "string" ? value.skill : "all",
    exercises: value.exercises,
    current: typeof value.current === "number" ? value.current : 0,
    grades: value.grades,
    answers: value.answers && typeof value.answers === "object" ? value.answers : {},
    sessionId: typeof value.sessionId === "string" ? value.sessionId : null,
  }
}

const SKILL_GROUPS = [
  { key: "grammar", codes: Object.keys(SKILL_LABELS).filter((code) => code.startsWith("grammar.")) },
  { key: "vocabulary", codes: Object.keys(SKILL_LABELS).filter((code) => code.startsWith("vocab.")) },
  { key: "expression", codes: Object.keys(SKILL_LABELS).filter((code) => code.startsWith("sentence.") || code.startsWith("style.") || code.startsWith("clarity.")) },
  { key: "discourse", codes: Object.keys(SKILL_LABELS).filter((code) => code.startsWith("discourse.")) },
] as const

function PracticeFlow() {
  const searchParams = useSearchParams()
  const querySkill = searchParams.get("skill")
  const [phase, setPhase] = useState<Phase>("setup")
  const [choice, setChoice] = useState<PracticeChoice>(querySkill ? "custom" : "recommended")
  const [skill, setSkill] = useState(querySkill ?? "all")
  const [loading, setLoading] = useState(false)
  const [actionError, setActionError] = useState<unknown>(null)
  const [retryAction, setRetryAction] = useState<(() => Promise<boolean>) | null>(null)
  const [exercises, setExercises] = useState<PracticeExercise[]>([])
  const [current, setCurrent] = useState(0)
  const [grades, setGrades] = useState<PracticeGrade[]>([])
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const startInFlight = useRef(false)
  const advanceInFlight = useRef(false)
  const sessionIdRef = useRef<string | null>(null)
  const {
    status: nextStatus,
    prepare: prepareNext,
    take: takeNext,
    reset: resetNext,
  } = useNextExercise<PracticeExercise>()
  const { language, t } = useLanguage()
  const timedOut = useLoadingTimeout(loading)
  const zh = language === "zh-CN"

  useEffect(() => {
    const restored = restoredPractice()
    if (!restored) return
    const timer = window.setTimeout(() => {
      setPhase(restored.phase)
      setChoice(restored.choice)
      setSkill(restored.skill)
      setExercises(restored.exercises)
      setCurrent(restored.current)
      setGrades(restored.grades)
      setAnswers(restored.answers)
      sessionIdRef.current = restored.sessionId
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (phase !== "active" || exercises.length === 0 || !sessionIdRef.current) return
    const snapshot: PracticeSnapshot = {
      phase,
      choice,
      skill,
      exercises,
      current,
      grades,
      answers,
      sessionId: sessionIdRef.current,
    }
    updateTaskResume(
      { step: `question-${current + 1}`, draft: snapshot },
      { feature: "practice", taskId: sessionIdRef.current },
    )
  }, [answers, choice, current, exercises, grades, phase, skill])

  useEffect(() => {
    if (phase !== "active" || !grades[current] || current + 1 >= SESSION_LENGTH) return
    const nextIndex = current + 1
    const target = choice === "custom" && skill !== "all" ? skill : undefined
    prepareNext(nextIndex, () => generatePractice(DEMO_USER_ID, target, undefined, {
      sessionId: sessionIdRef.current ?? crypto.randomUUID(),
      sequenceIndex: nextIndex,
      previousSkillCodes: exercises.map((item) => item.targetSkillCode),
      previousPracticeTypes: exercises.map((item) => item.type),
      sessionSlot: nextIndex,
      sessionSize: SESSION_LENGTH,
    }))
  }, [choice, current, exercises, grades, phase, prepareNext, skill])

  async function resolveTarget() {
    if (choice === "custom") return skill === "all" ? undefined : skill
    if (choice === "mixed") return undefined
    try {
      return (await getNextActionDecision()).targetSkillCode
    } catch {
      return undefined
    }
  }

  async function startSession() {
    if (startInFlight.current) return false
    startInFlight.current = true
    setLoading(true)
    setActionError(null)
    try {
      const target = await resolveTarget()
      const sessionId = crypto.randomUUID()
      sessionIdRef.current = sessionId
      resetNext()
      const first = await generatePractice(DEMO_USER_ID, target, undefined, {
        sessionId,
        sequenceIndex: 0,
        previousSkillCodes: [],
        previousPracticeTypes: [],
        sessionSlot: 0,
        sessionSize: SESSION_LENGTH,
      })
      setExercises([first])
      setCurrent(0)
      setGrades([])
      setAnswers({})
      setPhase("active")
      const title = choice === "recommended"
        ? (zh ? "系统推荐练习" : "Recommended practice")
        : choice === "mixed"
          ? t.practice.mixed
          : localizedSkillLabel(skill, language)
      startTaskResume({
        feature: "practice",
        href: skill !== "all" ? `/practice?skill=${encodeURIComponent(skill)}` : "/practice",
        taskId: sessionId,
        title,
        step: "question-1",
        draft: {
          phase: "active",
          choice,
          skill,
          exercises: [first],
          current: 0,
          grades: [],
          answers: {},
          sessionId,
        } satisfies PracticeSnapshot,
      })
      return true
    } catch (error) {
      setActionError(error)
      setRetryAction(() => startSession)
      return false
    } finally {
      startInFlight.current = false
      setLoading(false)
    }
  }

  function handleGraded(grade: PracticeGrade) {
    setGrades((previous) => [...previous, grade])
  }

  async function handleNext() {
    if (advanceInFlight.current) return false
    if (current + 1 >= SESSION_LENGTH) {
      setPhase("summary")
      finishTaskResume("practice", "completed")
      return true
    }
    advanceInFlight.current = true
    setLoading(true)
    setActionError(null)
    try {
      const nextIndex = current + 1
      const target = choice === "custom" && skill !== "all" ? skill : undefined
      const next = await takeNext(nextIndex, () => generatePractice(DEMO_USER_ID, target, undefined, {
        sessionId: sessionIdRef.current ?? crypto.randomUUID(),
        sequenceIndex: nextIndex,
        previousSkillCodes: exercises.map((item) => item.targetSkillCode),
        previousPracticeTypes: exercises.map((item) => item.type),
        sessionSlot: nextIndex,
        sessionSize: SESSION_LENGTH,
      }))
      setExercises((items) => [...items, next])
      setCurrent((value) => value + 1)
      return true
    } catch (error) {
      setActionError(error)
      setRetryAction(() => handleNext)
      return false
    } finally {
      advanceInFlight.current = false
      setLoading(false)
    }
  }

  function reset() {
    setPhase("setup")
    setExercises([])
    setGrades([])
    setAnswers({})
    setCurrent(0)
    setActionError(null)
    sessionIdRef.current = null
    resetNext()
  }

  const asyncMessage = actionError ? (
    <AsyncErrorState feature="practice" error={actionError} onRetry={retryAction ?? startSession} />
  ) : loading && timedOut ? (
    <AsyncErrorState feature="practice" timedOut onRetry={retryAction ?? startSession} />
  ) : null

  if (phase === "active" && exercises[current]) {
    const progress = (Math.min(grades.length, SESSION_LENGTH) / SESSION_LENGTH) * 100
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span className="flex items-center gap-2"><Target className="size-4 text-primary" />{choice === "custom" ? localizedSkillLabel(skill, language) : choice === "recommended" ? (zh ? "系统推荐" : "Recommended") : t.practice.mixed}</span>
            <span className="tabular-nums">{current + 1} / {SESSION_LENGTH}</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
        <PracticeCard
          key={`${current}:${exercises[current].id}`}
          exercise={exercises[current]}
          index={current}
          total={SESSION_LENGTH}
          onGraded={handleGraded}
          onNext={async () => { await handleNext() }}
          isLast={current + 1 >= SESSION_LENGTH}
          answer={answers[current] ?? ""}
          onAnswerChange={(answer) => setAnswers((previous) => ({ ...previous, [current]: answer }))}
          initialGrade={grades[current] ?? null}
          nextStatus={nextStatus}
        />
        {asyncMessage}
      </div>
    )
  }

  if (phase === "summary") {
    const correct = grades.filter((grade) => grade.isCorrect).length
    const average = grades.length ? Math.round(grades.reduce((sum, grade) => sum + grade.score, 0) / grades.length) : 0
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <SessionWin model={sessionWinFromPractice(grades, exercises, t, language)} />
        <Card>
          <CardHeader className="items-center text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10"><Trophy className="size-7 text-primary" /></div>
            <CardTitle className="font-heading text-2xl">{t.practice.complete}</CardTitle>
            <CardDescription>{t.practice.completeDescription.replace("4", String(exercises.length))}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-6">
            <ScoreRing score={average} label={t.common.avgScore} />
            <div className="grid w-full grid-cols-2 gap-3">
              <div className="flex flex-col items-center gap-1 rounded-xl border border-border p-4"><span className="text-2xl font-bold tabular-nums text-success">{correct}</span><span className="text-xs text-muted-foreground">{t.common.correct}</span></div>
              <div className="flex flex-col items-center gap-1 rounded-xl border border-border p-4"><span className="text-2xl font-bold tabular-nums">{exercises.length - correct}</span><span className="text-xs text-muted-foreground">{t.practice.toReview}</span></div>
            </div>
            <div className="flex w-full flex-col gap-2 sm:flex-row">
              <Button className="flex-1" onClick={() => void startSession()} disabled={loading}>{loading ? <Spinner data-icon="inline-start" /> : <RotateCcw data-icon="inline-start" />}{t.practice.again}</Button>
              <Button variant="outline" className="flex-1" onClick={reset}>{t.practice.changeSkill}</Button>
            </div>
          </CardContent>
        </Card>
        {asyncMessage}
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="font-heading text-3xl font-bold tracking-tight">{t.practice.title}</h1>
        <p className="text-muted-foreground">{t.practice.description.replace("4", String(SESSION_LENGTH))}</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label={t.practice.choose}>
        <PracticeChoiceCard selected={choice === "recommended"} onClick={() => setChoice("recommended")} icon={Sparkles} title={zh ? "系统推荐" : "Recommended"} description={zh ? "根据你的学习证据自动选择" : "Chosen from your learning evidence"} />
        <PracticeChoiceCard selected={choice === "mixed"} onClick={() => setChoice("mixed")} icon={Dumbbell} title={t.practice.mixed} description={zh ? "在多项能力之间交替练习" : "Rotate across several skills"} />
        <PracticeChoiceCard selected={choice === "custom"} onClick={() => setChoice("custom")} icon={ListTree} title={zh ? "自己选择" : "Choose a skill"} description={zh ? "打开分组技能清单" : "Open the grouped skill list"} />
      </div>

      {choice === "custom" ? (
        <Card>
          <CardHeader><CardTitle className="text-lg">{t.practice.choose}</CardTitle><CardDescription>{zh ? "技能按语法、词汇、表达和语篇分组。" : "Skills are grouped by grammar, vocabulary, expression, and discourse."}</CardDescription></CardHeader>
          <CardContent className="flex flex-col gap-6">
            {SKILL_GROUPS.map((group) => (
              <fieldset key={group.key} className="flex flex-col gap-2">
                <legend className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {{ grammar: zh ? "语法" : "Grammar", vocabulary: zh ? "词汇" : "Vocabulary", expression: zh ? "表达" : "Expression", discourse: zh ? "语篇" : "Discourse" }[group.key]}
                </legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {group.codes.map((code) => (
                    <button
                      key={code}
                      type="button"
                      role="radio"
                      aria-checked={skill === code}
                      onClick={() => setSkill(code)}
                      className={cn("min-h-12 rounded-xl border px-3 py-2.5 text-left outline-none transition focus-visible:ring-3 focus-visible:ring-ring/40", skill === code ? "border-primary/45 bg-primary/10" : "border-border hover:border-primary/30")}
                    >
                      <span className="block text-sm font-medium">{localizedSkillLabel(code, language)}</span>
                      {code === "grammar.sentence_structure" ? <span className="mt-0.5 block text-xs text-muted-foreground">{zh ? "从句、连接与语法组织" : "Clauses, connections, and grammatical organization"}</span> : null}
                      {code === "sentence.structure" ? <span className="mt-0.5 block text-xs text-muted-foreground">{zh ? "完整句、残句与连写句" : "Complete sentences, fragments, and run-ons"}</span> : null}
                    </button>
                  ))}
                </div>
              </fieldset>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">{choice === "recommended" ? (zh ? "系统会从最值得练的目标开始" : "We’ll start with the highest-value target") : choice === "mixed" ? (zh ? "本轮会混合多个目标" : "This session will mix several targets") : localizedSkillLabel(skill, language)}</p>
            <p className="mt-1 text-sm text-muted-foreground">{zh ? "诊断、评分和学习证据结构保持完整。" : "Diagnosis, scoring, and learning evidence remain complete."}</p>
          </div>
          <Button size="lg" onClick={() => void startSession()} disabled={loading || (choice === "custom" && skill === "all")}>
            {loading ? <Spinner data-icon="inline-start" /> : <Target data-icon="inline-start" />}
            {loading ? t.practice.generating : t.practice.start}
          </Button>
        </CardContent>
      </Card>
      {asyncMessage}
    </div>
  )
}

function PracticeChoiceCard({ selected, onClick, icon: Icon, title, description }: { selected: boolean; onClick: () => void; icon: typeof Sparkles; title: string; description: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cn("flex min-h-28 flex-col items-start rounded-2xl border p-4 text-left outline-none transition hover:-translate-y-0.5 hover:shadow-sm focus-visible:ring-3 focus-visible:ring-ring/40", selected ? "border-primary/45 bg-primary/10 ring-1 ring-primary/15" : "border-border bg-card")}
    >
      <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="size-4" /></span>
      <span className="mt-3 text-sm font-semibold">{title}</span>
      <span className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</span>
    </button>
  )
}

export default function PracticePage() {
  return (
    <Suspense fallback={<div className="mx-auto h-64 w-full max-w-3xl animate-pulse rounded-xl bg-muted" />}>
      <PracticeFlow />
    </Suspense>
  )
}
