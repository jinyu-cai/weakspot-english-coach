"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import {
  ArrowUp,
  ChevronDown,
  ClipboardCheck,
  Keyboard,
  MessageCircle,
  Mic,
  Plus,
  RefreshCw,
} from "lucide-react"
import {
  analyzeSession,
  createChatSession,
  getChatMessages,
  getChatSessions,
  getServerLLMModels,
  sendChatMessage,
} from "@/lib/api-client"
import { DEMO_USER_ID } from "@/lib/mock-data"
import type { ChatMessage, ChatSession, SessionAnalysis, StealthPracticeResult } from "@/lib/types"
import {
  DEFAULT_SERVER_DEEP_MODEL_ID,
  DEFAULT_SERVER_FAST_MODEL_ID,
  formatServerModelSelection,
  loadLLMSettings,
  LLM_SETTINGS_CHANGE_EVENT,
  normalizeServerModelSettings,
  saveLLMSettings,
  serverModelsForMode,
  type ServerLLMModel,
} from "@/lib/llm-settings"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { VoiceChatPanel, type VoiceChatLifecycle } from "@/components/voice-chat-panel"
import { SessionSummary } from "@/components/session-summary"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/components/language-provider"
import { setVoiceNavigationLocked } from "@/lib/voice-navigation-guard"

type ChatMode = "text" | "voice"
type ViewState = "chat" | "analyzing" | "summary"

function formatTextModel(model: string | null | undefined, models: ServerLLMModel[]) {
  if (!model) return "Server default"
  return models.find((option) => option.model === model)?.label ?? model
}

const SCENARIOS = [
  { key: "free", topic: undefined, emoji: "💬" },
  { key: "coffee", topic: "Ordering at a coffee shop", emoji: "☕" },
  { key: "interview", topic: "Job interview practice", emoji: "💼" },
  { key: "travel", topic: "Planning a trip and asking for directions", emoji: "✈️" },
  { key: "restaurant", topic: "Dining out at a restaurant", emoji: "🍽️" },
  { key: "smallTalk", topic: "Making small talk with a new colleague", emoji: "👋" },
] as const

