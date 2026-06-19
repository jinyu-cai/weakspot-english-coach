ERROR_TAXONOMY = {
    "grammar.verb_tense": {
        "label": "Verb tense",
        "zhLabel": "动词时态",
        "description": "Incorrect or inconsistent use of verb tense.",
    },
    "grammar.article": {
        "label": "Articles",
        "zhLabel": "冠词",
        "description": "Incorrect or missing a/an/the.",
    },
    "grammar.preposition": {
        "label": "Prepositions",
        "zhLabel": "介词",
        "description": "Incorrect use of prepositions such as in, on, at, for.",
    },
    "grammar.subject_verb_agreement": {
        "label": "Subject-verb agreement",
        "zhLabel": "主谓一致",
        "description": "Subject and verb do not agree in number/person.",
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


def all_skill_codes() -> list[str]:
    return list(ERROR_TAXONOMY.keys())
