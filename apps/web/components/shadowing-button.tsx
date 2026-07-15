"use client"

import { useEffect, useRef, useState } from "react"
import { Square, Volume2 } from "lucide-react"
import { toast } from "sonner"
import { synthesizeCoachSpeech } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/components/language-provider"

interface ShadowingButtonProps {
  text: string
}

export function ShadowingButton({ text }: ShadowingButtonProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioUrlRef = useRef<string | null>(null)
  const requestRef = useRef(0)
  const usingBrowserVoiceRef = useRef(false)
  const { t } = useLanguage()

  function stopPlayback() {
    requestRef.current += 1
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      audioRef.current = null
    }
    if (
      usingBrowserVoiceRef.current
      && typeof window !== "undefined"
      && "speechSynthesis" in window
    ) {
      window.speechSynthesis.cancel()
    }
    usingBrowserVoiceRef.current = false
    setIsPlaying(false)
  }

  useEffect(() => {
    return () => {
      requestRef.current += 1
      audioRef.current?.pause()
      if (usingBrowserVoiceRef.current && "speechSynthesis" in window) {
        window.speechSynthesis.cancel()
      }
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
    }
  }, [])

  function playBrowserVoice(requestId: number) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setIsPlaying(false)
      toast.error(t.chat.summary.shadowUnavailable)
      return
    }
    usingBrowserVoiceRef.current = true
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = "en-US"
    utterance.rate = 0.94
    const finish = () => {
      if (requestRef.current !== requestId) return
      usingBrowserVoiceRef.current = false
      setIsPlaying(false)
    }
    utterance.onend = finish
    utterance.onerror = finish
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
  }

  async function handlePlayback() {
    if (isPlaying) {
      stopPlayback()
      return
    }

    const requestId = requestRef.current + 1
    requestRef.current = requestId
    setIsPlaying(true)
    try {
      if (!audioUrlRef.current) {
        const blob = await synthesizeCoachSpeech(text, "natural")
        if (requestRef.current !== requestId) return
        audioUrlRef.current = URL.createObjectURL(blob)
      }
      if (requestRef.current !== requestId) return
      const audio = new Audio(audioUrlRef.current)
      audioRef.current = audio
      const finish = () => {
        if (requestRef.current !== requestId) return
        audioRef.current = null
        setIsPlaying(false)
      }
      audio.onended = finish
      audio.onerror = finish
      await audio.play()
    } catch {
      if (requestRef.current !== requestId) return
      audioRef.current = null
      toast.info(t.chat.summary.shadowFallback)
      playBrowserVoice(requestId)
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-8 shrink-0 gap-1.5"
      onClick={handlePlayback}
      aria-label={isPlaying ? t.chat.summary.shadowStop : t.chat.summary.shadowPlay}
      title={isPlaying ? t.chat.summary.shadowStop : t.chat.summary.shadowPlay}
    >
      {isPlaying ? <Square className="size-3.5" /> : <Volume2 className="size-3.5" />}
      {isPlaying ? t.chat.summary.shadowStop : t.chat.summary.shadowPlay}
    </Button>
  )
}
