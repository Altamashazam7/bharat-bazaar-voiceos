import os
from typing import Any

from dotenv import load_dotenv

from backend.app.services.session import OrderSession
from backend.app.services.transcript_splitter import split_commands
from backend.app.services.invoice import generate_invoice
from backend.app.services.confirmation import build_confirmation
load_dotenv("backend/.env")


def process_audio(audio_path: str, include_audio: bool = True) -> dict[str, Any]:
    """Transcribe an order, create its cart and invoice, and optionally synthesize speech."""
    from gnani.stt import GnaniSTTClient

    client = GnaniSTTClient(
        api_key=os.getenv(
            "GNANI_API_KEY"
        )
    )

    result = client.transcribe(
        audio_path,
        language_code="en-IN"
    )

    transcript = result["transcript"]

    session = OrderSession()

    commands = split_commands(
        transcript
    )

    for command in commands:
        cart = session.handle(command)

    invoice = generate_invoice(
        cart
    )

    confirmation_text = (
        build_confirmation(cart)
    )

    audio_file = None
    if include_audio:
        from backend.app.services.tts_service import generate_speech

        audio_file = generate_speech(confirmation_text)

    return {
        "transcript": transcript,
        "commands": commands,
        "cart": cart,
        "invoice": invoice,
        "confirmation_text": confirmation_text,
        "confirmation_audio": audio_file
    }