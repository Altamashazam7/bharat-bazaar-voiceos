import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from backend.app.services.tts_service import (
    generate_speech
)

audio_file = generate_speech(
    "Your order has been confirmed. Four units of Amul Butter. Two units of Parle G. Total items six."
)

print(audio_file)