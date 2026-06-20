"use client"

import { useMemo, useRef, useState } from "react"
import { FileArchive, FileJson, Inbox, Loader2, MessagesSquare, Sparkles, Upload } from "lucide-react"
import { toast } from "sonner"
import { analyzeChatImport } from "@/lib/api-client"
import {
  parseChatGPTImportFile,
  parseTranscript,
  selectImportConversations,
} from "@/lib/chatgpt-import"
import { DEMO_USER_ID } from "@/lib/mock-data"
import type {
  ChatImportAnalyzeResponse,
  ChatImportConversation,
  ChatImportEvidenceType,
  DiagnosisMode,
  Severity,
} from "@/lib/types"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"

const evidenceLabels: Record<ChatImportEvidenceType, string> = {
  user_error: "User error",
  expression_gap: "Expression gap",
  assistant_correction: "AI correction",
  assistant_advice: "AI advice",
}

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
  const [result, setResult] = useState<ChatImportAnalyzeResponse | null>(null)

  const selectedConversations = useMemo(
    () => selectImportConversations(allConversations, selectedCount),
    [allConversations, selectedCount],
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

  async function handleFile(file: File) {
    try {
      const conversations = await parseChatGPTImportFile(file)
      setSourceName(file.name)
      setAllConversations(conversations)
      setResult(null)
      toast.success("Import complete", {
        description: `Found ${conversations.length} analyzable conversations.`,
      })
    } catch (error) {
      toast.error("Import failed", {
        description: error instanceof Error ? error.message : "Couldn't read this file.",
      })
    }
  }

  function handlePasteImport() {
    const conversations = parseTranscript(pastedText)
    setSourceName("pasted-transcript")
    setAllConversations(conversations)
    setResult(null)
    toast.success("Text loaded")
  }

  async function handleAnalyze() {
    if (!selectedConversations.length) {
      toast.error("No conversations to analyze")
      return
    }
    setLoading(true)
    setResult(null)
    try {
      const response = await analyzeChatImport(DEMO_USER_ID, selectedConversations, sourceName, analysisMode)
      setResult(response)
      toast.success("Conversation analysis complete", {
        description: `Updated ${response.updatedSkills.length} skills in your profile.`,
      })
    } catch (error) {
      toast.error("Analysis failed", {
        description: error instanceof Error ? error.message : "Please try again shortly.",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      <header className="flex flex-col gap-2">
        <span className="w-fit rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          Chat history import
        </span>
        <h1 className="font-heading text-3xl font-bold tracking-tight">Import ChatGPT conversations</h1>
        <p className="max-w-3xl text-muted-foreground">
          Extract weaknesses from your messages, your requests for help, and the corrections the AI already gave you,
          then write them into your learning profile.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Inbox className="size-5 text-primary" />
                Source
              </CardTitle>
              <CardDescription>ChatGPT data export ZIP, conversations.json, or pasted transcript.</CardDescription>
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
                  Upload export
                </Button>
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={handlePasteImport}
                  disabled={!pastedText.trim()}
                >
                  <FileJson data-icon="inline-start" />
                  Use pasted text
                </Button>
              </div>
              <Textarea
                value={pastedText}
                onChange={(event) => setPastedText(event.target.value)}
                placeholder={"User: I want to say...\nAssistant: You can say..."}
                className="min-h-36 resize-y"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileArchive className="size-5 text-primary" />
                Scope
              </CardTitle>
              <CardDescription>{sourceName || "No source loaded"}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Loaded" value={allConversations.length} />
                <Stat label="Selected" value={stats.conversations} />
                <Stat label="User" value={stats.user} />
                <Stat label="AI" value={stats.assistant} />
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-sm font-medium" htmlFor="conversation-count">
                    Conversations
                  </label>
                  <span className="text-sm text-muted-foreground">{selectedCount}</span>
                </div>
                <input
                  id="conversation-count"
                  type="range"
                  min={1}
                  max={20}
                  value={selectedCount}
                  onChange={(event) => setSelectedCount(Number(event.target.value))}
                  className="w-full accent-primary"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {(["fast", "deep"] as DiagnosisMode[]).map((mode) => (
                  <Button
                    key={mode}
                    variant={analysisMode === mode ? "default" : "outline"}
                    onClick={() => setAnalysisMode(mode)}
                  >
                    {mode === "fast" ? "Quick" : "Deep"}
                  </Button>
                ))}
              </div>

              <Button onClick={handleAnalyze} disabled={loading || !selectedConversations.length} size="lg">
                {loading ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Sparkles data-icon="inline-start" />}
                Analyze conversations
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessagesSquare className="size-5 text-primary" />
                Preview
              </CardTitle>
              <CardDescription>
                {selectedConversations.length
                  ? `${stats.messages} messages selected`
                  : "Load a source to preview conversations"}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex max-h-[360px] flex-col gap-3 overflow-auto">
              {selectedConversations.length ? (
                selectedConversations.slice(0, 8).map((conversation) => (
                  <div key={conversation.id ?? conversation.title} className="rounded-lg border border-border p-3">
                    <div className="line-clamp-1 text-sm font-medium">{conversation.title || "Untitled conversation"}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{conversation.messages.length} messages</div>
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
                  ZIP / JSON / transcript
                </div>
              )}
            </CardContent>
          </Card>

          {result && (
            <Card>
              <CardHeader>
                <CardTitle>Weakness harvest</CardTitle>
                <CardDescription>
                  CEFR {result.analysis.cefrEstimate} · score {result.analysis.overallScore} ·{" "}
                  {result.importStats.conversationCount} conversations
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-5">
                <p className="leading-relaxed text-muted-foreground">{result.analysis.summaryZh}</p>

                <div className="grid gap-3 sm:grid-cols-2">
                  <InsightList title="Blind spots" items={result.analysis.topBlindSpotsZh} />
                  <InsightList title="AI confirmed" items={result.analysis.assistantConfirmedWeaknessesZh} />
                </div>

                <div className="flex flex-col gap-3">
                  {result.analysis.weaknesses.map((weakness) => (
                    <div key={`${weakness.code}-${weakness.evidenceQuote}`} className="rounded-lg border border-border p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={severityVariant[weakness.severity]}>{weakness.severity}</Badge>
                        <Badge variant="outline">{evidenceLabels[weakness.evidenceType]}</Badge>
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

                <InsightList title="Next actions" items={result.analysis.recommendedNextActionsZh} />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
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
