"""Server-side Qwen text-to-speech for generated learning material."""

from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import urlparse

import httpx

from app.config import settings
from app.models.coach import CoachSpeechStyle


QWEN_TTS_GENERATION_PATH = "/services/aigc/multimodal-generation/generation"
MAX_AUDIO_BYTES = 10 * 1024 * 1024
ALLOWED_AUDIO_HOST_SUFFIXES = (".aliyuncs.com", ".aliyuncs.com.cn")


class TTSNotConfiguredError(RuntimeError):
    pass


class TTSProviderError(RuntimeError):
    pass


@dataclass(frozen=True)
class SpeechAudio:
    content: bytes
    media_type: str


def _generation_url() -> str:
    base_url = settings.qwen_tts_base_url.strip().rstrip("/")
    if not base_url.startswith("https://"):
        raise TTSNotConfiguredError("The Qwen speech base URL must use HTTPS.")
    return f"{base_url}{QWEN_TTS_GENERATION_PATH}"


def _validated_audio_url(value: object) -> str:
    if not isinstance(value, str) or not value.strip():
        raise TTSProviderError("Qwen speech returned no audio URL.")
    url = value.strip()
    parsed = urlparse(url)
    hostname = (parsed.hostname or "").lower()
    try:
        port = parsed.port
    except ValueError as exc:
        raise TTSProviderError("Qwen speech returned an untrusted audio URL.") from exc
    if (
        parsed.scheme not in {"http", "https"}
        or not any(hostname.endswith(suffix) for suffix in ALLOWED_AUDIO_HOST_SUFFIXES)
        or parsed.username is not None
        or parsed.password is not None
        or port is not None
    ):
        raise TTSProviderError("Qwen speech returned an untrusted audio URL.")
    # DashScope currently returns signed OSS links with an http scheme even
    # though the same signed resource is available over HTTPS. Never download
    # generated audio over cleartext; canonicalize only already-allowlisted
    # Alibaba Cloud hosts and preserve the signed path and query string.
    return parsed._replace(scheme="https", netloc=hostname).geturl()


def generate_speech(
    text: str,
    style: CoachSpeechStyle = "natural",
) -> SpeechAudio:
    """Generate speech through Qwen3-TTS-Flash without exposing credentials."""

    api_key = settings.qwen_tts_effective_api_key.strip()
    if not api_key:
        raise TTSNotConfiguredError("Qwen speech is not configured.")

    model = settings.qwen_tts_model.strip()
    voice = settings.qwen_tts_voice.strip()
    language = settings.qwen_tts_language.strip()
    if not model or not voice:
        raise TTSNotConfiguredError("The Qwen speech model and voice are required.")

    # qwen3-tts-flash does not support instruction control. Keep the bounded
    # style field in the public API so the browser contract remains stable.
    _ = style
    request = {
        "model": model,
        "input": {
            "text": text,
            "voice": voice,
            "language_type": language or "English",
        },
    }

    try:
        with httpx.Client(timeout=60.0) as client:
            response = client.post(
                _generation_url(),
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json=request,
            )
            response.raise_for_status()
            payload = response.json()
            provider_status = payload.get("status_code")
            if provider_status not in (None, 200):
                code = payload.get("code") or "provider_error"
                raise TTSProviderError(f"Qwen speech request failed: {code}.")

            audio_url = _validated_audio_url(
                ((payload.get("output") or {}).get("audio") or {}).get("url")
            )
            with client.stream("GET", audio_url) as audio_response:
                audio_response.raise_for_status()
                content_length = audio_response.headers.get("content-length")
                if content_length:
                    try:
                        if int(content_length) > MAX_AUDIO_BYTES:
                            raise TTSProviderError(
                                "Qwen speech audio exceeded the size limit."
                            )
                    except ValueError:
                        pass

                content_buffer = bytearray()
                for chunk in audio_response.iter_bytes():
                    if len(content_buffer) + len(chunk) > MAX_AUDIO_BYTES:
                        raise TTSProviderError(
                            "Qwen speech audio exceeded the size limit."
                        )
                    content_buffer.extend(chunk)
                content = bytes(content_buffer)
                media_type = (
                    audio_response.headers.get("content-type", "")
                    .split(";")[0]
                    .strip()
                )
            if not content:
                raise TTSProviderError("Qwen speech returned an empty audio file.")

            if not media_type.startswith("audio/"):
                media_type = "audio/wav"
            return SpeechAudio(content=content, media_type=media_type)
    except TTSProviderError:
        raise
    except (httpx.HTTPError, ValueError, TypeError) as exc:
        raise TTSProviderError(
            f"Qwen speech request failed: {type(exc).__name__}"
        ) from exc
