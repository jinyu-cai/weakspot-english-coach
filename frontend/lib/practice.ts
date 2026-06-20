import type { PracticeType } from "./types"

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
  "vocab.word_choice": "Word choice",
  "vocab.repetition": "Word repetition",
  "sentence.structure": "Sentence structure",
  "sentence.variety": "Sentence variety",
  "discourse.coherence": "Coherence",
  "style.register": "Register & tone",
  "clarity.expression": "Clarity of expression",
}
