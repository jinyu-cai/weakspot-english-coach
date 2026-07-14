"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Circle,
  Clock3,
  GitBranch,
  Headphones,
  ImageIcon,
  Keyboard,
  Lightbulb,
  MessageCircle,
  NotebookTabs,
  Mic,
  RotateCcw,
  Send,
  Sparkles,
  Square,
  Volume2,
  WandSparkles,
} from "lucide-react"
import { toast } from "sonner"

import { CoachScene } from "@/components/coach-scene"
import { DiagnosticReport } from "@/components/diagnostic-report"
import { useLanguage } from "@/components/language-provider"
import { SessionSummary } from "@/components/session-summary"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import {
  analyzeSession,
  createChatSession,
  diagnose,
  generateCoachMission,
  sendChatMessage,
  synthesizeCoachSpeech,
} from "@/lib/api-client"
import { DEMO_USER_ID } from "@/lib/mock-data"
import type {
  ChatMessage,
  ChatSession,
  CoachMission,
  CoachMissionEnergy,
  CoachMissionModality,
  CoachMissionType,
  DiagnoseResponse,
  SessionAnalysis,
  StealthPracticeResult,
} from "@/lib/types"
import { cn } from "@/lib/utils"
import { shouldSendFromChatComposer } from "@/lib/chat-composer"

type Duration = 5 | 10 | 15
type Screen = "setup" | "briefing" | "active" | "feedback" | "chat_feedback"

type RecognitionResultLike = {
  isFinal: boolean
  0: { transcript: string }
}

type RecognitionEventLike = Event & {
  resultIndex: number
  results: ArrayLike<RecognitionResultLike>
}

type RecognitionLike = {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: RecognitionEventLike) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
  start: () => void
  stop: () => void
}

type RecognitionConstructor = new () => RecognitionLike

const DURATION_OPTIONS: Duration[] = [5, 10, 15]
const TYPE_ORDER: CoachMissionType[] = [
  "guided_scene",
  "picture_story",
  "decision_response",
  "vocabulary_in_action",
  "listen_retell",
]

const MISSION_ICONS = {
  guided_scene: MessageCircle,
  picture_story: ImageIcon,
  listen_retell: Headphones,
  decision_response: GitBranch,
  vocabulary_in_action: NotebookTabs,
} satisfies Record<CoachMissionType, typeof MessageCircle>

function speechRecognitionConstructor(): RecognitionConstructor | null {
  if (typeof window === "undefined") return null
  const speechWindow = window as typeof window & {
    SpeechRecognition?: RecognitionConstructor
    webkitSpeechRecognition?: RecognitionConstructor
  }
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null
}

function analysisContextForMission(mission: CoachMission): string | undefined {
  if (mission.vocabulary) {
    return [
      `Situation: ${mission.vocabulary.situation}`,
      `Communication goal: ${mission.vocabulary.communicativeGoal}`,
      `Audience: ${mission.vocabulary.audience}`,
      `Tone: ${mission.vocabulary.tone}`,
      `Meanings to express: ${mission.vocabulary.conceptsToExpress.join("; ")}`,
    ].join("\n")
  }
  if (mission.decision) {
    return [
      `Situation: ${mission.decision.situation}`,
      `Decision goal: ${mission.decision.decisionGoal}`,
      `Audience: ${mission.decision.audience}`,
      `Constraints: ${mission.decision.constraints.join("; ")}`,
    ].join("\n")
  }
  return undefined
}

function ChoiceButton({
  selected,
  onClick,
  children,
  className,
}: {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "min-h-11 rounded-xl border px-3 py-2 text-sm font-medium outline-none transition focus-visible:ring-3 focus-visible:ring-ring/40",
        selected
          ? "border-primary/45 bg-primary/10 text-foreground shadow-sm"
          : "border-border bg-background text-muted-foreground hover:border-primary/25 hover:text-foreground",
        className,
      )}
    >
      {children}
    </button>
  )
}

function PhaseDots({ current, label }: { current: 1 | 2 | 3; label: string }) {
  return (
    <div
      className="flex items-center gap-1.5"
      role="progressbar"
      aria-label={label}
      aria-valuemin={1}
      aria-valuemax={3}
      aria-valuenow={current}
    >
      {[1, 2, 3].map((step) => (
        <span
          key={step}
          className={cn(
            "h-1.5 rounded-full transition-all",
            step === current ? "w-8 bg-primary" : step < current ? "w-3 bg-primary/45" : "w-3 bg-border",
          )}
        />
      ))}
    </div>
  )
}

