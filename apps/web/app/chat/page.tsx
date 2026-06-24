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
} from "lucide-react"
import {
  analyzeSession,
  createChatSession,
  getChatMessages,
  getChatSessions,
  sendChatMessage,
} from "@/lib/api-client"
import { DEMO_USER_ID } from "@/lib/mock-data"
import type { ChatMessage, ChatSession, SessionAnalysis, TextChatModel } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { VoiceChatPanel } from "@/components/voice-chat-panel"
import { SessionSummary } from "@/components/session-summary"
import { cn } from "@/lib/utils"

type ChatMode = "text" | "voice"
type ViewState = "chat" | "analyzing" | "summary"

const TEXT_MODEL_LABELS: Record<TextChatModel, string> = {
  "deepseek-v4-flash": "Flash",
  "deepseek-v4-pro": "Pro",
}

const SCENARIOS = [
  { label: "Free Chat", topic: undefined, emoji: "💬", desc: "Talk about anything" },
  { label: "Coffee Shop", topic: "Ordering at a coffee shop", emoji: "☕", desc: "Order drinks & chat with barista" },
  { label: "Job Interview", topic: "Job interview practice", emoji: "💼", desc: "Practice common interview Q&A" },
  { label: "Travel", topic: "Planning a trip and asking for directions", emoji: "✈️", desc: "Navigate airports & ask locals" },
  { label: "Restaurant", topic: "Dining out at a restaurant", emoji: "🍽️", desc: "Order food & handle the bill" },
  { label: "Small Talk", topic: "Making small talk with a new colleague", emoji: "👋", desc: "Break the ice at work" },
]

