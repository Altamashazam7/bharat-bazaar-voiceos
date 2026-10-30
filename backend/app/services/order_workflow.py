import os

from dotenv import load_dotenv
from gnani.stt import GnaniSTTClient

from backend.app.services.session import OrderSession
from backend.app.services.transcript_splitter import split_commands
from backend.app.services.invoice import generate_invoice
from backend.app.services.confirmation import build_confirmation

load_dotenv("backend/.env")


def process_audio(audio_path: str):
    client = GnaniSTTClient(
        api_key=os.getenv("GNANI_API_KEY")
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

    return {
        "transcript": transcript,
        "commands": commands,
        "cart": cart,
        "invoice": invoice,
        "confirmation_text": confirmation_text
    }