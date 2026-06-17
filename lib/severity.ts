import type { Severity } from "@/lib/types"

export const SEVERITY_META: Record<
  Severity,
  { labelZh: string; badgeClass: string; dotClass: string }
> = {
  high: {
    labelZh: "高",
    badgeClass: "border-transparent bg-destructive/10 text-destructive",
    dotClass: "bg-destructive",
  },
  medium: {
    labelZh: "中",
    badgeClass: "border-transparent bg-warning/15 text-warning",
    dotClass: "bg-warning",
  },
  low: {
    labelZh: "低",
    badgeClass: "border-transparent bg-success/15 text-success",
    dotClass: "bg-success",
  },
}

export function masteryColorClass(mastery: number) {
  if (mastery < 50) return "text-destructive"
  if (mastery < 75) return "text-warning"
  return "text-success"
}

export function masteryFill(mastery: number) {
  if (mastery < 50) return "var(--destructive)"
  if (mastery < 75) return "var(--warning)"
  return "var(--success)"
}
