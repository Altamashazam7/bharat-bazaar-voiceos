import shutil
import subprocess
from pathlib import Path


class AudioConversionError(RuntimeError):
    """Raised when an uploaded audio recording cannot be decoded."""


class AudioConverterUnavailableError(AudioConversionError):
    """Raised when WebM input requires FFmpeg but it is not installed."""


def normalize_audio_for_stt(audio_path: Path) -> Path:
    """Convert browser-recorded WebM/Opus to mono 16 kHz PCM WAV for STT."""
    if audio_path.suffix.casefold() != ".webm":
        return audio_path

    ffmpeg = shutil.which("ffmpeg")
    if ffmpeg is None:
        raise AudioConverterUnavailableError(
            "FFmpeg is required to process browser-recorded WebM audio."
        )

    output_path = audio_path.with_suffix(".wav")
    command = [
        ffmpeg,
        "-nostdin",
        "-y",
        "-i",
        str(audio_path),
        "-vn",
        "-ac",
        "1",
        "-ar",
        "16000",
        "-c:a",
        "pcm_s16le",
        str(output_path),
    ]
    try:
        subprocess.run(
            command,
            check=True,
            capture_output=True,
            text=True,
            timeout=120,
        )
    except FileNotFoundError as error:
        raise AudioConverterUnavailableError(
            "FFmpeg is required to process browser-recorded WebM audio."
        ) from error
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as error:
        output_path.unlink(missing_ok=True)
        raise AudioConversionError(
            "FFmpeg could not decode the uploaded WebM recording."
        ) from error

    if not output_path.is_file() or output_path.stat().st_size == 0:
        output_path.unlink(missing_ok=True)
        raise AudioConversionError(
            "FFmpeg did not produce a usable WAV recording."
        )

    return output_path
