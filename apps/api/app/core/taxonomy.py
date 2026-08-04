from typing import Literal, TypeAlias


ERROR_TAXONOMY = {
    "grammar.verb_tense": {
        "label": "Verb tense",
        "zhLabel": "动词时态",
        "description": "Incorrect or inconsistent use of verb tense.",
    },
    "grammar.verb_form": {
        "label": "Verb form",
        "zhLabel": "动词形式",
        "description": "Incorrect base, infinitive, gerund, participle, or complement form.",
    },
    "grammar.auxiliary": {
        "label": "Auxiliary verbs",
        "zhLabel": "助动词",
        "description": "Missing, unnecessary, or incorrect be, do, or have auxiliary.",
    },
    "grammar.modal": {
        "label": "Modal verbs",
        "zhLabel": "情态动词",
        "description": "Incorrect modal choice, form, or modal verb construction.",
    },
    "grammar.voice": {
        "label": "Active and passive voice",
        "zhLabel": "主动与被动语态",
        "description": "Incorrect formation or use of active and passive voice.",
    },
    "grammar.subject_verb_agreement": {
        "label": "Subject-verb agreement",
        "zhLabel": "主谓一致",
        "description": "Subject and verb do not agree in number or person.",
    },
    "grammar.noun_number": {
        "label": "Noun number and countability",
        "zhLabel": "名词单复数与可数性",
        "description": "Incorrect singular, plural, countable, or uncountable noun use.",
    },
    "grammar.noun_possessive": {
        "label": "Noun possessives",
        "zhLabel": "名词所有格",
        "description": "Incorrect possessive noun form or possessive construction.",
    },
    "grammar.noun_form": {
        "label": "Noun form",
        "zhLabel": "名词形式",
        "description": "Incorrect noun derivation, inflection, or grammatical noun form.",
    },
    "grammar.article": {
        "label": "Articles",
        "zhLabel": "冠词",
        "description": "Incorrect or missing a/an/the.",
    },
    "grammar.determiner": {
        "label": "Determiners",
        "zhLabel": "限定词",
        "description": "Incorrect demonstrative, possessive, distributive, or other determiner.",
    },
    "grammar.quantifier": {
        "label": "Quantifiers",
        "zhLabel": "数量词",
        "description": "Incorrect use of quantifiers such as much, many, few, or several.",
    },
    "grammar.pronoun": {
        "label": "Pronouns",
        "zhLabel": "代词",
        "description": "Incorrect pronoun form, case, agreement, reference, or omission.",
    },
    "grammar.preposition": {
        "label": "Prepositions",
        "zhLabel": "介词",
        "description": "Incorrect use of prepositions such as in, on, at, for.",
    },
    "grammar.particle": {
        "label": "Particles and phrasal verbs",
        "zhLabel": "动词小品词与短语动词",
        "description": "Missing, misplaced, or incorrect particle in a phrasal construction.",
    },
    "grammar.adjective_form": {
        "label": "Adjective form",
        "zhLabel": "形容词形式",
        "description": "Incorrect adjective derivation, participial adjective, or adjective form.",
    },
    "grammar.adjective_order": {
        "label": "Adjective order",
        "zhLabel": "形容词顺序",
        "description": "Adjectives appear in an unnatural or grammatically incorrect order.",
    },
    "grammar.adverb": {
        "label": "Adverbs",
        "zhLabel": "副词形式与位置",
        "description": "Incorrect adverb form, choice, scope, or sentence position.",
    },
    "grammar.comparison": {
        "label": "Comparatives and superlatives",
        "zhLabel": "比较级与最高级",
        "description": "Incorrect comparative, superlative, equality, or comparison structure.",
    },
    "grammar.conjunction": {
        "label": "Conjunctions",
        "zhLabel": "连词",
        "description": "Missing, unnecessary, or incorrect coordinating or subordinating conjunction.",
    },
    "grammar.word_order": {
        "label": "Word order",
        "zhLabel": "语序",
        "description": "Words or constituents appear in an incorrect grammatical order.",
    },
    "grammar.negation": {
        "label": "Negation",
        "zhLabel": "否定结构",
        "description": "Incorrect formation, placement, or scope of a negative expression.",
    },
    "grammar.question_formation": {
        "label": "Question formation",
        "zhLabel": "疑问句结构",
        "description": "Incorrect auxiliary, inversion, question word, or indirect-question structure.",
    },
    "grammar.clause": {
        "label": "Clause structure",
        "zhLabel": "从句结构",
        "description": "Incorrect main, subordinate, complement, or adverbial clause construction.",
    },
    "grammar.relative_clause": {
        "label": "Relative clauses",
        "zhLabel": "定语从句",
        "description": "Incorrect relative word, reference, omission, or relative-clause structure.",
    },
    "grammar.conditional": {
        "label": "Conditionals",
        "zhLabel": "条件句",
        "description": "Incorrect tense, modal, or clause combination in a conditional construction.",
    },
    "grammar.parallelism": {
        "label": "Parallel structure",
        "zhLabel": "平行结构",
        "description": "Coordinated or listed elements do not use parallel grammatical forms.",
    },
    "grammar.fragment": {
        "label": "Sentence fragments",
        "zhLabel": "句子残缺",
        "description": "A dependent or incomplete construction is presented as a complete sentence.",
    },
    "grammar.run_on": {
        "label": "Run-on sentences",
        "zhLabel": "连写句与逗号拼接",
        "description": "Independent clauses are joined without correct punctuation or conjunctions.",
    },
    "grammar.punctuation": {
        "label": "Grammar-related punctuation",
        "zhLabel": "语法相关标点",
        "description": "Punctuation incorrectly marks sentence or clause structure.",
    },
    "grammar.other": {
        "label": "Other grammar",
        "zhLabel": "其他语法问题",
        "description": "A genuine grammatical error not covered by another grammar category.",
    },
    "vocab.word_choice": {
        "label": "Word choice",
        "zhLabel": "用词不自然",
        "description": "Word is understandable but unnatural or inaccurate.",
    },
    "vocab.repetition": {
        "label": "Repetitive vocabulary",
        "zhLabel": "词汇重复",
        "description": "Same words are repeated too often.",
    },
    "sentence.structure": {
        "label": "Sentence structure",
        "zhLabel": "句子结构",
        "description": "Sentence is awkward, fragmented, or too simple.",
    },
    "sentence.variety": {
        "label": "Sentence variety",
        "zhLabel": "句式单一",
        "description": "Sentences lack variety in structure and length.",
    },
    "discourse.coherence": {
        "label": "Coherence",
        "zhLabel": "逻辑连贯性",
        "description": "Ideas are not connected clearly.",
    },
    "style.register": {
        "label": "Register and tone",
        "zhLabel": "语气和语域",
        "description": "Tone is too casual, too formal, or inappropriate.",
    },
    "clarity.expression": {
        "label": "Clarity",
        "zhLabel": "表达清晰度",
        "description": "Meaning is unclear or hard to follow.",
    },
}

# Derive the model-facing type from the taxonomy itself so there is only one
# list to maintain. Pydantic expands this Literal into a JSON Schema enum.
SkillCode: TypeAlias = Literal[*tuple(ERROR_TAXONOMY)]


def all_skill_codes() -> list[str]:
    return list(ERROR_TAXONOMY.keys())


def format_skill_code_list(prefix: str = "- ") -> str:
    return "\n".join(f"{prefix}{code}" for code in ERROR_TAXONOMY)
