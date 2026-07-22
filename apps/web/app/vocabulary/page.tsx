"use client"

import { useEffect, useMemo, useState } from "react"
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  Brain,
  Check,
  CircleCheck,
  Lightbulb,
  RefreshCw,
  Sparkles,
  Target,
  TriangleAlert,
} from "lucide-react"
import { toast } from "sonner"

import { DiagnosticReport } from "@/components/diagnostic-report"
import { ShadowingButton } from "@/components/shadowing-button"
import { useLanguage } from "@/components/language-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { diagnose, generateCoachMission, getHistory, updateActivityRun } from "@/lib/api-client"
import { DEMO_USER_ID } from "@/lib/mock-data"
import type { CoachMission, DiagnoseResponse } from "@/lib/types"

type VocabularyStage = "meet" | "notice" | "apply"

const KNOWN_VOCABULARY_KEY = "weakspot.known-vocabulary.v1"

function readKnownVocabulary(): string[] {
  if (typeof window === "undefined") return []
  try {
    const value = JSON.parse(window.localStorage.getItem(KNOWN_VOCABULARY_KEY) ?? "[]")
    return Array.isArray(value)
      ? value.filter((word): word is string => typeof word === "string").slice(-30)
      : []
  } catch {
    return []
  }
}

function saveKnownVocabulary(words: string[]) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(KNOWN_VOCABULARY_KEY, JSON.stringify(words.slice(-30)))
}

function containsWordForm(text: string, forms: string[]): boolean {
  return forms.some((form) => {
    const escaped = form.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    return new RegExp(`(^|[^A-Za-z])${escaped}(?=$|[^A-Za-z])`, "i").test(text)
  })
}

