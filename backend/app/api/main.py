import asyncio
import json
from queue import Queue
from pathlib import Path
import shutil
import logging
from threading import Thread
from typing import Any, Callable
from uuid import uuid4

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
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


def _validate_product_catalog(products: str) -> list[dict[str, Any]]:
    try:
        return [
            product.model_dump()
            for product in VOICE_PRODUCT_LIST.validate_json(products)
        ]
    except ValidationError as error:
        raise HTTPException(
            status_code=422,
            detail="The business product catalog is invalid.",
        ) from error


def _prepare_uploaded_audio(audio: UploadFile) -> tuple[str, Path, Path]:
    UPLOAD_DIRECTORY.mkdir(parents=True, exist_ok=True)
    extension = Path((audio.filename or "").replace("\\", "/")).suffix
    filename = f"{uuid4().hex}{extension}"
    file_path = UPLOAD_DIRECTORY / filename

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(audio.file, buffer)

    try:
        normalized_path = normalize_audio_for_stt(file_path)
    except AudioConverterUnavailableError as error:
        file_path.unlink(missing_ok=True)
        logger.error("Cannot process WebM upload: FFmpeg is unavailable.")
        raise HTTPException(
            status_code=503,
            detail="The server requires FFmpeg to process browser recordings.",
        ) from error
    except AudioConversionError as error:
        file_path.unlink(missing_ok=True)
        logger.warning("Could not decode uploaded recording %s: %s", filename, error)
        raise HTTPException(
            status_code=422,
            detail="Could not read the recorded audio. Please record it again.",
        ) from error

    return filename, file_path, normalized_path


def _stream_order(
    process: Callable[[Callable[[str], None]], dict[str, Any]],
) -> StreamingResponse:
    events: Queue[dict[str, Any] | None] = Queue()

    def report_step(step: str) -> None:
        events.put({"type": "step", "step": step})

    def run() -> None:
        try:
            events.put({"type": "result", "order": process(report_step)})
        except Exception:
            logger.exception("Voice-order processing failed.")
            events.put(
                {
                    "type": "error",
                    "message": "Voice-order processing failed. Check the recording and try again.",
                }
            )
        finally:
            events.put(None)

    Thread(target=run, daemon=True).start()

    async def stream_events():
        while True:
            event = await asyncio.to_thread(events.get)
            if event is None:
                break
            yield f"{json.dumps(event, separators=(',', ':'))}\n"

    return StreamingResponse(
        stream_events(),
        media_type="application/x-ndjson",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


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
    product_catalog = _validate_product_catalog(products)
    _, file_path, normalized_path = _prepare_uploaded_audio(audio)

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


@app.post("/transcribe-order/stream")
async def transcribe_order_stream(
    audio: UploadFile = File(...),
    products: str = Form(...),
):
    product_catalog = _validate_product_catalog(products)
    _, file_path, normalized_path = _prepare_uploaded_audio(audio)

    def process(progress_callback: Callable[[str], None]) -> dict[str, Any]:
        try:
            return process_audio(
                str(normalized_path),
                record_order=False,
                deduct_inventory=False,
                product_catalog=product_catalog,
                progress_callback=progress_callback,
            )
        finally:
            if normalized_path != file_path:
                normalized_path.unlink(missing_ok=True)

    return _stream_order(process)


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


@app.post("/demo/stream")
def run_demo_stream():
    """Run the demo order while emitting each processing stage."""
    project_root = Path(__file__).resolve().parents[3]
    sample_path = project_root / "samples" / "eval" / "order1.m4a"
    if not sample_path.is_file():
        raise HTTPException(
            status_code=404,
            detail="The bundled demo audio is unavailable.",
        )

    return _stream_order(
        lambda progress_callback: process_audio(
            str(sample_path),
            progress_callback=progress_callback,
        )
    )


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