export default function ChatPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [creatingSession, setCreatingSession] = useState(false)
  const [mode, setMode] = useState<ChatMode>("voice")
  const [selectedTextModel, setSelectedTextModel] = useState<TextChatModel>("deepseek-v4-flash")
  const [viewState, setViewState] = useState<ViewState>("chat")
  const [analysis, setAnalysis] = useState<SessionAnalysis | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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

  function resetSession() {
    setActiveSession(null)
    setMessages([])
    setViewState("chat")
    setAnalysis(null)
  }

  async function triggerAnalysis(sessionId: string) {
    setViewState("analyzing")
    setAnalysis(null)
    try {
      const result = await analyzeSession(sessionId)
      setAnalysis(result.analysis)
      setViewState("summary")
    } catch {
      toast.error("Failed to analyze session.")
      setViewState("chat")
    }
  }

  async function handleNewSession(topic?: string) {
    setCreatingSession(true)
    try {
      const session = await createChatSession(DEMO_USER_ID, topic, selectedTextModel)
      setSessions((prev) => [session, ...prev])
      setActiveSession(session)
      setSelectedTextModel(session.textModel ?? selectedTextModel)
      setMessages([])
      setInput("")
      setViewState("chat")
      setAnalysis(null)
    } catch {
      toast.error("Failed to create chat session.")
    } finally {
      setCreatingSession(false)
    }
  }

  async function handleSelectSession(session: ChatSession) {
    setActiveSession(session)
    setSelectedTextModel(session.textModel ?? "deepseek-v4-flash")
    setMessages([])
    setInput("")
    setViewState("chat")
    setAnalysis(null)
    try {
      const { messages: msgs } = await getChatMessages(session.id, DEMO_USER_ID)
      setMessages(msgs)
    } catch {
      toast.error("Failed to load messages.")
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
      toast.error("Failed to send message. Please try again.")
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
    if (!activeSession) return
    await triggerAnalysis(activeSession.id)
  }

  async function handleVoiceEnd(sessionId?: string) {
    if (sessionId) {
      await triggerAnalysis(sessionId)
    } else {
      resetSession()
    }
  }

  // ---- No active session: show session picker ----
  if (!activeSession) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-2">
            <h1 className="font-heading text-3xl font-bold tracking-tight">Chat Practice</h1>
            <p className="text-muted-foreground">
              Practice real conversations in English. Your expressions are analyzed after each session.
            </p>
          </div>
          <ToggleGroup
            value={[selectedTextModel]}
            onValueChange={(v) => v[0] && setSelectedTextModel(v[0] as TextChatModel)}
            className="w-fit rounded-lg border border-border p-0.5"
          >
            <ToggleGroupItem value="deepseek-v4-flash" className="h-7 rounded-md px-2.5 text-xs">
              Flash
            </ToggleGroupItem>
            <ToggleGroupItem value="deepseek-v4-pro" className="h-7 rounded-md px-2.5 text-xs">
              Pro
            </ToggleGroupItem>
          </ToggleGroup>
        </header>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SCENARIOS.map((s) => (
            <Card
              key={s.label}
              className="cursor-pointer transition-all hover:border-primary/40 hover:shadow-md"
              onClick={() => handleNewSession(s.topic)}
            >
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <span className="text-xl">{s.emoji}</span>
                  {s.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>{s.desc}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>

        {creatingSession && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Spinner className="size-4" /> Creating session...
          </div>
        )}

        {sessions.length > 0 && (
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-medium text-muted-foreground">Recent conversations</h2>
            <div className="flex flex-col gap-2">
              {sessions.slice(0, 5).map((s) => (
                <Card
                  key={s.id}
                  className="cursor-pointer transition-colors hover:bg-muted/50"
                  onClick={() => handleSelectSession(s)}
                >
                  <CardContent className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <MessageCircle className="size-4 text-muted-foreground" />
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">
                          {s.topic || s.summary || "Free Chat"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {s.messageCount} messages
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
            <Spinner className="size-4" /> Loading sessions...
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
          >
            <ChevronDown className="size-4 rotate-90" />
            Back
          </Button>
          <div className="flex flex-col">
            <span className="text-sm font-medium">
              {activeSession.topic || "Free Chat"}
            </span>
            <span className="text-xs text-muted-foreground">
              {viewState === "summary"
                ? "Analysis complete"
                : viewState === "analyzing"
                  ? "Analyzing..."
                  : mode === "voice"
                    ? "Voice mode"
                    : `${messages.length} messages`}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {viewState === "chat" && mode === "text" && (
            <Badge variant="secondary" className="h-7 rounded-md px-2.5 text-xs">
              {TEXT_MODEL_LABELS[activeSession.textModel ?? selectedTextModel]}
            </Badge>
          )}
          {viewState === "chat" && (
            <ToggleGroup
              value={[mode]}
              onValueChange={(v) => v[0] && setMode(v[0] as ChatMode)}
              className="rounded-lg border border-border p-0.5"
            >
              <ToggleGroupItem value="voice" className="h-7 gap-1 rounded-md px-2.5 text-xs">
                <Mic className="size-3.5" />
                Voice
              </ToggleGroupItem>
              <ToggleGroupItem value="text" className="h-7 gap-1 rounded-md px-2.5 text-xs">
                <Keyboard className="size-3.5" />
                Text
              </ToggleGroupItem>
            </ToggleGroup>
          )}
          {viewState === "summary" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setViewState("chat"); setAnalysis(null) }}
            >
              Continue Chat
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleNewSession(activeSession.topic ?? undefined)}
            disabled={creatingSession}
          >
            <Plus className="size-4" />
            New
          </Button>
        </div>
      </div>

      {/* Analysis summary view */}
      {(viewState === "analyzing" || viewState === "summary") && (
        <SessionSummary
          analysis={analysis}
          analyzing={viewState === "analyzing"}
          onClose={resetSession}
        />
      )}

      {/* Voice mode */}
      {viewState === "chat" && mode === "voice" && (
        <VoiceChatPanel
          topic={activeSession.topic ?? undefined}
          onEnd={handleVoiceEnd}
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
                  Start typing to begin the conversation!
                  <br />
                  <span className="text-xs">
                    Chat naturally — your English will be analyzed when you end the session.
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
                  <span>Thinking...</span>
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
                  placeholder="Type your message in English..."
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
                >
                  <ClipboardCheck className="size-3" />
                  End &amp; Analyze
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
