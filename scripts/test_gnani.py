import os

from dotenv import load_dotenv

load_dotenv("backend/.env")

api_key = os.getenv("GNANI_API_KEY")

print("API Key Loaded:", bool(api_key))
