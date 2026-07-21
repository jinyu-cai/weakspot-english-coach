#!/usr/bin/env python3
"""Apply sentence-level Qwen timings to the reviewed Chinese captions."""

from __future__ import annotations

import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parent
REVIEW_SRT = ROOT / "subtitles-zh-review.srt"
TIMELINE = ROOT / "output" / "timeline-qwen.json"
OUTPUT_SRT = ROOT / "output" / "subtitles-zh.srt"
TIMECODE = re.compile(r"^\d{2}:\d{2}:\d{2},\d{3} --> \d{2}:\d{2}:\d{2},\d{3}$")


def timestamp(seconds: float) -> str:
    milliseconds = max(0, round(seconds * 1000))
    hours, remainder = divmod(milliseconds, 3_600_000)
    minutes, remainder = divmod(remainder, 60_000)
    secs, millis = divmod(remainder, 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"


def reviewed_captions(path: Path) -> list[str]:
    blocks = re.split(r"\n\s*\n", path.read_text(encoding="utf-8").strip())
    captions: list[str] = []
    for block in blocks:
        lines = [line.strip() for line in block.splitlines() if line.strip()]
        if len(lines) < 3 or not lines[0].isdigit() or not TIMECODE.fullmatch(lines[1]):
            raise ValueError(f"Invalid SRT block: {block[:80]!r}")
        captions.append("\n".join(lines[2:]))
    return captions


def main() -> None:
    captions = reviewed_captions(REVIEW_SRT)
    segments = json.loads(TIMELINE.read_text(encoding="utf-8"))["segments"]
    if len(captions) != len(segments):
        raise ValueError(
            f"Chinese captions ({len(captions)}) do not match audio segments "
            f"({len(segments)})."
        )

    blocks = []
    for index, (caption, segment) in enumerate(zip(captions, segments), start=1):
        blocks.append(
            f"{index}\n{timestamp(float(segment['start']))} --> "
            f"{timestamp(float(segment['end']))}\n{caption}"
        )
    OUTPUT_SRT.write_text("\n\n".join(blocks) + "\n", encoding="utf-8")
    print(f"Created {OUTPUT_SRT} ({len(blocks)} cues)")


if __name__ == "__main__":
    main()
