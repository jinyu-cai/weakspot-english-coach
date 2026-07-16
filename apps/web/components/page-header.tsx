import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export function PageHeader({
  eyebrow,
  title,
  description,
  meta,
  action,
  className,
}: {
  eyebrow?: ReactNode
  title: ReactNode
  description?: ReactNode
  meta?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <header
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0 max-w-3xl">
        {eyebrow ? (
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-primary">
            {eyebrow}
          </div>
        ) : null}
        <h1 className="text-balance font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
            {description}
          </p>
        ) : null}
        {meta ? <div className="mt-3 flex flex-wrap items-center gap-2">{meta}</div> : null}
      </div>
      {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
    </header>
  )
}
