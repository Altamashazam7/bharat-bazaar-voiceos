import os
import sys
from pathlib import Path

# Add project root to Python path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from dotenv import load_dotenv
from gnani.stt import GnaniSTTClient

from backend.app.services.session import OrderSession
from backend.app.services.transcript_splitter import split_commands
from backend.app.services.invoice import generate_invoice

# Load environment variables
load_dotenv("backend/.env")

# Create STT client
client = GnaniSTTClient(
    api_key=os.getenv("GNANI_API_KEY")
)

# Transcribe audio
result = client.transcribe(
    "samples/order1.m4a",
    language_code="en-IN"
)

transcript = result["transcript"]

print("\nTRANSCRIPT")
print(transcript)

# Parse transcript into commands
commands = split_commands(transcript)

print("\nCOMMANDS")
print(commands)

# Create order session
session = OrderSession()

for command in commands:
    cart = session.handle(command)

print("\nFINAL CART")
print(cart)

print("\nINVOICE")
invoice = generate_invoice(cart)
print(invoice)