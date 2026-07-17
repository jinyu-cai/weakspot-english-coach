"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, Clock3, Compass, Import, Info, MessageCircle, Radio, Sparkles } from "lucide-react"
import { useDiagnose } from "@/components/diagnose-provider"
import { DiagnosticInput } from "@/components/diagnostic-input"
import { DiagnosticReport } from "@/components/diagnostic-report"
import { DiagnosticLoading } from "@/components/loading-state"
import { useLanguage } from "@/components/language-provider"
import { getWelcomeBackMessage } from "@/lib/session-win"

const SHORTCUTS = [
  { key: "chat", href: "/chat", icon: MessageCircle },
  { key: "input", href: "/input", icon: Radio },
  { key: "import", href: "/import", icon: Import },
] as const

export default function DiagnosePage() {
  const { text, setText, diagnosisMode, setDiagnosisMode, loading, result, originalText, isDuplicate, handleAnalyze } =
    useDiagnose()
  const { t } = useLanguage()
  const showOnboarding = !result
  const showShortcuts = !loading && !result
  const [welcomeBack, setWelcomeBack] = useState<string | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => setWelcomeBack(getWelcomeBackMessage(t)), 0)
    return () => window.clearTimeout(timer)
  }, [t])

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-7">
      {showOnboarding && welcomeBack ? (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm leading-relaxed text-foreground">
          {welcomeBack}
        </div>
      ) : null}

      {showOnboarding ? (
        <section className="relative overflow-hidden rounded-3xl border border-primary/25 bg-primary text-primary-foreground shadow-sm">
          <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />
          <div className="relative grid gap-5 px-5 py-6 sm:px-7 sm:py-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="max-w-2xl">
              <div className="mb-2.5 flex flex-wrap items-center gap-2 text-xs font-medium text-primary-foreground/80">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-2.5 py-1">
                  <Compass className="size-3.5" />
                  {t.nav.items.mission[0]}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock3 className="size-3.5" />
                  5–15 {t.common.minutesShort}
                </span>
              </div>
              <h1 className="text-balance font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
                {t.coach.title}
              </h1>
              <p className="mt-2 max-w-xl text-pretty text-sm leading-relaxed text-primary-foreground/80">
                {t.coach.description}
              </p>
            </div>
            <Link
              href="/coach"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary-foreground px-5 py-2.5 text-sm font-semibold text-primary shadow-sm outline-none transition hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-3 focus-visible:ring-white/40"
            >
              <Sparkles className="size-4" />
              {t.coach.setup.arrange}
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </section>
      ) : null}

      {showOnboarding ? (
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-wide text-primary uppercase">
              {t.diagnose.onboarding.eyebrow}
            </p>
            <h2 className="mt-1 font-heading text-xl font-semibold tracking-tight">
              {t.diagnose.onboarding.title}
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {t.diagnose.onboarding.description}
            </p>
          </div>
          <p className="shrink-0 text-xs text-muted-foreground">{t.diagnose.onboarding.time}</p>
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

      {loading && <DiagnosticLoading />}
      {!loading && result && (
        <div className="flex flex-col gap-4">
          {isDuplicate ? (
            <div className="flex items-start gap-2.5 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
              <Info className="mt-0.5 size-4 shrink-0 text-warning" />
              <p className="leading-relaxed text-foreground">{t.diagnose.duplicate}</p>
            </div>
          ) : null}
          <DiagnosticReport result={result} originalText={originalText} />
        </div>
      )}

      {showShortcuts ? (
        <section className="flex flex-col gap-3 border-t border-border/70 pt-6">
          <div>
            <h2 className="font-heading text-lg font-semibold">{t.diagnose.onboarding.otherWays}</h2>
            {t.diagnose.onboarding.otherWaysDescription ? (
              <p className="mt-1 text-sm text-muted-foreground">
                {t.diagnose.onboarding.otherWaysDescription}
              </p>
            ) : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {SHORTCUTS.map(({ key, href, icon: Icon }) => {
              const shortcut = t.diagnose.onboarding.shortcuts[key]
              return (
                <Link
                  key={key}
                  href={href}
                  className="group flex min-w-0 items-start gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2 font-heading text-sm font-semibold">
                      {shortcut.title}
                      <ArrowRight className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                      {shortcut.description}
                    </span>
                  </span>
                </Link>
              )
            })}
          </div>
        </section>
      ) : null}
    </div>
  )
}
