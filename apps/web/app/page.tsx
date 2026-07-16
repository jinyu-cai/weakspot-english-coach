"use client"

import Link from "next/link"
import { useRef } from "react"
import {
  ArrowRight,
  Clock3,
  Compass,
  Import,
  Info,
  MessageCircle,
  Radio,
  Sparkles,
  Stethoscope,
} from "lucide-react"
import { useDiagnose } from "@/components/diagnose-provider"
import { DiagnosticInput } from "@/components/diagnostic-input"
import { DiagnosticReport } from "@/components/diagnostic-report"
import { DiagnosticLoading } from "@/components/loading-state"
import { useLanguage } from "@/components/language-provider"
import { LearningLoop } from "@/components/learning-loop"
import { StartPathCard } from "@/components/start-path-card"
import { StepBadge } from "@/components/step-badge"

const SHORTCUTS = [
  { key: "chat", href: "/chat", icon: MessageCircle },
  { key: "input", href: "/input", icon: Radio },
  { key: "import", href: "/import", icon: Import },
] as const

export default function DiagnosePage() {
  const { text, setText, diagnosisMode, setDiagnosisMode, loading, result, originalText, isDuplicate, handleAnalyze } =
    useDiagnose()
  const { t } = useLanguage()
  const diagnoseRef = useRef<HTMLDivElement>(null)
  const showOnboarding = !result
  const showShortcuts = !loading && !result

  function scrollToDiagnose() {
    diagnoseRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    window.setTimeout(() => {
      document.getElementById("diagnose-input")?.focus()
    }, 350)
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
      {showOnboarding ? (
        <section className="study-surface relative overflow-hidden rounded-[1.75rem] border border-border/80 p-5 shadow-[var(--shadow-card)] sm:p-7">
          <div
            className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-primary/10 blur-3xl"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute -bottom-20 left-10 size-56 rounded-full bg-chart-3/15 blur-3xl"
            aria-hidden="true"
          />

          <div className="relative flex flex-col gap-6">
            <div className="flex flex-wrap items-center gap-2">
              <StepBadge step="01" label={t.diagnose.spotlight.stepLabel} />
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-card/80 px-3 py-1 text-xs text-muted-foreground">
                <Clock3 className="size-3.5" />
                {t.diagnose.spotlight.time}
              </span>
            </div>

            <div className="max-w-3xl">
              <h1 className="text-balance font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
                {t.diagnose.spotlight.title}
              </h1>
              <p className="mt-3 max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
                {t.diagnose.spotlight.description}
              </p>
            </div>

            <LearningLoop
              activeKey="discover"
              steps={[
                { key: "discover", label: t.nav.loop.discover },
                { key: "practice", label: t.nav.loop.practice },
                { key: "remember", label: t.nav.loop.remember },
              ]}
            />

            <div className="grid gap-3 md:grid-cols-3">
              <StartPathCard
                step="A"
                href="/coach"
                icon={Compass}
                title={t.diagnose.spotlight.paths.coach.title}
                description={t.diagnose.spotlight.paths.coach.description}
                cta={t.diagnose.spotlight.paths.coach.cta}
                featured
              />
              <StartPathCard
                step="B"
                icon={Stethoscope}
                title={t.diagnose.spotlight.paths.diagnose.title}
                description={t.diagnose.spotlight.paths.diagnose.description}
                cta={t.diagnose.spotlight.paths.diagnose.cta}
                onClick={scrollToDiagnose}
              />
              <StartPathCard
                step="C"
                href="/chat"
                icon={MessageCircle}
                title={t.diagnose.spotlight.paths.chat.title}
                description={t.diagnose.spotlight.paths.chat.description}
                cta={t.diagnose.spotlight.paths.chat.cta}
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3">
              <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <Sparkles className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">{t.diagnose.spotlight.recommendTitle}</p>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {t.diagnose.spotlight.recommendDescription}
                </p>
              </div>
              <Link
                href="/coach"
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm outline-none transition hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/40"
              >
                {t.diagnose.spotlight.recommendCta}
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      <div ref={diagnoseRef} className="scroll-mt-24">
        {showOnboarding ? (
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="mb-2">
                <StepBadge step="B" label={t.diagnose.onboarding.eyebrow} />
              </div>
              <h2 className="font-heading text-xl font-semibold tracking-tight sm:text-2xl">
                {t.diagnose.onboarding.title}
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                {t.diagnose.onboarding.description}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">{t.diagnose.onboarding.time}</p>
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
      </div>

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
