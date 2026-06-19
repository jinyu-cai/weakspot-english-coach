"use client"

import { Suspense, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Dumbbell, Sparkles } from "lucide-react"
import { AppShell } from "@/components/app-shell"
import { PracticeCard } from "@/components/practice-card"
import { EmptyState } from "@/components/empty-state"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { generatePractice, submitPractice } from "@/lib/api-client"
import { SKILL_LABELS } from "@/lib/labels"
import type { PracticeExercise, PracticeGrade } from "@/lib/types"

function PracticeContent() {
  const searchParams = useSearchParams()
  const initialSkill = searchParams.get("skill") ?? "auto"

  const [skill, setSkill] = useState(initialSkill)
  const [exercise, setExercise] = useState<PracticeExercise | null>(null)
  const [answer, setAnswer] = useState("")
  const [grade, setGrade] = useState<PracticeGrade | null>(null)
  const [generating, setGenerating] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleGenerate() {
    setGenerating(true)
    setGrade(null)
    setAnswer("")
    setExercise(null)
    try {
      const res = await generatePractice(skill === "auto" ? undefined : skill)
      setExercise(res.exercise)
    } finally {
      setGenerating(false)
    }
  }

  async function handleSubmit() {
    if (!exercise) return
    setSubmitting(true)
    try {
      const res = await submitPractice(exercise.id, answer)
      setGrade(res.grade)
    } finally {
      setSubmitting(false)
    }
  }

  function handleNext() {
    handleGenerate()
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Practice</h1>
        <p className="text-muted-foreground">针对你的薄弱技能生成练习，立即获得批改与反馈。</p>
      </header>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="skill-select" className="text-xs font-medium text-muted-foreground">
            目标技能 Target skill
          </label>
          <Select value={skill} onValueChange={(v) => setSkill(v ?? "auto")}>
            <SelectTrigger id="skill-select" className="w-56">
              <SelectValue>
                {(value) =>
                  value === "auto"
                    ? "自动选择最薄弱项"
                    : SKILL_LABELS[value as string] ?? "选择技能"
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="auto">自动选择最薄弱项</SelectItem>
                {Object.entries(SKILL_LABELS).map(([code, label]) => (
                  <SelectItem key={code} value={code}>
                    {label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleGenerate} disabled={generating}>
          {generating ? (
            <>
              <Spinner data-icon="inline-start" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles data-icon="inline-start" />
              Generate Practice
            </>
          )}
        </Button>
      </div>

      {exercise ? (
        <PracticeCard
          exercise={exercise}
          answer={answer}
          onAnswerChange={setAnswer}
          onSubmit={handleSubmit}
          submitting={submitting}
          grade={grade}
          onNext={handleNext}
        />
      ) : (
        !generating && (
          <EmptyState
            icon={Dumbbell}
            title="开始一次针对性练习"
            description="选择一个目标技能（或让系统自动挑选你最薄弱的一项），生成专属练习题。"
          />
        )
      )}
    </div>
  )
}

export default function PracticePage() {
  return (
    <AppShell>
      <Suspense fallback={<div className="h-40" />}>
        <PracticeContent />
      </Suspense>
    </AppShell>
  )
}
