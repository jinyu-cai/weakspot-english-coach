"""Stable hash of submission text, used to detect accidental duplicate submissions.

Normalizes whitespace and case so trivial differences (extra spaces, capitalization)
still count as the same text. This is deliberately narrow: only text that is
byte-identical after normalization collides. Two *different* inputs that merely
share the same error type (e.g. both have a verb-tense mistake) hash differently
and are therefore both counted — that is a genuine recurring weakness, not a
duplicate.
"""

import hashlib
import re

_WHITESPACE = re.compile(r"\s+")


def normalized_text_hash(text: str) -> str:
    normalized = _WHITESPACE.sub(" ", (text or "").strip().lower())
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()[:32]
