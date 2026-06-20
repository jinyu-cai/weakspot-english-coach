"use client"

import Link from "next/link"
import useSWR from "swr"
import { ArrowRight, CalendarDays, CheckCircle2, Flame, Sparkles, Target, Trophy } from "lucide-react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { getDailyStats } from "@/lib/api-client"
import { DEMO_USER_ID } from "@/lib/mock-data"
import type { DailyStatsDay } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"

const chartConfig = {
  checkins: {
    label: "Check-ins",
    color: "var(--chart-1)",
  },
  practiceAttempts: {
    label: "Practice",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig

const dayFormatter = new Intl.DateTimeFormat("en-US", { weekday: "short" })

function getBrowserTimezone() {
  if (typeof Intl === "undefined") return "UTC"
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
}

function formatDay(day: DailyStatsDay) {
  const midday = new Date(`${day.date}T12:00:00`)
  return Number.isNaN(midday.getTime()) ? day.date : dayFormatter.format(midday)
}

function toPercent(progress: number, target: number) {
  if (!target) return 0
  return Math.min(100, Math.round((progress / target) * 100))
}

export default function DailyWinsPage() {
  const timezone = getBrowserTimezone()
  const { data, isLoading, error } = useSWR(["daily-stats", timezone], () => getDailyStats(DEMO_USER_ID, timezone, 7))

  const chartData =
    data?.weekly.map((day) => ({
      ...day,
      label: formatDay(day),
    })) ?? []

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      <section className="overflow-hidden rounded-3xl border border-warning/30 bg-gradient-to-br from-warning/20 via-sidebar-accent to-background p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex max-w-2xl flex-col gap-3">
            <Badge className="w-fit bg-warning/20 text-warning-foreground hover:bg-warning/20">
              <Sparkles className="size-3.5" />
              Daily Wins
            </Badge>
            <div className="flex flex-col gap-2">
              <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
                See the small wins that make English feel lighter.
              </h1>
              <p className="text-muted-foreground">
                A warm 7-day view of check-ins, practice, focus time, and streak progress.
              </p>
            </div>
          </div>
          <div className="rounded-2xl border border-warning/30 bg-background/75 px-4 py-3 text-sm shadow-sm backdrop-blur">
            <span className="text-muted-foreground">Timezone</span>
            <div className="font-medium">{data?.timezone ?? timezone}</div>
          </div>
        </div>
      </section>

      {error ? (
        <Card className="border-danger/30">
          <CardHeader>
            <CardTitle>Stats are taking a break</CardTitle>
            <CardDescription>{error instanceof Error ? error.message : "Could not load Daily Wins."}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {isLoading || !data ? (
        <LoadingStats />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              icon={<Flame className="size-5" />}
              label="Current streak"
              value={`${data.summary.streakDays} day${data.summary.streakDays === 1 ? "" : "s"}`}
              note="Learning days in a row"
            />
            <StatTile
              icon={<CalendarDays className="size-5" />}
              label="Active days"
              value={`${data.summary.activeDays}/${data.summary.days}`}
              note="Days with check-in or practice"
            />
            <StatTile
              icon={<Target className="size-5" />}
              label="Focus minutes"
              value={`${data.summary.minutesEstimated}`}
              note="Estimated this week"
            />
            <StatTile
              icon={<Trophy className="size-5" />}
              label="Average score"
              value={data.summary.averageScore ? `${data.summary.averageScore}%` : "New"}
              note="Across practice attempts"
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
            <Card className="border-warning/20">
              <CardHeader>
                <CardTitle>7-day activity</CardTitle>
                <CardDescription>Check-ins and practice attempts by local day.</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-72 w-full">
                  <BarChart data={chartData} margin={{ left: -20, right: 12, top: 12 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="checkins" fill="var(--color-checkins)" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="practiceAttempts" fill="var(--color-practiceAttempts)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card className="border-warning/20 bg-warning/5">
              <CardHeader>
                <CardTitle>Today&apos;s gentle scorecard</CardTitle>
                <CardDescription>{data.today.active ? "You already have a win today." : "A tiny step counts."}</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                <MiniMetric label="Check-ins" value={data.today.checkins} />
                <MiniMetric label="Practice" value={data.today.practiceAttempts} />
                <MiniMetric label="Correct" value={data.today.correctAttempts} />
                <MiniMetric label="Errors found" value={data.today.errorsFound} />
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
            <Card className="border-warning/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Flame className="size-5 text-warning" />
                  Warm streak
                </CardTitle>
                <CardDescription>Consistency beats intensity for this kind of learning.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-5">
                <div className="flex items-end gap-2">
                  <span className="font-heading text-5xl font-bold tabular-nums">{data.summary.streakDays}</span>
                  <span className="pb-2 text-muted-foreground">day streak</span>
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {data.weekly.map((day) => (
                    <div key={day.date} className="flex flex-col items-center gap-2">
                      <div
                        className={
                          day.active
                            ? "size-8 rounded-full bg-warning shadow-sm ring-2 ring-warning/25"
                            : "size-8 rounded-full border border-dashed border-border bg-muted/50"
                        }
                        aria-label={`${formatDay(day)} ${day.active ? "active" : "inactive"}`}
                      />
                      <span className="text-xs text-muted-foreground">{formatDay(day)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-warning/20">
              <CardHeader>
                <CardTitle>Achievement badges</CardTitle>
                <CardDescription>Small visible milestones for a kinder learning loop.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                {data.achievements.map((achievement) => (
                  <div key={achievement.id} className="rounded-2xl border border-border bg-card p-4">
                    <div className="mb-3 flex items-start gap-3">
                      <div
                        className={
                          achievement.unlocked
                            ? "flex size-10 shrink-0 items-center justify-center rounded-2xl bg-warning text-warning-foreground"
                            : "flex size-10 shrink-0 items-center justify-center rounded-2xl bg-muted text-muted-foreground"
                        }
                      >
                        <CheckCircle2 className="size-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium">{achievement.title}</div>
                        <p className="text-sm text-muted-foreground">{achievement.description}</p>
                      </div>
                    </div>
                    <Progress value={toPercent(achievement.progress, achievement.target)} className="h-2" />
                    <div className="mt-2 text-xs text-muted-foreground">
                      {achievement.progress}/{achievement.target}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card className="border-warning/30 bg-gradient-to-r from-warning/15 via-card to-card">
            <CardContent className="flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-1">
                <div className="text-sm font-medium text-warning-foreground">Next best action</div>
                <h2 className="font-heading text-2xl font-bold">{data.nextBestAction.title}</h2>
                <p className="max-w-2xl text-sm text-muted-foreground">{data.nextBestAction.description}</p>
              </div>
              <Button nativeButton={false} render={<Link href={data.nextBestAction.href} />}>
                Continue
                <ArrowRight data-icon="inline-end" />
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

function StatTile({
  icon,
  label,
  value,
  note,
}: {
  icon: React.ReactNode
  label: string
  value: string
  note: string
}) {
  return (
    <Card className="border-warning/20">
      <CardContent className="flex flex-col gap-3 pt-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="flex size-9 items-center justify-center rounded-xl bg-warning/15 text-warning-foreground">
            {icon}
          </span>
          {label}
        </div>
        <div className="font-heading text-3xl font-bold tabular-nums">{value}</div>
        <div className="text-xs text-muted-foreground">{note}</div>
      </CardContent>
    </Card>
  )
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-warning/20 bg-background/70 p-4">
      <div className="font-heading text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  )
}

function LoadingStats() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-36 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-96 rounded-2xl" />
      <Skeleton className="h-72 rounded-2xl" />
    </div>
  )
}
