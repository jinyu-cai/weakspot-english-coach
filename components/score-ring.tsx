import { cn } from "@/lib/utils"

function scoreColor(score: number) {
  if (score < 50) return "text-destructive"
  if (score < 75) return "text-warning"
  return "text-success"
}

function strokeColor(score: number) {
  if (score < 50) return "var(--destructive)"
  if (score < 75) return "var(--warning)"
  return "var(--success)"
}

export function ScoreRing({
  score,
  size = 120,
  strokeWidth = 10,
  label = "Overall",
  className,
}: {
  score: number
  size?: number
  strokeWidth?: number
  label?: string
  className?: string
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (Math.min(100, Math.max(0, score)) / 100) * circumference

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${label} score ${score} out of 100`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={strokeColor(score)}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("text-3xl font-bold tabular-nums", scoreColor(score))}>{score}</span>
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
    </div>
  )
}
