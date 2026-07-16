"use client"

import Link from "next/link"
import { ArrowUpRight, Info } from "lucide-react"
import { useDiagnose } from "@/components/diagnose-provider"
import { DiagnosticInput } from "@/components/diagnostic-input"
import { DiagnosticReport } from "@/components/diagnostic-report"
import { DiagnosticLoading } from "@/components/loading-state"
import { useLanguage } from "@/components/language-provider"

export default function DiagnosePage() {
  const { text, setText, diagnosisMode, setDiagnosisMode, loading, result, originalText, isDuplicate, handleAnalyze } =
    useDiagnose()
  const { t } = useLanguage()
  const showLinks = !loading && !result

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      {!result ? (
        <section className="hermes-stage rounded-2xl px-5 py-6 sm:px-7 sm:py-8">
          <div className="relative flex flex-col gap-5">
            <div className="flex items-center gap-2">
              <span className="hermes-mark">W</span>
              <span className="text-[11px] font-medium tracking-[0.16em] text-hermes uppercase">
                {t.diagnose.minimal.kicker}
              </span>
            </div>

            <div className="max-w-xl">
              <h1 className="font-heading text-[2.15rem] leading-[1.15] tracking-tight text-foreground sm:text-[2.6rem]">
                {t.diagnose.minimal.title}
              </h1>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
                {t.diagnose.minimal.subtitle}
              </p>
            </div>
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
            <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2.5 text-sm">
              <Info className="mt-0.5 size-4 shrink-0 text-warning" />
              <p className="text-foreground">{t.diagnose.duplicate}</p>
            </div>
          ) : null}
          <DiagnosticReport result={result} originalText={originalText} />
        </div>
      )}

      {showLinks ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs text-muted-foreground">{t.diagnose.minimal.or}</span>
          {[
            { href: "/coach", label: t.diagnose.minimal.mission },
            { href: "/chat", label: t.diagnose.minimal.chat },
            { href: "/practice", label: t.diagnose.minimal.practice },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="inline-flex items-center gap-1 rounded-full border border-hermes/20 bg-hermes/5 px-3 py-1.5 text-xs font-medium text-hermes transition hover:border-hermes/40 hover:bg-hermes/10"
            >
              {item.label}
              <ArrowUpRight className="size-3.5" />
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  )
}
