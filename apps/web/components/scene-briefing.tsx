"use client"

import { Sparkles } from "lucide-react"
import { useLanguage } from "@/components/language-provider"
import type { ChatSession } from "@/lib/types"
import { cn } from "@/lib/utils"

export type SceneBriefingSession = Pick<
  ChatSession,
  "setting" | "userRole" | "aiRole" | "goal"
>

interface SceneBriefingProps {
  session: SceneBriefingSession
  className?: string
}

export function SceneBriefing({ session, className }: SceneBriefingProps) {
  const { t } = useLanguage()
  const details = [
    [t.chat.sceneBriefing.setting, session.setting?.trim()],
    [t.chat.sceneBriefing.yourRole, session.userRole?.trim()],
    [t.chat.sceneBriefing.aiRole, session.aiRole?.trim()],
    [t.chat.sceneBriefing.goal, session.goal?.trim()],
  ].filter((detail): detail is [string, string] => Boolean(detail[1]))

  if (details.length === 0) return null

  return (
    <section
      aria-label={t.chat.sceneBriefing.title}
      className={cn("rounded-2xl border border-primary/25 bg-primary/5 p-4 sm:p-5", className)}
    >
      <div className="flex items-start gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Sparkles className="size-4" />
        </span>
        <div>
          <h2 className="font-heading text-sm font-semibold">{t.chat.sceneBriefing.title}</h2>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            {t.chat.sceneBriefing.description}
          </p>
        </div>
      </div>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        {details.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-border/70 bg-background/70 px-3.5 py-3">
            <dt className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{label}</dt>
            <dd className="mt-1 text-sm leading-relaxed text-foreground">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
