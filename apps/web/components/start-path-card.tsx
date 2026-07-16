import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import { ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"

export function StartPathCard({
  step,
  href,
  icon: Icon,
  title,
  description,
  cta,
  featured = false,
  onClick,
  className,
}: {
  step: number | string
  href?: string
  icon: LucideIcon
  title: string
  description: string
  cta?: string
  featured?: boolean
  onClick?: () => void
  className?: string
}) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-2xl text-sm font-bold tabular-nums",
            featured
              ? "bg-primary-foreground/15 text-primary-foreground"
              : "bg-primary/12 text-primary",
          )}
        >
          {step}
        </span>
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-2xl",
            featured
              ? "bg-primary-foreground/12 text-primary-foreground"
              : "bg-secondary text-secondary-foreground",
          )}
        >
          <Icon className="size-5" />
        </span>
      </div>

      <div className="mt-5 min-w-0 flex-1">
        <h3
          className={cn(
            "font-heading text-lg font-semibold tracking-tight",
            featured ? "text-primary-foreground" : "text-foreground",
          )}
        >
          {title}
        </h3>
        <p
          className={cn(
            "mt-2 text-sm leading-relaxed",
            featured ? "text-primary-foreground/80" : "text-muted-foreground",
          )}
        >
          {description}
        </p>
      </div>

      {cta ? (
        <div
          className={cn(
            "mt-5 inline-flex items-center gap-1.5 text-sm font-semibold",
            featured ? "text-primary-foreground" : "text-primary",
          )}
        >
          {cta}
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        </div>
      ) : null}
    </>
  )

  const classes = cn(
    "group relative flex min-h-[11.5rem] flex-col rounded-3xl border p-5 outline-none transition",
    "focus-visible:ring-3 focus-visible:ring-ring/40",
    featured
      ? "border-primary/30 bg-primary text-primary-foreground shadow-[var(--shadow-featured)] hover:-translate-y-0.5 hover:shadow-lg"
      : "border-border/80 bg-card shadow-[var(--shadow-card)] hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md",
    className,
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
