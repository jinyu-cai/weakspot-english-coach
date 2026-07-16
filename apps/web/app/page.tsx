"use client"

import Link from "next/link"
import { useRef } from "react"
import {
  ArrowDown,
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
import { cn } from "@/lib/utils"

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
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      {showOnboarding ? (
        <>
          {/* Bold hero — intentionally different from production diagnose page */}
          <section className="relative overflow-hidden rounded-[2rem] bg-[oklch(0.28_0.06_230)] px-5 py-8 text-white shadow-[0_20px_50px_oklch(0.28_0.06_230/0.28)] sm:px-8 sm:py-10">
            <div
              className="pointer-events-none absolute -right-10 -top-16 size-72 rounded-full bg-[oklch(0.78_0.14_70/0.35)] blur-3xl"
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute -bottom-24 left-1/4 size-64 rounded-full bg-[oklch(0.7_0.12_200/0.35)] blur-3xl"
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/20 to-transparent"
              aria-hidden="true"
            />

            <div className="relative grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
              <div className="max-w-2xl">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[oklch(0.82_0.14_75)] px-3 py-1 text-xs font-bold tracking-wide text-stone-900 uppercase">
                    {t.diagnose.spotlight.stepLabel}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/85">
                    <Clock3 className="size-3.5" />
                    {t.diagnose.spotlight.time}
                  </span>
                </div>

                <p className="mb-2 text-sm font-medium text-[oklch(0.88_0.08_85)]">
                  {t.diagnose.spotlight.kicker}
                </p>
                <h1 className="text-balance font-heading text-4xl font-semibold tracking-tight sm:text-5xl">
                  {t.diagnose.spotlight.title}
                </h1>
                <p className="mt-4 max-w-xl text-pretty text-base leading-relaxed text-white/75 sm:text-lg">
                  {t.diagnose.spotlight.description}
                </p>

                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    href="/coach"
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[oklch(0.82_0.14_75)] px-5 py-3 text-sm font-bold text-stone-900 shadow-lg outline-none transition hover:-translate-y-0.5 hover:brightness-105 focus-visible:ring-3 focus-visible:ring-white/40"
                  >
                    <Compass className="size-4" />
                    {t.diagnose.spotlight.recommendCta}
                    <ArrowRight className="size-4" />
                  </Link>
                  <button
                    type="button"
                    onClick={scrollToDiagnose}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/25 bg-white/10 px-5 py-3 text-sm font-semibold text-white outline-none transition hover:bg-white/15 focus-visible:ring-3 focus-visible:ring-white/40"
                  >
                    {t.diagnose.spotlight.paths.diagnose.cta}
                    <ArrowDown className="size-4" />
                  </button>
                </div>
              </div>

              <div className="rounded-3xl border border-white/15 bg-white/10 p-5 backdrop-blur-md">
                <div className="mb-4 flex items-center gap-3">
                  <span className="flex size-14 items-center justify-center rounded-2xl bg-[oklch(0.82_0.14_75)] text-3xl shadow-md">
                    🦉
                  </span>
                  <div>
                    <p className="font-heading text-lg font-semibold">{t.diagnose.spotlight.coachCardTitle}</p>
                    <p className="text-sm text-white/70">{t.diagnose.spotlight.coachCardSubtitle}</p>
                  </div>
                </div>
                <ol className="space-y-3">
                  {t.diagnose.spotlight.howItWorks.map((item, index) => (
                    <li key={item} className="flex items-start gap-3 text-sm leading-relaxed text-white/85">
                      <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-white/15 text-xs font-bold tabular-nums">
                        {index + 1}
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </section>

          {/* Three giant path choices */}
          <section className="flex flex-col gap-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="font-heading text-2xl font-semibold tracking-tight">
                  {t.diagnose.spotlight.chooseTitle}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t.diagnose.spotlight.chooseDescription}
                </p>
              </div>
              <p className="text-xs font-semibold tracking-wide text-primary uppercase">
                {t.diagnose.spotlight.chooseHint}
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <PathChoiceCard
                number="1"
                recommended
                href="/coach"
                icon={Compass}
                title={t.diagnose.spotlight.paths.coach.title}
                description={t.diagnose.spotlight.paths.coach.description}
                cta={t.diagnose.spotlight.paths.coach.cta}
                badge={t.diagnose.spotlight.recommended}
              />
              <PathChoiceCard
                number="2"
                icon={Stethoscope}
                title={t.diagnose.spotlight.paths.diagnose.title}
                description={t.diagnose.spotlight.paths.diagnose.description}
                cta={t.diagnose.spotlight.paths.diagnose.cta}
                onClick={scrollToDiagnose}
              />
              <PathChoiceCard
                number="3"
                href="/chat"
                icon={MessageCircle}
                title={t.diagnose.spotlight.paths.chat.title}
                description={t.diagnose.spotlight.paths.chat.description}
                cta={t.diagnose.spotlight.paths.chat.cta}
              />
            </div>
          </section>

          {/* Visual learning loop strip */}
          <section className="grid gap-3 rounded-[1.5rem] border-2 border-dashed border-primary/25 bg-primary/5 p-4 sm:grid-cols-3 sm:gap-0 sm:p-0 sm:overflow-hidden">
            {[
              { n: "01", label: t.nav.loop.discover, hint: t.diagnose.spotlight.loopHints.discover },
              { n: "02", label: t.nav.loop.practice, hint: t.diagnose.spotlight.loopHints.practice },
              { n: "03", label: t.nav.loop.remember, hint: t.diagnose.spotlight.loopHints.remember },
            ].map((step, index) => (
              <div
                key={step.n}
                className={cn(
                  "flex items-start gap-3 sm:border-r sm:border-primary/15 sm:p-5 last:sm:border-r-0",
                  index === 0 && "sm:bg-primary/10",
                )}
              >
                <span className="font-heading text-2xl font-bold text-primary/70 tabular-nums">{step.n}</span>
                <div>
                  <p className="font-heading text-base font-semibold">{step.label}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{step.hint}</p>
                </div>
              </div>
            ))}
          </section>
        </>
      ) : null}

      <div ref={diagnoseRef} className="scroll-mt-28">
        {showOnboarding ? (
          <div className="mb-4 rounded-2xl border border-border bg-card px-4 py-4 shadow-sm sm:px-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                2
              </span>
              <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                {t.diagnose.onboarding.eyebrow}
              </span>
            </div>
            <h2 className="mt-3 font-heading text-2xl font-semibold tracking-tight">
              {t.diagnose.onboarding.title}
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {t.diagnose.onboarding.description}
            </p>
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
                  className="group flex min-w-0 items-start gap-3 rounded-2xl border-2 border-border bg-card p-4 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-5" />
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

function PathChoiceCard({
  number,
  title,
  description,
  cta,
  icon: Icon,
  href,
  onClick,
  recommended = false,
  badge,
}: {
  number: string
  title: string
  description: string
  cta: string
  icon: typeof Compass
  href?: string
  onClick?: () => void
  recommended?: boolean
  badge?: string
}) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            "flex size-14 items-center justify-center rounded-2xl font-heading text-2xl font-bold tabular-nums",
            recommended
              ? "bg-[oklch(0.82_0.14_75)] text-stone-900"
              : "bg-primary/12 text-primary",
          )}
        >
          {number}
        </span>
        {badge ? (
          <span className="rounded-full bg-[oklch(0.82_0.14_75)] px-2.5 py-1 text-[11px] font-bold text-stone-900">
            {badge}
          </span>
        ) : (
          <span
            className={cn(
              "flex size-11 items-center justify-center rounded-2xl",
              recommended ? "bg-white/15 text-white" : "bg-muted text-muted-foreground",
            )}
          >
            <Icon className="size-5" />
          </span>
        )}
      </div>

      <div className="mt-6 flex-1">
        <h3
          className={cn(
            "font-heading text-xl font-semibold tracking-tight",
            recommended ? "text-white" : "text-foreground",
          )}
        >
          {title}
        </h3>
        <p
          className={cn(
            "mt-2 text-sm leading-relaxed",
            recommended ? "text-white/75" : "text-muted-foreground",
          )}
        >
          {description}
        </p>
      </div>

      <div
        className={cn(
          "mt-6 inline-flex items-center gap-2 text-sm font-bold",
          recommended ? "text-[oklch(0.9_0.1_85)]" : "text-primary",
        )}
      >
        {recommended ? <Sparkles className="size-4" /> : null}
        {cta}
        <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
      </div>
    </>
  )

  const classes = cn(
    "group relative flex min-h-[17rem] flex-col rounded-[1.75rem] border-2 p-6 outline-none transition",
    "focus-visible:ring-3 focus-visible:ring-ring/40",
    recommended
      ? "border-transparent bg-[oklch(0.34_0.08_230)] text-white shadow-[0_16px_40px_oklch(0.34_0.08_230/0.35)] hover:-translate-y-1 hover:shadow-[0_22px_48px_oklch(0.34_0.08_230/0.4)]"
      : "border-border bg-card shadow-sm hover:-translate-y-1 hover:border-primary/35 hover:shadow-lg",
  )

  if (href) {
    return (
      <Link href={href} className={classes}>
        {content}
      </Link>
    )
  }

  return (
    <button type="button" onClick={onClick} className={cn(classes, "w-full text-left")}>
      {content}
    </button>
  )
}
