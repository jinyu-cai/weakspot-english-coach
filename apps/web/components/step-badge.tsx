import { cn } from "@/lib/utils"

export function StepBadge({
  step,
  label,
  className,
}: {
  step: number | string
  label?: string
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary",
        className,
      )}
    >
      <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground tabular-nums">
        {step}
      </span>
      {label ? <span>{label}</span> : null}
    </span>
  )
}
