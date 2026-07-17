"use client"

import { useEffect } from "react"
import Link from "next/link"
import { ArrowRight, PartyPopper, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { markSessionWin, type SessionWinModel } from "@/lib/session-win"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/components/language-provider"

export function SessionWin({
  model,
  className,
  compact = false,
}: {
  model: SessionWinModel
  className?: string
  compact?: boolean
}) {
  const { t } = useLanguage()

  useEffect(() => {
    markSessionWin(model.source)
  }, [model.source])

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-3xl border border-success/25 bg-success/8 shadow-sm",
        compact ? "p-4 sm:p-5" : "p-5 sm:p-6",
        className,
      )}
      aria-label={t.sessionWin.ariaLabel}
    >
      <div
        className="pointer-events-none absolute -right-10 -top-10 size-36 rounded-full bg-success/10 blur-2xl"
        aria-hidden="true"
      />

      <div className="relative flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-success/15 text-success">
            <PartyPopper className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-wide text-success uppercase">
              {t.sessionWin.badge}
            </p>
            <h2 className="mt-1 font-heading text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              {model.title}
            </h2>
          </div>
        </div>

        <ul className="flex flex-col gap-2">
          {model.wins.map((win) => (
            <li
              key={win}
              className="flex items-start gap-2.5 rounded-xl border border-border/70 bg-card/80 px-3 py-2.5 text-sm leading-relaxed text-foreground"
            >
              <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>{win}</span>
            </li>
          ))}
        </ul>

        {model.note ? (
          <p className="text-xs leading-relaxed text-muted-foreground">{model.note}</p>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            className="min-h-11 flex-1 sm:flex-none"
            nativeButton={false}
            render={<Link href={model.nextHref} />}
          >
            {model.nextLabel}
            <ArrowRight data-icon="inline-end" />
          </Button>
          {model.secondaryHref && model.secondaryLabel ? (
            <Button
              variant="outline"
              className="min-h-11 flex-1 sm:flex-none"
              nativeButton={false}
              render={<Link href={model.secondaryHref} />}
            >
              {model.secondaryLabel}
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  )
}
