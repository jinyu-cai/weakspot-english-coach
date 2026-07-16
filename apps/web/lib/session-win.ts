import type { AppCopy } from "@/lib/i18n"
import type {
  DiagnosticResult,
  PracticeExercise,
  PracticeGrade,
  SessionAnalysis,
  StealthPracticeResult,
} from "@/lib/types"
import { skillLabel as localizedSkillLabel } from "@/lib/practice"
import type { OutputLanguage } from "@/lib/language"

export type SessionWinSource = "diagnose" | "practice" | "coach" | "chat"

export type SessionWinModel = {
  source: SessionWinSource
  title: string
  wins: string[]
  nextHref: string
  nextLabel: string
  secondaryHref?: string
  secondaryLabel?: string
  note?: string
}

const LAST_WIN_KEY = "weakspot-last-session-win"

export function markSessionWin(source: SessionWinSource) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(
      LAST_WIN_KEY,
      JSON.stringify({ source, at: Date.now() }),
    )
  } catch {
    // Ignore private-mode storage failures.
  }
}

/** Gentle return message when the learner has been away at least one local day. */
export function getWelcomeBackMessage(t: AppCopy): string | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(LAST_WIN_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { at?: number }
    if (!parsed.at || !Number.isFinite(parsed.at)) return null
    const last = new Date(parsed.at)
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const startOfLast = new Date(last.getFullYear(), last.getMonth(), last.getDate()).getTime()
    const daysAway = Math.round((startOfToday - startOfLast) / 86_400_000)
    if (daysAway <= 0) return null
    if (daysAway === 1) return t.sessionWin.welcomeBackYesterday
    return t.sessionWin.welcomeBackAway.replace("{days}", String(daysAway))
  } catch {
    return null
  }
}

function firstSkillHref(skillCode?: string | null) {
  if (!skillCode) return "/practice"
  return `/practice?skill=${encodeURIComponent(skillCode)}`
}

export function sessionWinFromDiagnose(
  result: DiagnosticResult,
  t: AppCopy,
  language: OutputLanguage,
): SessionWinModel {
  const wins: string[] = []
  if (result.strengthsZh[0]) wins.push(result.strengthsZh[0])
  if (result.errors.length > 0) {
    const top = result.errors[0]
    const skill = localizedSkillLabel(top.code, language)
    wins.push(t.sessionWin.diagnoseFocus.replace("{skill}", skill))
  } else if (result.weaknessesZh[0]) {
    wins.push(result.weaknessesZh[0])
  }
  if (wins.length === 0) wins.push(t.sessionWin.diagnoseDefaultWin)

  const topSkill = result.errors[0]?.code
  const score = result.overallScore
  const title =
    score >= 85
      ? t.sessionWin.titles.strong
      : score >= 65
        ? t.sessionWin.titles.solid
        : t.sessionWin.titles.progress

  return {
    source: "diagnose",
    title,
    wins: wins.slice(0, 2),
    nextHref: firstSkillHref(topSkill),
    nextLabel: t.sessionWin.actions.practiceFocus,
    secondaryHref: "/coach",
    secondaryLabel: t.sessionWin.actions.mission,
    note: t.sessionWin.notes.profileUpdated,
  }
}

