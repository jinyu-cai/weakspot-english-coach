import type { PracticeType } from "@/lib/types"

export const PRACTICE_TYPE_META: Record<PracticeType, { labelZh: string; labelEn: string }> = {
  fix_sentence: { labelZh: "改错句", labelEn: "Fix sentence" },
  fill_blank: { labelZh: "填空", labelEn: "Fill blank" },
  rewrite_sentence: { labelZh: "句子重写", labelEn: "Rewrite" },
}

export const SKILL_LABELS: Record<string, string> = {
  verb_tense: "动词时态",
  prepositions: "介词搭配",
  word_choice: "词汇选择",
  comparatives: "比较级",
  register: "语域与语气",
  articles: "冠词",
  clarity: "表达清晰度",
  subject_verb: "主谓一致",
}
