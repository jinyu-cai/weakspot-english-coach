import { cn } from "@/lib/utils"
import type { CEFRLevel } from "@/lib/types"

const LEVEL_LABEL: Record<CEFRLevel, string> = {
  A1: "Beginner",
  A2: "Elementary",
  B1: "Intermediate",
  B2: "Upper Int.",
  C1: "Advanced",
  C2: "Proficient",
}

const SIZE = {
  sm: "h-9 px-3 text-base",
  md: "h-12 px-4 text-xl",
  lg: "h-16 px-6 text-3xl",
}

export function CefrBadge({
  level,
  size = "md",
  showLabel = true,
  className,
}: {
  level: CEFRLevel
  size?: keyof typeof SIZE
  showLabel?: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-2xl bg-primary font-semibold text-primary-foreground",
        SIZE[size],
        className,
      )}
    >
      <span className="font-mono tracking-tight">{level}</span>
      {showLabel && (
        <span className="text-[0.7em] font-medium opacity-90">{LEVEL_LABEL[level]}</span>
      )}
    </div>
  )
}
