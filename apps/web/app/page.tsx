"use client"

import Link from "next/link"
import { ArrowRight, Clock3, Compass, Import, Info, MessageCircle, Radio, Sparkles } from "lucide-react"
import { useDiagnose } from "@/components/diagnose-provider"
import { DiagnosticInput } from "@/components/diagnostic-input"
import { DiagnosticReport } from "@/components/diagnostic-report"
import { DiagnosticLoading } from "@/components/loading-state"
import { useLanguage } from "@/components/language-provider"

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

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
      {showOnboarding ? (
        <section className="relative overflow-hidden rounded-3xl border border-primary/25 bg-primary text-primary-foreground shadow-sm">
          <div className="absolute -top-20 right-[-4rem] size-72 rounded-full bg-white/10 blur-2xl" />
          <div className="relative grid gap-6 px-5 py-7 sm:px-8 sm:py-9 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="max-w-3xl">
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-primary-foreground/80">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-3 py-1">
                  <Compass className="size-3.5" /> {t.nav.items.mission[0]}
                </span>
                <span className="inline-flex items-center gap-1"><Clock3 className="size-3.5" /> 5–15 {t.common.minutesShort}</span>
              </div>
              <h1 className="text-balance font-heading text-3xl font-semibold tracking-tight sm:text-4xl">{t.coach.title}</h1>
              <p className="mt-3 max-w-2xl text-pretty text-sm leading-relaxed text-primary-foreground/80 sm:text-base">{t.coach.description}</p>
            </div>
            <Link
              href="/coach"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary-foreground px-5 py-3 text-sm font-semibold text-primary shadow-sm outline-none transition hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-3 focus-visible:ring-white/40"
            >
              <Sparkles className="size-4" /> {t.coach.setup.arrange} <ArrowRight className="size-4" />
            </Link>
          </div>
        </section>
      ) : null}

      {showOnboarding ? (
        <section className="rounded-2xl border border-border/80 bg-card px-5 py-5 sm:px-6">
          <div className="max-w-3xl">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/12 px-3 py-1 text-xs font-semibold text-primary">
                <Sparkles className="size-3.5" />
                {t.diagnose.onboarding.eyebrow}
              </span>
              <span className="text-xs text-muted-foreground">{t.diagnose.onboarding.time}</span>
            </div>
            <h2 className="text-balance font-heading text-xl font-semibold tracking-tight sm:text-2xl">
              {t.diagnose.onboarding.title}
            </h2>
            <p className="mt-2 max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground">
              {t.diagnose.onboarding.description}
            </p>
          </div>
        </section>
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
        <section className="flex flex-col gap-4 border-t border-border/70 pt-7">
          <div>
            <h2 className="font-heading text-xl font-semibold">{t.diagnose.onboarding.otherWays}</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {t.diagnose.onboarding.otherWaysDescription}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {SHORTCUTS.map(({ key, href, icon: Icon }) => {
              const shortcut = t.diagnose.onboarding.shortcuts[key]
              return (
                <Link
                  key={key}
                  href={href}
                  className="group flex min-w-0 items-start gap-3 rounded-2xl border border-border bg-card p-4 transition hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-4.5" />
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
