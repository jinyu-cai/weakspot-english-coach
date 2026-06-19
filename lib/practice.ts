import type { PracticeType } from "./types"

export const PRACTICE_TYPE_META: Record<PracticeType, { label: string; zhLabel: string }> = {
  fix_sentence: { label: "Fix sentence", zhLabel: "改错" },
  fill_blank: { label: "Fill blank", zhLabel: "填空" },
  rewrite_sentence: { label: "Rewrite", zhLabel: "改写" },
}

// Keyed by the backend taxonomy codes (app/core/taxonomy.py). These values are
// also used as `targetSkillCode` when generating practice, so they MUST match
// the codes the backend emits.
export const SKILL_LABELS: Record<string, string> = {
  "grammar.verb_tense": "动词时态",
  "grammar.article": "冠词",
  "grammar.preposition": "介词",
  "grammar.subject_verb_agreement": "主谓一致",
  "vocab.word_choice": "用词不自然",
  "vocab.repetition": "词汇重复",
  "sentence.structure": "句子结构",
  "sentence.variety": "句式单一",
  "discourse.coherence": "逻辑连贯性",
  "style.register": "语气和语域",
  "clarity.expression": "表达清晰度",
}