export default function ChatPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [creatingSession, setCreatingSession] = useState(false)
  const [mode, setMode] = useState<ChatMode>("voice")
  const [serverModels, setServerModels] = useState<ServerLLMModel[]>([])
  const [loadingModels, setLoadingModels] = useState(true)
  const [modelsError, setModelsError] = useState(false)
  const [selectedServerDeepModelId, setSelectedServerDeepModelId] = useState(
    () => loadLLMSettings().serverDeepModelId || DEFAULT_SERVER_DEEP_MODEL_ID,
  )
  const [selectedServerFastModelId, setSelectedServerFastModelId] = useState(
    () => loadLLMSettings().serverFastModelId || DEFAULT_SERVER_FAST_MODEL_ID,
  )
  const [viewState, setViewState] = useState<ViewState>("chat")
  const [analysis, setAnalysis] = useState<SessionAnalysis | null>(null)
  const [stealthPractice, setStealthPractice] = useState<StealthPracticeResult | null>(null)
  const [voiceLifecycle, setVoiceLifecycle] = useState<VoiceChatLifecycle>({ active: false, pending: false })
  const { t } = useLanguage()

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const sessionSelectionRef = useRef(0)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  useEffect(() => {
    getChatSessions(DEMO_USER_ID)
      .then(setSessions)
      .catch(() => {})
      .finally(() => setLoadingSessions(false))
  }, [])

  async function retryServerModels() {
    setLoadingModels(true)
    setModelsError(false)
    try {
      const models = await getServerLLMModels()
      if (models.length === 0) throw new Error("No server models available.")
      setServerModels(models)
      const normalized = normalizeServerModelSettings(loadLLMSettings(), models)
      setSelectedServerDeepModelId(normalized.serverDeepModelId)
      setSelectedServerFastModelId(normalized.serverFastModelId)
    } catch {
      setServerModels([])
      setModelsError(true)
    } finally {
      setLoadingModels(false)
    }
  }

  useEffect(() => {
    let active = true
    void getServerLLMModels()
      .then((models) => {
        if (!active) return
        if (models.length === 0) throw new Error("No server models available.")
        setServerModels(models)
        const normalized = normalizeServerModelSettings(loadLLMSettings(), models)
        setSelectedServerDeepModelId(normalized.serverDeepModelId)
        setSelectedServerFastModelId(normalized.serverFastModelId)
      })
      .catch(() => {
        if (!active) return
        setServerModels([])
        setModelsError(true)
      })
      .finally(() => {
        if (active) setLoadingModels(false)
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const syncServerModel = () => {
      const settings = loadLLMSettings()
      setSelectedServerDeepModelId(settings.serverDeepModelId || DEFAULT_SERVER_DEEP_MODEL_ID)
      setSelectedServerFastModelId(settings.serverFastModelId || DEFAULT_SERVER_FAST_MODEL_ID)
    }
    window.addEventListener(LLM_SETTINGS_CHANGE_EVENT, syncServerModel)
    return () => window.removeEventListener(LLM_SETTINGS_CHANGE_EVENT, syncServerModel)
  }, [])

  const deepServerModels = serverModelsForMode(serverModels, "deep")
  const fastServerModels = serverModelsForMode(serverModels, "fast")
  const selectedDeepServerModel = deepServerModels.find((model) => model.id === selectedServerDeepModelId)
  const selectedFastServerModel = fastServerModels.find((model) => model.id === selectedServerFastModelId)
  const voiceNavigationLocked = voiceLifecycle.active || voiceLifecycle.pending

  useEffect(() => {
    setVoiceNavigationLocked(voiceNavigationLocked)
    return () => setVoiceNavigationLocked(false)
  }, [voiceNavigationLocked])

  function selectServerModel(mode: "deep" | "fast", serverModelId: string) {
    const current = loadLLMSettings()
    const next = {
      ...current,
      [mode === "deep" ? "serverDeepModelId" : "serverFastModelId"]: serverModelId,
      apiKey: "",
      model: "",
      fastModel: "",
    }
    saveLLMSettings(next)
    setSelectedServerDeepModelId(next.serverDeepModelId)
    setSelectedServerFastModelId(next.serverFastModelId)
  }

  function resetSession() {
    sessionSelectionRef.current += 1
    setVoiceLifecycle({ active: false, pending: false })
    setActiveSession(null)
    setMessages([])
    setViewState("chat")
    setAnalysis(null)
    setStealthPractice(null)
  }

  async function triggerAnalysis(sessionId: string) {
    setViewState("analyzing")
    setAnalysis(null)
    setStealthPractice(null)
    try {
      const result = await analyzeSession(sessionId)
      setAnalysis(result.analysis)
      setStealthPractice(result.stealthPractice ?? null)
      setActiveSession((current) => current?.id === sessionId
        ? {
            ...current,
            analysis: result.analysis,
            stealthPractice: result.stealthPractice ?? null,
          }
        : current)
      setSessions((current) => current.map((session) => session.id === sessionId
        ? {
            ...session,
            analysis: result.analysis,
            stealthPractice: result.stealthPractice ?? null,
          }
        : session))
      setViewState("summary")
    } catch {
      toast.error(t.chat.analyzeFailed)
      setViewState("chat")
    }
  }

  async function handleNewSession(topic?: string) {
    if (voiceNavigationLocked) {
      toast.error(t.chat.voicePanel.finishBeforeLeaving)
      return
    }
    if (sending) return
    sessionSelectionRef.current += 1
    setCreatingSession(true)
    try {
      const session = await createChatSession(DEMO_USER_ID, topic)
      setSessions((prev) => [session, ...prev])
      setActiveSession(session)
      setMode("text")
      setMessages([])
      setInput("")
      setViewState("chat")
      setAnalysis(null)
      setStealthPractice(null)
    } catch {
      toast.error(t.chat.createFailed)
    } finally {
      setCreatingSession(false)
    }
  }

  async function handleSelectSession(session: ChatSession) {
    const selectionId = ++sessionSelectionRef.current
    setActiveSession(session)
    setMode(session.mode === "voice" ? "voice" : "text")
    setMessages([])
    setInput("")
    setViewState(session.analysis ? "summary" : "chat")
    setAnalysis(session.analysis ?? null)
    setStealthPractice(session.stealthPractice ?? null)
    try {
      const { session: refreshedSession, messages: msgs } = await getChatMessages(session.id, DEMO_USER_ID)
      if (sessionSelectionRef.current !== selectionId) return
      setActiveSession(refreshedSession)
      setSessions((current) => current.map((item) => item.id === refreshedSession.id ? refreshedSession : item))
      setMode(refreshedSession.mode === "voice" ? "voice" : "text")
      setMessages(msgs)
      setViewState(refreshedSession.analysis ? "summary" : "chat")
      setAnalysis(refreshedSession.analysis ?? null)
      setStealthPractice(refreshedSession.stealthPractice ?? null)
    } catch {
      if (sessionSelectionRef.current !== selectionId) return
      toast.error(t.chat.loadFailed)
    }
  }

  async function handleSend() {
    if (!input.trim() || !activeSession || sending) return
    const text = input.trim()
    setInput("")
    setSending(true)

    const optimisticUser: ChatMessage = {
      id: `temp-${Date.now()}`,
      userId: DEMO_USER_ID,
      sessionId: activeSession.id,
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimisticUser])

    try {
      const { userMessage, assistantMessage } = await sendChatMessage(
        DEMO_USER_ID,
        activeSession.id,
        text,
      )
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== optimisticUser.id),
        userMessage,
        assistantMessage,
      ])
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticUser.id))
      setInput(text)
      toast.error(t.chat.sendFailed)
    } finally {
      setSending(false)
      textareaRef.current?.focus()
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  async function handleEndTextChat() {
    if (!activeSession || sending) return
    await triggerAnalysis(activeSession.id)
  }

  async function handleVoiceEnd(sessionId?: string) {
    setVoiceLifecycle({ active: false, pending: false })
    if (sessionId) {
      await triggerAnalysis(sessionId)
    } else {
      resetSession()
    }
  }

  function handleModeChange(nextMode: ChatMode) {
    if (voiceNavigationLocked) {
      toast.error(t.chat.voicePanel.finishBeforeLeaving)
      return
    }
    if (sending) return
    if (nextMode === "text" && activeSession?.mode === "voice") {
      void handleNewSession(activeSession.topic ?? undefined)
      return
    }
    setMode(nextMode)
  }

  // ---- No active session: show session picker ----
  if (!activeSession) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <header className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <h1 className="font-heading text-3xl font-bold tracking-tight">{t.chat.title}</h1>
            <p className="text-muted-foreground">{t.chat.description}</p>
          </div>
          <div className="grid w-full min-w-0 gap-2 text-xs font-medium text-muted-foreground">
            <span>{t.settings.serverModel}</span>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid min-w-0 gap-1">
                <span>{t.settings.deepModel}</span>
                <select
                  aria-label={t.settings.deepModel}
                  value={selectedServerDeepModelId}
                  onChange={(event) => selectServerModel("deep", event.target.value)}
                  disabled={loadingModels && serverModels.length === 0}
                  title={selectedDeepServerModel ? formatServerModelSelection(selectedDeepServerModel) : selectedServerDeepModelId}
                  className="h-10 w-full min-w-0 rounded-lg border border-border bg-background px-3 pr-8 text-sm font-medium text-foreground outline-none transition focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-wait disabled:opacity-60"
                >
                  {loadingModels && serverModels.length === 0 ? (
                    <option value={selectedServerDeepModelId}>{t.settings.serverModelsLoading}</option>
                  ) : deepServerModels.length === 0 ? (
                    <option value={selectedServerDeepModelId}>{selectedServerDeepModelId}</option>
                  ) : (
                    deepServerModels.map((model) => (
                      <option key={model.id} value={model.id}>
                        {formatServerModelSelection(model)}
                      </option>
                    ))
                  )}
                </select>
              </label>
              <label className="grid min-w-0 gap-1">
                <span>{t.settings.fastModel}</span>
                <select
                  aria-label={t.settings.fastModel}
                  value={selectedServerFastModelId}
                  onChange={(event) => selectServerModel("fast", event.target.value)}
                  disabled={loadingModels && serverModels.length === 0}
                  title={selectedFastServerModel ? formatServerModelSelection(selectedFastServerModel) : selectedServerFastModelId}
                  className="h-10 w-full min-w-0 rounded-lg border border-border bg-background px-3 pr-8 text-sm font-medium text-foreground outline-none transition focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-wait disabled:opacity-60"
                >
                  {loadingModels && serverModels.length === 0 ? (
                    <option value={selectedServerFastModelId}>{t.settings.serverModelsLoading}</option>
                  ) : fastServerModels.length === 0 ? (
                    <option value={selectedServerFastModelId}>{selectedServerFastModelId}</option>
                  ) : (
                    fastServerModels.map((model) => (
                      <option key={model.id} value={model.id}>
                        {formatServerModelSelection(model)}
                      </option>
                    ))
                  )}
                </select>
              </label>
            </div>
            <div className="flex justify-end">
              {modelsError && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  title={t.common.tryAgain}
                  aria-label={t.common.tryAgain}
                  onClick={() => void retryServerModels()}
                >
                  <RefreshCw />
                </Button>
              )}
            </div>
            {modelsError && <span className="text-destructive">{t.settings.serverModelsFailed}</span>}
          </div>
        </header>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SCENARIOS.map((s) => {
            const localized = t.chat.scenarios[s.key]
            return (
              <Card
                key={s.key}
                className="relative transition-all hover:border-primary/40 hover:shadow-md"
              >
                <button
                  type="button"
                  aria-label={`${localized[0]}: ${localized[1]}`}
                  title={`${localized[0]}: ${localized[1]}`}
                  disabled={creatingSession}
                  className="absolute inset-0 z-0 cursor-pointer rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-wait"
                  onClick={() => handleNewSession(s.topic)}
                />
                <CardHeader className="pointer-events-none relative z-10 pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <span className="text-xl" aria-hidden="true">{s.emoji}</span>
                    {localized[0]}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pointer-events-none relative z-10">
                  <CardDescription>{localized[1]}</CardDescription>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {creatingSession && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Spinner className="size-4" /> {t.chat.creating}
          </div>
        )}

        {sessions.length > 0 && (
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-medium text-muted-foreground">{t.chat.recent}</h2>
            <div className="flex flex-col gap-2">
              {sessions.slice(0, 5).map((s) => (
                <Card
                  key={s.id}
                  className="relative transition-colors hover:bg-muted/50"
                >
                  <button
                    type="button"
                    aria-label={`${s.topic || s.summary || t.chat.freeChat}: ${s.messageCount} ${t.chat.messages}`}
                    title={`${s.topic || s.summary || t.chat.freeChat}: ${s.messageCount} ${t.chat.messages}`}
                    className="absolute inset-0 z-0 cursor-pointer rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                    onClick={() => handleSelectSession(s)}
                  />
                  <CardContent className="pointer-events-none relative z-10 flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <MessageCircle className="size-4 text-muted-foreground" />
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">
                          {s.topic || s.summary || t.chat.freeChat}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {s.messageCount} {t.chat.messages}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(s.createdAt).toLocaleDateString()}
                    </span>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {loadingSessions && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Spinner className="size-4" /> {t.common.loading}
          </div>
        )}
      </div>
    )
  }

  // ---- Active session: chat view ----
  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] w-full max-w-3xl flex-col">
      {/* Chat header */}
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={resetSession}
            disabled={voiceNavigationLocked || sending}
            title={voiceNavigationLocked ? t.chat.voicePanel.finishBeforeLeaving : undefined}
          >
            <ChevronDown className="size-4 rotate-90" />
            {t.chat.back}
          </Button>
          <div className="flex flex-col">
            <span className="text-sm font-medium">
              {activeSession.topic || t.chat.freeChat}
            </span>
            <span className="text-xs text-muted-foreground">
              {viewState === "summary"
                ? t.chat.analysisComplete
                : viewState === "analyzing"
                  ? t.chat.analyzing
                  : mode === "voice"
                    ? t.chat.voiceMode
                    : `${messages.length} ${t.chat.messages}`}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {viewState === "chat" && mode === "text" && (
            <Badge variant="secondary" className="h-7 rounded-md px-2.5 text-xs">
              {formatTextModel(activeSession.textModel, serverModels)}
            </Badge>
          )}
          {viewState === "chat" && (
            <ToggleGroup
              value={[mode]}
              onValueChange={(v) => v[0] && handleModeChange(v[0] as ChatMode)}
              disabled={voiceNavigationLocked || sending}
              className="rounded-lg border border-border p-0.5"
              title={voiceNavigationLocked ? t.chat.voicePanel.finishBeforeLeaving : undefined}
            >
              <ToggleGroupItem value="voice" className="h-7 gap-1 rounded-md px-2.5 text-xs">
                <Mic className="size-3.5" />
                {t.chat.voice}
              </ToggleGroupItem>
              <ToggleGroupItem value="text" className="h-7 gap-1 rounded-md px-2.5 text-xs">
                <Keyboard className="size-3.5" />
                {t.chat.text}
              </ToggleGroupItem>
            </ToggleGroup>
          )}
          {viewState === "summary" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleNewSession(activeSession.topic ?? undefined)}
              disabled={creatingSession}
            >
              {t.chat.continueChat}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleNewSession(activeSession.topic ?? undefined)}
            disabled={creatingSession || voiceNavigationLocked || sending}
            title={voiceNavigationLocked ? t.chat.voicePanel.finishBeforeLeaving : undefined}
          >
            <Plus className="size-4" />
            {t.chat.new}
          </Button>
        </div>
      </div>

      {/* Analysis summary view */}
      {(viewState === "analyzing" || viewState === "summary") && (
        <SessionSummary
          analysis={analysis}
          stealthPractice={stealthPractice}
          analyzing={viewState === "analyzing"}
          onClose={resetSession}
        />
      )}

      {/* Voice mode */}
      {viewState === "chat" && mode === "voice" && (
        <VoiceChatPanel
          topic={activeSession.topic ?? undefined}
          onEnd={handleVoiceEnd}
          onLifecycleChange={setVoiceLifecycle}
        />
      )}

      {/* Text mode */}
      {viewState === "chat" && mode === "text" && (
        <>
          {/* Messages area */}
          <div className="flex-1 overflow-y-auto py-4">
            {messages.length === 0 && !sending && (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-muted-foreground">
                <MessageCircle className="size-10 opacity-30" />
                <p className="text-sm">
                  {t.chat.empty}
                  <br />
                  <span className="text-xs">
                    {t.chat.emptySub}
                  </span>
                </p>
              </div>
            )}

            <div className="flex flex-col gap-4">
              {messages.map((msg) => (
                <ChatBubble key={msg.id} message={msg} />
              ))}
              {sending && (
                <div className="flex items-center gap-2 px-4 text-sm text-muted-foreground">
                  <Spinner className="size-4" />
                  <span>{t.chat.thinking}</span>
                </div>
              )}
            </div>
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="border-t border-border pt-3">
            <div className="relative flex items-end gap-2">
              <div className="relative flex-1">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t.chat.placeholder}
                  rows={1}
                  className={cn(
                    "w-full resize-none rounded-xl border border-border bg-background px-4 py-3 pr-12 text-sm",
                    "placeholder:text-muted-foreground/60 focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20",
                    "max-h-32 min-h-[2.75rem]",
                  )}
                  style={{ height: "auto", overflow: "hidden" }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement
                    target.style.height = "auto"
                    target.style.height = Math.min(target.scrollHeight, 128) + "px"
                  }}
                  disabled={sending}
                />
              </div>
              <Button
                size="icon"
                className="size-11 shrink-0 rounded-xl"
                onClick={handleSend}
                disabled={!input.trim() || sending}
                aria-label={t.chat.sendMessage}
                title={t.chat.sendMessage}
              >
                <ArrowUp className="size-5" />
              </Button>
            </div>
            <div className="mt-1.5 flex items-center justify-end px-1">
              {messages.filter((m) => m.role === "user").length >= 2 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 gap-1 px-2 text-[10px]"
                  onClick={handleEndTextChat}
                  disabled={sending}
                >
                  <ClipboardCheck className="size-3" />
                  {t.chat.endAnalyze}
                </Button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/* ---- Chat Bubble Component ---- */

function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user"

  return (
    <div className={cn("flex flex-col gap-1.5", isUser ? "items-end" : "items-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted/60 text-foreground",
        )}
      >
        {message.content}
      </div>
    </div>
  )
}
