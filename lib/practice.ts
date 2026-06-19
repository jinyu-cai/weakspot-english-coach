import type { PracticeType } from "./types"

export const PRACTICE_TYPE_META: Record<PracticeType, { label: string; zhLabel: string }> = {
  fix_sentence: { label: "Fix sentence", zhLabel: "改错" },
  fill_blank: { label: "Fill blank", zhLabel: "填空" },
  rewrite_sentence: { label: "Rewrite", zhLabel: "改写" },
}

export const SKILL_LABELS: Record<string, string> = {
  verb_tense: "动词时态",
  prepositions: "介词使用",
  subject_verb_agreement: "主谓一致",
  vocabulary_range: "词汇丰富度",
  articles: "冠词使用",
  clarity: "表达清晰度",
  register: "语域与语气",
}