export function sessionWinFromPractice(
  grades: PracticeGrade[],
  exercises: PracticeExercise[],
  t: AppCopy,
  language: OutputLanguage,
): SessionWinModel {
  const correct = grades.filter((g) => g.isCorrect).length
  const total = grades.length || exercises.length || 1
  const avg = grades.length
    ? Math.round(grades.reduce((sum, g) => sum + g.score, 0) / grades.length)
    : 0

  const wins: string[] = [
    t.sessionWin.practiceCorrect
      .replace("{correct}", String(correct))
      .replace("{total}", String(total)),
  ]

  if (avg >= 80) wins.push(t.sessionWin.practiceStrongAvg.replace("{score}", String(avg)))
  else if (avg >= 50) wins.push(t.sessionWin.practiceMidAvg.replace("{score}", String(avg)))
  else wins.push(t.sessionWin.practiceLowAvg.replace("{score}", String(avg)))

  const weakExercise = grades
    .map((grade, index) => ({ grade, exercise: exercises[index] }))
    .find((item) => item.exercise && !item.grade.isCorrect)

  const skillCode = weakExercise?.exercise?.targetSkillCode ?? exercises[0]?.targetSkillCode
  const skill = skillCode ? localizedSkillLabel(skillCode, language) : null

  return {
    source: "practice",
    title: correct === total ? t.sessionWin.titles.perfect : t.sessionWin.titles.practiceDone,
    wins: wins.slice(0, 2),
    nextHref: skillCode ? firstSkillHref(skillCode) : "/practice",
    nextLabel: skill
      ? t.sessionWin.actions.practiceSkill.replace("{skill}", skill)
      : t.sessionWin.actions.practiceAgain,
    secondaryHref: "/",
    secondaryLabel: t.sessionWin.actions.diagnose,
    note: t.sessionWin.notes.savedToProfile,
  }
}

export function sessionWinFromCoach(
  diagnostic: DiagnosticResult | null,
  t: AppCopy,
  language: OutputLanguage,
  assisted: boolean,
): SessionWinModel {
  const base = diagnostic
    ? sessionWinFromDiagnose(diagnostic, t, language)
    : {
        source: "coach" as const,
        title: t.sessionWin.titles.missionDone,
        wins: [t.sessionWin.coachDefaultWin],
        nextHref: "/practice",
        nextLabel: t.sessionWin.actions.practiceFocus,
        secondaryHref: "/coach",
        secondaryLabel: t.sessionWin.actions.anotherMission,
        note: t.sessionWin.notes.evidenceKept,
      }

  return {
    ...base,
    source: "coach",
    title: t.sessionWin.titles.missionDone,
    wins: [
      assisted ? t.sessionWin.coachAssisted : t.sessionWin.coachIndependent,
      ...base.wins.slice(0, 1),
    ].slice(0, 2),
    secondaryHref: "/coach",
    secondaryLabel: t.sessionWin.actions.anotherMission,
    note: t.sessionWin.notes.evidenceKept,
  }
}

export function sessionWinFromChat(
  analysis: SessionAnalysis,
  t: AppCopy,
  language: OutputLanguage,
  stealthPractices: StealthPracticeResult[] = [],
): SessionWinModel {
  const wins: string[] = []
  if (analysis.strengthsZh[0]) wins.push(analysis.strengthsZh[0])

  const successProbe = stealthPractices.find((p) => p.outcome === "success" || p.outcome === "hinted_success")
  if (successProbe) {
    const skill = localizedSkillLabel(successProbe.targetSkillCode, language)
    wins.push(
      successProbe.outcome === "success"
        ? t.sessionWin.chatNaturalSuccess.replace("{skill}", skill)
        : t.sessionWin.chatNaturalHinted.replace("{skill}", skill),
    )
  } else if (analysis.corrections.length > 0) {
    wins.push(
      t.sessionWin.chatCorrections.replace("{count}", String(analysis.corrections.length)),
    )
  }

  if (wins.length === 0) wins.push(t.sessionWin.chatDefaultWin)

  const weakSkill = analysis.weaknesses[0]?.code ?? stealthPractices[0]?.targetSkillCode

  return {
    source: "chat",
    title: t.sessionWin.titles.chatDone,
    wins: wins.slice(0, 2),
    nextHref: firstSkillHref(weakSkill),
    nextLabel: t.sessionWin.actions.practiceFocus,
    secondaryHref: "/chat",
    secondaryLabel: t.sessionWin.actions.chatAgain,
    note: t.sessionWin.notes.savedToProfile,
  }
}
