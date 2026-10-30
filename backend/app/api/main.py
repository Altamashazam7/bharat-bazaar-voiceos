from pathlib import Path
import shutil

from fastapi import FastAPI, UploadFile, File

from backend.app.services.order_workflow import process_audio

app = FastAPI(
    title="Bharat Bazaar VoiceOS"
)


@app.get("/")
def health():
    return {
        "status": "ok"
    }


@app.get("/demo-cart")
def demo_cart():
    return {
        "cart": {
            "Amul Butter": 4,
            "Parle G": 2
        }
    }


@app.get("/demo-invoice")
def demo_invoice():
    return {
        "invoice": {
            "Amul Butter": 4,
            "Parle G": 2,
            "total_items": 6
        }
    }


@app.post("/transcribe-order")
async def transcribe_order(
    audio: UploadFile = File(...)
):
    upload_dir = Path("uploads")
    upload_dir.mkdir(exist_ok=True)

    file_path = upload_dir / audio.filename

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(
            audio.file,
            buffer
        )

    result = process_audio(
        str(file_path)
    )

    return result