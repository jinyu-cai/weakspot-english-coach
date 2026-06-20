"use client"

import useSWR from "swr"
import Link from "next/link"
import { GraduationCap, FileText, Dumbbell, ArrowRight, TrendingDown } from "lucide-react"
import { getProfile } from "@/lib/api-client"
import { masteryColor, masteryLabel, masteryTextClass, sortByMasteryAsc } from "@/lib/skills"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { CardsLoading } from "@/components/loading-state"
import { Skeleton } from "@/components/ui/skeleton"
import { CefrBadge } from "@/components/cefr-badge"
import { SkillBarChart } from "@/components/skill-bar-chart"
import { WeaknessRadar } from "@/components/weakness-radar"
import type { CEFRLevel } from "@/lib/types"

export default function DashboardPage() {
  const { data, isLoading } = useSWR("profile", () => getProfile())

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="font-heading text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Your evolving weakness model, built from real mistakes.</p>
      </header>

      {/* Stat cards */}
      {isLoading || !data ? (
        <CardsLoading count={3} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            icon={<GraduationCap className="size-5 text-primary" />}
            title="Estimated level"
            value={<CefrBadge level={data.profile.estimatedLevel as CEFRLevel} size="md" />}
          />
          <StatCard
            icon={<FileText className="size-5 text-primary" />}
            title="Total submissions"
            value={<span className="font-heading text-3xl font-bold">{data.profile.totalSubmissions}</span>}
          />
          <StatCard
            icon={<Dumbbell className="size-5 text-primary" />}
            title="Practice attempts"
            value={<span className="font-heading text-3xl font-bold">{data.profile.totalPracticeAttempts}</span>}
          />
        </div>
      )}

      {/* Weakness chart */}
      <Card>
        <CardHeader>
          <CardTitle>Weakness model</CardTitle>
          <CardDescription>{"Ranked by skill mastery. Red < 50, amber < 75, green is fairly strong."}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading || !data ? (
            <Skeleton className="h-72 w-full rounded-xl" />
          ) : (
            <Tabs defaultValue="bar">
              <TabsList>
                <TabsTrigger value="bar">Bar</TabsTrigger>
                <TabsTrigger value="radar">Radar</TabsTrigger>
              </TabsList>
              <TabsContent value="bar">
                <SkillBarChart skills={data.skills} />
              </TabsContent>
              <TabsContent value="radar">
                <WeaknessRadar skills={data.skills} />
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Weakest skills */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingDown className="size-5 text-danger" />
              Weakest skills
            </CardTitle>
            <CardDescription>Sorted by lowest mastery first.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {!data
              ? null
              : sortByMasteryAsc(data.skills)
                  .slice(0, 5)
                  .map((skill) => (
                    <div key={skill.skillCode} className="flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{skill.zhLabel}</span>
                          <span className="text-xs text-muted-foreground">
                            {skill.errorCount} errors · {skill.correctCount} correct
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-sm font-semibold ${masteryTextClass(skill.mastery)}`}>
                            {skill.mastery}%
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            nativeButton={false}
                            render={<Link href={`/practice?skill=${skill.skillCode}`} />}
                          >
                            Practice
                            <ArrowRight data-icon="inline-end" />
                          </Button>
                        </div>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={skill.mastery} aria-valuemin={0} aria-valuemax={100}>
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${skill.mastery}%`, backgroundColor: masteryColor(skill.mastery) }}
                        />
                      </div>
                    </div>
                  ))}
          </CardContent>
        </Card>

        {/* Recent mistakes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent mistakes</CardTitle>
            <CardDescription>Your latest corrected errors.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {!data
              ? null
              : data.recentErrors.slice(0, 5).map((err) => (
                  <div key={err.id} className="flex flex-col gap-1 rounded-xl border border-border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="secondary">{err.category}</Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-mono text-danger line-through decoration-danger/50">{err.originalText}</span>
                      <span className="font-mono font-medium text-success">{err.correctedText}</span>
                    </div>
                  </div>
                ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function StatCard({ icon, title, value }: { icon: React.ReactNode; title: string; value: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10">{icon}</span>
          {title}
        </div>
        <div className="flex items-center">{value}</div>
      </CardContent>
    </Card>
  )
}