export default function CoachPage() {
  const { t } = useLanguage()
  const [screen, setScreen] = useState<Screen>("setup")
  const [durationMinutes, setDurationMinutes] = useState<Duration>(5)
  const [modality, setModality] = useState<CoachMissionModality>("text")
  const [energy, setEnergy] = useState<CoachMissionEnergy>("light")
  const [preferredType, setPreferredType] = useState<CoachMissionType | undefined>()
  const [mission, setMission] = useState<CoachMission | null>(null)
  const [generating, setGenerating] = useState(false)
  const [answer, setAnswer] = useState("")
  const [submittedAnswer, setSubmittedAnswer] = useState("")
  const [hintLevel, setHintLevel] = useState(0)
  const [playsUsed, setPlaysUsed] = useState(0)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isDictating, setIsDictating] = useState(false)
  const [diagnostic, setDiagnostic] = useState<DiagnoseResponse | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [checkedCriteria, setCheckedCriteria] = useState<Set<number>>(new Set())

  const [chatSession, setChatSession] = useState<ChatSession | null>(null)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [sending, setSending] = useState(false)
  const [chatAnalysis, setChatAnalysis] = useState<SessionAnalysis | null>(null)
  const [stealthPractice, setStealthPractice] = useState<StealthPracticeResult | null>(null)

  const recognitionRef = useRef<RecognitionLike | null>(null)
  const dictationBaseRef = useRef("")
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioUrlRef = useRef<string | null>(null)
  const audioMissionIdRef = useRef<string | null>(null)
  const transientAudioUrlRef = useRef<string | null>(null)
  const ttsUnavailableRef = useRef(false)
  const playbackRequestRef = useRef(0)
  const optimisticMessageCounterRef = useRef(0)

  const visibleHints = useMemo(
    () => mission?.hints.slice(0, hintLevel) ?? [],
    [hintLevel, mission?.hints],
  )

  useEffect(() => {
    return () => {
      const recognition = recognitionRef.current
      recognitionRef.current = null
      try {
        recognition?.stop()
      } catch {
        // The recognition session may already be stopped.
      }
      if (typeof window !== "undefined") window.speechSynthesis?.cancel()
      audioRef.current?.pause()
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
      if (transientAudioUrlRef.current) URL.revokeObjectURL(transientAudioUrlRef.current)
    }
  }, [])

  function stopPlayback(clearCache = false) {
    playbackRequestRef.current += 1
    audioRef.current?.pause()
    audioRef.current = null
    if (typeof window !== "undefined") window.speechSynthesis?.cancel()
    setIsSpeaking(false)
    if (transientAudioUrlRef.current) {
      URL.revokeObjectURL(transientAudioUrlRef.current)
      transientAudioUrlRef.current = null
    }
    if (clearCache && audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current)
      audioUrlRef.current = null
      audioMissionIdRef.current = null
    }
  }

  function stopDictation(discardPendingResults = false) {
    const recognition = recognitionRef.current
    if (!recognition) {
      setIsDictating(false)
      return
    }
    if (discardPendingResults) recognitionRef.current = null
    try {
      recognition.stop()
    } catch {
      // Already stopped is equivalent to the desired state.
      if (recognitionRef.current === recognition) recognitionRef.current = null
      setIsDictating(false)
    }
    if (discardPendingResults) setIsDictating(false)
  }

  function resetAttempt(nextScreen: Screen = "briefing") {
    stopDictation(true)
    stopPlayback(nextScreen === "setup")
    setScreen(nextScreen)
    setAnswer("")
    setSubmittedAnswer("")
    setHintLevel(0)
    setPlaysUsed(0)
    setIsSpeaking(false)
    setIsDictating(false)
    setDiagnostic(null)
    setCheckedCriteria(new Set())
    setChatSession(null)
    setChatMessages([])
    setChatAnalysis(null)
    setStealthPractice(null)
  }

  function returnToBriefing() {
    stopDictation(true)
    stopPlayback()
    setScreen("briefing")
  }

  async function arrangeMission(type: CoachMissionType | undefined = preferredType) {
    setGenerating(true)
    try {
      const nextMission = await generateCoachMission({
        durationMinutes,
        modality,
        energy,
        ...(type ? { preferredType: type } : {}),
      })
      stopPlayback(true)
      ttsUnavailableRef.current = false
      setMission(nextMission)
      resetAttempt("briefing")
    } catch {
      toast.error(t.coach.errors.generate)
    } finally {
      setGenerating(false)
    }
  }

  async function enterMission() {
    if (!mission) return
    if (mission.type !== "guided_scene") {
      setScreen("active")
      return
    }
    if (!mission.scene) return
    if (chatMessages.length === 0) {
      const opening: ChatMessage = {
        id: `coach-opening-${mission.id}`,
        userId: DEMO_USER_ID,
        sessionId: mission.id,
        role: "assistant",
        content: mission.scene.starterMessage,
        createdAt: new Date().toISOString(),
      }
      setChatMessages([opening])
    }
    setScreen("active")
  }

  async function submitFreeResponse() {
    if (!mission || answer.trim().length < 20 || analyzing || isDictating || isSpeaking) return
    const text = answer.trim()
    setSubmittedAnswer(text)
    setAnalyzing(true)
    try {
      const result = await diagnose(DEMO_USER_ID, text, "fast", analysisContextForMission(mission))
      setDiagnostic(result)
      setScreen("feedback")
    } catch {
      toast.error(t.coach.errors.analyze)
    } finally {
      setAnalyzing(false)
    }
  }

  async function sendRoleplayMessage() {
    if (!mission?.scene || !answer.trim() || sending || isDictating || isSpeaking) return
    const text = answer.trim()
    setSending(true)
    try {
      let session = chatSession
      if (!session) {
        const createdSession = await createChatSession(
          DEMO_USER_ID,
          mission.title,
          undefined,
          mission.scene.scenarioPrompt,
          mission.scene.starterMessage,
          mission.scene.scenarioFamily,
          mission.scene.scenarioKey,
        )
        session = createdSession
        setChatSession(createdSession)
        setChatMessages((current) => current.map((message) => ({ ...message, sessionId: createdSession.id })))
      }
      optimisticMessageCounterRef.current += 1
      const optimistic: ChatMessage = {
        id: `coach-temp-${optimisticMessageCounterRef.current}`,
        userId: session.userId,
        sessionId: session.id,
        role: "user",
        content: text,
        createdAt: new Date().toISOString(),
      }
      setAnswer("")
      setChatMessages((current) => [...current, optimistic])
      const response = await sendChatMessage(DEMO_USER_ID, session.id, text)
      setChatMessages((current) => [
        ...current.filter((message) => message.id !== optimistic.id),
        response.userMessage,
        response.assistantMessage,
      ])
      if (modality === "voice") void playRoleplaySpeech(response.assistantMessage.content)
    } catch {
      setChatMessages((current) => current.filter((message) => !message.id.startsWith("coach-temp-")))
      setAnswer(text)
      toast.error(t.coach.errors.send)
    } finally {
      setSending(false)
    }
  }

  async function finishRoleplay() {
    if (!chatSession || analyzing) return
    setAnalyzing(true)
    setScreen("chat_feedback")
    try {
      const result = await analyzeSession(chatSession.id, hintLevel)
      setChatAnalysis(result.analysis)
      setStealthPractice(result.stealthPractice ?? null)
    } catch {
      toast.error(t.coach.errors.analyze)
      setScreen("active")
    } finally {
      setAnalyzing(false)
    }
  }

  function revealHint() {
    if (!mission || hintLevel >= mission.hints.length) return
    setHintLevel((current) => current + 1)
  }

  function playBrowserSpeech(script: string) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setIsSpeaking(false)
      toast.error(t.coach.mission.playbackUnavailable)
      return
    }
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(script)
    utterance.lang = "en-US"
    utterance.rate = energy === "light" ? 0.86 : energy === "challenge" ? 1.02 : 0.94
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)
    window.speechSynthesis.speak(utterance)
  }

  async function playListening() {
    if (!mission?.listening || typeof window === "undefined") return
    if (playsUsed >= mission.listening.playLimit || isDictating) return
    stopPlayback()
    const requestId = playbackRequestRef.current
    setIsSpeaking(true)
    setPlaysUsed((current) => current + 1)
    try {
      if (!audioUrlRef.current || audioMissionIdRef.current !== mission.id) {
        if (ttsUnavailableRef.current) throw new Error("AI speech unavailable")
        if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
        const audioBlob = await synthesizeCoachSpeech(
          mission.listening.script,
          energy === "light" ? "gentle" : energy === "challenge" ? "challenge" : "natural",
        )
        audioUrlRef.current = URL.createObjectURL(audioBlob)
        audioMissionIdRef.current = mission.id
      }
      if (playbackRequestRef.current !== requestId) return
      const audio = new Audio(audioUrlRef.current)
      audioRef.current = audio
      audio.onended = () => {
        audioRef.current = null
        setIsSpeaking(false)
      }
      audio.onerror = () => {
        audioRef.current = null
        setIsSpeaking(false)
      }
      await audio.play()
    } catch {
      if (playbackRequestRef.current !== requestId) return
      audioRef.current = null
      if (transientAudioUrlRef.current) {
        URL.revokeObjectURL(transientAudioUrlRef.current)
        transientAudioUrlRef.current = null
      }
      ttsUnavailableRef.current = true
      toast.info(t.coach.mission.browserVoiceFallback)
      playBrowserSpeech(mission.listening.script)
    }
  }

  async function playRoleplaySpeech(text: string) {
    if (typeof window === "undefined") return
    stopPlayback()
    const requestId = playbackRequestRef.current
    setIsSpeaking(true)
    try {
      if (ttsUnavailableRef.current) throw new Error("AI speech unavailable")
      const audioBlob = await synthesizeCoachSpeech(
        text,
        energy === "light" ? "gentle" : energy === "challenge" ? "challenge" : "natural",
      )
      if (playbackRequestRef.current !== requestId) return
      const url = URL.createObjectURL(audioBlob)
      transientAudioUrlRef.current = url
      const audio = new Audio(url)
      audioRef.current = audio
      const finish = () => {
        if (transientAudioUrlRef.current === url) {
          URL.revokeObjectURL(url)
          transientAudioUrlRef.current = null
        }
        if (audioRef.current === audio) audioRef.current = null
        setIsSpeaking(false)
      }
      audio.onended = finish
      audio.onerror = finish
      await audio.play()
    } catch {
      if (playbackRequestRef.current !== requestId) return
      audioRef.current = null
      if (transientAudioUrlRef.current) {
        URL.revokeObjectURL(transientAudioUrlRef.current)
        transientAudioUrlRef.current = null
      }
      ttsUnavailableRef.current = true
      toast.info(t.coach.mission.browserVoiceFallback)
      playBrowserSpeech(text)
    }
  }

  function toggleDictation() {
    if (isDictating) {
      stopDictation()
      return
    }
    if (isSpeaking) return
    const Recognition = speechRecognitionConstructor()
    if (!Recognition) {
      toast.error(t.coach.mission.voiceUnsupported)
      return
    }
    const recognition = new Recognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = "en-US"
    dictationBaseRef.current = answer.trim()
    recognition.onresult = (event) => {
      if (recognitionRef.current !== recognition) return
      let combined = ""
      for (let index = 0; index < event.results.length; index += 1) {
        combined += `${event.results[index][0].transcript.trim()} `
      }
      const prefix = dictationBaseRef.current ? `${dictationBaseRef.current} ` : ""
      setAnswer(`${prefix}${combined.trim()}`.trim())
    }
    recognition.onend = () => {
      if (recognitionRef.current === recognition) recognitionRef.current = null
      setIsDictating(false)
    }
    recognition.onerror = () => {
      if (recognitionRef.current === recognition) recognitionRef.current = null
      setIsDictating(false)
      toast.error(t.coach.mission.voiceUnsupported)
    }
    recognitionRef.current = recognition
    try {
      recognition.start()
      setIsDictating(true)
    } catch {
      recognitionRef.current = null
      setIsDictating(false)
      toast.error(t.coach.mission.voiceUnsupported)
    }
  }

  function toggleCriterion(index: number) {
    setCheckedCriteria((current) => {
      const next = new Set(current)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  if (screen === "setup") {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-7">
        <section className="overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/12 via-card to-background px-5 py-7 sm:px-8 sm:py-10">
          <Badge className="mb-4 gap-1.5 rounded-full bg-primary/12 text-primary" variant="secondary">
            <Sparkles className="size-3.5" />
            {t.coach.badge}
          </Badge>
          <h1 className="max-w-3xl text-balance font-heading text-3xl font-semibold tracking-tight sm:text-5xl">
            {t.coach.title}
          </h1>
          <p className="mt-4 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
            {t.coach.description}
          </p>
        </section>

        <Card className="overflow-hidden border-border/80 shadow-sm">
          <CardHeader>
            <CardTitle className="font-heading text-xl">{t.coach.setup.title}</CardTitle>
            <CardDescription>{t.coach.setup.description}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            <div className="grid gap-5 lg:grid-cols-3">
              <fieldset className="grid gap-2">
                <legend className="mb-1 flex items-center gap-2 text-sm font-semibold">
                  <Clock3 className="size-4 text-primary" /> {t.coach.setup.duration}
                </legend>
                <div className="grid grid-cols-3 gap-2">
                  {DURATION_OPTIONS.map((minutes) => (
                    <ChoiceButton key={minutes} selected={durationMinutes === minutes} onClick={() => setDurationMinutes(minutes)}>
                      {minutes} {t.common.minutesShort}
                    </ChoiceButton>
                  ))}
                </div>
              </fieldset>

              <fieldset className="grid gap-2">
                <legend className="mb-1 text-sm font-semibold">{t.coach.setup.response}</legend>
                <div className="grid grid-cols-2 gap-2">
                  <ChoiceButton selected={modality === "text"} onClick={() => setModality("text")}>
                    <span className="flex items-center justify-center gap-2"><Keyboard className="size-4" /> {t.coach.setup.text}</span>
                  </ChoiceButton>
                  <ChoiceButton selected={modality === "voice"} onClick={() => setModality("voice")}>
                    <span className="flex items-center justify-center gap-2"><Mic className="size-4" /> {t.coach.setup.voice}</span>
                  </ChoiceButton>
                </div>
              </fieldset>

              <fieldset className="grid gap-2">
                <legend className="mb-1 text-sm font-semibold">{t.coach.setup.energy}</legend>
                <div className="grid grid-cols-3 gap-2">
                  {(["light", "normal", "challenge"] as CoachMissionEnergy[]).map((value) => (
                    <ChoiceButton key={value} selected={energy === value} onClick={() => setEnergy(value)}>
                      {t.coach.setup[value]}
                    </ChoiceButton>
                  ))}
                </div>
              </fieldset>
            </div>

            <Button
              size="lg"
              className="min-h-12 w-full gap-2 rounded-xl text-base sm:w-auto sm:justify-self-start"
              onClick={() => void arrangeMission()}
              disabled={generating}
            >
              {generating ? <Spinner className="size-4" /> : <WandSparkles className="size-4.5" />}
              {generating ? t.coach.setup.generating : t.coach.setup.arrange}
            </Button>

            <details className="group rounded-2xl border border-border/70 bg-muted/25 p-4">
              <summary className="cursor-pointer list-none text-sm font-medium text-muted-foreground outline-none group-open:text-foreground">
                {t.coach.setup.specific}
              </summary>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <ChoiceButton selected={!preferredType} onClick={() => setPreferredType(undefined)} className="text-left">
                  <span className="block font-semibold">{t.coach.setup.surprise[0]}</span>
                  <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{t.coach.setup.surprise[1]}</span>
                </ChoiceButton>
                {TYPE_ORDER.map((type) => {
                  const Icon = MISSION_ICONS[type]
                  const copy = t.coach.setup.types[type]
                  return (
                    <ChoiceButton key={type} selected={preferredType === type} onClick={() => setPreferredType(type)} className="text-left">
                      <span className="flex items-center gap-2 font-semibold"><Icon className="size-4 text-primary" /> {copy[0]}</span>
                      <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{copy[1]}</span>
                    </ChoiceButton>
                  )
                })}
              </div>
            </details>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!mission) return null
  const MissionIcon = MISSION_ICONS[mission.type]
  const difficultyLabel = mission.difficulty === "light"
    ? t.coach.setup.light
    : mission.difficulty === "normal"
      ? t.coach.setup.normal
      : mission.difficulty === "challenge"
        ? t.coach.setup.challenge
        : mission.difficulty

  if (screen === "briefing") {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
        <div className="flex items-center justify-between gap-4">
          <Button variant="ghost" size="sm" onClick={() => setScreen("setup")}>
            <ArrowLeft className="size-4" /> {t.coach.mission.back}
          </Button>
          <PhaseDots current={1} label={t.coach.mission.progress} />
        </div>

        <Card className="overflow-hidden border-primary/20 shadow-sm">
          <div className="h-1.5 bg-gradient-to-r from-primary via-warning to-secondary" />
          <CardHeader className="gap-3 sm:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="gap-1.5"><MissionIcon className="size-3.5" /> {mission.eyebrow}</Badge>
              <Badge variant="outline"><Clock3 className="size-3.5" /> {mission.estimatedMinutes} {t.common.minutesShort}</Badge>
              <Badge variant="outline">{difficultyLabel}</Badge>
            </div>
            <CardTitle className="text-balance font-heading text-3xl sm:text-4xl">{mission.title}</CardTitle>
            <CardDescription className="max-w-2xl text-base leading-relaxed">{mission.briefing}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 sm:p-8 sm:pt-0">
            {mission.scene ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  [t.coach.mission.setting, mission.scene.setting],
                  [t.coach.mission.yourRole, mission.scene.userRole],
                  [t.coach.mission.coachRole, mission.scene.aiRole],
                  [t.coach.mission.goal, mission.scene.goal],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-border/70 bg-muted/25 p-4">
                    <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{label}</div>
                    <p className="mt-1 text-sm leading-relaxed">{value}</p>
                  </div>
                ))}
              </div>
            ) : null}

            {mission.decision ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  [t.coach.mission.situation, mission.decision.situation],
                  [t.coach.mission.yourRole, mission.decision.userRole],
                  [t.coach.mission.audience, mission.decision.audience],
                  [t.coach.mission.goal, mission.decision.decisionGoal],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-border/70 bg-muted/25 p-4">
                    <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{label}</div>
                    <p className="mt-1 text-sm leading-relaxed">{value}</p>
                  </div>
                ))}
                <div className="rounded-2xl border border-warning/25 bg-warning/5 p-4 sm:col-span-2">
                  <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t.coach.mission.constraints}</div>
                  <ul className="mt-2 grid gap-1.5 text-sm leading-relaxed">
                    {mission.decision.constraints.map((constraint) => <li key={constraint}>• {constraint}</li>)}
                  </ul>
                </div>
              </div>
            ) : null}

            {mission.vocabulary ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  [t.coach.mission.situation, mission.vocabulary.situation],
                  [t.coach.mission.goal, mission.vocabulary.communicativeGoal],
                  [t.coach.mission.audience, mission.vocabulary.audience],
                  [t.coach.mission.tone, mission.vocabulary.tone],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-border/70 bg-muted/25 p-4">
                    <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{label}</div>
                    <p className="mt-1 text-sm leading-relaxed">{value}</p>
                  </div>
                ))}
                <div className="rounded-2xl border border-primary/20 bg-primary/6 p-4 sm:col-span-2">
                  <div className="text-xs font-semibold tracking-wide text-primary uppercase">{t.coach.mission.concepts}</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {mission.vocabulary.conceptsToExpress.map((concept) => <Badge key={concept} variant="outline">{concept}</Badge>)}
                  </div>
                </div>
              </div>
            ) : null}

            <div className="rounded-2xl bg-primary/8 p-5">
              <div className="text-xs font-semibold tracking-wide text-primary uppercase">{t.coach.mission.briefing}</div>
              <p className="mt-2 text-base font-medium leading-relaxed">{mission.taskPrompt}</p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {mission.successCriteria.map((criterion) => (
                  <div key={criterion} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span>{criterion}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button size="lg" className="min-h-12 rounded-xl" onClick={() => void enterMission()} disabled={generating}>
                {generating ? <Spinner className="size-4" /> : <ArrowRight className="size-4" />}
                {mission.type === "guided_scene" ? t.coach.mission.startScene : t.coach.mission.startTask}
              </Button>
              {mission.type === "guided_scene" ? (
                <span className="text-xs leading-relaxed text-muted-foreground">{t.coach.mission.aiStarts}</span>
              ) : null}
              <Button variant="ghost" className="sm:ml-auto" onClick={() => void arrangeMission()} disabled={generating}>
                <RotateCcw className="size-4" /> {t.coach.mission.another}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (screen === "chat_feedback") {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Badge variant={hintLevel > 0 ? "secondary" : "outline"}>
              {hintLevel > 0 ? t.coach.feedback.assisted : t.coach.feedback.independent}
            </Badge>
          </div>
          <PhaseDots current={3} label={t.coach.mission.progress} />
        </div>
        {hintLevel > 0 ? (
          <p className="rounded-xl border border-warning/25 bg-warning/8 px-4 py-3 text-sm text-muted-foreground">
            {t.coach.feedback.assistedNote}
          </p>
        ) : null}
        <SessionSummary
          analysis={chatAnalysis}
          stealthPractice={stealthPractice}
          analyzing={analyzing}
          onClose={() => resetAttempt("setup")}
        />
      </div>
    )
  }

  if (screen === "feedback" && diagnostic) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <Badge variant={hintLevel > 0 ? "secondary" : "outline"}>
            {hintLevel > 0 ? t.coach.feedback.assisted : t.coach.feedback.independent}
          </Badge>
          <PhaseDots current={3} label={t.coach.mission.progress} />
        </div>

        <section className="rounded-3xl border border-success/25 bg-success/8 p-5 sm:p-7">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-success/15 text-success">
              <CheckCircle2 className="size-5" />
            </span>
            <div>
              <h1 className="font-heading text-2xl font-semibold">{t.coach.feedback.title}</h1>
              <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">{t.coach.feedback.description}</p>
            </div>
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)]">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t.coach.feedback.taskTitle}</CardTitle>
              <CardDescription>{t.coach.feedback.taskDescription}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              {mission.successCriteria.map((criterion, index) => {
                const checked = checkedCriteria.has(index)
                return (
                  <button
                    key={criterion}
                    type="button"
                    aria-pressed={checked}
                    onClick={() => toggleCriterion(index)}
                    className="flex items-start gap-3 rounded-xl border border-border/70 p-3 text-left text-sm outline-none transition hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/40"
                  >
                    {checked ? <CheckCircle2 className="mt-0.5 size-4.5 shrink-0 text-success" /> : <Circle className="mt-0.5 size-4.5 shrink-0 text-muted-foreground" />}
                    <span>{criterion}</span>
                  </button>
                )
              })}
              {hintLevel > 0 ? (
                <p className="mt-2 rounded-xl bg-warning/8 p-3 text-xs leading-relaxed text-muted-foreground">{t.coach.feedback.assistedNote}</p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t.coach.feedback.languageTitle}</CardTitle>
              <CardDescription>{t.coach.feedback.languageDescription}</CardDescription>
            </CardHeader>
          </Card>
        </div>

        <DiagnosticReport result={diagnostic.diagnostic} originalText={submittedAnswer} />

        <div className="sticky bottom-3 z-10 flex flex-col gap-2 rounded-2xl border border-border bg-background/92 p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center">
          <Button variant="outline" onClick={() => resetAttempt("active")}>
            <RotateCcw className="size-4" /> {t.coach.feedback.retry}
          </Button>
          <Button onClick={() => void arrangeMission(mission.type)} disabled={generating}>
            {generating ? <Spinner className="size-4" /> : <WandSparkles className="size-4" />}
            {t.coach.feedback.variation}
          </Button>
          <Button variant="ghost" className="sm:ml-auto" render={<Link href="/dashboard" />}>
            {t.coach.feedback.done} <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>
    )
  }

  const userTurns = chatMessages.filter((message) => message.role === "user").length
  const playLimit = mission.listening?.playLimit ?? 0
  const canPlay = playsUsed < playLimit && !isSpeaking && !isDictating

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <div className="flex items-center justify-between gap-4">
        <Button variant="ghost" size="sm" onClick={returnToBriefing}>
          <ArrowLeft className="size-4" /> {t.coach.mission.backToBriefing}
        </Button>
        <PhaseDots current={2} label={t.coach.mission.progress} />
      </div>

      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(19rem,0.8fr)] lg:items-start">
        <section className="min-w-0 space-y-4">
          {mission.picture ? <CoachScene assetKey={mission.picture.assetKey} title={mission.title} /> : null}

          {mission.decision || mission.vocabulary ? (
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle className="text-lg">{mission.decision?.situation ?? mission.vocabulary?.situation}</CardTitle>
                <CardDescription>
                  {mission.decision
                    ? `${t.coach.mission.audience}: ${mission.decision.audience}`
                    : `${t.coach.mission.tone}: ${mission.vocabulary?.tone}`}
                </CardDescription>
              </CardHeader>
              {mission.decision ? (
                <CardContent className="flex flex-wrap gap-2">
                  {mission.decision.constraints.map((constraint) => <Badge key={constraint} variant="outline">{constraint}</Badge>)}
                </CardContent>
              ) : null}
            </Card>
          ) : null}

          {mission.listening ? (
            <div className="flex min-h-72 flex-col items-center justify-center rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/8 via-card to-secondary/35 p-6 text-center">
              <span className={cn("flex size-20 items-center justify-center rounded-full bg-primary/12 text-primary transition", isSpeaking && "animate-pulse")}>
                <Headphones className="size-9" />
              </span>
              <h2 className="mt-5 font-heading text-2xl font-semibold">{mission.title}</h2>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{mission.briefing}</p>
              <Button className="mt-5 min-h-11 rounded-xl" onClick={playListening} disabled={!canPlay}>
                <Volume2 className="size-4" />
                {playsUsed === 0 ? t.coach.mission.listen : t.coach.mission.listenAgain}
              </Button>
              <span className="mt-2 text-xs text-muted-foreground">{Math.max(0, playLimit - playsUsed)} {t.coach.mission.playsLeft}</span>
              <span className="mt-1 text-[11px] text-muted-foreground">{t.coach.mission.aiVoiceDisclosure}</span>
            </div>
          ) : null}

          {mission.type === "guided_scene" ? (
            <div className="min-h-80 rounded-3xl border border-border bg-card p-4 shadow-sm sm:p-5">
              <div className="flex flex-col gap-4" role="log" aria-live="polite" aria-relevant="additions text">
                {chatMessages.map((message) => (
                  <div key={message.id} className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}>
                    <div className={cn(
                      "max-w-[88%] whitespace-pre-wrap break-words rounded-2xl px-4 py-3 text-sm leading-relaxed sm:max-w-[76%]",
                      message.role === "user"
                        ? "rounded-br-md bg-primary text-primary-foreground"
                        : "rounded-bl-md border border-border bg-muted/45 text-foreground",
                    )}>
                      {message.content}
                      {message.role === "assistant" && modality === "voice" ? (
                        <button
                          type="button"
                          className="mt-2 flex items-center gap-1 text-[11px] font-medium text-muted-foreground transition hover:text-foreground disabled:cursor-wait disabled:opacity-50"
                          onClick={() => void playRoleplaySpeech(message.content)}
                          disabled={isSpeaking || isDictating}
                        >
                          <Volume2 className="size-3" /> {t.coach.mission.playReply}
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
                {sending ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground"><Spinner className="size-4" /> {t.coach.mission.thinking}</div>
                ) : null}
                {modality === "voice" ? (
                  <p className="border-t border-border/60 pt-3 text-[11px] text-muted-foreground">{t.coach.mission.aiVoiceDisclosure}</p>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <label htmlFor="coach-answer" className="text-sm font-semibold">{t.coach.mission.responseLabel}</label>
            <Textarea
              id="coach-answer"
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              placeholder={t.coach.mission.placeholder}
              aria-keyshortcuts="Control+Enter Meta+Enter"
              className="mt-2 min-h-32 resize-y"
              disabled={sending || analyzing || isSpeaking || isDictating}
              onKeyDown={(event) => {
                if (mission.type === "guided_scene" && shouldSendFromChatComposer(event)) {
                  event.preventDefault()
                  void sendRoleplayMessage()
                }
              }}
            />
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              {modality === "voice" ? (
                <Button variant={isDictating ? "destructive" : "outline"} onClick={toggleDictation} disabled={sending || analyzing || isSpeaking}>
                  {isDictating ? <Square className="size-3.5 fill-current" /> : <Mic className="size-4" />}
                  {isDictating ? t.coach.mission.voiceStop : t.coach.mission.voiceStart}
                </Button>
              ) : null}
              <span className="text-xs leading-relaxed text-muted-foreground">
                {modality === "voice"
                  ? t.coach.mission.voiceConfirm
                  : mission.type === "guided_scene"
                    ? t.coach.mission.composerHint
                    : t.coach.mission.minimum}
              </span>
              {mission.type === "guided_scene" ? (
                <Button className="sm:ml-auto" onClick={() => void sendRoleplayMessage()} disabled={!answer.trim() || sending || analyzing || isDictating || isSpeaking}>
                  <Send className="size-4" /> {t.coach.mission.send}
                </Button>
              ) : (
                <Button className="sm:ml-auto" onClick={() => void submitFreeResponse()} disabled={answer.trim().length < 20 || analyzing || isDictating || isSpeaking}>
                  {analyzing ? <Spinner className="size-4" /> : <Sparkles className="size-4" />}
                  {analyzing ? t.coach.mission.analyzing : t.coach.mission.analyze}
                </Button>
              )}
            </div>
          </div>

          {mission.type === "guided_scene" && userTurns >= 2 ? (
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => void finishRoleplay()} disabled={sending || analyzing || isDictating || isSpeaking}>
                {analyzing ? <Spinner className="size-4" /> : <CheckCircle2 className="size-4" />}
                {t.coach.mission.finishChat}
              </Button>
            </div>
          ) : null}
        </section>

        <aside className="grid gap-4 lg:sticky lg:top-24">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Badge variant="secondary"><MissionIcon className="size-3.5" /> {mission.eyebrow}</Badge>
                <Badge variant="outline">{mission.estimatedMinutes} {t.common.minutesShort}</Badge>
              </div>
              <CardTitle className="font-heading text-xl">{mission.title}</CardTitle>
              <CardDescription className="leading-relaxed">{mission.taskPrompt}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t.coach.mission.success}</div>
              <ul className="mt-2 grid gap-2">
                {mission.successCriteria.map((criterion) => (
                  <li key={criterion} className="flex items-start gap-2 text-sm leading-relaxed">
                    <Circle className="mt-1 size-3 shrink-0 text-primary" /> {criterion}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="border-warning/25 bg-warning/5">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base"><Lightbulb className="size-4 text-warning" /> {t.coach.mission.hint}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {visibleHints.map((hint, index) => (
                <div key={`${index}-${hint}`} className="rounded-xl border border-warning/20 bg-background/70 p-3 text-sm leading-relaxed">
                  <span className="mb-1 block text-[10px] font-semibold tracking-wide text-warning uppercase">{t.coach.mission.hintLevel} {index + 1}</span>
                  {hint}
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={revealHint} disabled={hintLevel >= mission.hints.length}>
                <Lightbulb className="size-4" />
                {hintLevel === 0 ? t.coach.mission.hint : t.coach.mission.nextHint}
              </Button>
              {hintLevel >= mission.hints.length ? <p className="text-xs leading-relaxed text-muted-foreground">{t.coach.mission.noMoreHints}</p> : null}
            </CardContent>
          </Card>

          {mission.picture ? (
            <p className="rounded-xl border border-border bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">{t.coach.mission.visualBoundary}</p>
          ) : null}
          {mission.listening ? (
            <p className="rounded-xl border border-border bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">{t.coach.mission.listeningBoundary}</p>
          ) : null}
        </aside>
      </div>
    </div>
  )
}
