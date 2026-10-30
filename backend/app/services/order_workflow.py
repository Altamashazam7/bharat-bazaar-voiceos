import os

from dotenv import load_dotenv
from gnani.stt import GnaniSTTClient

from backend.app.services.session import OrderSession
from backend.app.services.transcript_splitter import split_commands
from backend.app.services.invoice import generate_invoice

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

    commands = split_commands(transcript)

    for command in commands:
        cart = session.handle(command)

    invoice = generate_invoice(cart)

    return {
        "transcript": transcript,
        "commands": commands,
        "cart": cart,
        "invoice": invoice
    }