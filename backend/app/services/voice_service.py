import base64
import io
import math
import struct
import wave
from typing import Any, Dict, Optional
import httpx

from app.core.config import get_settings


def _generate_soft_chime_wav_base64() -> str:
    """Generate a tiny valid WAV chime as fallback audio when TTS API keys are absent."""
    sample_rate = 16000
    duration_sec = 0.25
    n_samples = int(sample_rate * duration_sec)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        frames = bytearray()
        for i in range(n_samples):
            env = 1.0 - (i / n_samples)
            val = int(4000 * env * math.sin(2 * math.pi * 587.33 * i / sample_rate))
            frames.extend(struct.pack("<h", val))
        wf.writeframes(bytes(frames))
    return base64.b64encode(buf.getvalue()).decode("ascii")


async def transcribe_audio(
    audio_bytes: bytes,
    filename: str = "recording.webm",
    language: str = "en",
) -> Dict[str, Any]:
    """Transcribe uploaded audio via OpenAI Whisper in Live mode, or Demo fallback."""
    settings = get_settings()
    if settings.is_live_ai_available and len(audio_bytes) > 0:
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    f"{settings.openai_base_url.rstrip('/')}/audio/transcriptions",
                    headers={"Authorization": f"Bearer {settings.openai_api_key}"},
                    data={"model": settings.openai_stt_model, "language": language.split("-")[0]},
                    files={"file": (filename, audio_bytes, "audio/webm")},
                )
                resp.raise_for_status()
                text = resp.json().get("text", "").strip()
                return {
                    "text": text,
                    "mode": "live",
                    "provider": "openai-whisper",
                    "language": language,
                }
        except Exception as exc:
            return {
                "text": "",
                "mode": "demo",
                "provider": "browser-web-speech-fallback",
                "language": language,
                "note": f"Live STT fallback triggered: {exc}",
            }

    return {
        "text": (
            "Hello, I am interested in your AI voice agent pricing and would like to schedule a demo."
            if not language.startswith("hi")
            else "नमस्ते, मैं आपके AI वॉइस एजेंट की कीमत जानना चाहता हूँ और डेमो बुक करना चाहता हूँ।"
        ),
        "mode": "demo",
        "provider": "demo-mock-stt",
        "language": language,
        "note": "Demo Mode active: Browser Web Speech API provides live mic transcription; this endpoint provides sample fallback transcription.",
    }


async def synthesize_speech(
    text: str,
    language: str = "en",
    voice: Optional[str] = None,
) -> Dict[str, Any]:
    """Synthesize speech via OpenAI TTS in Live mode, or instruct browser SpeechSynthesis in Demo mode."""
    settings = get_settings()
    selected_voice = voice or settings.openai_tts_voice

    if settings.is_live_ai_available:
        try:
            async with httpx.AsyncClient(timeout=25.0) as client:
                resp = await client.post(
                    f"{settings.openai_base_url.rstrip('/')}/audio/speech",
                    headers={"Authorization": f"Bearer {settings.openai_api_key}"},
                    json={
                        "model": settings.openai_tts_model,
                        "input": text[:4000],
                        "voice": selected_voice,
                        "response_format": "mp3",
                    },
                )
                resp.raise_for_status()
                b64 = base64.b64encode(resp.content).decode("ascii")
                return {
                    "audio_base64": b64,
                    "mime_type": "audio/mpeg",
                    "mode": "live",
                    "provider": "openai-tts",
                    "language": language,
                    "use_browser_tts": False,
                }
        except Exception:
            pass

    return {
        "audio_base64": _generate_soft_chime_wav_base64(),
        "mime_type": "audio/wav",
        "mode": "demo",
        "provider": "browser-speech-synthesis",
        "language": language,
        "use_browser_tts": True,
        "text": text,
    }
