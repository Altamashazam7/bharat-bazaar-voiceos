from pathlib import Path
import shutil
import logging
from uuid import uuid4

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, TypeAdapter, ValidationError

from backend.app.services.audio import (
    AudioConversionError,
    AudioConverterUnavailableError,
    normalize_audio_for_stt,
)
from backend.app.services.evaluation import evaluate_dataset
from backend.app.services.order_workflow import process_audio

logger = logging.getLogger(__name__)
UPLOAD_DIRECTORY = Path("uploads")


class VoiceProduct(BaseModel):
    """Business-scoped product data used only while processing one voice order."""

    name: str = Field(min_length=1, max_length=120)
    aliases: list[str] = Field(default_factory=list)
    category: str = Field(min_length=1, max_length=80)
    unit: str = Field(min_length=1, max_length=30)
    price_paise: int = Field(ge=0)


VOICE_PRODUCT_LIST = TypeAdapter(list[VoiceProduct])


app = FastAPI(
    title="Bharat Bazaar VoiceOS"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://bharat-bazaar-voiceos.vercel.app",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
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
    audio: UploadFile = File(...),
    products: str = Form(...),
):
    try:
        product_catalog = [
            product.model_dump()
            for product in VOICE_PRODUCT_LIST.validate_json(products)
        ]
    except ValidationError as error:
        raise HTTPException(
            status_code=422,
            detail="The business product catalog is invalid.",
        ) from error

    UPLOAD_DIRECTORY.mkdir(parents=True, exist_ok=True)

    extension = Path((audio.filename or "").replace("\\", "/")).suffix
    filename = f"{uuid4().hex}{extension}"
    file_path = UPLOAD_DIRECTORY / filename

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(
            audio.file,
            buffer
        )

    try:
        normalized_path = normalize_audio_for_stt(file_path)
    except AudioConverterUnavailableError as error:
        logger.error("Cannot process WebM upload: FFmpeg is unavailable.")
        raise HTTPException(
            status_code=503,
            detail="The server requires FFmpeg to process browser recordings.",
        ) from error
    except AudioConversionError as error:
        logger.warning("Could not decode uploaded recording %s: %s", filename, error)
        raise HTTPException(
            status_code=422,
            detail="Could not read the recorded audio. Please record it again.",
        ) from error

    try:
        return process_audio(
            str(normalized_path),
            record_order=False,
            deduct_inventory=False,
            product_catalog=product_catalog,
        )
    finally:
        if normalized_path != file_path:
            normalized_path.unlink(missing_ok=True)


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


LEGACY_RETAIL_API_DETAIL = (
    "This legacy endpoint is disabled because it does not enforce business ownership. "
    "Use the authenticated retail dashboard."
)


def _reject_unscoped_retail_api() -> None:
    raise HTTPException(status_code=410, detail=LEGACY_RETAIL_API_DETAIL)


@app.api_route("/inventory", methods=["GET", "POST"], include_in_schema=False)
def legacy_inventory_api() -> None:
    _reject_unscoped_retail_api()


@app.api_route(
    "/inventory/{product_id}",
    methods=["PUT", "DELETE"],
    include_in_schema=False,
)
def legacy_inventory_item_api(product_id: str) -> None:
    _reject_unscoped_retail_api()


@app.get("/orders", include_in_schema=False)
def legacy_orders_api() -> None:
    _reject_unscoped_retail_api()


@app.get("/orders/{order_id}", include_in_schema=False)
def legacy_order_api(order_id: str) -> None:
    _reject_unscoped_retail_api()


@app.get("/orders/{order_id}/invoice.pdf", include_in_schema=False)
def legacy_invoice_api(order_id: str) -> None:
    _reject_unscoped_retail_api()


@app.get("/analytics", include_in_schema=False)
def legacy_analytics_api() -> None:
    _reject_unscoped_retail_api()