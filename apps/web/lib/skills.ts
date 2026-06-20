import type { SkillState } from "./types"

/** Returns a CSS variable color based on mastery thresholds. */
export function masteryColor(mastery: number): string {
  if (mastery < 50) return "var(--danger)"
  if (mastery < 75) return "var(--warning)"
  return "var(--success)"
}

export function masteryTextClass(mastery: number): string {
  if (mastery < 50) return "text-danger"
  if (mastery < 75) return "text-warning"
  return "text-success"
}

export function masteryLabel(mastery: number): string {
  if (mastery < 50) return "Needs focus"
  if (mastery < 75) return "Improving"
  return "Fairly strong"
}

export function sortByMasteryAsc(skills: SkillState[]): SkillState[] {
  return [...skills].sort((a, b) => a.mastery - b.mastery)
}
