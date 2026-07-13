"use client"

import Link from "next/link"
import { ArrowRight, Import, Info, MessageCircle, Radio, Sparkles } from "lucide-react"
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
        <section className="overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/12 via-card to-background px-5 py-7 sm:px-8 sm:py-9">
          <div className="max-w-3xl">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/12 px-3 py-1 text-xs font-semibold text-primary">
                <Sparkles className="size-3.5" />
                {t.diagnose.onboarding.eyebrow}
              </span>
              <span className="text-xs text-muted-foreground">{t.diagnose.onboarding.time}</span>
            </div>
            <h1 className="text-balance font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
              {t.diagnose.onboarding.title}
            </h1>
            <p className="mt-3 max-w-2xl text-pretty leading-relaxed text-muted-foreground">
              {t.diagnose.onboarding.description}
            </p>
          </div>

          <ol className="mt-7 grid gap-3 sm:grid-cols-3">
            {t.diagnose.onboarding.steps.map((step, index) => (
              <li
                key={step.title}
                className="flex gap-3 rounded-2xl border border-border/70 bg-background/70 p-4 backdrop-blur-sm"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/12 text-xs font-bold text-primary">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <div className="font-heading text-sm font-semibold">{step.title}</div>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{step.description}</p>
                </div>
              </li>
            ))}
          </ol>
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
