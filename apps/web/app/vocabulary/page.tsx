"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowRight, BookOpenCheck, Lightbulb, RefreshCw, Sparkles } from "lucide-react"
import { toast } from "sonner"

import { DiagnosticReport } from "@/components/diagnostic-report"
import { useLanguage } from "@/components/language-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { diagnose, generateCoachMission, getHistory } from "@/lib/api-client"
import { DEMO_USER_ID } from "@/lib/mock-data"
import type { CoachMission, DiagnoseResponse } from "@/lib/types"


export default function VocabularyPage() {
  const { t } = useLanguage()
  const [mission, setMission] = useState<CoachMission | null>(null)
  const [answer, setAnswer] = useState("")
  const [submittedAnswer, setSubmittedAnswer] = useState("")
  const [diagnostic, setDiagnostic] = useState<DiagnoseResponse | null>(null)
  const [creating, setCreating] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [showHint, setShowHint] = useState(false)
  const [historicalVocabularyCount, setHistoricalVocabularyCount] = useState(0)

  async function refreshEvidenceCount() {
    try {
      const history = await getHistory(DEMO_USER_ID)
      setHistoricalVocabularyCount(history.errors.filter((error) => error.code === "vocab.word_choice").length)
    } catch {
      // The practice remains usable if historical evidence is temporarily unavailable.
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

  async function createSituation() {
    setCreating(true)
    try {
      const next = await generateCoachMission({
        durationMinutes: 5,
        modality: "text",
        energy: "normal",
        preferredType: "vocabulary_in_action",
      })
      if (!next.vocabulary) throw new Error("Vocabulary mission is missing its context")
      setMission(next)
      setAnswer("")
      setSubmittedAnswer("")
      setDiagnostic(null)
      setShowHint(false)
    } catch {
      toast.error(t.vocabulary.generateFailed)
    } finally {
      setCreating(false)
    }
  }

  async function analyzeAnswer() {
    const text = answer.trim()
    if (text.length < 20 || analyzing) return
    setAnalyzing(true)
    try {
      const vocabulary = mission?.vocabulary
      const analysisContext = vocabulary
        ? [
            `Situation: ${vocabulary.situation}`,
            `Communication goal: ${vocabulary.communicativeGoal}`,
            `Audience: ${vocabulary.audience}`,
            `Tone: ${vocabulary.tone}`,
            `Meanings to express: ${vocabulary.conceptsToExpress.join("; ")}`,
          ].join("\n")
        : undefined
      const result = await diagnose(DEMO_USER_ID, text, "fast", analysisContext)
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
        <Button className="mt-5 min-h-11 rounded-xl" onClick={() => void createSituation()} disabled={creating}>
          {creating ? <Spinner className="size-4" /> : mission ? <RefreshCw className="size-4" /> : <Sparkles className="size-4" />}
          {creating ? t.vocabulary.creating : mission ? t.vocabulary.another : t.vocabulary.start}
        </Button>
      </header>

      {mission?.vocabulary ? (
        <>
          <Card className="overflow-hidden border-primary/20">
            <div className="h-1.5 bg-gradient-to-r from-primary via-warning to-secondary" />
            <CardHeader>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{mission.eyebrow}</Badge>
                <Badge variant="outline">{mission.estimatedMinutes} {t.common.minutesShort}</Badge>
              </div>
              <CardTitle className="font-heading text-2xl">{mission.title}</CardTitle>
              <CardDescription className="text-sm leading-relaxed">{mission.briefing}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  [t.vocabulary.situation, mission.vocabulary.situation],
                  [t.vocabulary.goal, mission.vocabulary.communicativeGoal],
                  [t.vocabulary.audience, mission.vocabulary.audience],
                  [t.vocabulary.tone, mission.vocabulary.tone],
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
                  {mission.vocabulary.conceptsToExpress.map((concept) => <Badge key={concept} variant="outline">{concept}</Badge>)}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t.vocabulary.answerLabel}</CardTitle>
              <CardDescription>{mission.taskPrompt}</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={answer}
                onChange={(event) => setAnswer(event.target.value)}
                placeholder={t.vocabulary.placeholder}
                className="min-h-36 resize-y"
                disabled={analyzing}
              />
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                <Button variant="outline" onClick={() => setShowHint(true)} disabled={showHint}>
                  <Lightbulb className="size-4" /> {t.vocabulary.hint}
                </Button>
                <span className="text-xs leading-relaxed text-muted-foreground">
                  {showHint ? mission.hints[0] : t.vocabulary.minimum}
                </span>
                <Button className="sm:ml-auto" onClick={() => void analyzeAnswer()} disabled={answer.trim().length < 20 || analyzing}>
                  {analyzing ? <Spinner className="size-4" /> : <ArrowRight className="size-4" />}
                  {analyzing ? t.vocabulary.analyzing : t.vocabulary.analyze}
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}

      {diagnostic ? (
        <section className="grid gap-5">
          <Card className="border-warning/25 bg-warning/5">
            <CardHeader>
              <CardTitle>{t.vocabulary.evidenceTitle}</CardTitle>
              <CardDescription className="leading-relaxed">{t.vocabulary.evidenceDescription}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {vocabularyErrors.length === 0 ? (
                <p className="rounded-xl bg-background/75 p-4 text-sm leading-relaxed text-muted-foreground">{t.vocabulary.noIssue}</p>
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