export default function VocabularyPage() {
  const { t } = useLanguage()
  const [mission, setMission] = useState<CoachMission | null>(null)
  const [stage, setStage] = useState<VocabularyStage>("meet")
  const [answer, setAnswer] = useState("")
  const [submittedAnswer, setSubmittedAnswer] = useState("")
  const [diagnostic, setDiagnostic] = useState<DiagnoseResponse | null>(null)
  const [creating, setCreating] = useState(false)
  const [skipping, setSkipping] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [showHint, setShowHint] = useState(false)
  const [knownWords, setKnownWords] = useState<string[]>(readKnownVocabulary)
  const [historicalVocabularyCount, setHistoricalVocabularyCount] = useState(0)

  const vocabulary = mission?.vocabulary ?? null
  const acceptedForms = useMemo(
    () => vocabulary?.wordForms?.length
      ? vocabulary.wordForms
      : vocabulary?.targetWord
        ? [vocabulary.targetWord]
        : [],
    [vocabulary],
  )
  const usedTargetWord = useMemo(
    () => containsWordForm(answer, acceptedForms),
    [acceptedForms, answer],
  )
  const canAnalyze = answer.trim().length >= 20 && usedTargetWord

  async function refreshEvidenceCount() {
    try {
      const history = await getHistory(DEMO_USER_ID)
      setHistoricalVocabularyCount(history.errors.filter((error) => error.code === "vocab.word_choice").length)
    } catch {
      // The lesson remains usable if historical evidence is temporarily unavailable.
    }
  }

  useEffect(() => {
    let active = true
    void getHistory(DEMO_USER_ID)
      .then((history) => {
        if (active) setHistoricalVocabularyCount(history.errors.filter((error) => error.code === "vocab.word_choice").length)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  const vocabularyErrors = useMemo(
    () => diagnostic?.diagnostic.errors.filter((error) => error.code === "vocab.word_choice") ?? [],
    [diagnostic],
  )

  async function requestWord(excludedWords: string[]) {
    const next = await generateCoachMission({
      durationMinutes: 5,
      modality: "text",
      energy: "normal",
      preferredType: "vocabulary_in_action",
      excludedVocabulary: excludedWords.slice(-30),
    })
    if (!next.vocabulary) throw new Error("Vocabulary lesson is missing its target word")
    setMission(next)
    setStage("meet")
    setAnswer("")
    setSubmittedAnswer("")
    setDiagnostic(null)
    setShowHint(false)
  }

  async function createWord() {
    if (creating || skipping) return
    setCreating(true)
    try {
      if (mission?.activityRunId && !diagnostic) {
        await updateActivityRun(mission.activityRunId, {
          status: answer.trim() ? "abandoned" : "skipped",
          ...(answer.trim()
            ? { abandonReason: "Learner requested another vocabulary word." }
            : { skipReason: "Learner requested another vocabulary word." }),
        }).catch(() => undefined)
      }
      await requestWord(knownWords)
    } catch {
      toast.error(t.vocabulary.generateFailed)
    } finally {
      setCreating(false)
    }
  }

  async function skipKnownWord() {
    if (!vocabulary || skipping || creating) return
    setSkipping(true)
    const normalizedWord = vocabulary.targetWord.toLowerCase()
    const nextKnownWords = Array.from(new Set([...knownWords, normalizedWord])).slice(-30)
    setKnownWords(nextKnownWords)
    saveKnownVocabulary(nextKnownWords)
    try {
      if (mission?.activityRunId) {
        await updateActivityRun(mission.activityRunId, {
          status: "skipped",
          skipReason: `Learner self-reported that they already know “${vocabulary.targetWord}”.`,
        }).catch(() => undefined)
      }
      await requestWord(nextKnownWords)
      toast.success(t.vocabulary.knownSkipped)
    } catch {
      toast.error(t.vocabulary.generateFailed)
    } finally {
      setSkipping(false)
    }
  }

  async function analyzeAnswer() {
    const text = answer.trim()
    if (!canAnalyze || analyzing || !vocabulary) return
    setAnalyzing(true)
    try {
      const analysisContext = [
        `Target word: ${vocabulary.targetWord}`,
        `Accepted word forms: ${acceptedForms.join(", ")}`,
        `Meaning: ${vocabulary.meaning}`,
        `Usage note: ${vocabulary.usageNote}`,
        `Situation: ${vocabulary.situation}`,
        `Communication goal: ${vocabulary.communicativeGoal}`,
        `Audience: ${vocabulary.audience}`,
        `Tone: ${vocabulary.tone}`,
        `Meanings to express: ${vocabulary.conceptsToExpress.join("; ")}`,
      ].join("\n")
      if (mission?.activityRunId) {
        await updateActivityRun(mission.activityRunId, {
          status: "started",
          hintLevel: showHint ? 1 : 0,
          attemptCount: 1,
        })
      }
      const result = await diagnose(
        DEMO_USER_ID,
        text,
        "fast",
        analysisContext,
        mission?.activityRunId
          ? {
              activityRunId: mission.activityRunId,
              missionType: "vocabulary_in_action",
              targetSkills: mission.targetSkills,
              modality: "text",
              hintLevel: showHint ? 1 : 0,
              playCount: 0,
              contextKey: `vocabulary:${vocabulary.targetWord}:${mission.id}`,
              taskDifficulty: 0.65,
              delayed: false,
              novelContext: true,
            }
          : undefined,
      )
      setSubmittedAnswer(text)
      setDiagnostic(result)
      await refreshEvidenceCount()
    } catch {
      toast.error(t.vocabulary.analyzeFailed)
    } finally {
      setAnalyzing(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header className="rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/8 via-card to-secondary/30 p-6 sm:p-8">
        <Badge variant="secondary"><BookOpenCheck className="size-3.5" /> {t.vocabulary.badge}</Badge>
        <h1 className="mt-4 max-w-3xl text-balance font-heading text-3xl font-bold tracking-tight sm:text-4xl">{t.vocabulary.title}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">{t.vocabulary.description}</p>
        <Button className="mt-5 min-h-11 rounded-xl" onClick={() => void createWord()} disabled={creating || skipping}>
          {creating ? <Spinner className="size-4" /> : mission ? <RefreshCw className="size-4" /> : <Sparkles className="size-4" />}
          {creating ? t.vocabulary.creating : mission ? t.vocabulary.another : t.vocabulary.start}
        </Button>
      </header>

      {vocabulary && mission ? (
        <>
          <div className="grid grid-cols-3 gap-2" aria-label={t.vocabulary.progressLabel}>
            {([
              ["meet", t.vocabulary.progressMeet],
              ["notice", t.vocabulary.progressNotice],
              ["apply", t.vocabulary.progressApply],
            ] as const).map(([value, label], index) => {
              const currentIndex = ["meet", "notice", "apply"].indexOf(stage)
              const complete = index < currentIndex
              const active = value === stage
              return (
                <div
                  key={value}
                  className={`rounded-xl border px-3 py-2 text-center text-xs font-medium transition-colors sm:text-sm ${
                    active
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : complete
                        ? "border-primary/20 bg-primary/5 text-foreground"
                        : "border-border/70 text-muted-foreground"
                  }`}
                >
                  {complete ? <Check className="mr-1 inline size-3.5" /> : null}
                  {index + 1}. {label}
                </div>
              )
            })}
          </div>

          {stage === "meet" ? (
            <Card className="overflow-hidden border-primary/25">
              <div className="h-1.5 bg-gradient-to-r from-primary via-warning to-secondary" />
              <CardHeader>
                <Badge variant="outline" className="w-fit">{t.vocabulary.stepOne}</Badge>
                <CardTitle className="font-heading text-2xl">{t.vocabulary.meetTitle}</CardTitle>
                <CardDescription>{t.vocabulary.meetDescription}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-5">
                <div className="flex flex-col gap-4 rounded-2xl bg-primary/7 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-heading text-4xl font-bold tracking-tight text-primary sm:text-5xl">{vocabulary.targetWord}</span>
                      <Badge variant="secondary">{vocabulary.partOfSpeech}</Badge>
                    </div>
                    <p className="mt-3 max-w-3xl text-base leading-relaxed">{vocabulary.meaning}</p>
                  </div>
                  <ShadowingButton text={vocabulary.targetWord} />
                </div>

                <div className="rounded-2xl border border-border/70 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Brain className="size-4 text-primary" /> {t.vocabulary.recognitionTip}
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{vocabulary.recognitionTip}</p>
                </div>

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                  <Button variant="ghost" onClick={() => void skipKnownWord()} disabled={skipping || creating}>
                    {skipping ? <Spinner className="size-4" /> : <RefreshCw className="size-4" />}
                    {skipping ? t.vocabulary.skippingKnown : t.vocabulary.alreadyKnow}
                  </Button>
                  <Button onClick={() => setStage("notice")}>
                    {t.vocabulary.continueUsage} <ArrowRight className="size-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {stage === "notice" ? (
            <Card className="overflow-hidden border-primary/20">
              <div className="h-1.5 bg-gradient-to-r from-primary via-warning to-secondary" />
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Badge variant="outline">{t.vocabulary.stepTwo}</Badge>
                  <div className="flex items-center gap-2">
                    <span className="font-heading text-xl font-bold text-primary">{vocabulary.targetWord}</span>
                    <ShadowingButton text={vocabulary.targetWord} />
                  </div>
                </div>
                <CardTitle className="font-heading text-2xl">{t.vocabulary.noticeTitle}</CardTitle>
                <CardDescription>{t.vocabulary.noticeDescription}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-border/70 p-4">
                    <div className="text-xs font-semibold tracking-wide text-primary uppercase">{t.vocabulary.usageNote}</div>
                    <p className="mt-2 text-sm leading-relaxed">{vocabulary.usageNote}</p>
                  </div>
                  <div className="rounded-2xl border border-warning/25 bg-warning/5 p-4">
                    <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-warning-foreground uppercase">
                      <TriangleAlert className="size-4" /> {t.vocabulary.commonMistake}
                    </div>
                    <p className="mt-2 text-sm leading-relaxed">{vocabulary.commonMistake}</p>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t.vocabulary.collocations}</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {vocabulary.collocations.map((collocation) => (
                      <Badge key={collocation} variant="secondary" className="px-3 py-1 text-sm">{collocation}</Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t.vocabulary.examples}</div>
                  <div className="mt-2 grid gap-2">
                    {vocabulary.exampleSentences.map((sentence, index) => (
                      <div key={sentence} className="flex gap-3 rounded-xl bg-muted/35 p-3 text-sm leading-relaxed">
                        <span className="font-semibold text-primary">{index + 1}</span>
                        <span>{sentence}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                  <Button variant="ghost" onClick={() => setStage("meet")}>
                    <ArrowLeft className="size-4" /> {t.vocabulary.backToWord}
                  </Button>
                  <Button onClick={() => setStage("apply")}>
                    {t.vocabulary.applyWord} <ArrowRight className="size-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {stage === "apply" ? (
            <>
              <Card className="overflow-hidden border-primary/20">
                <div className="h-1.5 bg-gradient-to-r from-primary via-warning to-secondary" />
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Badge variant="outline">{t.vocabulary.stepThree}</Badge>
                    <Badge variant="secondary" className="text-sm">
                      <Target className="size-3.5" /> {t.vocabulary.targetWord}: {vocabulary.targetWord}
                    </Badge>
                  </div>
                  <CardTitle className="font-heading text-2xl">{mission.title}</CardTitle>
                  <CardDescription className="text-sm leading-relaxed">{mission.taskPrompt}</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      [t.vocabulary.situation, vocabulary.situation],
                      [t.vocabulary.goal, vocabulary.communicativeGoal],
                      [t.vocabulary.audience, vocabulary.audience],
                      [t.vocabulary.tone, vocabulary.tone],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-2xl border border-border/70 bg-muted/25 p-4">
                        <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{label}</div>
                        <p className="mt-1 text-sm leading-relaxed">{value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-2xl bg-primary/7 p-4">
                    <div className="text-xs font-semibold tracking-wide text-primary uppercase">{t.vocabulary.meanings}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {vocabulary.conceptsToExpress.map((concept) => <Badge key={concept} variant="outline">{concept}</Badge>)}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{t.vocabulary.answerLabel}</CardTitle>
                  <CardDescription>{t.vocabulary.answerDescription}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={answer}
                    onChange={(event) => setAnswer(event.target.value)}
                    placeholder={t.vocabulary.placeholder}
                    className="min-h-36 resize-y"
                    disabled={analyzing || Boolean(diagnostic)}
                  />
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowHint(true)
                        if (mission.activityRunId) {
                          void updateActivityRun(mission.activityRunId, { hintLevel: 1 })
                        }
                      }}
                      disabled={showHint || Boolean(diagnostic)}
                    >
                      <Lightbulb className="size-4" /> {t.vocabulary.hint}
                    </Button>
                    <span className={`flex items-center gap-1.5 text-xs leading-relaxed ${usedTargetWord ? "text-primary" : "text-muted-foreground"}`}>
                      {usedTargetWord ? <CircleCheck className="size-4" /> : <Target className="size-4" />}
                      {showHint
                        ? mission.hints[0]
                        : usedTargetWord
                          ? t.vocabulary.targetUsed
                          : `${t.vocabulary.targetMissing} “${vocabulary.targetWord}”`}
                    </span>
                    <Button className="sm:ml-auto" onClick={() => void analyzeAnswer()} disabled={!canAnalyze || analyzing || Boolean(diagnostic)}>
                      {analyzing ? <Spinner className="size-4" /> : <ArrowRight className="size-4" />}
                      {analyzing ? t.vocabulary.analyzing : t.vocabulary.analyze}
                    </Button>
                  </div>
                  <Button variant="ghost" size="sm" className="mt-3" onClick={() => setStage("notice")}>
                    <ArrowLeft className="size-4" /> {t.vocabulary.backToUsage}
                  </Button>
                </CardContent>
              </Card>
            </>
          ) : null}
        </>
      ) : null}

      {diagnostic && vocabulary ? (
        <section className="grid gap-5">
          <Card className="border-primary/25 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CircleCheck className="size-5 text-primary" /> {t.vocabulary.evidenceTitle}
              </CardTitle>
              <CardDescription className="leading-relaxed">{t.vocabulary.evidenceDescription}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {vocabularyErrors.length === 0 ? (
                <p className="rounded-xl bg-background/75 p-4 text-sm leading-relaxed text-muted-foreground">
                  {t.vocabulary.noIssue} <span className="font-semibold text-foreground">{vocabulary.targetWord}</span>.
                </p>
              ) : vocabularyErrors.map((error) => (
                <div key={error.id} className="rounded-2xl border border-warning/25 bg-background/80 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{t.vocabulary.observed}</Badge>
                    <Badge variant="outline">{t.vocabulary.provisional}</Badge>
                  </div>
                  <p className="mt-3 text-sm"><span className="text-muted-foreground line-through">{error.originalText}</span> <ArrowRight className="mx-1 inline size-3.5" /> {error.correctedText}</p>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{error.explanationZh}</p>
                </div>
              ))}
              <div className="flex items-center justify-between rounded-xl border border-border/70 bg-background/70 px-4 py-3 text-sm">
                <span className="text-muted-foreground">{t.vocabulary.historical}</span>
                <Badge variant="outline">{historicalVocabularyCount}</Badge>
              </div>
            </CardContent>
          </Card>

          <div>
            <h2 className="mb-3 font-heading text-xl font-semibold">{t.vocabulary.fullReport}</h2>
            <DiagnosticReport result={diagnostic.diagnostic} originalText={submittedAnswer} />
          </div>
        </section>
      ) : null}
    </div>
  )
}
