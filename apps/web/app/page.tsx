"use client"

import Link from "next/link"
import { ArrowRight, Compass, Import, Info, MessageCircle, Radio, Sparkles } from "lucide-react"
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
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      {showOnboarding ? (
        <section className="flex flex-col gap-3 rounded-2xl border border-primary/20 bg-primary px-5 py-5 text-primary-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-primary-foreground/80">
              <Compass className="size-3.5" />
              {t.nav.items.mission[0]}
            </div>
            <h1 className="font-heading text-xl font-semibold tracking-tight sm:text-2xl">
              {t.coach.title}
            </h1>
          </div>
          <Link
            href="/coach"
            className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary-foreground px-4 py-2 text-sm font-semibold text-primary outline-none transition hover:opacity-95 focus-visible:ring-3 focus-visible:ring-white/40"
          >
            <Sparkles className="size-4" />
            {t.coach.setup.arrange}
            <ArrowRight className="size-4" />
          </Link>
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
        <section className="flex flex-col gap-3 border-t border-border/70 pt-5">
          <h2 className="text-sm font-medium text-muted-foreground">{t.diagnose.onboarding.otherWays}</h2>
          <div className="grid gap-2 sm:grid-cols-3">
            {SHORTCUTS.map(({ key, href, icon: Icon }) => {
              const shortcut = t.diagnose.onboarding.shortcuts[key]
              return (
                <Link
                  key={key}
                  href={href}
                  className="group flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 text-sm font-medium transition hover:border-primary/30 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{shortcut.title}</span>
                  <ArrowRight className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </Link>
              )
            })}
          </div>
        </section>
      ) : null}
    </div>
  )
}
