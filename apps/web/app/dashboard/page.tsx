"use client"

import useSWR from "swr"
import Link from "next/link"
import { GraduationCap, FileText, Dumbbell, ArrowRight, TrendingDown, ShieldQuestion, Sparkles } from "lucide-react"
import { getLearningOverview, getProfile } from "@/lib/api-client"
import { masteryColor, masteryTextClass, sortByMasteryAsc } from "@/lib/skills"
import { skillLabel as localizedSkillLabel } from "@/lib/practice"
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
import { useLanguage } from "@/components/language-provider"

export default function DashboardPage() {
  const { data, isLoading } = useSWR("profile", () => getProfile())
  const { data: learning, isLoading: learningLoading } = useSWR("learning-overview", getLearningOverview)
  const { language, t } = useLanguage()

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="font-heading text-3xl font-bold tracking-tight">{t.dashboard.title}</h1>
        <p className="text-muted-foreground">{t.dashboard.description}</p>
      </header>

      {/* Stat cards */}
      {isLoading || !data ? (
        <CardsLoading count={3} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            icon={<GraduationCap className="size-5 text-primary" />}
            title={t.dashboard.estimatedLevel}
            value={<CefrBadge level={data.profile.estimatedLevel as CEFRLevel} size="md" />}
          />
          <StatCard
            icon={<FileText className="size-5 text-primary" />}
            title={t.dashboard.totalSubmissions}
            value={<span className="font-heading text-3xl font-bold">{data.profile.totalSubmissions}</span>}
          />
          <StatCard
            icon={<Dumbbell className="size-5 text-primary" />}
            title={t.dashboard.practiceAttempts}
            value={<span className="font-heading text-3xl font-bold">{data.profile.totalPracticeAttempts}</span>}
          />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldQuestion className="size-5 text-primary" />
            {t.dashboard.evidenceModel}
          </CardTitle>
          <CardDescription>{t.dashboard.evidenceModelDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          {learningLoading || !learning ? (
            <Skeleton className="h-72 w-full rounded-xl" />
          ) : (() => {
            const enough = learning.states.filter((state) => state.coverageStatus === "enough_evidence").length
            const unassessed = learning.states.filter((state) => state.coverageStatus === "unassessed").length
            const independent = learning.states.reduce((sum, state) => sum + state.independentSuccessCount, 0)
            const assisted = learning.states.reduce((sum, state) => sum + state.hintedSuccessCount, 0)
            const delayed = learning.states.reduce((sum, state) => sum + state.delayedIndependentTransferCount, 0)
            const assistanceRate = independent + assisted ? Math.round((assisted / (independent + assisted)) * 100) : 0
            return (
              <div className="flex flex-col gap-5">
                <div className="grid gap-3 sm:grid-cols-4">
                  <EvidenceMetric label={t.dashboard.coverageEnough} value={`${enough}/${learning.states.length}`} />
                  <EvidenceMetric label={t.dashboard.unassessed} value={String(unassessed)} />
                  <EvidenceMetric label={t.dashboard.assistanceRate} value={`${assistanceRate}%`} />
                  <EvidenceMetric label={t.dashboard.delayedTransfer} value={String(delayed)} />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {learning.states.map((state) => (
                    <div key={state.skillCode} className="rounded-xl border border-border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium">{localizedSkillLabel(state.skillCode, language)}</span>
                        <Badge variant={state.coverageStatus === "enough_evidence" ? "secondary" : "outline"}>
                          {state.coverageStatus === "unassessed"
                            ? t.dashboard.unassessed
                            : state.coverageStatus === "exploring"
                              ? t.dashboard.exploring
                              : t.dashboard.enoughEvidence}
                        </Badge>
                      </div>
                      <div className="mt-2 flex items-center gap-3">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${state.abilityMean ?? 0}%` }} />
                        </div>
                        <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">
                          {state.abilityMean == null ? "—" : `${Math.round(state.abilityMean)}%`}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {state.opportunityCount} {t.dashboard.opportunities} · {state.hintedSuccessCount} {t.dashboard.assisted}
                      </p>
                    </div>
                  ))}
                </div>
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Sparkles className="size-3.5" /> {t.dashboard.noEvidenceRule}
                </p>
              </div>
            )
          })()}
        </CardContent>
      </Card>

      {/* Weakness chart */}
      <Card>
        <CardHeader>
          <CardTitle>{t.dashboard.weaknessModel}</CardTitle>
          <CardDescription>{t.dashboard.modelDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading || !data ? (
            <Skeleton className="h-72 w-full rounded-xl" />
          ) : (
            <Tabs defaultValue="bar">
              <TabsList>
                <TabsTrigger value="bar">{t.dashboard.bar}</TabsTrigger>
                <TabsTrigger value="radar">{t.dashboard.radar}</TabsTrigger>
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
              {t.dashboard.weakestSkills}
            </CardTitle>
            <CardDescription>{t.dashboard.sorted}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {!data
              ? null
              : sortByMasteryAsc(data.skills)
                  .map((skill) => (
                    <div key={skill.skillCode} className="flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{localizedSkillLabel(skill.skillCode, language)}</span>
                          <span className="text-xs text-muted-foreground">
                            {skill.errorCount} {t.dashboard.errors} · {skill.correctCount} {t.common.correct.toLowerCase()}
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
                            {t.common.practice}
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
            <CardTitle className="text-base">{t.dashboard.recentMistakes}</CardTitle>
            <CardDescription>{t.dashboard.latest}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {!data
              ? null
              : data.recentErrors.map((err) => (
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

function EvidenceMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-primary/15 bg-primary/5 p-3">
      <div className="font-heading text-2xl font-bold tabular-nums">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </div>
  )
}
