from pathlib import Path
import shutil

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.app.services.order_workflow import process_audio
from backend.app.services.evaluation import evaluate_dataset

app = FastAPI(
    title="Bharat Bazaar VoiceOS"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve generated audio files
app.mount(
    "/audio",
    StaticFiles(directory="tts_output"),
    name="audio",
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

    return process_audio(
        str(file_path)
    )


@app.post("/demo")
def run_demo():
    """Process a bundled sample order without requiring an upload."""
    project_root = Path(__file__).resolve().parents[3]
    sample_path = project_root / "samples" / "eval" / "order1.m4a"
    if not sample_path.is_file():
        raise HTTPException(
            status_code=404,
            detail="The bundled demo audio is unavailable.",
        )

    return process_audio(str(sample_path))


@app.post("/evaluate")
def run_evaluation():
    """Run the bundled audio benchmark and return per-sample cart results."""
    return evaluate_dataset()