"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createRealtimeSession, saveVoiceTranscript } from "@/lib/api-client"
import type { RealtimeVoiceModel, VoiceCompletion } from "@/lib/types"
import { getCopy } from "@/lib/i18n"
import { getOutputLanguage } from "@/lib/language"

export type ConnectionStatus = "idle" | "connecting" | "connected" | "error"

interface TranscriptEntry {
  id: string
  role: "user" | "assistant"
  text: string
  final: boolean
}

interface StoredVoiceTranscript {
  sessionId: string
  transcript: TranscriptEntry[]
}

const TRANSCRIPT_SETTLE_MS = 1500

function pendingTranscriptStorageKey(userId: string) {
  return `weakspot:pending-voice-transcript:${userId}`
}

function transcriptMessageId(message: Record<string, unknown>, role: TranscriptEntry["role"]) {
  for (const key of ["item_id", "response_id", "event_id"]) {
    const value = message[key]
    if (typeof value === "string" && value.trim()) return `${role}:${value.trim()}`
  }
  const randomId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
  return `${role}:${randomId}`
}

export function useRealtimeChat(
  userId: string,
  options?: {
    /** Called after an unexpected disconnect (e.g. duration limit) once transcript is saved. */
    onAutoEnd?: (sessionId?: string) => void
  },
) {
  const [status, setStatus] = useState<ConnectionStatus>("idle")
  const [isMicOn, setIsMicOn] = useState(true)
  const [isAiSpeaking, setIsAiSpeaking] = useState(false)
  const [isSavingTranscript, setIsSavingTranscript] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [completions, setCompletions] = useState<VoiceCompletion | null>(null)
  const [error, setError] = useState<string | null>(null)

  const pcRef = useRef<RTCPeerConnection | null>(null)
  const dcRef = useRef<RTCDataChannel | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const modelRef = useRef<string>("")
  const transcriptRef = useRef<TranscriptEntry[]>([])
  const disconnectPromiseRef = useRef<Promise<string | undefined> | null>(null)
  const onAutoEndRef = useRef(options?.onAutoEnd)
  useEffect(() => {
    onAutoEndRef.current = options?.onAutoEnd
  }, [options?.onAutoEnd])
  const intentionalDisconnectRef = useRef(false)
  const endSessionRef = useRef<(opts?: { intentional?: boolean }) => Promise<string | undefined>>(
    async () => undefined,
  )

  const aiTranscriptBufferRef = useRef("")
  const fnCallBufferRef = useRef<Record<string, { name: string; args: string }>>({})

  const persistPendingTranscript = useCallback((sessionId: string, entries: TranscriptEntry[]) => {
    try {
      const pending: StoredVoiceTranscript = { sessionId, transcript: entries }
      window.sessionStorage.setItem(pendingTranscriptStorageKey(userId), JSON.stringify(pending))
    } catch {
      // Storage can be unavailable in privacy modes; the in-memory retry still works.
    }
  }, [userId])

  const clearPendingTranscript = useCallback(() => {
    try {
      window.sessionStorage.removeItem(pendingTranscriptStorageKey(userId))
    } catch {
      // Ignore unavailable storage.
    }
  }, [userId])

  const appendTranscript = useCallback((entry: TranscriptEntry) => {
    const next = [...transcriptRef.current, entry]
    transcriptRef.current = next
    setTranscript(next)
    if (sessionIdRef.current) {
      persistPendingTranscript(sessionIdRef.current, next)
    }
  }, [persistPendingTranscript])

  const handleDataChannelMessage = useCallback((event: MessageEvent) => {
    let msg: Record<string, unknown>
    try {
      msg = JSON.parse(event.data)
    } catch {
      return
    }
    const type = msg.type as string

    if (type === "conversation.item.input_audio_transcription.completed") {
      const text = (msg.transcript as string) || ""
      if (text.trim()) {
        appendTranscript({
          id: transcriptMessageId(msg, "user"),
          role: "user",
          text: text.trim(),
          final: true,
        })
      }
    }

    if (type === "response.audio_transcript.delta") {
      aiTranscriptBufferRef.current += (msg.delta as string) || ""
    }
    if (type === "response.audio_transcript.done") {
      const text = aiTranscriptBufferRef.current.trim()
      if (text) {
        appendTranscript({
          id: transcriptMessageId(msg, "assistant"),
          role: "assistant",
          text,
          final: true,
        })
      }
      aiTranscriptBufferRef.current = ""
    }

    if (type === "response.audio.delta") {
      setIsAiSpeaking(true)
    }

    if (type === "response.function_call_arguments.delta") {
      const callId = (msg.call_id as string) || ""
      if (!fnCallBufferRef.current[callId]) {
        fnCallBufferRef.current[callId] = { name: (msg.name as string) || "", args: "" }
      }
      fnCallBufferRef.current[callId].args += (msg.delta as string) || ""
    }

    if (type === "response.function_call_arguments.done") {
      const callId = (msg.call_id as string) || ""
      const name = (msg.name as string) || fnCallBufferRef.current[callId]?.name || ""
      const argsStr = (msg.arguments as string) || fnCallBufferRef.current[callId]?.args || ""
      delete fnCallBufferRef.current[callId]

      try {
        const args = JSON.parse(argsStr)
        if (name === "suggest_completion") {
          setCompletions({
            partialText: args.partialText || "",
            suggestions: args.suggestions || [],
            hintZh: args.hintZh || "",
          })
        }
      } catch {
        // malformed function call args
      }

      if (dcRef.current?.readyState === "open") {
        dcRef.current.send(
          JSON.stringify({
            type: "conversation.item.create",
            item: {
              type: "function_call_output",
              call_id: callId,
              output: JSON.stringify({ displayed: true }),
            },
          }),
        )
        dcRef.current.send(JSON.stringify({ type: "response.create" }))
      }
    }

    if (type === "response.done") {
      setIsAiSpeaking(false)
    }

    if (type === "error") {
      const detail = (msg.error as Record<string, unknown>)?.message || "Unknown error"
      console.error("[realtime] server error:", detail)
      setError(String(detail))
    }
  }, [appendTranscript])

  const stopMicrophone = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }, [])

  const cleanup = useCallback(() => {
    dcRef.current?.close()
    dcRef.current = null
    pcRef.current?.close()
    pcRef.current = null
    stopMicrophone()
  }, [stopMicrophone])

  const connect = useCallback(
    async (topic?: string, realtimeModel: RealtimeVoiceModel = "gpt-realtime-mini-2025-12-15") => {
      if (status === "connecting" || status === "connected") return
      if (sessionIdRef.current && transcriptRef.current.length > 0) {
        setStatus("error")
        setError(getCopy(getOutputLanguage()).chat.voicePanel.saveTranscriptFailed)
        return
      }
      setStatus("connecting")
      setError(null)
      transcriptRef.current = []
      setTranscript([])
      setCompletions(null)
      clearPendingTranscript()
      sessionIdRef.current = null
      setSessionId(null)

      try {
        const { clientSecret, sessionId, model } = await createRealtimeSession(userId, topic, realtimeModel)
        sessionIdRef.current = sessionId
        setSessionId(sessionId)
        modelRef.current = model
        persistPendingTranscript(sessionId, [])

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        streamRef.current = stream
        setIsMicOn(true)

        const pc = new RTCPeerConnection()
        pcRef.current = pc

        const audioEl = document.createElement("audio")
        audioEl.autoplay = true
        pc.ontrack = (e) => {
          audioEl.srcObject = e.streams[0]
        }

        stream.getTracks().forEach((track) => pc.addTrack(track, stream))

        const dc = pc.createDataChannel("oai-events")
        dcRef.current = dc
        dc.onmessage = handleDataChannelMessage

        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)

        const sdpResp = await fetch("https://api.openai.com/v1/realtime/calls", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${clientSecret}`,
            "Content-Type": "application/sdp",
          },
          body: offer.sdp,
        })

        if (!sdpResp.ok) {
          throw new Error(`WebRTC SDP exchange failed: ${sdpResp.status}`)
        }

        const answerSdp = await sdpResp.text()
        await pc.setRemoteDescription({ type: "answer", sdp: answerSdp })

        pc.onconnectionstatechange = () => {
          if (pc.connectionState === "connected") {
            setStatus("connected")
          } else if (
            (pc.connectionState === "failed" || pc.connectionState === "disconnected")
            && !intentionalDisconnectRef.current
          ) {
            // Duration limit / network drop: save transcript and hand off to feedback
            // instead of wiping the practice view.
            void (async () => {
              try {
                const endedSessionId = await endSessionRef.current({ intentional: false })
                onAutoEndRef.current?.(endedSessionId)
              } catch {
                setStatus("error")
                setError(getCopy(getOutputLanguage()).chat.voicePanel.connectionLost)
              }
            })()
          }
        }

        setStatus("connected")
      } catch (err) {
        console.error("[realtime] connect error:", err)
        setStatus("error")
        setError(err instanceof Error ? err.message : getCopy(getOutputLanguage()).chat.voicePanel.failedConnect)
        cleanup()
        if (transcriptRef.current.length === 0) {
          sessionIdRef.current = null
          setSessionId(null)
          clearPendingTranscript()
        }
      }
    },
    [userId, status, handleDataChannelMessage, cleanup, clearPendingTranscript, persistPendingTranscript],
  )

  const endSession = useCallback((opts?: { intentional?: boolean }): Promise<string | undefined> => {
    if (disconnectPromiseRef.current) return disconnectPromiseRef.current
    intentionalDisconnectRef.current = opts?.intentional !== false

    const pending = (async () => {
      const sid = sessionIdRef.current

      // Stop recording immediately, but keep the data channel briefly alive so
      // the final transcription-completed event can arrive before we snapshot.
      stopMicrophone()
      setIsMicOn(false)
      setIsSavingTranscript(true)
      setError(null)
      if (sid && dcRef.current?.readyState === "open") {
        await new Promise((resolve) => window.setTimeout(resolve, TRANSCRIPT_SETTLE_MS))
      }

      const snapshot = [...transcriptRef.current]
      const hasUserTranscript = snapshot.some((entry) => entry.role === "user" && entry.text.trim())
      cleanup()
      setIsAiSpeaking(false)

      if (sid && snapshot.length > 0) {
        try {
          await saveVoiceTranscript(userId, sid, snapshot.map((entry) => ({
            role: entry.role,
            content: entry.text,
            clientMessageId: entry.id,
          })))
        } catch (err) {
          persistPendingTranscript(sid, snapshot)
          setStatus("error")
          setError(getCopy(getOutputLanguage()).chat.voicePanel.saveTranscriptFailed)
          throw err
        } finally {
          setIsSavingTranscript(false)
        }
      } else {
        setIsSavingTranscript(false)
      }

      clearPendingTranscript()
      sessionIdRef.current = null
      setSessionId(null)
      transcriptRef.current = []
      setTranscript([])
      setStatus("idle")
      intentionalDisconnectRef.current = false
      return hasUserTranscript ? sid ?? undefined : undefined
    })()

    const guarded = pending.finally(() => {
      disconnectPromiseRef.current = null
    })
    disconnectPromiseRef.current = guarded
    return guarded
  }, [userId, cleanup, clearPendingTranscript, persistPendingTranscript, stopMicrophone])

  useEffect(() => {
    endSessionRef.current = endSession
  }, [endSession])

  const disconnect = useCallback((): Promise<string | undefined> => {
    return endSession({ intentional: true })
  }, [endSession])

  const toggleMic = useCallback(() => {
    const stream = streamRef.current
    if (!stream) return
    const audioTrack = stream.getAudioTracks()[0]
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled
      setIsMicOn(audioTrack.enabled)
    }
  }, [])

  const dismissCompletions = useCallback(() => {
    setCompletions(null)
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const raw = window.sessionStorage.getItem(pendingTranscriptStorageKey(userId))
        if (!raw) return
        const stored = JSON.parse(raw) as Partial<StoredVoiceTranscript>
        const restored: TranscriptEntry[] = Array.isArray(stored.transcript)
          ? stored.transcript.flatMap((entry, index) => {
              if (
                !entry
                || (entry.role !== "user" && entry.role !== "assistant")
                || typeof entry.text !== "string"
                || !entry.text.trim()
              ) {
                return []
              }
              return [{
                id: typeof entry.id === "string" && entry.id
                  ? entry.id
                  : `recovered:${entry.role}:${index}`,
                role: entry.role,
                text: entry.text.trim(),
                final: true,
              }]
            })
          : []
        if (typeof stored.sessionId !== "string" || !stored.sessionId || restored.length === 0) {
          clearPendingTranscript()
          return
        }
        sessionIdRef.current = stored.sessionId
        setSessionId(stored.sessionId)
        transcriptRef.current = restored
        setTranscript(restored)
        setStatus("error")
        setError(getCopy(getOutputLanguage()).chat.voicePanel.recoveredTranscript)
      } catch {
        clearPendingTranscript()
      }
    }, 0)
    return () => window.clearTimeout(timer)
  }, [userId, clearPendingTranscript])

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      const sid = sessionIdRef.current
      const pendingEntries = transcriptRef.current
      if (!sid || (pendingEntries.length === 0 && !pcRef.current)) return
      if (pendingEntries.length > 0) {
        persistPendingTranscript(sid, pendingEntries)
      }
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [persistPendingTranscript])

  useEffect(() => {
    return () => {
      const sid = sessionIdRef.current
      if (sid && transcriptRef.current.length > 0) {
        persistPendingTranscript(sid, transcriptRef.current)
      }
      cleanup()
    }
  }, [cleanup, persistPendingTranscript])

  return {
    status,
    error,
    connect,
    disconnect,
    toggleMic,
    isMicOn,
    isAiSpeaking,
    isSavingTranscript,
    hasPendingTranscript: Boolean(sessionId && transcript.length > 0),
    transcript,
    completions,
    dismissCompletions,
    sessionId,
  }
}
