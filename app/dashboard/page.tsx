"use client"

import useSWR from "swr"
import Link from "next/link"
import { GraduationCap, PenLine, Dumbbell, ArrowRight, AlertCircle } from "lucide-react"
import { AppShell } from "@/components/app-shell"
import { SkillBarChart } from "@/components/skill-bar-chart"
import { WeaknessRadar } from "@/components/weakness-radar"
import { CardsLoading } from "@/components/loading-state"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { getProfile } from "@/lib/api-client"
import { masteryColorClass } from "@/lib/severity"
import { SEVERITY_META } from "@/lib/severity"
import { cn } from "@/lib/utils"
import type { ProfileResponse } from "@/lib/types"

export default function DashboardPage() {
  const { data, isLoading } = useSWR<ProfileResponse>("profile", () => getProfile())

  return (
    <AppShell>
      <div className="flex flex-col gap-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">你的学习画像与薄弱点模型，随着每次提交不断进化。</p>
        </header>

        {/* Stat cards */}
        {isLoading || !data ? (
          <CardsLoading count={3} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              icon={<GraduationCap className="size-5" />}
              label="Estimated level"
              value={data.profile.estimatedLevel}
            />
            <StatCard
              icon={<PenLine className="size-5" />}
              label="Total submissions"
              value={String(data.profile.totalSubmissions)}
            />
            <StatCard
              icon={<Dumbbell className="size-5" />}
              label="Practice attempts"
              value={String(data.profile.totalPracticeAttempts)}
            />
          </div>
        )}

        {/* Charts */}
        {isLoading || !data ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <Skeleton className="h-[420px] rounded-2xl" />
            <Skeleton className="h-[420px] rounded-2xl" />
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            <SkillBarChart skills={data.skills} />
            <WeaknessRadar skills={data.skills} />
          </div>
        )}

        {/* Weakest skills + recent mistakes */}
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">最薄弱技能 Weakest skills</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              {isLoading || !data
                ? [0, 1, 2].map((i) => <Skeleton key={i} className="h-14 w-full" />)
                : [...data.skills]
                    .sort((a, b) => a.mastery - b.mastery)
                    .slice(0, 4)
                    .map((skill) => (
                      <div key={skill.skillCode} className="flex flex-col gap-2">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">{skill.zhLabel}</span>
                            <span className="text-xs text-muted-foreground">
                              {skill.label} · 错误 {skill.errorCount} / 正确 {skill.correctCount}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span
                              className={cn(
                                "text-sm font-semibold tabular-nums",
                                masteryColorClass(skill.mastery),
                              )}
                            >
                              {skill.mastery}%
                            </span>
                            <Button
                              size="sm"
                              variant="outline"
                              nativeButton={false}
                              render={<Link href={`/practice?skill=${skill.skillCode}`} />}
                            >
                              Practice this
                            </Button>
                          </div>
                        </div>
                        <Progress value={skill.mastery} />
                      </div>
                    ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">最近的错误 Recent mistakes</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {isLoading || !data
                ? [0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)
                : data.recentErrors.slice(0, 5).map((err) => {
                    const sev = SEVERITY_META[err.severity]
                    return (
                      <div
                        key={err.id}
                        className="flex items-start gap-3 rounded-xl border border-border p-3"
                      >
                        <AlertCircle className={cn("mt-0.5 size-4 shrink-0", masteryColorClass(0))} />
                        <div className="flex min-w-0 flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className={cn("rounded-full text-xs", sev.badgeClass)}
                            >
                              {err.category}
                            </Badge>
                          </div>
                          <p className="truncate text-sm text-muted-foreground">
                            <span className="text-destructive line-through">{err.originalText}</span>
                          </p>
                        </div>
                      </div>
                    )
                  })}
              <Button
                variant="ghost"
                size="sm"
                nativeButton={false}
                className="mt-1 w-fit gap-1.5 px-2 text-primary"
                render={<Link href="/history" />}
              >
                查看全部历史
                <ArrowRight data-icon="inline-end" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  )
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 pt-6">
        <span className="flex size-11 items-center justify-center rounded-xl bg-accent text-accent-foreground">
          {icon}
        </span>
        <div className="flex flex-col">
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
          <span className="text-2xl font-bold tabular-nums">{value}</span>
        </div>
      </CardContent>
    </Card>
  )
}
