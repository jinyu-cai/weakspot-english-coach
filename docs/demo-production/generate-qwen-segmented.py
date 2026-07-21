#!/usr/bin/env python3
"""Generate sentence-aligned Qwen narration, subtitles, and timeline metadata."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import textwrap
from pathlib import Path

import dashscope
from dashscope.audio.tts_v2 import AudioFormat, SpeechSynthesizer


PRODUCTION_DIR = Path(__file__).resolve().parent
DEFAULT_INPUT = PRODUCTION_DIR / "voiceover-en.txt"
DEFAULT_ENV = PRODUCTION_DIR / ".env"
DEFAULT_OUTPUT_DIR = PRODUCTION_DIR / "output"
ENV_KEY_PATTERN = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
SENTENCE_BOUNDARY = re.compile(r"(?<=[.!?])\s+")
TARGET_DURATION_SECONDS = 174.0
SCENE_SENTENCE_COUNTS = (4, 4, 11, 5, 4, 3, 2)


def load_env_file(path: Path) -> None:
    """Load a small dotenv file without printing any secret values."""
    if not path.exists():
        raise FileNotFoundError(
            f"Missing {path}. Copy .env.example to .env and fill it locally."
        )

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if not ENV_KEY_PATTERN.fullmatch(key):
            continue
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        os.environ.setdefault(key, value)


def required_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value or value.startswith("replace_with_"):
        raise ValueError(f"Set {name} in {DEFAULT_ENV} before running synthesis.")
    return value


def run(command: list[str]) -> str:
    completed = subprocess.run(
        command,
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    return completed.stdout.strip()


def duration(path: Path) -> float:
    output = run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "csv=p=0",
            str(path),
        ]
    )
    value = float(output)
    if value <= 0:
        raise ValueError(f"Invalid audio duration for {path}: {value}")
    return value


def timestamp(seconds: float) -> str:
    milliseconds = max(0, round(seconds * 1000))
    hours, remainder = divmod(milliseconds, 3_600_000)
    minutes, remainder = divmod(remainder, 60_000)
    secs, millis = divmod(remainder, 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"


def wrap_caption(sentence: str) -> str:
    lines = textwrap.wrap(
        sentence,
        width=54,
        break_long_words=False,
        break_on_hyphens=False,
    )
    return "\n".join(lines)


def synthesize_sentence(
    *,
    sentence: str,
    output: Path,
    model: str,
    voice: str,
    language: str,
    instruction: str | None,
    speech_rate: float,
) -> None:
    synthesizer = SpeechSynthesizer(
        model=model,
        voice=voice,
        format=AudioFormat.MP3_44100HZ_MONO_256KBPS,
        volume=55,
        speech_rate=speech_rate,
        pitch_rate=1.0,
        seed=2026,
        instruction=instruction,
        language_hints=[language],
        additional_params={"enable_aigc_tag": True},
    )
    audio = synthesizer.call(sentence, timeout_millis=300_000)
    if not audio:
        raise RuntimeError("Qwen returned no audio data.")
    temporary = output.with_suffix(output.suffix + ".tmp")
    temporary.write_bytes(audio)
    temporary.replace(output)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Generate sentence-aligned narration with Qwen Audio 3 TTS Plus."
    )
    parser.add_argument("--env", type=Path, default=DEFAULT_ENV)
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--target-duration", type=float, default=TARGET_DURATION_SECONDS)
    parser.add_argument("--dry-run", action="store_true")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    load_env_file(args.env)

    api_key = required_env("DASHSCOPE_API_KEY")
    model = required_env("QWEN_TTS_MODEL")
    voice = required_env("QWEN_TTS_VOICE")
    websocket_url = required_env("DASHSCOPE_WEBSOCKET_BASE_URL")
    language = os.environ.get("QWEN_TTS_LANGUAGE", "en").strip() or "en"
    instruction = os.environ.get("QWEN_TTS_INSTRUCTION", "").strip() or None
    speech_rate = float(os.environ.get("QWEN_TTS_SPEECH_RATE", "1.0"))

    text = " ".join(args.input.read_text(encoding="utf-8").split())
    sentences = [item.strip() for item in SENTENCE_BOUNDARY.split(text) if item.strip()]
    if sum(SCENE_SENTENCE_COUNTS) != len(sentences):
        raise ValueError(
            f"Expected {sum(SCENE_SENTENCE_COUNTS)} narration sentences, found "
            f"{len(sentences)}. Update SCENE_SENTENCE_COUNTS if the script changed."
        )
    if not 0.5 <= speech_rate <= 2.0:
        raise ValueError("QWEN_TTS_SPEECH_RATE must be between 0.5 and 2.0.")
    if args.target_duration <= 0:
        raise ValueError("--target-duration must be positive.")

    settings = {
        "model": model,
        "voice": voice,
        "language": language,
        "instruction": instruction,
        "speech_rate": speech_rate,
        "sentences": sentences,
    }
    fingerprint = hashlib.sha256(
        json.dumps(settings, ensure_ascii=False, sort_keys=True).encode("utf-8")
    ).hexdigest()

    if args.dry_run:
        print(
            f"Configuration valid: model={model}, voice={voice}, "
            f"sentences={len(sentences)}, target={args.target_duration:.3f}s"
        )
        return 0

    args.output_dir.mkdir(parents=True, exist_ok=True)
    segments_dir = args.output_dir / "voiceover-segments"
    segments_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = segments_dir / "manifest.json"
    previous_fingerprint = None
    if manifest_path.exists():
        try:
            previous_fingerprint = json.loads(
                manifest_path.read_text(encoding="utf-8")
            ).get("fingerprint")
        except (json.JSONDecodeError, OSError):
            previous_fingerprint = None

    dashscope.api_key = api_key
    dashscope.base_websocket_api_url = websocket_url

    segment_paths: list[Path] = []
    for index, sentence in enumerate(sentences, start=1):
        segment_path = segments_dir / f"{index:02d}.mp3"
        reusable = previous_fingerprint == fingerprint and segment_path.exists()
        if reusable:
            try:
                reusable = duration(segment_path) > 0.2
            except Exception:
                reusable = False
        if reusable:
            print(f"[{index:02d}/{len(sentences):02d}] cached")
        else:
            print(f"[{index:02d}/{len(sentences):02d}] synthesizing", flush=True)
            synthesize_sentence(
                sentence=sentence,
                output=segment_path,
                model=model,
                voice=voice,
                language=language,
                instruction=instruction,
                speech_rate=speech_rate,
            )
        segment_paths.append(segment_path)

    manifest_path.write_text(
        json.dumps(
            {"fingerprint": fingerprint, "settings": settings},
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    concat_path = segments_dir / "concat.txt"
    concat_path.write_text(
        "".join(f"file '{path.name}'\n" for path in segment_paths),
        encoding="utf-8",
    )
    joined_path = args.output_dir / "voiceover-qwen-segmented.wav"
    run(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(concat_path),
            "-ac",
            "1",
            "-ar",
            "48000",
            "-c:a",
            "pcm_s16le",
            str(joined_path),
        ]
    )

    segment_durations = [duration(path) for path in segment_paths]
    joined_duration = duration(joined_path)
    tempo = joined_duration / args.target_duration
    if not 0.5 <= tempo <= 2.0:
        raise ValueError(f"Required atempo value is outside the supported range: {tempo}")

    mastered_path = args.output_dir / "voiceover-qwen-mastered.m4a"
    run(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-i",
            str(joined_path),
            "-af",
            f"atempo={tempo:.10f},loudnorm=I=-16:LRA=7:TP=-1.5,apad=pad_dur={args.target_duration}",
            "-t",
            f"{args.target_duration:.3f}",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-ar",
            "48000",
            str(mastered_path),
        ]
    )

    total_segment_duration = sum(segment_durations)
    timeline_scale = args.target_duration / total_segment_duration
    cursor = 0.0
    srt_parts: list[str] = []
    timeline_segments: list[dict[str, object]] = []
    for index, (sentence, raw_duration) in enumerate(
        zip(sentences, segment_durations), start=1
    ):
        start = cursor * timeline_scale
        cursor += raw_duration
        end = cursor * timeline_scale
        srt_parts.append(
            f"{index}\n{timestamp(start)} --> {timestamp(end)}\n"
            f"{wrap_caption(sentence)}\n"
        )
        timeline_segments.append(
            {
                "index": index,
                "sentence": sentence,
                "start": round(start, 3),
                "end": round(end, 3),
            }
        )

    subtitles_path = args.output_dir / "subtitles-qwen.srt"
    subtitles_path.write_text("\n".join(srt_parts), encoding="utf-8")

    scene_ranges: list[dict[str, object]] = []
    first_sentence = 0
    for scene_index, count in enumerate(SCENE_SENTENCE_COUNTS, start=1):
        selected = timeline_segments[first_sentence : first_sentence + count]
        scene_ranges.append(
            {
                "scene": scene_index,
                "start": selected[0]["start"],
                "end": selected[-1]["end"],
                "duration": round(
                    float(selected[-1]["end"]) - float(selected[0]["start"]), 3
                ),
            }
        )
        first_sentence += count

    timeline_path = args.output_dir / "timeline-qwen.json"
    timeline_path.write_text(
        json.dumps(
            {
                "target_duration": args.target_duration,
                "source_duration": round(joined_duration, 3),
                "tempo": round(tempo, 8),
                "segments": timeline_segments,
                "scenes": scene_ranges,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    print(
        f"Created {mastered_path} and {subtitles_path} "
        f"({len(sentences)} aligned cues; tempo {tempo:.5f}x)"
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"Segmented voice-over generation failed: {exc}", file=sys.stderr)
        raise SystemExit(1)
