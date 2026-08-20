"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  ChevronDown,
  Compass,
  Info,
  PlayCircle,
  Sparkles,
} from "lucide-react"
import { useDiagnose } from "@/components/diagnose-provider"
import { DiagnosticInput } from "@/components/diagnostic-input"
import { DiagnosticReport } from "@/components/diagnostic-report"
import { DiagnosticLoading } from "@/components/loading-state"
import { AsyncErrorState, useLoadingTimeout } from "@/components/async-state"
import { useLanguage } from "@/components/language-provider"
import { getRecentSessionWin, getWelcomeBackMessage } from "@/lib/session-win"
import { getRecentLearningPath, useTaskResume } from "@/lib/task-resume"
import { markFirstAction } from "@/lib/experience"

const VISITED_KEY = "weakspot-has-visited-v1"

export default function DiagnosePage() {
  const {
    text,
    setText,
    diagnosisMode,
    setDiagnosisMode,
    loading,
    error,
    result,
    originalText,
    isDuplicate,
    handleAnalyze,
  } = useDiagnose()
  const { language, t } = useLanguage()
  const resume = useTaskResume()
  const [homeContext, setHomeContext] = useState<{
    hydrated: boolean
    returning: boolean
    welcomeBack: string | null
    recentPath: string
    recentWin: ReturnType<typeof getRecentSessionWin>
  }>({ hydrated: false, returning: false, welcomeBack: null, recentPath: "/coach", recentWin: null })
  const { hydrated, returning, welcomeBack, recentPath, recentWin } = homeContext
  const timedOut = useLoadingTimeout(loading)
  const learningStarted = Boolean(text.trim() || loading || result)
  const zh = language === "zh-CN"

  useEffect(() => {
    const win = getRecentSessionWin()
    const wasReturning = window.localStorage.getItem(VISITED_KEY) === "1" || Boolean(resume) || Boolean(win)
    const nextContext = {
      hydrated: true,
      returning: wasReturning,
      welcomeBack: getWelcomeBackMessage(t),
      recentPath: getRecentLearningPath(),
      recentWin: win,
    }
    const timer = window.setTimeout(() => setHomeContext(nextContext), 0)
    try {
      window.localStorage.setItem(VISITED_KEY, "1")
    } catch {
      // The first-use layout still works when storage is unavailable.
    }
    return () => window.clearTimeout(timer)
  // The first render snapshot is intentional; later task changes hide this
  // panel or arrive through a fresh navigation.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function focusWriting() {
    markFirstAction("diagnose")
    document.getElementById("diagnose-input")?.focus()
  }

  const recentSource = recentWin
    ? ({
        diagnose: zh ? "完成了一次写作诊断" : "Completed a writing diagnosis",
        practice: zh ? "完成了一轮针对练习" : "Completed a focused practice",
        coach: zh ? "完成了一个今日任务" : "Completed a daily mission",
        chat: zh ? "完成了一次对话复盘" : "Completed a conversation review",
      } as const)[recentWin.source]
    : zh ? "学习证据会在这里持续累积" : "Your learning evidence will build here"

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      {!learningStarted && hydrated && !returning ? (
        <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          {/* Masthead */}
          <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3 sm:px-7">
            <p className="label-mono text-primary">{zh ? "首次诊断" : "First session"}</p>
            <p className="label-mono hidden text-muted-foreground sm:block">WeakSpot Journal</p>
          </div>

          {/* Front-page headline */}
          <div className="px-5 py-8 sm:px-7 sm:py-10">
            <h1 className="max-w-2xl text-balance font-heading text-3xl font-semibold leading-[1.18] sm:text-4xl">
              {zh ? (
                <>写下一段英文，让<span className="text-primary">薄弱点</span>自己浮现。</>
              ) : (
                <>Paste your English. <em className="text-primary">Find the weak spot.</em></>
              )}
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              {zh ? "选择一种方式即可开始；所有路径都会更新同一份学习画像。" : "Choose one way to begin. Every path updates the same learning profile."}
            </p>
          </div>

          {/* Three newspaper columns */}
          <div className="grid divide-y divide-border border-t border-border sm:grid-cols-3 sm:divide-x sm:divide-y-0" aria-label={zh ? "开始方式" : "Ways to begin"}>
            <button
              type="button"
              onClick={focusWriting}
              className="group flex items-center gap-4 px-5 py-5 text-left outline-none transition hover:bg-accent/40 focus-visible:bg-accent/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50 sm:px-7"
            >
              <span className="label-mono shrink-0 text-primary">01</span>
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-sm font-semibold">
                  {zh ? "写一段" : "Write something"}
                  <ArrowRight className="size-3.5 text-primary opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{zh ? "立即诊断" : "Diagnose now"}</span>
              </span>
            </button>
            <Link
              href="/chat"
              onClick={() => markFirstAction("chat")}
              className="group flex items-center gap-4 px-5 py-5 outline-none transition hover:bg-accent/40 focus-visible:bg-accent/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50 sm:px-7"
            >
              <span className="label-mono shrink-0 text-primary">02</span>
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-sm font-semibold">
                  {zh ? "开始对话" : "Start a chat"}
                  <ArrowRight className="size-3.5 text-primary opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{zh ? "文字或语音" : "Text or voice"}</span>
              </span>
            </Link>
            <Link
              href="/import"
              onClick={() => markFirstAction("import")}
              className="group flex items-center gap-4 px-5 py-5 outline-none transition hover:bg-accent/40 focus-visible:bg-accent/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50 sm:px-7"
            >
              <span className="label-mono shrink-0 text-primary">03</span>
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-sm font-semibold">
                  {zh ? "导入历史" : "Import history"}
                  <ArrowRight className="size-3.5 text-primary opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{zh ? "利用过去对话" : "Learn from past chats"}</span>
              </span>
            </Link>
          </div>
        </section>
      ) : null}

      {!learningStarted && hydrated && returning ? (
        <section className="flex flex-col gap-5">
          <div className="border-b border-border pb-5">
            <p className="label-mono text-primary">{zh ? "欢迎回来" : "Welcome back"}</p>
            <h1 className="mt-2 font-heading text-2xl font-semibold tracking-tight sm:text-4xl">
              {welcomeBack ?? (zh ? "从上次的位置继续" : "Pick up where you left off")}
            </h1>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <Link
              href={resume?.href ?? recentPath}
              className="group flex min-h-28 flex-col justify-between rounded-lg border border-primary bg-primary p-4 text-primary-foreground shadow-sm outline-none transition hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/40"
            >
              <span className="flex items-center justify-between gap-3 text-sm font-semibold"><span className="flex items-center gap-2"><PlayCircle className="size-4" />{zh ? "继续上次任务" : "Continue last task"}</span><ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" /></span>
              <span className="mt-3 text-sm text-primary-foreground/75">{resume?.title ?? (zh ? "回到最近的学习路径" : "Return to your latest learning path")}</span>
            </Link>
            <Link href="/coach" className="group flex min-h-28 flex-col justify-between rounded-lg border border-border bg-card p-4 outline-none transition hover:-translate-y-0.5 hover:border-foreground/35 hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/40">
              <span className="flex items-center justify-between gap-3 text-sm font-semibold"><span className="flex items-center gap-2"><Compass className="size-4 text-primary" />{zh ? "今日推荐" : "Today’s recommendation"}</span><ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" /></span>
              <span className="mt-3 text-sm text-muted-foreground">{zh ? "让教练根据现有证据安排任务" : "Let your coach choose from your evidence"}</span>
            </Link>
            <Link href="/dashboard" className="group flex min-h-28 flex-col justify-between rounded-lg border border-border bg-card p-4 outline-none transition hover:-translate-y-0.5 hover:border-foreground/35 hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/40">
              <span className="flex items-center justify-between gap-3 text-sm font-semibold"><span className="flex items-center gap-2"><BarChart3 className="size-4 text-primary" />{zh ? "最近进步" : "Recent progress"}</span><ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" /></span>
              <span className="mt-3 text-sm text-muted-foreground">{recentSource}</span>
            </Link>
          </div>
        </section>
      ) : null}

      {!result ? (
        <div className="flex flex-col gap-1.5">
          <p className="label-mono text-primary">{t.diagnose.onboarding.eyebrow}</p>
          <h2 className="font-heading text-xl font-semibold tracking-tight sm:text-2xl">{t.diagnose.onboarding.title}</h2>
        </div>
      ) : null}

      <DiagnosticInput
        value={text}
        onChange={setText}
        onAnalyze={handleAnalyze}
        loading={loading}
        diagnosisMode={diagnosisMode}
        onDiagnosisModeChange={setDiagnosisMode}
      />

      {loading && !timedOut ? <DiagnosticLoading /> : null}
      {loading && timedOut ? (
        <AsyncErrorState feature="diagnose" timedOut />
      ) : null}
      {!loading && error && !result ? (
        <AsyncErrorState feature="diagnose" error={error} onRetry={handleAnalyze} />
      ) : null}
      {!loading && error && result ? (
        <AsyncErrorState feature="diagnose" error={error} onRetry={handleAnalyze} compact />
      ) : null}
      {!loading && result ? (
        <div className="flex flex-col gap-4">
          {isDuplicate ? (
            <div className="flex items-start gap-2.5 rounded-md border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
              <Info className="mt-0.5 size-4 shrink-0 text-warning" />
              <p className="leading-relaxed text-foreground">{t.diagnose.duplicate}</p>
            </div>
          ) : null}
          <DiagnosticReport result={result} originalText={originalText} />
        </div>
      ) : null}

      {!loading && !result ? (
        <details className="group rounded-lg border border-border bg-card p-4">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/40">
            <span className="flex items-center gap-2"><Sparkles className="size-4 text-primary" />{zh ? "展开其他学习方式" : "Explore other learning paths"}</span>
            <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <div className="mt-3 grid gap-2 border-t border-border pt-3 sm:grid-cols-2">
            <Link href="/input" className="flex min-h-11 items-center gap-3 rounded-md border border-border p-3 text-sm outline-none transition hover:border-foreground/35 hover:bg-accent/40 focus-visible:ring-3 focus-visible:ring-ring/40"><BookOpen className="size-4 text-primary" />{t.diagnose.onboarding.shortcuts.input.title}</Link>
            <Link href="/coach" className="flex min-h-11 items-center gap-3 rounded-md border border-border p-3 text-sm outline-none transition hover:border-foreground/35 hover:bg-accent/40 focus-visible:ring-3 focus-visible:ring-ring/40"><Compass className="size-4 text-primary" />{t.nav.items.mission[0]}</Link>
          </div>
        </details>
      ) : null}
    </div>
  )
}
