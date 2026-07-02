from enum import Enum
from typing import Literal


OutputLanguage = Literal["en", "zh-CN"]


class CEFRLevel(str, Enum):
    A1 = "A1"
    A2 = "A2"
    B1 = "B1"
    B2 = "B2"
    C1 = "C1"
    C2 = "C2"


class Severity(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"


class PracticeType(str, Enum):
    fix_sentence = "fix_sentence"
    fill_blank = "fill_blank"
    rewrite_sentence = "rewrite_sentence"
