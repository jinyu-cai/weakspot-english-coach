"use client"

import { useMemo, useRef, useState } from "react"
import useSWR, { mutate } from "swr"
import { toast } from "sonner"
import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Eye,
  FileText,
  History,
  Lightbulb,
  ListChecks,
  Radio,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
} from "lucide-react"

import {
  analyzeInputLearning,
  deleteInputLearningSource,
  getInputLearningSource,
  getInputLearningSources,
  submitInputLearningAttempt,
} from "@/lib/api-client"
import type {
  InputAttentionMission,
  InputLearningAttempt,
  InputLearningAttemptKind,
  InputLearningItem,
  InputLearningSource,
  InputLearningSourceType,
} from "@/lib/types"
import { useLanguage } from "@/components/language-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

type InputFlow = "capture" | "mission"

const SOURCE_TYPES: InputLearningSourceType[] = [
  "series",
  "movie",
  "video",
  "podcast",
  "article",
  "book",
  "work",
  "conversation",
  "other",
]

const SOURCE_EMOJI: Record<InputLearningSourceType, string> = {
  series: "📺",
  movie: "🎬",
  video: "▶️",
  podcast: "🎧",
  article: "📰",
  book: "📚",
  work: "💼",
  conversation: "💬",
  other: "✨",
}

const ITEM_STYLE: Record<InputLearningItem["kind"], string> = {
  word: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  phrase: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  collocation: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  grammar_pattern: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  pronunciation: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
  culture: "bg-teal-500/10 text-teal-700 dark:text-teal-300",
}

