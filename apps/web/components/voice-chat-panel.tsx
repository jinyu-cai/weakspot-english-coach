"use client"

import { useEffect, useRef, useState } from "react"
import {
  Lightbulb,
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  Volume2,
  X,
} from "lucide-react"
import { useRealtimeChat } from "@/hooks/use-realtime-chat"
import { DEMO_USER_ID } from "@/lib/mock-data"
import type { RealtimeVoiceModel } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/components/language-provider"

interface VoiceChatPanelProps {
  topic?: string
  onEnd: (sessionId?: string) => void
}

export function VoiceChatPanel({ topic, onEnd }: VoiceChatPanelProps) {
  const [voiceModel, setVoiceModel] = useState<RealtimeVoiceModel>("gpt-realtime-mini-2025-12-15")
  const { t } = useLanguage()
  const {
    status,
    error,
    connect,
    disconnect,
    toggleMic,
    isMicOn,
    isAiSpeaking,
    transcript,
    completions,
    dismissCompletions,
    sessionId,
  } = useRealtimeChat(DEMO_USER_ID)

  const transcriptEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [transcript])

  async function handleConnect() {
    await connect(topic, voiceModel)
  }

  async function handleEnd() {
    const sid = sessionId
    await disconnect()
    onEnd(sid ?? undefined)
  }

  // ---- Not connected: show start button ----
  if (status === "idle" || status === "error") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6">
        <div className="flex size-24 items-center justify-center rounded-full bg-primary/10">
          <Mic className="size-12 text-primary" />
        </div>
        <div className="flex flex-col items-center gap-2 text-center">
          <h3 className="text-lg font-medium">{t.chat.voicePanel.title}</h3>
          <p className="max-w-sm text-sm text-muted-foreground">{t.chat.voicePanel.description}</p>
          {error && (
            <p className="mt-1 text-sm text-destructive">{error}</p>
          )}
        </div>
        <ToggleGroup
          value={[voiceModel]}
          onValueChange={(v) => v[0] && setVoiceModel(v[0] as RealtimeVoiceModel)}
          className="rounded-lg border border-border p-0.5"
        >
          <ToggleGroupItem value="gpt-realtime-mini-2025-12-15" className="h-8 rounded-md px-3 text-xs">
            Mini
          </ToggleGroupItem>
          <ToggleGroupItem value="gpt-realtime-2" className="h-8 rounded-md px-3 text-xs">
            Realtime 2
          </ToggleGroupItem>
        </ToggleGroup>
        <Button size="lg" onClick={handleConnect} className="gap-2">
          <Phone className="size-5" />
          {t.chat.voicePanel.start}
        </Button>
      </div>
    )
  }

  // ---- Connecting ----
  if (status === "connecting") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <Spinner className="size-8" />
        <p className="text-sm text-muted-foreground">{t.chat.voicePanel.connecting}</p>
      </div>
    )
  }

  // ---- Connected: live conversation ----
  return (
    <div className="flex h-full flex-col">
      {/* Transcript area */}
      <div className="flex-1 overflow-y-auto px-2 py-4">
        {transcript.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
            <Volume2 className="size-8 opacity-30" />
            <p className="text-sm">{t.chat.voicePanel.empty}</p>
          </div>
        )}
        <div className="flex flex-col gap-3">
          {transcript.map((entry, i) => (
            <div
              key={i}
              className={cn(
                "flex flex-col gap-0.5",
                entry.role === "user" ? "items-end" : "items-start",
              )}
            >
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {entry.role === "user" ? t.chat.voicePanel.you : t.chat.voicePanel.coach}
              </span>
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-2 text-sm leading-relaxed",
                  entry.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/60 text-foreground",
                )}
              >
                {entry.text}
              </div>
            </div>
          ))}
          {isAiSpeaking && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="flex gap-0.5">
                <span className="inline-block size-1.5 animate-bounce rounded-full bg-primary [animation-delay:0ms]" />
                <span className="inline-block size-1.5 animate-bounce rounded-full bg-primary [animation-delay:150ms]" />
                <span className="inline-block size-1.5 animate-bounce rounded-full bg-primary [animation-delay:300ms]" />
              </span>
              {t.chat.voicePanel.speaking}
            </div>
          )}
        </div>
        <div ref={transcriptEndRef} />
      </div>

      {/* Completion suggestions (shown only when user is stuck) */}
      {completions && (
        <div className="border-t border-border bg-muted/20 px-3 py-3">
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
                <Lightbulb className="size-3.5" />
                {t.chat.voicePanel.maybe}
              </div>
              <button
                onClick={dismissCompletions}
                className="rounded p-0.5 hover:bg-muted"
              >
                <X className="size-3.5 text-muted-foreground" />
              </button>
            </div>
            <p className="mb-1.5 text-xs text-muted-foreground">{completions.hintZh}</p>
            <div className="flex flex-col gap-1">
              {completions.suggestions.map((s, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
                >
                  <span className="text-muted-foreground">{completions.partialText} </span>
                  <span className="font-medium text-primary">{s}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Controls bar */}
      <div className="border-t border-border px-4 py-4">
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="icon"
            className={cn(
              "size-12 rounded-full",
              !isMicOn && "border-destructive/50 bg-destructive/10",
            )}
            onClick={toggleMic}
          >
            {isMicOn ? <Mic className="size-5" /> : <MicOff className="size-5 text-destructive" />}
          </Button>

          {isAiSpeaking && (
            <div className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5">
              <Volume2 className="size-4 text-primary" />
              <span className="text-xs font-medium text-primary">{t.chat.voicePanel.aiSpeaking}</span>
            </div>
          )}

          <Button
            variant="destructive"
            size="icon"
            className="size-12 rounded-full"
            onClick={handleEnd}
          >
            <PhoneOff className="size-5" />
          </Button>
        </div>
        <div className="mt-2 flex items-center justify-center gap-3">
          <Badge variant="secondary" className="gap-1 text-[10px]">
            {isMicOn ? t.chat.voicePanel.listening : t.chat.voicePanel.muted}
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            {voiceModel === "gpt-realtime-2" ? "Realtime 2" : "Mini"}
          </Badge>
        </div>
      </div>
    </div>
  )
}
