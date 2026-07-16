"use client"

import Link from "next/link"
import { ArrowRight, Compass, Info, MessageCircle, Target } from "lucide-react"
import { useDiagnose } from "@/components/diagnose-provider"
import { DiagnosticInput } from "@/components/diagnostic-input"
import { DiagnosticReport } from "@/components/diagnostic-report"
import { DiagnosticLoading } from "@/components/loading-state"
import { useLanguage } from "@/components/language-provider"

export default function DiagnosePage() {
  const { text, setText, diagnosisMode, setDiagnosisMode, loading, result, originalText, isDuplicate, handleAnalyze } =
    useDiagnose()
  const { t } = useLanguage()
  const showAside = !loading && !result

  return (
    <div className="mx-auto w-full max-w-6xl">
      {/* Layout shift: writing is the stage; alternatives sit in a side rail */}
      <div className={showAside ? "grid gap-6 lg:grid-cols-[minmax(0,1fr)_16.5rem] lg:items-start" : "flex flex-col gap-6"}>
        <section className="min-w-0">
          {!result ? (
            <header className="mb-5 flex flex-col gap-1">
              <p className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                {t.diagnose.minimal.kicker}
              </p>
              <h1 className="font-heading text-3xl tracking-tight text-foreground sm:text-[2.15rem]">
                {t.diagnose.minimal.title}
              </h1>
              <p className="max-w-xl text-sm text-muted-foreground">{t.diagnose.minimal.subtitle}</p>
            </header>
          ) : null}

          <DiagnosticInput
            value={text}
            onChange={setText}
            onAnalyze={handleAnalyze}
            loading={loading}
            diagnosisMode={diagnosisMode}
            onDiagnosisModeChange={setDiagnosisMode}
          />

          {loading && (
            <div className="mt-6">
              <DiagnosticLoading />
            </div>
          )}

          {!loading && result && (
            <div className="mt-6 flex flex-col gap-4">
              {isDuplicate ? (
                <div className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2.5 text-sm">
                  <Info className="mt-0.5 size-4 shrink-0 text-warning" />
                  <p className="text-foreground">{t.diagnose.duplicate}</p>
                </div>
              ) : null}
              <DiagnosticReport result={result} originalText={originalText} />
            </div>
          )}
        </section>

        {showAside ? (
          <aside className="lg:sticky lg:top-20">
            <div className="rounded-2xl border border-border bg-card/70 p-3 shadow-[var(--shadow-card)]">
              <p className="mb-2 px-1 text-[11px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
                {t.diagnose.minimal.or}
              </p>
              <div className="flex flex-col gap-2">
                <SideLink
                  href="/coach"
                  icon={Compass}
                  title={t.diagnose.minimal.mission}
                  hint={t.diagnose.minimal.missionHint}
                />
                <SideLink
                  href="/chat"
                  icon={MessageCircle}
                  title={t.diagnose.minimal.chat}
                  hint={t.diagnose.minimal.chatHint}
                />
                <SideLink
                  href="/practice"
                  icon={Target}
                  title={t.diagnose.minimal.practice}
                  hint={t.diagnose.minimal.practiceHint}
                />
              </div>
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  )
}

function SideLink({
  href,
  icon: Icon,
  title,
  hint,
}: {
  href: string
  icon: typeof Compass
  title: string
  hint: string
}) {
  return (
    <Link
      href={href}
      className="study-rail-card group flex items-start gap-3 rounded-xl p-3 outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
    >
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-foreground">{title}</span>
          <ArrowRight className="size-3.5 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" />
        </span>
        <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">{hint}</span>
      </span>
    </Link>
  )
}
