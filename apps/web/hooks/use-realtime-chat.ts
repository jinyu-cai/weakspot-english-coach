"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createRealtimeSession, saveVoiceTranscript } from "@/lib/api-client"
import type { VoiceCompletion } from "@/lib/types"

export type ConnectionStatus = "idle" | "connecting" | "connected" | "error"

interface TranscriptEntry {
  role: "user" | "assistant"
  text: string
  final: boolean
}

export function useRealtimeChat(userId: string) {
  const [status, setStatus] = useState<ConnectionStatus>("idle")
  const [isMicOn, setIsMicOn] = useState(true)
  const [isAiSpeaking, setIsAiSpeaking] = useState(false)
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [completions, setCompletions] = useState<VoiceCompletion | null>(null)
  const [error, setError] = useState<string | null>(null)

  const pcRef = useRef<RTCPeerConnection | null>(null)
  const dcRef = useRef<RTCDataChannel | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const modelRef = useRef<string>("")

  const aiTranscriptBufferRef = useRef("")
  const fnCallBufferRef = useRef<Record<string, { name: string; args: string }>>({})

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
        setTranscript((prev) => [...prev, { role: "user", text: text.trim(), final: true }])
      }
    }

    if (type === "response.audio_transcript.delta") {
      aiTranscriptBufferRef.current += (msg.delta as string) || ""
    }
    if (type === "response.audio_transcript.done") {
      const text = aiTranscriptBufferRef.current.trim()
      if (text) {
        setTranscript((prev) => [...prev, { role: "assistant", text, final: true }])
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
  }, [])

  const connect = useCallback(
    async (topic?: string) => {
      if (status === "connecting" || status === "connected") return
      setStatus("connecting")
      setError(null)
      setTranscript([])
      setCompletions(null)

      try {
        const { clientSecret, sessionId, model } = await createRealtimeSession(userId, topic)
        sessionIdRef.current = sessionId
        modelRef.current = model

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        streamRef.current = stream

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
          } else if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
            setStatus("error")
            setError("Connection lost")
          }
        }

        setStatus("connected")
      } catch (err) {
        console.error("[realtime] connect error:", err)
        setStatus("error")
        setError(err instanceof Error ? err.message : "Failed to connect")
        cleanup()
      }
    },
    [userId, status, handleDataChannelMessage],
  )

  function cleanup() {
    dcRef.current?.close()
    dcRef.current = null
    pcRef.current?.close()
    pcRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  const disconnect = useCallback(async () => {
    const sid = sessionIdRef.current
    if (sid && transcript.length > 0) {
      try {
        await saveVoiceTranscript(userId, sid, transcript.map((t) => ({
          role: t.role,
          content: t.text,
        })))
      } catch {
        // best-effort
      }
    }

    cleanup()
    setStatus("idle")
    setIsAiSpeaking(false)
  }, [userId, transcript])

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
    return () => {
      cleanup()
    }
  }, [])

  return {
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
    sessionId: sessionIdRef.current,
  }
}
