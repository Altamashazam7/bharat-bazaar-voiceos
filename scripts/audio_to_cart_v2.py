import os
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from dotenv import load_dotenv
from gnani.stt import GnaniSTTClient

from backend.app.services.session import OrderSession
from backend.app.services.transcript_splitter import split_commands

load_dotenv("backend/.env")

client = GnaniSTTClient(
    api_key=os.getenv("GNANI_API_KEY")
)

result = client.transcribe(
    "samples/order1.m4a",
    language_code="en-IN"
)

transcript = result["transcript"]

print("\nTRANSCRIPT")
print(transcript)

session = OrderSession()

commands = split_commands(transcript)

print("\nCOMMANDS")
print(commands)

for command in commands:
    cart = session.handle(command)

print("\nFINAL CART")
print(cart)
