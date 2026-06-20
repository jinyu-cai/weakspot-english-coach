import { cn } from "@/lib/utils"
import type { CEFRLevel } from "@/lib/types"

const LEVEL_LABELS: Record<CEFRLevel, string> = {
  A1: "Beginner",
  A2: "Elementary",
  B1: "Intermediate",
  B2: "Upper Intermediate",
  C1: "Advanced",
  C2: "Proficient",
}

export function CefrBadge({
  level,
  showLabel = true,
  size = "md",
  className,
}: {
  level: CEFRLevel
  showLabel?: boolean
  size?: "sm" | "md" | "lg"
  className?: string
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/10 text-primary",
        size === "sm" && "px-2.5 py-1",
        size === "md" && "px-3 py-1.5",
        size === "lg" && "px-4 py-2",
        className,
      )}
    >
      <span
        className={cn(
          "font-heading font-bold leading-none tracking-tight",
          size === "sm" && "text-base",
          size === "md" && "text-xl",
          size === "lg" && "text-3xl",
        )}
      >
        {level}
      </span>
      {showLabel && (
        <span className={cn("font-medium leading-none", size === "lg" ? "text-sm" : "text-xs")}>
          {LEVEL_LABELS[level]}
        </span>
      )}
    </div>
  )
}
