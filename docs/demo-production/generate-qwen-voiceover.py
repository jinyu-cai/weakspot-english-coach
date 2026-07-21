#!/usr/bin/env python3
"""Generate the WeakSpot demo narration with Qwen-Audio-TTS."""

from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path

import dashscope
from dashscope.audio.tts_v2 import AudioFormat, SpeechSynthesizer


PRODUCTION_DIR = Path(__file__).resolve().parent
DEFAULT_INPUT = PRODUCTION_DIR / "voiceover-en.txt"
DEFAULT_OUTPUT = PRODUCTION_DIR / "output" / "voiceover-qwen.mp3"
DEFAULT_ENV = PRODUCTION_DIR / ".env"
ENV_KEY_PATTERN = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


def load_env_file(path: Path) -> None:
    """Load a small dotenv file without echoing any values."""
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


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Generate an MP3 voice-over using qwen-audio-3.0-tts-plus."
    )
    parser.add_argument("--env", type=Path, default=DEFAULT_ENV)
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument(
        "--text",
        help="Synthesize this text instead of reading --input (useful for auditions).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate configuration without sending a request.",
    )
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

    if not 0.5 <= speech_rate <= 2.0:
        raise ValueError("QWEN_TTS_SPEECH_RATE must be between 0.5 and 2.0.")
    if instruction and len(instruction) > 100:
        raise ValueError("QWEN_TTS_INSTRUCTION must be no longer than 100 characters.")

    text = args.text if args.text is not None else args.input.read_text(encoding="utf-8")
    text = text.strip()
    if not text:
        raise ValueError("Narration text is empty.")
    if len(text) > 20_000:
        raise ValueError("Narration exceeds the 20,000-character non-streaming limit.")

    if args.dry_run:
        print(
            f"Configuration valid: model={model}, voice={voice}, "
            f"language={language}, characters={len(text)}"
        )
        return 0

    dashscope.api_key = api_key
    dashscope.base_websocket_api_url = websocket_url

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
    audio = synthesizer.call(text, timeout_millis=300_000)
    if not audio:
        raise RuntimeError("Qwen returned no audio data.")

    args.output.parent.mkdir(parents=True, exist_ok=True)
    temporary_output = args.output.with_suffix(args.output.suffix + ".tmp")
    temporary_output.write_bytes(audio)
    temporary_output.replace(args.output)

    request_id = synthesizer.get_last_request_id()
    print(f"Created {args.output} ({len(audio):,} bytes; request {request_id})")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"Voice-over generation failed: {exc}", file=sys.stderr)
        raise SystemExit(1)
