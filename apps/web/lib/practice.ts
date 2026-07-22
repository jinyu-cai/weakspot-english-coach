import type { PracticeType } from "./types"
import type { OutputLanguage } from "./language"
import { getCopy } from "./i18n"

export const PRACTICE_TYPE_META: Record<PracticeType, { label: string; zhLabel: string }> = {
  fix_sentence: { label: "Fix sentence", zhLabel: "Fix sentence" },
  fill_blank: { label: "Fill blank", zhLabel: "Fill blank" },
  rewrite_sentence: { label: "Rewrite", zhLabel: "Rewrite" },
}

// Keyed by the backend taxonomy codes (app/core/taxonomy.py). These values are
// also used as `targetSkillCode` when generating practice, so they MUST match
// the codes the backend emits.
export const SKILL_LABELS: Record<string, string> = {
  "grammar.verb_tense": "Verb tense",
  "grammar.article": "Articles",
  "grammar.preposition": "Prepositions",
  "grammar.subject_verb_agreement": "Subject-verb agreement",
  "grammar.phrasal_verb_object": "Phrasal verb object",
  "grammar.preposition_phrase": "Prepositional phrases",
  "grammar.question_word": "Question words",
  "grammar.sentence_structure": "Grammar structure",
  "grammar.verb_form": "Verb forms",
  "grammar.word_order": "Word order",
  "grammar.adjective": "Adjectives",
  "grammar.be_missing": "Missing be verb",
  "grammar.time_expression": "Time expressions",
  "vocab.word_choice": "Word choice",
  "vocab.repetition": "Word repetition",
  "sentence.structure": "Complete sentence building",
  "sentence.variety": "Sentence variety",
  "discourse.coherence": "Coherence",
  "style.register": "Register & tone",
  "clarity.expression": "Clarity of expression",
}

function humanizeSkillCode(code: string) {
  const words = code.replace(/^[a-z]+\./, "").replace(/[._-]+/g, " ").trim()
  if (!words) return code
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export function practiceTypeLabel(type: PracticeType, language: OutputLanguage) {
  return getCopy(language).labels.practiceTypes[type] ?? PRACTICE_TYPE_META[type].label
}

export function skillLabel(code: string, language: OutputLanguage) {
  const labels = getCopy(language).labels.skills as Record<string, string>
  return labels[code] ?? SKILL_LABELS[code] ?? humanizeSkillCode(code)
}
