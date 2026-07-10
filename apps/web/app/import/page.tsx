"use client"

import { useMemo, useRef, useState } from "react"
import { AlertTriangle, FileArchive, FileJson, Inbox, ListChecks, Loader2, MessagesSquare, Sparkles, Upload } from "lucide-react"
import { toast } from "sonner"
import { analyzeChatImport } from "@/lib/api-client"
import {
  parseChatGPTImportFile,
  parseTranscript,
  selectImportConversations,
} from "@/lib/chatgpt-import"
import { DEMO_USER_ID } from "@/lib/mock-data"
import type {
  CEFRLevel,
  ChatImportAnalyzeResponse,
  ChatImportConversation,
  ChatImportEvidenceType,
  DiagnosisMode,
  Severity,
  SkillState,
} from "@/lib/types"
import { cn } from "@/lib/utils"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useLanguage } from "@/components/language-provider"

const CHAT_IMPORT_BATCH_SIZE = 20
const CEFR_LEVELS: CEFRLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"]
type PartialFailure = { completed: number; total: number; message: string }

const severityVariant: Record<Severity, "secondary" | "destructive" | "outline"> = {
  low: "outline",
  medium: "secondary",
  high: "destructive",
}

export default function ImportPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [sourceName, setSourceName] = useState<string>("")
  const [allConversations, setAllConversations] = useState<ChatImportConversation[]>([])
  const [selectedCount, setSelectedCount] = useState(8)
  const [analysisMode, setAnalysisMode] = useState<DiagnosisMode>("fast")
  const [pastedText, setPastedText] = useState("")
  const [loading, setLoading] = useState(false)
  const [analysisProgress, setAnalysisProgress] = useState<{ completed: number; total: number } | null>(null)
  const [result, setResult] = useState<ChatImportAnalyzeResponse | null>(null)
  const [partialFailure, setPartialFailure] = useState<PartialFailure | null>(null)
  const { t } = useLanguage()

  const requestedConversationCount = allConversations.length
    ? Math.min(selectedCount, allConversations.length)
    : selectedCount
  const controlConversationCount = allConversations.length ? requestedConversationCount : 1

  const selectedConversations = useMemo(
    () => selectImportConversations(allConversations, requestedConversationCount),
    [allConversations, requestedConversationCount],
  )

  const stats = useMemo(() => {
    const messages = selectedConversations.flatMap((conversation) => conversation.messages)
    return {
      conversations: selectedConversations.length,
      messages: messages.length,
      user: messages.filter((msg) => msg.role === "user").length,
      assistant: messages.filter((msg) => msg.role === "assistant").length,
    }
  }, [selectedConversations])

  const batchCount = selectedConversations.length
    ? Math.ceil(selectedConversations.length / CHAT_IMPORT_BATCH_SIZE)
    : 0

  function updateSelectedCount(value: number) {
    if (!allConversations.length || !Number.isFinite(value)) return
    setSelectedCount(Math.min(Math.max(1, Math.round(value)), allConversations.length))
  }

  async function handleFile(file: File) {
    try {
      const conversations = await parseChatGPTImportFile(file)
      setSourceName(file.name)
      setAllConversations(conversations)
      setSelectedCount(Math.max(1, conversations.length))
      setResult(null)
      setPartialFailure(null)
      toast.success(t.import.importComplete, {
        description: `${conversations.length} ${t.import.conversations.toLowerCase()}`,
      })
    } catch (error) {
      toast.error(t.import.importFailed, {
        description: error instanceof Error ? error.message : t.import.readFailed,
      })
    }
  }

  function handlePasteImport() {
    const conversations = parseTranscript(pastedText)
    setSourceName("pasted-transcript")
    setAllConversations(conversations)
    setSelectedCount(Math.max(1, conversations.length))
    setResult(null)
    setPartialFailure(null)
    toast.success(t.import.textLoaded)
  }

  async function handleAnalyze() {
    if (!selectedConversations.length) {
      toast.error(t.import.noConversations)
      return
    }
    setLoading(true)
    setResult(null)
    setPartialFailure(null)
    setAnalysisProgress(null)
    try {
      const batches = chunkConversations(selectedConversations, CHAT_IMPORT_BATCH_SIZE)
      const responses: ChatImportAnalyzeResponse[] = []

      for (let index = 0; index < batches.length; index += 1) {
        setAnalysisProgress({ completed: index, total: batches.length })
        const batchSourceName = batches.length > 1
          ? `${sourceName || "chat-import"} batch ${index + 1} of ${batches.length}`
          : sourceName
        try {
          const response = await analyzeChatImport(DEMO_USER_ID, batches[index], batchSourceName, analysisMode)
          responses.push(response)
          setAnalysisProgress({ completed: index + 1, total: batches.length })
        } catch (error) {
          if (!responses.length) throw error

          const message = error instanceof Error ? error.message : t.import.tryShortly
          const partialResult = mergeChatImportResponses(responses)
          setResult(partialResult)
          setPartialFailure({ completed: responses.length, total: batches.length, message })
          toast.warning(t.import.partialComplete, {
            description: `${responses.length}/${batches.length} ${t.import.batchesCompleted}. ${t.import.partialSaved}`,
          })
          return
        }
      }

      const response = mergeChatImportResponses(responses)
      setResult(response)
      setPartialFailure(null)
      toast.success(t.import.analysisComplete, {
        description: `${response.updatedSkills.length} ${t.import.updatedSkills}`,
      })
    } catch (error) {
      toast.error(t.import.analysisFailed, {
        description: error instanceof Error ? error.message : t.import.tryShortly,
      })
    } finally {
      setLoading(false)
      setAnalysisProgress(null)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      <header className="flex flex-col gap-2">
        <span className="w-fit rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          {t.import.badge}
        </span>
        <h1 className="font-heading text-3xl font-bold tracking-tight">{t.import.title}</h1>
        <p className="max-w-3xl text-muted-foreground">{t.import.description}</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ListChecks className="size-5 text-primary" />
                {t.import.howTitle}
              </CardTitle>
              <CardDescription>{t.import.howDescription}</CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm text-muted-foreground">
                {t.import.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Inbox className="size-5 text-primary" />
                {t.import.source}
              </CardTitle>
              <CardDescription>{t.import.sourceDescription}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip,.json,application/json,application/zip"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void handleFile(file)
                  event.currentTarget.value = ""
                }}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <Button variant="outline" size="lg" onClick={() => fileInputRef.current?.click()}>
                  <Upload data-icon="inline-start" />
                  {t.import.upload}
                </Button>
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={handlePasteImport}
                  disabled={!pastedText.trim()}
                >
                  <FileJson data-icon="inline-start" />
                  {t.import.pasted}
                </Button>
              </div>
              <Textarea
                value={pastedText}
                onChange={(event) => setPastedText(event.target.value)}
                placeholder={t.import.placeholder}
                className="min-h-36 resize-y"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileArchive className="size-5 text-primary" />
                {t.import.scope}
              </CardTitle>
              <CardDescription>{sourceName || t.import.noSource}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label={t.import.loaded} value={allConversations.length} />
                <Stat label={t.import.selected} value={stats.conversations} />
                <Stat label={t.import.user} value={stats.user} />
                <Stat label={t.import.ai} value={stats.assistant} />
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-sm font-medium" htmlFor="conversation-count">
                    {t.import.conversationsToAnalyze}
                  </label>
                  <span className="text-sm text-muted-foreground">{stats.conversations}</span>
                </div>
                <input
                  id="conversation-count"
                  type="range"
                  min={1}
                  max={Math.max(1, allConversations.length)}
                  value={controlConversationCount}
                  onChange={(event) => updateSelectedCount(Number(event.target.value))}
                  disabled={!allConversations.length}
                  className="w-full accent-primary"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={Math.max(1, allConversations.length)}
                    value={stats.conversations}
                    onChange={(event) => updateSelectedCount(Number(event.target.value))}
                    disabled={!allConversations.length}
                    className="w-28"
                    aria-label={t.import.conversationsToAnalyze}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => updateSelectedCount(allConversations.length)}
                    disabled={!allConversations.length || stats.conversations === allConversations.length}
                  >
                    {t.import.all}
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {stats.conversations
                      ? `${batchCount} ${batchCount === 1 ? t.import.batch : t.import.batches} · ${t.import.batchHint}`
                      : t.import.previewEmpty}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {(["fast", "deep"] as DiagnosisMode[]).map((mode) => (
                  <Button
                    key={mode}
                    variant={analysisMode === mode ? "default" : "outline"}
                    onClick={() => setAnalysisMode(mode)}
                  >
                    {mode === "fast" ? t.import.quick : t.import.deep}
                  </Button>
                ))}
              </div>

              <Button onClick={handleAnalyze} disabled={loading || !selectedConversations.length} size="lg">
                {loading ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Sparkles data-icon="inline-start" />}
                {loading && analysisProgress
                  ? `${t.import.analyzingBatch} ${Math.min(analysisProgress.completed + 1, analysisProgress.total)}/${analysisProgress.total}`
                  : t.import.analyze}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessagesSquare className="size-5 text-primary" />
                {t.import.preview}
              </CardTitle>
              <CardDescription>
                {selectedConversations.length
                  ? `${stats.messages} ${t.import.messagesSelected}`
                  : t.import.previewEmpty}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex max-h-[360px] flex-col gap-3 overflow-auto">
              {selectedConversations.length ? (
                selectedConversations.slice(0, 8).map((conversation) => (
                  <div key={conversation.id ?? conversation.title} className="rounded-lg border border-border p-3">
                    <div className="line-clamp-1 text-sm font-medium">{conversation.title || t.import.untitled}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {conversation.messages.length} {t.chat.messages}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
                  {t.import.zipJson}
                </div>
              )}
            </CardContent>
          </Card>

          {result && (
            <Card>
              <CardHeader>
                <CardTitle>{t.import.harvest}</CardTitle>
                <CardDescription>
                  CEFR {result.analysis.cefrEstimate} · {t.import.score} {result.analysis.overallScore} ·{" "}
                  {result.importStats.conversationCount} {t.import.conversations.toLowerCase()}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-5">
                {partialFailure && (
                  <Alert className="border-warning/40 bg-warning/10">
                    <AlertTriangle className="size-4 text-warning" />
                    <AlertTitle>{t.import.partialComplete}</AlertTitle>
                    <AlertDescription>
                      {partialFailure.completed}/{partialFailure.total} {t.import.batchesCompleted}.{" "}
                      {t.import.partialSaved} {partialFailure.message}
                    </AlertDescription>
                  </Alert>
                )}
                <p className="leading-relaxed text-muted-foreground">{result.analysis.summaryZh}</p>

                <div className="grid gap-3 sm:grid-cols-2">
                  <InsightList title={t.import.blindSpots} items={result.analysis.topBlindSpotsZh} />
                  <InsightList title={t.import.aiConfirmed} items={result.analysis.assistantConfirmedWeaknessesZh} />
                </div>

                <div className="flex flex-col gap-3">
                  {result.analysis.weaknesses.map((weakness) => (
                    <div key={`${weakness.code}-${weakness.evidenceQuote}`} className="rounded-lg border border-border p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={severityVariant[weakness.severity]}>{weakness.severity}</Badge>
                        <Badge variant="outline">{t.import.evidence[weakness.evidenceType]}</Badge>
                        <span className="text-sm font-medium">{weakness.category}</span>
                      </div>
                      <blockquote className="mt-3 border-l-2 border-primary/40 pl-3 text-sm text-muted-foreground">
                        {weakness.evidenceQuote}
                      </blockquote>
                      <div className="mt-3 flex flex-col gap-1 text-sm">
                        <span className="font-medium text-success">{weakness.suggestedBetterEnglish}</span>
                        <span>{weakness.explanationZh}</span>
                        <span className="text-muted-foreground">{weakness.practiceGoal}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <InsightList title={t.import.nextActions} items={result.analysis.recommendedNextActionsZh} />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

function chunkConversations(conversations: ChatImportConversation[], size: number) {
  const chunks: ChatImportConversation[][] = []
  for (let index = 0; index < conversations.length; index += size) {
    chunks.push(conversations.slice(index, index + size))
  }
  return chunks
}

function mergeChatImportResponses(responses: ChatImportAnalyzeResponse[]): ChatImportAnalyzeResponse {
  if (responses.length === 1) return responses[0]

  const latest = responses[responses.length - 1]
  const importStats = responses.reduce(
    (stats, response) => ({
      conversationCount: stats.conversationCount + response.importStats.conversationCount,
      messageCount: stats.messageCount + response.importStats.messageCount,
      userMessageCount: stats.userMessageCount + response.importStats.userMessageCount,
      assistantMessageCount: stats.assistantMessageCount + response.importStats.assistantMessageCount,
    }),
    { conversationCount: 0, messageCount: 0, userMessageCount: 0, assistantMessageCount: 0 },
  )

  const weightTotal = Math.max(1, importStats.conversationCount)
  const overallScore = Math.round(
    responses.reduce(
      (sum, response) => sum + response.analysis.overallScore * Math.max(1, response.importStats.conversationCount),
      0,
    ) / weightTotal,
  )
  const cefrEstimate = averageCefrEstimate(responses)
  const updatedSkills = Array.from(
    responses
      .flatMap((response) => response.updatedSkills)
      .reduce((skills, skill) => skills.set(skill.skillCode, skill), new Map<string, SkillState>())
      .values(),
  )

  return {
    ...latest,
    submission: {
      ...latest.submission,
      originalText: responses.map((response) => response.submission.originalText).filter(Boolean).join("\n\n"),
      correctedText: responses.map((response) => response.analysis.summaryZh).filter(Boolean).join("\n\n"),
      cefrEstimate,
      summaryZh: responses.map((response, index) => `[${index + 1}/${responses.length}] ${response.analysis.summaryZh}`).join("\n\n"),
    },
    analysis: {
      ...latest.analysis,
      cefrEstimate,
      overallScore,
      summaryZh: responses.map((response, index) => `[${index + 1}/${responses.length}] ${response.analysis.summaryZh}`).join("\n\n"),
      strengthsZh: uniqueStrings(responses.flatMap((response) => response.analysis.strengthsZh)),
      topBlindSpotsZh: uniqueStrings(responses.flatMap((response) => response.analysis.topBlindSpotsZh)),
      weaknesses: uniqueBy(
        responses.flatMap((response) => response.analysis.weaknesses),
        (weakness) => `${weakness.code}:${weakness.evidenceQuote}`,
      ),
      assistantConfirmedWeaknessesZh: uniqueStrings(
        responses.flatMap((response) => response.analysis.assistantConfirmedWeaknessesZh),
      ),
      recommendedNextActionsZh: uniqueStrings(
        responses.flatMap((response) => response.analysis.recommendedNextActionsZh),
      ),
    },
    savedErrors: responses.flatMap((response) => response.savedErrors),
    updatedSkills,
    profile: latest.profile,
    importStats,
  }
}

function averageCefrEstimate(responses: ChatImportAnalyzeResponse[]) {
  const totalWeight = responses.reduce((sum, response) => sum + Math.max(1, response.importStats.conversationCount), 0)
  const average = responses.reduce((sum, response) => {
    const levelIndex = CEFR_LEVELS.indexOf(response.analysis.cefrEstimate)
    return sum + Math.max(0, levelIndex) * Math.max(1, response.importStats.conversationCount)
  }, 0) / Math.max(1, totalWeight)

  return CEFR_LEVELS[Math.min(CEFR_LEVELS.length - 1, Math.max(0, Math.round(average)))]
}

function uniqueStrings(items: string[]) {
  return uniqueBy(items.filter(Boolean), (item) => item.trim().toLowerCase())
}

function uniqueBy<T>(items: T[], getKey: (item: T) => string) {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = getKey(item)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-heading text-2xl font-bold">{value}</div>
    </div>
  )
}

function InsightList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className={cn("rounded-lg bg-muted/50 p-4", !items.length && "hidden")}>
      <div className="text-sm font-medium">{title}</div>
      <ul className="mt-2 flex flex-col gap-1 text-sm text-muted-foreground">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  )
}
