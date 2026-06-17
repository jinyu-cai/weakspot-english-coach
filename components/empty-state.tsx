import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon
  title: string
  description: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center",
        className,
      )}
    >
      <span className="flex size-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
        <Icon className="size-7" />
      </span>
      <div className="flex max-w-sm flex-col gap-1.5">
        <h3 className="text-lg font-semibold text-balance">{title}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground text-pretty">{description}</p>
      </div>
      {action}
    </div>
  )
}
