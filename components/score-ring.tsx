import { cn } from "@/lib/utils"

function scoreColor(score: number) {
  if (score < 50) return "var(--danger)"
  if (score < 75) return "var(--warning)"
  return "var(--success)"
}

export function ScoreRing({
  score,
  size = 120,
  label = "Score",
}: {
  score: number
  size?: number
  label?: string
}) {
  const stroke = size * 0.09
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(100, score))
  const offset = circumference - (clamped / 100) * circumference
  const color = scoreColor(clamped)

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("font-heading font-bold leading-none", size >= 100 ? "text-3xl" : "text-xl")}>
          {clamped}
        </span>
        <span className="mt-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
      </div>
      <span className="sr-only">{`${label}: ${clamped} out of 100`}</span>
    </div>
  )
}