export default function InputLearningPage() {
  const { language, t } = useLanguage()
  const locale = language === "zh-CN" ? "zh-CN" : "en-US"
  const [flow, setFlow] = useState<InputFlow>("capture")
  const [sourceType, setSourceType] = useState<InputLearningSourceType>("series")
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [notes, setNotes] = useState("")
  const [goal, setGoal] = useState("")
  const [targetItemCount, setTargetItemCount] = useState(6)
  const [analyzing, setAnalyzing] = useState(false)
  const [latestSource, setLatestSource] = useState<InputLearningSource | null>(null)
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const resultRef = useRef<HTMLDivElement>(null)

  const { data: historyData, isLoading: historyLoading } = useSWR(
    "input-learning:sources",
    getInputLearningSources,
  )
  const { data: selectedSource, isLoading: detailLoading } = useSWR(
    selectedSourceId ? ["input-learning:source", selectedSourceId] : null,
    ([, id]) => getInputLearningSource(id),
    {
      onError: () => toast.error(t.inputLearning.loadFailed),
    },
  )

  const sources = useMemo(() => historyData?.sources ?? [], [historyData?.sources])
  const visibleSource = latestSource ?? selectedSource ?? null
  const selectedLabel = t.inputLearning.sourceTypes[sourceType]
  const inputLength = content.trim().length
  const isCapture = flow === "capture"

  const historyGroups = useMemo(() => {
    return sources.reduce<Record<string, InputLearningSource[]>>((groups, source) => {
      const date = new Date(source.createdAt)
      const key = Number.isNaN(date.getTime())
        ? t.common.unknownDate
        : date.toLocaleDateString(locale, { month: "long", year: "numeric" })
      groups[key] = [...(groups[key] ?? []), source]
      return groups
    }, {})
  }, [locale, sources, t.common.unknownDate])

  function formatDate(value: string) {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return t.common.unknownDate
    return date.toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric" })
  }

  async function handleSubmit() {
    if (!title.trim()) {
      toast.error(t.inputLearning.titleRequired)
      return
    }
    if (isCapture && !content.trim()) {
      toast.error(t.inputLearning.contentRequired)
      return
    }

    setAnalyzing(true)
    try {
      const source = await analyzeInputLearning({
        sourceType,
        title: title.trim(),
        content: isCapture ? content.trim() : undefined,
        notes: notes.trim() || undefined,
        goal: goal.trim() || undefined,
        targetItemCount,
      })
      setLatestSource(source)
      setSelectedSourceId(null)
      await mutate("input-learning:sources")
      toast.success(isCapture ? t.inputLearning.createdCapture : t.inputLearning.createdMission)
      window.setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50)
    } catch (error) {
      toast.error(t.inputLearning.analyzeFailed, {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setAnalyzing(false)
    }
  }

  function openSource(sourceId: string) {
    setLatestSource(null)
    setSelectedSourceId(sourceId)
    window.setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50)
  }

  async function handleDelete(sourceId: string) {
    setDeletingId(sourceId)
    try {
      await deleteInputLearningSource(sourceId)
      if (selectedSourceId === sourceId) setSelectedSourceId(null)
      if (latestSource?.id === sourceId) setLatestSource(null)
      await mutate("input-learning:sources")
      toast.success(t.inputLearning.deleted)
    } catch (error) {
      toast.error(t.inputLearning.deleteFailed, {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      <header className="relative overflow-hidden rounded-3xl border border-primary/15 bg-gradient-to-br from-primary/10 via-background to-violet-500/10 px-6 py-7 sm:px-8 sm:py-9">
        <div className="pointer-events-none absolute -right-12 -top-16 size-56 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative max-w-3xl">
          <Badge variant="secondary" className="mb-4 w-fit">
            <Radio data-icon="inline-start" />
            {t.inputLearning.badge}
          </Badge>
          <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
            {t.inputLearning.title}
          </h1>
          <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">
            {t.inputLearning.description}
          </p>
        </div>
      </header>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.7fr)]">
        <Card>
          <CardHeader className="border-b">
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setFlow("capture")}
                aria-pressed={flow === "capture"}
                className={cn(
                  "rounded-xl border p-4 text-left transition-all",
                  flow === "capture"
                    ? "border-primary/50 bg-primary/7 ring-2 ring-primary/10"
                    : "border-border bg-background hover:border-primary/25 hover:bg-muted/30",
                )}
              >
                <span className="flex items-center gap-2 font-heading text-sm font-semibold">
                  <FileText className="size-4 text-primary" />
                  {t.inputLearning.captureTab}
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                  {t.inputLearning.captureTabHint}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setFlow("mission")}
                aria-pressed={flow === "mission"}
                className={cn(
                  "rounded-xl border p-4 text-left transition-all",
                  flow === "mission"
                    ? "border-violet-500/50 bg-violet-500/7 ring-2 ring-violet-500/10"
                    : "border-border bg-background hover:border-violet-500/25 hover:bg-muted/30",
                )}
              >
                <span className="flex items-center gap-2 font-heading text-sm font-semibold">
                  <Eye className="size-4 text-violet-500" />
                  {t.inputLearning.missionTab}
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                  {t.inputLearning.missionTabHint}
                </span>
              </button>
            </div>
          </CardHeader>

          <CardContent className="flex flex-col gap-5 pt-1">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">{t.inputLearning.sourceType}</label>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {SOURCE_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setSourceType(type)}
                    aria-pressed={sourceType === type}
                    className={cn(
                      "flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2 text-center text-xs transition-all",
                      sourceType === type
                        ? "border-primary/45 bg-primary/8 font-medium text-foreground"
                        : "border-border text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                    )}
                  >
                    <span className="text-lg" aria-hidden="true">{SOURCE_EMOJI[type]}</span>
                    <span className="line-clamp-1">{t.inputLearning.sourceTypes[type]}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="input-title" className="text-sm font-medium">{t.inputLearning.titleLabel}</label>
              <Input
                id="input-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={isCapture ? t.inputLearning.captureTitlePlaceholder : t.inputLearning.missionTitlePlaceholder}
                maxLength={180}
              />
            </div>

            {isCapture && (
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <label htmlFor="input-content" className="text-sm font-medium">{t.inputLearning.contentLabel}</label>
                    <p className="mt-0.5 text-xs text-muted-foreground">{t.inputLearning.contentOptional}</p>
                  </div>
                  <span className="text-xs tabular-nums text-muted-foreground">{inputLength.toLocaleString(locale)}</span>
                </div>
                <Textarea
                  id="input-content"
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  placeholder={t.inputLearning.contentPlaceholder}
                  maxLength={64000}
                  className="min-h-44 resize-y leading-relaxed"
                />
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <label htmlFor="input-notes" className="text-sm font-medium">{t.inputLearning.notesLabel}</label>
                <Textarea
                  id="input-notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder={t.inputLearning.notesPlaceholder}
                  maxLength={32000}
                  className="min-h-24 resize-y"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="input-goal" className="text-sm font-medium">{t.inputLearning.goalLabel}</label>
                <Textarea
                  id="input-goal"
                  value={goal}
                  onChange={(event) => setGoal(event.target.value)}
                  placeholder={t.inputLearning.goalPlaceholder}
                  maxLength={800}
                  className="min-h-24 resize-y"
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                  <label htmlFor="target-count" className="font-medium">{t.inputLearning.itemCount}</label>
                  <Badge variant="secondary" className="tabular-nums">
                    {targetItemCount} {t.inputLearning.targets}
                  </Badge>
                </div>
                <input
                  id="target-count"
                  type="range"
                  min={3}
                  max={10}
                  value={targetItemCount}
                  onChange={(event) => setTargetItemCount(Number(event.target.value))}
                  className="w-full accent-primary sm:w-64"
                />
              </div>
              <Button size="lg" onClick={() => void handleSubmit()} disabled={analyzing} className="sm:min-w-52">
                {analyzing ? (
                  <Sparkles className="animate-pulse" data-icon="inline-start" />
                ) : isCapture ? (
                  <BookOpenCheck data-icon="inline-start" />
                ) : (
                  <Eye data-icon="inline-start" />
                )}
                {analyzing
                  ? t.inputLearning.analyzing
                  : isCapture
                    ? t.inputLearning.captureButton
                    : t.inputLearning.missionButton}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card className={cn(isCapture ? "bg-primary/5" : "bg-violet-500/5")}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {isCapture ? <BookOpenCheck className="size-4 text-primary" /> : <Target className="size-4 text-violet-500" />}
                {isCapture ? t.inputLearning.captureTab : t.inputLearning.missionTab}
              </CardTitle>
              <CardDescription className="leading-relaxed">
                {isCapture ? t.inputLearning.captureExplainer : t.inputLearning.missionExplainer}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="text-base" aria-hidden="true">{SOURCE_EMOJI[sourceType]}</span>
                <ArrowRight className="size-3" />
                <span>{selectedLabel}</span>
                <ArrowRight className="size-3" />
                <span>{targetItemCount} {t.inputLearning.targets}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <ShieldCheck className="size-4 text-emerald-600" />
                {t.inputLearning.copyrightTitle}
              </CardTitle>
              <CardDescription className="leading-relaxed">
                {t.inputLearning.copyrightNotice}
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      <div ref={resultRef} className="scroll-mt-24">
        {detailLoading && !latestSource ? (
          <ResultSkeleton />
        ) : visibleSource ? (
          <InputLearningPack
            source={visibleSource}
            sourceLabel={t.inputLearning.sourceTypes[visibleSource.sourceType]}
            formatDate={formatDate}
          />
        ) : null}
      </div>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-heading text-xl font-semibold">
              <History className="size-5 text-primary" />
              {t.inputLearning.historyTitle}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{t.inputLearning.historyDescription}</p>
          </div>
          {sources.length > 0 && <Badge variant="secondary">{sources.length}</Badge>}
        </div>

        {historyLoading ? (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((item) => <Skeleton key={item} className="h-32 rounded-xl" />)}
          </div>
        ) : sources.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
              <Radio className="size-9 text-muted-foreground/40" />
              <div>
                <p className="font-medium">{t.inputLearning.noHistory}</p>
                <p className="mt-1 text-sm text-muted-foreground">{t.inputLearning.noHistoryDescription}</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-6">
            {Object.entries(historyGroups).map(([month, monthSources]) => (
              <div key={month} className="flex flex-col gap-3">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{month}</p>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {monthSources.map((source) => (
                    <Card
                      key={source.id}
                      size="sm"
                      className={cn(
                        "relative transition-all hover:-translate-y-0.5 hover:ring-primary/30 hover:shadow-sm",
                        selectedSourceId === source.id && "ring-2 ring-primary/35",
                      )}
                    >
                      <button
                        type="button"
                        aria-label={`${t.inputLearning.open}: ${source.title}`}
                        title={`${t.inputLearning.open}: ${source.title}`}
                        className="absolute inset-0 z-0 cursor-pointer rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                        onClick={() => openSource(source.id)}
                      />
                      <CardHeader className="pointer-events-none relative z-10">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-start gap-2.5">
                            <span className="mt-0.5 text-lg" aria-hidden="true">{SOURCE_EMOJI[source.sourceType]}</span>
                            <div className="min-w-0">
                              <CardTitle className="truncate">{source.title}</CardTitle>
                              <CardDescription className="mt-0.5">
                                {t.inputLearning.sourceTypes[source.sourceType]}
                              </CardDescription>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="pointer-events-auto relative z-20"
                            aria-label={t.inputLearning.delete}
                            title={t.inputLearning.delete}
                            disabled={deletingId === source.id}
                            onClick={(event) => {
                              event.stopPropagation()
                              void handleDelete(source.id)
                            }}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="pointer-events-none relative z-10 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                        <Badge variant={source.mode === "attention_mission" ? "outline" : "secondary"}>
                          {source.mode === "attention_mission" ? t.inputLearning.missionBadge : t.inputLearning.groundedBadge}
                        </Badge>
                        <span className="flex items-center gap-1 tabular-nums">
                          <Clock3 className="size-3" />
                          {formatDate(source.createdAt)}
                        </span>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )

  function InputLearningPack({
    source,
    sourceLabel,
    formatDate,
  }: {
    source: InputLearningSource
    sourceLabel: string
    formatDate: (value: string) => string
  }) {
    const items = source.items ?? []
    const isMission = source.mode === "attention_mission"
    const [retrievalActive, setRetrievalActive] = useState(false)

    return (
      <section className="flex flex-col gap-5 rounded-3xl border border-primary/15 bg-card p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge variant={isMission ? "outline" : "secondary"}>
                {isMission ? <Eye data-icon="inline-start" /> : <CheckCircle2 data-icon="inline-start" />}
                {isMission ? t.inputLearning.missionBadge : t.inputLearning.groundedBadge}
              </Badge>
              <span className="text-xs text-muted-foreground">{sourceLabel}</span>
            </div>
            <h2 className="font-heading text-2xl font-semibold">{source.title}</h2>
            <p className="mt-2 max-w-3xl leading-relaxed text-muted-foreground">{source.summary}</p>
          </div>
          <div className="shrink-0 text-xs text-muted-foreground sm:text-right">
            <p>{t.inputLearning.created}</p>
            <p className="mt-0.5 font-medium text-foreground">{formatDate(source.createdAt)}</p>
          </div>
        </div>

        {source.attentionMission && <AttentionMission mission={source.attentionMission} />}

        {items.length > 0 && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h3 className="flex items-center gap-2 font-heading text-lg font-semibold">
                  <Sparkles className="size-4 text-primary" />
                  {isMission ? t.inputLearning.missionTargetsTitle : t.inputLearning.expressionsTitle}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {isMission ? t.inputLearning.missionTargetsDescription : t.inputLearning.expressionsDescription}
                </p>
              </div>
              {source.savedMemoryIds && source.savedMemoryIds.length > 0 && (
                <Badge variant="secondary">
                  <CheckCircle2 data-icon="inline-start" />
                  {source.savedMemoryIds.length} {t.inputLearning.remembered}
                </Badge>
              )}
            </div>

            <div className={cn("grid gap-4 transition-all lg:grid-cols-2", retrievalActive && "pointer-events-none select-none blur-md")}>
              {items.map((item, index) => (
                <article key={item.id || `${item.expression}-${index}`} className="rounded-2xl border border-border bg-background p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <Badge className={cn("mb-2 border-0", ITEM_STYLE[item.kind])}>
                        {t.inputLearning.kinds[item.kind]}
                      </Badge>
                      <h4 className="font-heading text-lg font-semibold leading-snug">{item.expression}</h4>
                    </div>
                    {item.grounded && (
                      <Badge variant="outline" className="text-[10px]">
                        <ShieldCheck data-icon="inline-start" />
                        {t.inputLearning.groundedBadge}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-2 text-sm leading-relaxed">{item.meaning}</p>

                  <div className="mt-4 flex flex-col gap-3 border-t border-border pt-3">
                    <LearningReason icon={Lightbulb} label={t.inputLearning.whyUseful} text={item.whyUseful} />
                    {item.personalizedReason && (
                      <LearningReason icon={Target} label={t.inputLearning.personalFit} text={item.personalizedReason} />
                    )}
                    <LearningReason icon={BookOpenCheck} label={t.inputLearning.example} text={item.example || item.examples?.[0] || ""} italic />
                    {item.sourceEvidence && (
                      <div className="rounded-lg bg-muted/45 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                        <span className="font-medium text-foreground">{t.inputLearning.evidence}: </span>
                        &ldquo;{item.sourceEvidence}&rdquo;
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
            {!isMission && (
              <InputOutputPractice
                source={source}
                items={items}
                onRetrievalActiveChange={setRetrievalActive}
              />
            )}
          </div>
        )}
      </section>
    )
  }

  function AttentionMission({ mission }: { mission: InputAttentionMission }) {
    const steps = [
      { label: t.inputLearning.before, icon: Clock3, items: mission.beforeYouStart },
      { label: t.inputLearning.focus, icon: Target, items: mission.focusTargets },
      { label: t.inputLearning.during, icon: Eye, items: mission.whileConsuming },
      { label: t.inputLearning.after, icon: ListChecks, items: mission.afterYouFinish },
    ]

    return (
      <div className="overflow-hidden rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-500/8 to-primary/5">
        <div className="border-b border-violet-500/15 px-5 py-4">
          <h3 className="flex items-center gap-2 font-heading text-lg font-semibold">
            <Eye className="size-5 text-violet-500" />
            {t.inputLearning.missionTitle}
          </h3>
          <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-muted-foreground">{mission.objective}</p>
        </div>
        <div className="grid gap-px bg-violet-500/10 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((step) => (
            <div key={step.label} className="bg-background/80 p-4">
              <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <step.icon className="size-3.5 text-violet-500" />
                {step.label}
              </p>
              <ul className="flex flex-col gap-2">
                {step.items.map((item, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm leading-relaxed">
                    <ChevronRight className="mt-0.5 size-3.5 shrink-0 text-violet-500" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    )
  }
}

function InputOutputPractice({
  source,
  items,
  onRetrievalActiveChange,
}: {
  source: InputLearningSource
  items: InputLearningItem[]
  onRetrievalActiveChange: (active: boolean) => void
}) {
  const { language, t } = useLanguage()
  const [kind, setKind] = useState<InputLearningAttemptKind>("retell")
  const [responseText, setResponseText] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<InputLearningAttempt | null>(null)
  const [openedAt] = useState(() => Date.now())
  const clientAttemptIdRef = useRef<string | null>(null)
  const reusableItems = items.filter((item) => item.kind !== "culture").slice(0, 2)
  const dueAt = source.delayedReviewDueAt
    ? new Date(source.delayedReviewDueAt)
    : new Date(new Date(source.createdAt).getTime() + 24 * 60 * 60 * 1000)
  const delayedReady = Boolean(dueAt && !Number.isNaN(dueAt.getTime()) && openedAt >= dueAt.getTime())

  function selectKind(next: InputLearningAttemptKind) {
    setKind(next)
    setResult(null)
    setResponseText("")
    clientAttemptIdRef.current = null
    onRetrievalActiveChange(next === "delayed_retrieval")
  }

  async function handleSubmit() {
    if (!responseText.trim() || submitting) return
    setSubmitting(true)
    try {
      const clientAttemptId = clientAttemptIdRef.current ?? crypto.randomUUID()
      clientAttemptIdRef.current = clientAttemptId
      const attempt = await submitInputLearningAttempt(source.id, {
        kind,
        responseText: responseText.trim(),
        targetItemIds: kind === "required_reuse" ? reusableItems.map((item) => item.id) : [],
        clientAttemptId,
        // Immediate retell/reuse keeps the source targets visible. Only the
        // delayed retrieval mode hides them and can count as independent.
        hintUsed: kind !== "delayed_retrieval",
      })
      setResult(attempt)
      toast.success(attempt.passed ? t.inputLearning.outputPassed : t.inputLearning.outputRecorded)
    } catch (error) {
      toast.error(t.inputLearning.outputFailed, {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mt-2 rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:p-5">
      <div className="flex flex-col gap-1">
        <h3 className="font-heading text-lg font-semibold">{t.inputLearning.outputTitle}</h3>
        <p className="text-sm text-muted-foreground">{t.inputLearning.outputDescription}</p>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {([
          ["retell", t.inputLearning.retellMode],
          ["required_reuse", t.inputLearning.reuseMode],
          ["delayed_retrieval", t.inputLearning.delayedMode],
        ] as const).map(([value, label]) => (
          <Button
            key={value}
            type="button"
            variant={kind === value ? "default" : "outline"}
            onClick={() => selectKind(value)}
            disabled={value === "delayed_retrieval" && !delayedReady}
          >
            {label}
          </Button>
        ))}
      </div>

      {kind === "required_reuse" ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">{t.inputLearning.requiredTargets}</span>
          {reusableItems.map((item) => <Badge key={item.id}>{item.expression}</Badge>)}
        </div>
      ) : kind === "delayed_retrieval" ? (
        <p className="mt-4 text-sm text-muted-foreground">{t.inputLearning.delayedPrompt}</p>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">{t.inputLearning.retellPrompt}</p>
      )}

      {!delayedReady && dueAt ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {t.inputLearning.delayedDue} {dueAt.toLocaleString(language === "zh-CN" ? "zh-CN" : "en-US")}
        </p>
      ) : null}

      <Textarea
        value={responseText}
        onChange={(event) => {
          setResponseText(event.target.value)
          setResult(null)
          clientAttemptIdRef.current = null
        }}
        placeholder={t.inputLearning.outputPlaceholder}
        className="mt-4 min-h-32 bg-background"
        disabled={submitting || Boolean(result)}
      />
      <div className="mt-3 flex justify-end">
        <Button onClick={() => void handleSubmit()} disabled={!responseText.trim() || submitting || Boolean(result)}>
          {submitting ? <Sparkles className="animate-pulse" data-icon="inline-start" /> : <CheckCircle2 data-icon="inline-start" />}
          {submitting ? t.inputLearning.outputChecking : t.inputLearning.outputSubmit}
        </Button>
      </div>

      {result ? (
        <div className={cn("mt-4 rounded-xl border p-3 text-sm", result.passed ? "border-emerald-500/30 bg-emerald-500/8" : "border-amber-500/30 bg-amber-500/8")}>
          <p className="font-medium">{result.passed ? t.inputLearning.outputPassed : t.inputLearning.outputTryAgain}</p>
          <p className="mt-1 text-muted-foreground">{result.feedback}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            {result.wordCount} {t.inputLearning.words} · {result.matchedExpressions.length} {t.inputLearning.targetsMatched}
            {result.countedAsDelayed ? ` · ${t.inputLearning.countedDelayed}` : ""}
          </p>
        </div>
      ) : null}
    </div>
  )
}

function LearningReason({
  icon: Icon,
  label,
  text,
  italic = false,
}: {
  icon: typeof Lightbulb
  label: string
  text: string
  italic?: boolean
}) {
  if (!text) return null
  return (
    <div className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
      <Icon className="mt-0.5 size-3.5 shrink-0 text-primary" />
      <p className={cn(italic && "italic")}>
        <span className="font-medium not-italic text-foreground">{label}: </span>
        {text}
      </p>
    </div>
  )
}

function ResultSkeleton() {
  return (
    <div className="flex flex-col gap-4 rounded-3xl border border-border p-6">
      <Skeleton className="h-6 w-32 rounded-full" />
      <Skeleton className="h-8 w-2/5 rounded-lg" />
      <Skeleton className="h-16 w-full rounded-xl" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    </div>
  )
}
