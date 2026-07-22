"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import useSWR, { mutate } from "swr"
import { toast } from "sonner"
import {
  Archive,
  BrainCircuit,
  CheckCircle2,
  Crosshair,
  Flag,
  Lightbulb,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Search,
  Sparkles,
  Target,
  Trash2,
} from "lucide-react"

import {
  createMemory,
  forgetMemory,
  getMemories,
  getMemoryTraces,
  getNextActionDecision,
  retrieveMemories,
  updateMemory,
} from "@/lib/api-client"
import type { MemoryItem, MemoryKind, MemoryPack } from "@/lib/types"
import { useLanguage } from "@/components/language-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { AsyncErrorState, useLoadingTimeout } from "@/components/async-state"


const KIND_ICONS = {
  preference: Sparkles,
  goal: Target,
  strategy: Lightbulb,
  weakness: Crosshair,
  episode: Flag,
} as const

const KIND_STYLES = {
  preference: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  goal: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  strategy: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  weakness: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  episode: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
} as const


export default function MemoryPage() {
  const { language, t } = useLanguage()
  const locale = language === "zh-CN" ? "zh-CN" : "en-US"
  const { data, isLoading, error, mutate: retryMemories } = useSWR("memory:all", () => getMemories("all"), { keepPreviousData: true })
  const { data: traces = [], error: tracesError, mutate: retryTraces } = useSWR("memory:traces", getMemoryTraces, { keepPreviousData: true })
  const { data: decision, error: decisionError, mutate: retryDecision } = useSWR("memory:decision", getNextActionDecision, { keepPreviousData: true })
  const memories = useMemo(() => data?.memories ?? [], [data?.memories])
  const active = useMemo(
    () => memories.filter((memory) => memory.status === "active"),
    [memories],
  )
  const archived = useMemo(
    () => memories.filter((memory) => memory.status !== "active"),
    [memories],
  )
  const resolved = useMemo(
    () => memories.filter((memory) => memory.status === "resolved"),
    [memories],
  )

  const [filter, setFilter] = useState<"active" | "all" | "archived">("active")
  const [kind, setKind] = useState<MemoryKind>("preference")
  const [content, setContent] = useState("")
  const [pinned, setPinned] = useState(false)
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState("")
  const [query, setQuery] = useState("")
  const [retrieving, setRetrieving] = useState(false)
  const [preview, setPreview] = useState<MemoryPack | null>(null)
  const timedOut = useLoadingTimeout(isLoading && !data)

  const visible = useMemo(() => {
    if (filter === "active") return active
    if (filter === "archived") return archived
    return memories
  }, [active, archived, filter, memories])

  async function refresh() {
    await Promise.all([
      mutate("memory:all"),
      mutate("memory:traces"),
      mutate("memory:decision"),
    ])
  }

  async function handleAdd() {
    if (!content.trim()) return
    setAdding(true)
    try {
      await createMemory({ kind, content: content.trim(), pinned })
      setContent("")
      setPinned(false)
      await refresh()
      toast.success(t.memory.saved)
    } catch (error) {
      toast.error(t.memory.failed, { description: error instanceof Error ? error.message : undefined })
    } finally {
      setAdding(false)
    }
  }

  async function handlePin(memory: MemoryItem) {
    try {
      await updateMemory(memory.id, { pinned: !memory.pinned })
      await refresh()
      toast.success(t.memory.updated)
    } catch (error) {
      toast.error(t.memory.failed, { description: error instanceof Error ? error.message : undefined })
    }
  }

  async function handleSaveEdit(memory: MemoryItem) {
    if (!editingContent.trim()) return
    try {
      await updateMemory(memory.id, { content: editingContent.trim() })
      setEditingId(null)
      await refresh()
      toast.success(t.memory.updated)
    } catch (error) {
      toast.error(t.memory.failed, { description: error instanceof Error ? error.message : undefined })
    }
  }

  async function handleForget(memory: MemoryItem) {
    try {
      await forgetMemory(memory.id)
      await refresh()
      toast.success(t.memory.forgotten)
    } catch (error) {
      toast.error(t.memory.failed, { description: error instanceof Error ? error.message : undefined })
    }
  }

  async function handleRetrieve() {
    if (!query.trim()) return
    setRetrieving(true)
    try {
      const pack = await retrieveMemories(query.trim(), 700)
      setPreview(pack)
      await mutate("memory:traces")
    } catch (error) {
      toast.error(t.memory.failed, { description: error instanceof Error ? error.message : undefined })
    } finally {
      setRetrieving(false)
    }
  }

  function formatDate(value?: string | null) {
    if (!value) return t.memory.never
    return new Date(value).toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" })
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      <header className="flex flex-col gap-3">
        <Badge variant="secondary" className="w-fit">
          <BrainCircuit data-icon="inline-start" />
          {t.memory.badge}
        </Badge>
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">{t.memory.title}</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">{t.memory.description}</p>
        </div>
      </header>

      {error && data ? <AsyncErrorState feature="memory" error={error} onRetry={retryMemories} compact /> : null}
      {tracesError ? <AsyncErrorState feature="memory-traces" error={tracesError} onRetry={retryTraces} compact /> : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <SummaryCard label={t.memory.active} value={active.length} icon={BrainCircuit} />
        <SummaryCard label={t.memory.resolved} value={resolved.length} icon={CheckCircle2} />
        <SummaryCard label={t.memory.pinned} value={active.filter((memory) => memory.pinned).length} icon={Pin} />
        <SummaryCard label={t.memory.tokenBudget} value={preview ? `${preview.estimatedTokens}/${preview.tokenBudget}` : "700"} icon={Archive} />
        <SummaryCard label={t.memory.nextAction} value={decision?.targetSkillCode ?? "—"} icon={Target} compact />
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>{t.memory.addTitle}</CardTitle>
            <CardDescription>{t.memory.addDescription}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
              <select
                value={kind}
                onChange={(event) => setKind(event.target.value as MemoryKind)}
                className="h-8 rounded-lg border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring/40"
                aria-label="Memory kind"
              >
                {(Object.keys(KIND_ICONS) as MemoryKind[]).map((key) => (
                  <option key={key} value={key}>{t.memory.kinds[key]}</option>
                ))}
              </select>
              <Input
                value={content}
                onChange={(event) => setContent(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void handleAdd()
                }}
                placeholder={t.memory.contentPlaceholder}
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                <input type="checkbox" checked={pinned} onChange={(event) => setPinned(event.target.checked)} />
                <Pin className="size-3.5" />
                {t.memory.pin}
              </label>
              <Button onClick={handleAdd} disabled={adding || !content.trim()}>
                <Plus data-icon="inline-start" />
                {adding ? t.memory.adding : t.memory.add}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-primary/5">
          <CardHeader>
            <CardTitle>{t.memory.nextAction}</CardTitle>
            <CardDescription>{decision?.reason ?? (decisionError ? t.memory.failed : t.common.loading)}</CardDescription>
          </CardHeader>
          {decision && (
            <CardContent className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                <Badge>{t.labels.skills[decision.targetSkillCode as keyof typeof t.labels.skills] ?? decision.targetSkillCode}</Badge>
                <Badge variant="outline">{t.labels.practiceTypes[decision.practiceType]}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{t.memory.policy}: {decision.policy}</p>
              <Button nativeButton={false} render={<Link href={`/practice?skill=${encodeURIComponent(decision.targetSkillCode)}`} />}>
                {t.memory.startPractice}
              </Button>
            </CardContent>
          )}
          {!decision && decisionError ? (
            <CardContent>
              <AsyncErrorState feature="memory-decision" error={decisionError} onRetry={retryDecision} compact />
            </CardContent>
          ) : null}
        </Card>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-heading text-xl font-semibold">{t.memory.active}</h2>
          <div className="flex rounded-lg border border-border p-1">
            {(["active", "all", "archived"] as const).map((value) => (
              <Button
                key={value}
                size="sm"
                variant={filter === value ? "secondary" : "ghost"}
                onClick={() => setFilter(value)}
              >
                {value === "active" ? t.memory.active : value === "all" ? t.memory.all : t.memory.archived}
              </Button>
            ))}
          </div>
        </div>

        {(timedOut || error) && !data ? (
          <AsyncErrorState feature="memory" error={error} timedOut={timedOut} onRetry={retryMemories} />
        ) : isLoading && !data ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-52 rounded-xl" />
            <Skeleton className="h-52 rounded-xl" />
          </div>
        ) : visible.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <BrainCircuit className="mx-auto mb-3 size-8 text-muted-foreground" />
              <p className="font-medium">{t.memory.noMemories}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t.memory.noMemoriesDescription}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid items-start gap-4 md:grid-cols-2">
            {visible.map((memory) => {
              const Icon = KIND_ICONS[memory.kind]
              const isEditing = editingId === memory.id
              const graduation = memory.kind === "weakness" ? memory.graduation : undefined
              const thresholds = graduation?.thresholds
              const retention = memory.kind === "weakness" ? memory.retention : undefined
              const modalityMastery = Object.entries(memory.modalityMastery ?? {})
              return (
                <Card
                  key={memory.id}
                  className={
                    memory.status === "active"
                      ? ""
                      : memory.status === "resolved"
                        ? "border-emerald-500/40 bg-emerald-500/[0.03]"
                        : "opacity-70"
                  }
                >
                  <CardHeader>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`flex size-8 items-center justify-center rounded-lg ${KIND_STYLES[memory.kind]}`}>
                        <Icon className="size-4" />
                      </span>
                      <Badge variant="outline">{t.memory.kinds[memory.kind]}</Badge>
                      <Badge variant={memory.status === "active" ? "secondary" : "outline"}>
                        {t.memory.statuses[memory.status]}
                      </Badge>
                      {memory.verification && (
                        <Badge
                          variant={memory.verification.state === "candidate" ? "secondary" : "outline"}
                          title={t.memory.verification}
                        >
                          {t.memory.verificationStates[memory.verification.state]}
                        </Badge>
                      )}
                      {memory.pinned && <Pin className="size-3.5 text-primary" aria-label={t.memory.pinned} />}
                    </div>
                    {memory.status === "active" && (
                      <CardAction className="flex gap-1">
                        <Button size="icon-sm" variant="ghost" onClick={() => void handlePin(memory)} aria-label={memory.pinned ? t.memory.unpin : t.memory.pin}>
                          {memory.pinned ? <PinOff /> : <Pin />}
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingId(memory.id)
                            setEditingContent(memory.content)
                          }}
                          aria-label={t.memory.edit}
                        >
                          <Pencil />
                        </Button>
                        <Button size="icon-sm" variant="destructive" onClick={() => void handleForget(memory)} aria-label={t.memory.forget}>
                          <Trash2 />
                        </Button>
                      </CardAction>
                    )}
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    {isEditing ? (
                      <div className="flex flex-col gap-2">
                        <Textarea value={editingContent} onChange={(event) => setEditingContent(event.target.value)} />
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>{t.common.cancel}</Button>
                          <Button size="sm" onClick={() => void handleSaveEdit(memory)}>{t.memory.saveEdit}</Button>
                        </div>
                      </div>
                    ) : (
                      <p className="leading-relaxed">{memory.content}</p>
                    )}

                    {memory.evidence && (
                      <div className="rounded-lg bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground">
                        <span className="font-medium text-foreground">{t.memory.evidence}: </span>{memory.evidence}
                      </div>
                    )}

                    {memory.kind === "weakness" && (retention || memory.progressionStage || modalityMastery.length > 0) && (
                      <div className="rounded-lg border border-primary/15 bg-primary/[0.03] p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-medium">{t.memory.retentionTitle}</p>
                          {memory.progressionStage && (
                            <Badge variant="outline">
                              {t.memory.progression}: {t.memory.progressionStages[memory.progressionStage]}
                            </Badge>
                          )}
                        </div>
                        {retention && (
                          <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
                            <div>
                              <p className="text-muted-foreground">{t.memory.nextReview}</p>
                              <p className="mt-0.5 font-medium">{formatDate(retention.dueAt)}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">{t.memory.stability}</p>
                              <p className="mt-0.5 font-medium tabular-nums">
                                {retention.stabilityDays.toFixed(1)} {t.memory.days}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">{t.memory.relapseRisk}</p>
                              <p className="mt-0.5 font-medium tabular-nums">
                                {Math.round((retention.relapseRisk ?? 0) * 100)}%
                              </p>
                            </div>
                          </div>
                        )}
                        {modalityMastery.length > 0 && (
                          <div className="mt-3 border-t border-border pt-3">
                            <p className="mb-2 text-xs text-muted-foreground">{t.memory.modalityMastery}</p>
                            <div className="flex flex-wrap gap-2">
                              {modalityMastery.map(([modality, state]) => (
                                <Badge key={modality} variant="secondary" className="tabular-nums">
                                  {t.memory.modalities[modality as keyof typeof t.memory.modalities] ?? modality}: {Math.round(state.mastery)}%
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {graduation && (
                      <div className="rounded-lg border border-border bg-muted/30 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium">{t.memory.graduationTitle}</p>
                            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                              {memory.status === "resolved"
                                ? t.memory.graduationResolved
                                : t.memory.graduationDescription}
                            </p>
                          </div>
                          {memory.status === "resolved" && <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />}
                        </div>
                        <div className="mt-3">
                          <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
                            <span>{t.memory.graduationProgress}</span>
                            <span>{Math.round((graduation.progress ?? 0) * 100)}%</span>
                          </div>
                          <Progress value={(graduation.progress ?? 0) * 100} />
                        </div>
                        {thresholds && (
                          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
                            <EvidenceMetric label={t.memory.attempts} value={`${graduation.attempts ?? 0}/${thresholds.minAttempts}`} passed={graduation.criteria?.attempts} />
                            <EvidenceMetric label={t.memory.distinctDays} value={`${graduation.distinctDays ?? 0}/${thresholds.minDistinctDays}`} passed={graduation.criteria?.distinctDays} />
                            <EvidenceMetric label={t.memory.spanDays} value={`${graduation.spanDays ?? 0}/${thresholds.minSpanDays} ${t.memory.days}`} passed={graduation.criteria?.spanDays} />
                            <EvidenceMetric label={t.memory.recentSuccess} value={`${Math.round((graduation.recentSuccessRate ?? 0) * 100)}%/${Math.round(thresholds.minRecentSuccessRate * 100)}%`} passed={graduation.criteria?.recentSuccessRate} />
                            <EvidenceMetric label={t.memory.recentAverage} value={`${graduation.recentAverageScore ?? 0}/${thresholds.minRecentAverageScore}`} passed={graduation.criteria?.recentAverageScore} />
                            <EvidenceMetric label={t.memory.mastery} value={`${Math.round(graduation.mastery ?? 0)}/${thresholds.minMastery}`} passed={graduation.criteria?.mastery} />
                            <EvidenceMetric label={t.memory.exerciseTypes} value={`${graduation.exerciseTypeCount ?? 0}/${thresholds.minExerciseTypes}`} passed={graduation.criteria?.exerciseTypes} />
                            <EvidenceMetric label={t.memory.recurrenceFree} value={`${graduation.daysSinceLastObserved ?? 0}/${thresholds.recurrenceFreeDays} ${t.memory.days}`} passed={graduation.criteria?.recurrenceFree} />
                          </div>
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <Metric label={t.memory.confidence} value={memory.confidence} />
                      <Metric label={t.memory.importance} value={memory.importance} />
                    </div>
                    <div className="flex flex-wrap justify-between gap-2 border-t pt-3 text-xs text-muted-foreground">
                      <span>{memory.observationCount} {t.memory.observations}</span>
                      <span>{t.memory.expires}: {formatDate(memory.expiresAt)}</span>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </section>

      <section className="grid items-start gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t.memory.previewTitle}</CardTitle>
            <CardDescription>{t.memory.previewDescription}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex gap-2">
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void handleRetrieve()
                }}
                placeholder={t.memory.previewPlaceholder}
              />
              <Button onClick={handleRetrieve} disabled={retrieving || !query.trim()}>
                <Search data-icon="inline-start" />
                {retrieving ? t.memory.retrieving : t.memory.retrieve}
              </Button>
            </div>
            {preview && (
              <div className="flex flex-col gap-3">
                <div>
                  <div className="mb-2 flex justify-between text-xs text-muted-foreground">
                    <span>{t.memory.tokenBudget}</span>
                    <span>{preview.estimatedTokens} / {preview.tokenBudget}</span>
                  </div>
                  <Progress value={(preview.estimatedTokens / preview.tokenBudget) * 100} />
                </div>
                <p className="text-sm font-medium">{t.memory.recalled}</p>
                {preview.items.length ? preview.items.map((memory) => (
                  <RecallRow key={memory.id} memory={memory} whyLabel={t.memory.why} kindLabel={t.memory.kinds[memory.kind]} />
                )) : <p className="text-sm text-muted-foreground">{t.memory.noRecall}</p>}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t.memory.tracesTitle}</CardTitle>
            <CardDescription>{t.memory.tracesDescription}</CardDescription>
          </CardHeader>
          <CardContent className="flex max-h-[520px] flex-col gap-3 overflow-y-auto">
            {traces.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.memory.noTraces}</p>
            ) : traces.map((trace) => (
              <div key={trace.id} className="rounded-lg border border-border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Badge variant="outline">{trace.purpose}</Badge>
                    <p className="mt-2 line-clamp-2 text-sm">{trace.queryPreview}</p>
                  </div>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {trace.estimatedTokens}/{trace.tokenBudget}
                  </span>
                </div>
                <div className="mt-3 flex flex-col gap-2">
                  {trace.selected?.map((selected) => (
                    <div key={selected.id} className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                      <span className="line-clamp-1">{selected.content}</span>
                      <span className="shrink-0 font-medium text-foreground">{Math.round(selected.score * 100)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}


function SummaryCard({ label, value, icon: Icon, compact = false }: { label: string; value: string | number; icon: typeof BrainCircuit; compact?: boolean }) {
  return (
    <Card size="sm">
      <CardContent className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className={compact ? "truncate text-sm font-semibold" : "text-xl font-semibold tabular-nums"}>{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}


function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-muted-foreground">
        <span>{label}</span>
        <span>{Math.round(value * 100)}%</span>
      </div>
      <Progress value={value * 100} />
    </div>
  )
}


function EvidenceMetric({ label, value, passed }: { label: string; value: string; passed?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-muted-foreground">{label}</p>
      <p className={passed ? "font-medium tabular-nums text-emerald-600" : "font-medium tabular-nums"}>
        {value}
      </p>
    </div>
  )
}


function RecallRow({ memory, whyLabel, kindLabel }: { memory: MemoryItem; whyLabel: string; kindLabel: string }) {
  const score = memory.retrievalScore ?? 0
  const breakdown = memory.scoreBreakdown
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Badge variant="outline">{kindLabel}</Badge>
          <p className="mt-2 text-sm">{memory.content}</p>
        </div>
        <span className="text-sm font-semibold tabular-nums text-primary">{Math.round(score * 100)}%</span>
      </div>
      {breakdown && (
        <p className="mt-2 text-xs text-muted-foreground">
          {whyLabel}: semantic {Math.round(breakdown.semantic * 100)}% · lexical {Math.round(breakdown.lexical * 100)}% · importance {Math.round(breakdown.importance * 100)}% · recency {Math.round(breakdown.recency * 100)}%
        </p>
      )}
    </div>
  )
}
