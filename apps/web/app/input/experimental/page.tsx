"use client"

import { useEffect, useState } from "react"
import { FlaskConical, Headphones, LockKeyhole, RotateCcw, ShieldCheck, Volume2 } from "lucide-react"
import { toast } from "sonner"

import { useLanguage } from "@/components/language-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { generateInputLab2TranscriptMission } from "@/lib/api-client"
import { getMe } from "@/lib/auth"
import type { CoachMission } from "@/lib/types"

export default function InputLab2ExperimentalPage() {
  const { t } = useLanguage()
  const [checkingAccess, setCheckingAccess] = useState(true)
  const [isOwner, setIsOwner] = useState(false)
  const [title, setTitle] = useState("")
  const [transcript, setTranscript] = useState("")
  const [rightsBasis, setRightsBasis] = useState("")
  const [creating, setCreating] = useState(false)
  const [mission, setMission] = useState<CoachMission | null>(null)
  const [playsUsed, setPlaysUsed] = useState(0)
  const [speaking, setSpeaking] = useState(false)

  useEffect(() => {
    let active = true
    void getMe()
      .then((me) => {
        if (active) setIsOwner(me.isOwner === true)
      })
      .finally(() => {
        if (active) setCheckingAccess(false)
      })
    return () => {
      active = false
      if (typeof window !== "undefined") window.speechSynthesis?.cancel()
    }
  }, [])

  async function createMission() {
    const normalizedTranscriptLength = transcript.trim().replace(/\s+/g, " ").length
    if (!title.trim() || normalizedTranscriptLength < 40 || rightsBasis.trim().length < 3) {
      toast.error(t.inputLab2.required)
      return
    }
    setCreating(true)
    try {
      const result = await generateInputLab2TranscriptMission({
        title: title.trim(),
        transcript: transcript.trim(),
        rightsBasis: rightsBasis.trim(),
        durationMinutes: 5,
        modality: "text",
        energy: "light",
      })
      setMission(result)
      setPlaysUsed(0)
    } catch {
      toast.error(t.inputLab2.failed)
    } finally {
      setCreating(false)
    }
  }

  function playMission() {
    if (!mission?.listening || typeof window === "undefined") return
    if (!("speechSynthesis" in window)) {
      toast.error(t.coach.mission.playbackUnavailable)
      return
    }
    if (playsUsed >= mission.listening.playLimit || speaking) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(mission.listening.script)
    utterance.lang = "en-US"
    utterance.rate = 0.92
    utterance.onend = () => setSpeaking(false)
    utterance.onerror = () => setSpeaking(false)
    setSpeaking(true)
    setPlaysUsed((current) => current + 1)
    window.speechSynthesis.speak(utterance)
  }

  if (checkingAccess) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-xl items-center justify-center gap-2 text-sm text-muted-foreground">
        <Spinner className="size-4" /> {t.inputLab2.accessChecking}
      </div>
    )
  }

  if (!isOwner) {
    return (
      <div className="mx-auto flex min-h-[55vh] w-full max-w-xl items-center">
        <Card className="w-full text-center">
          <CardHeader className="items-center">
            <span className="mb-2 flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <LockKeyhole className="size-5" />
            </span>
            <CardTitle>{t.inputLab2.denied}</CardTitle>
            <CardDescription className="max-w-md leading-relaxed">{t.inputLab2.deniedDescription}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header>
        <Badge variant="secondary" className="mb-3 gap-1.5 rounded-full">
          <ShieldCheck className="size-3.5" /> {t.inputLab2.badge}
        </Badge>
        <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">{t.inputLab2.title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">{t.inputLab2.description}</p>
      </header>

      {!mission ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><FlaskConical className="size-5 text-primary" /> {t.inputLab2.title}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5">
            <label className="grid gap-2 text-sm font-medium">
              {t.inputLab2.sourceTitle}
              <Input value={title} maxLength={240} onChange={(event) => setTitle(event.target.value)} placeholder={t.inputLab2.sourceTitlePlaceholder} />
              <span className="text-right text-xs font-normal text-muted-foreground">{title.length} / 240</span>
            </label>
            <label className="grid gap-2 text-sm font-medium">
              {t.inputLab2.transcript}
              <Textarea value={transcript} maxLength={12000} onChange={(event) => setTranscript(event.target.value)} placeholder={t.inputLab2.transcriptPlaceholder} className="min-h-52" />
              <span className="text-xs font-normal leading-relaxed text-muted-foreground">{t.inputLab2.transcriptHint}</span>
              <span className="text-right text-xs font-normal text-muted-foreground">{transcript.trim().replace(/\s+/g, " ").length} / 12,000</span>
            </label>
            <label className="grid gap-2 text-sm font-medium">
              {t.inputLab2.rights}
              <Input value={rightsBasis} maxLength={500} onChange={(event) => setRightsBasis(event.target.value)} placeholder={t.inputLab2.rightsPlaceholder} />
              <span className="text-right text-xs font-normal text-muted-foreground">{rightsBasis.length} / 500</span>
            </label>
            <Button className="min-h-11 justify-self-start" onClick={() => void createMission()} disabled={creating}>
              {creating ? <Spinner className="size-4" /> : <FlaskConical className="size-4" />}
              {creating ? t.inputLab2.creating : t.inputLab2.create}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden border-primary/20">
          <div className="h-1.5 bg-gradient-to-r from-primary via-warning to-secondary" />
          <CardHeader>
            <Badge variant="secondary" className="mb-2 w-fit gap-1.5"><Headphones className="size-3.5" /> {t.inputLab2.ready}</Badge>
            <CardTitle className="font-heading text-2xl">{mission.title}</CardTitle>
            <CardDescription className="leading-relaxed">{t.inputLab2.readyDescription}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="rounded-2xl bg-primary/8 p-5">
              <p className="font-medium leading-relaxed">{mission.taskPrompt}</p>
              <ul className="mt-3 grid gap-1.5 text-sm text-muted-foreground">
                {mission.successCriteria.map((criterion) => <li key={criterion}>• {criterion}</li>)}
              </ul>
            </div>
            <div className="flex flex-col items-center rounded-2xl border border-border bg-muted/25 p-6 text-center">
              <span className="flex size-16 items-center justify-center rounded-full bg-primary/12 text-primary"><Headphones className="size-7" /></span>
              <Button className="mt-4" onClick={playMission} disabled={speaking || playsUsed >= (mission.listening?.playLimit ?? 0)}>
                <Volume2 className="size-4" /> {playsUsed === 0 ? t.inputLab2.play : t.inputLab2.replay}
              </Button>
              <span className="mt-2 text-xs text-muted-foreground">
                {Math.max(0, (mission.listening?.playLimit ?? 0) - playsUsed)} {t.coach.mission.playsLeft}
              </span>
            </div>
            <Button
              variant="outline"
              className="justify-self-start"
              onClick={() => {
                if (typeof window !== "undefined") window.speechSynthesis?.cancel()
                setSpeaking(false)
                setMission(null)
              }}
            >
              <RotateCcw className="size-4" /> {t.inputLab2.new}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
