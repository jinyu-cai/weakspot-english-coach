import { cn } from "@/lib/utils"

export function LearningLoop({
  steps,
  activeKey,
  compact = false,
  className,
}: {
  steps: ReadonlyArray<{ key: string; label: string }>
  activeKey?: string
  compact?: boolean
  className?: string
}) {
  return (
    <div
      className={cn("flex flex-wrap items-center gap-1.5", className)}
      aria-label="Learning loop"
    >
      {steps.map((step, index) => {
        const active = activeKey ? step.key === activeKey : index === 0
        return (
          <div key={step.key} className="flex min-w-0 items-center gap-1.5">
            {index > 0 ? (
              <span
                className={cn(
                  "h-px shrink-0 rounded-full bg-border",
                  compact ? "w-2.5" : "w-4",
                )}
                aria-hidden="true"
              />
            ) : null}
            <span
              className={cn(
                "inline-flex min-w-0 items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-semibold tracking-wide",
                active
                  ? "border-primary/25 bg-primary/10 text-primary"
                  : "border-border/70 bg-card/70 text-muted-foreground",
                compact && "px-1.5 py-0.5 text-[10px]",
              )}
            >
              <span
                className={cn(
                  "flex size-4 items-center justify-center rounded-full text-[10px] font-bold tabular-nums",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {index + 1}
              </span>
              <span className="truncate">{step.label}</span>
            </span>
          </div>
        )
      })}
    </div>
  )
}
