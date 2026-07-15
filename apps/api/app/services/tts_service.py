"""Server-side OpenAI text-to-speech for generated learning material."""

from __future__ import annotations

from openai import OpenAI, OpenAIError

from app.config import settings
from app.models.coach import CoachSpeechStyle


ALLOWED_TTS_VOICES = {
    "alloy",
    "ash",
    "ballad",
    "coral",
    "echo",
    "fable",
    "onyx",
    "nova",
    "sage",
    "shimmer",
    "verse",
    "marin",
    "cedar",
}

# The current Speech API exposes more voices for newer TTS models, while the
# tts-1 family accepts only this smaller subset. Validate the combination
# locally so an individually valid model and voice cannot fail later with a
# provider-side 400 response.
TTS_1_VOICES = {
    "alloy",
    "ash",
    "coral",
    "echo",
    "fable",
    "nova",
    "onyx",
    "sage",
    "shimmer",
}


class TTSNotConfiguredError(RuntimeError):
    pass


class TTSProviderError(RuntimeError):
    pass


def _speed_for_style(style: CoachSpeechStyle) -> float:
    return {"gentle": 0.9, "natural": 1.0, "challenge": 1.06}[style]


def generate_speech(text: str, style: CoachSpeechStyle = "natural") -> bytes:
    """Generate an MP3 without exposing the OpenAI credential to the client."""

    if not settings.openai_api_key:
        raise TTSNotConfiguredError("OpenAI speech is not configured.")

    voice = settings.openai_tts_voice.strip().lower()
    if voice not in ALLOWED_TTS_VOICES:
        raise TTSNotConfiguredError("The configured OpenAI speech voice is not supported.")

    model = settings.openai_tts_model.strip()
    if not model:
        raise TTSNotConfiguredError("The OpenAI speech model is not configured.")
    if model in {"tts-1", "tts-1-hd"} and voice not in TTS_1_VOICES:
        raise TTSNotConfiguredError(
            f"The configured OpenAI speech voice is not supported by {model}."
        )

    request: dict = {
        "model": model,
        "voice": voice,
        "input": text,
        "response_format": "mp3",
        "speed": _speed_for_style(style),
    }
    # The supported tts-1 family does not accept instructions. Keep this
    # branch for deployments that intentionally opt into an instruction-aware
    # speech model later.
    if model.startswith("gpt-4o-mini-tts"):
        request["instructions"] = (
            "Speak as a warm, natural English learning partner. Use clear phrasing, "
            "human pauses, and an encouraging tone without exaggeration."
        )

    try:
        client = OpenAI(
            api_key=settings.openai_api_key,
            base_url=settings.openai_tts_base_url,
            timeout=60.0,
        )
        response = client.audio.speech.create(**request)
        content = getattr(response, "content", None)
        if isinstance(content, bytes):
            return content
        read = getattr(response, "read", None)
        if callable(read):
            data = read()
            if isinstance(data, bytes):
                return data
        raise TTSProviderError("OpenAI speech returned no audio bytes.")
    except TTSProviderError:
        raise
    except OpenAIError as exc:
        raise TTSProviderError(f"OpenAI speech request failed: {type(exc).__name__}") from exc
    except Exception as exc:
        raise TTSProviderError(f"OpenAI speech response failed: {type(exc).__name__}") from exc
