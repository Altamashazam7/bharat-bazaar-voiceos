import os

from dotenv import load_dotenv
from gnani.stt import GnaniSTTClient

load_dotenv("backend/.env")

client = GnaniSTTClient(
    api_key=os.getenv("GNANI_API_KEY")
)

result = client.transcribe(
    "samples/order1.m4a",
    language_code="en-IN"
)

print(result)
