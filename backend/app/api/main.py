from pathlib import Path
import shutil
import logging
from typing import Any
from uuid import uuid4

from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from backend.app.services.audio import (
    AudioConversionError,
    AudioConverterUnavailableError,
    normalize_audio_for_stt,
)
from backend.app.services.analytics import build_analytics
from backend.app.services.evaluation import evaluate_dataset
from backend.app.services.inventory import (
    add_product,
    delete_product,
    list_products,
    update_product,
)
from backend.app.services.orders import get_order, list_orders
from backend.app.services.order_workflow import process_audio
from backend.app.services.pdf_invoice import generate_invoice_pdf

logger = logging.getLogger(__name__)
LOW_STOCK_THRESHOLD = 5
UPLOAD_DIRECTORY = Path("uploads")


class ProductInput(BaseModel):
    """Validated inventory create/update payload."""

    id: str | None = None
    name: str = Field(min_length=1, max_length=120)
    category: str = Field(min_length=1, max_length=80)
    aliases: list[str] = Field(default_factory=list)
    unit: str = Field(min_length=1, max_length=30)
    price_paise: int = Field(ge=0)
    stock: int = Field(ge=0)

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
    audio: UploadFile = File(...)
):
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
        return process_audio(str(normalized_path))
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


@app.get("/inventory")
def inventory_dashboard() -> dict[str, Any]:
    """Return products and stock health metrics for the inventory page."""
    products = list_products()
    return {
        "products": products,
        "total_products": len(products),
        "low_stock_items": sum(
            0 < product["stock"] <= LOW_STOCK_THRESHOLD
            for product in products
        ),
        "out_of_stock_items": sum(
            product["stock"] == 0 for product in products
        ),
        "low_stock_threshold": LOW_STOCK_THRESHOLD,
    }


@app.post("/inventory", status_code=201)
def create_inventory_product(product: ProductInput) -> dict[str, Any]:
    """Add a product to retailer inventory."""
    try:
        return add_product(product.model_dump(exclude_none=True))
    except ValueError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error


@app.put("/inventory/{product_id}")
def edit_inventory_product(
    product_id: str,
    product: ProductInput,
) -> dict[str, Any]:
    """Replace editable product fields while preserving its inventory ID."""
    changes = product.model_dump(exclude={"id"})
    try:
        return update_product(product_id, changes)
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@app.delete("/inventory/{product_id}", status_code=204)
def remove_inventory_product(product_id: str) -> None:
    """Remove a product from the retailer's active inventory."""
    try:
        delete_product(product_id)
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@app.get("/orders")
def order_history(
    search: str = Query(default="", max_length=120),
    status: str | None = Query(default=None, max_length=30),
    limit: int = Query(default=100, ge=1, le=500),
) -> dict[str, Any]:
    """Search and return recent persisted customer orders."""
    orders = list_orders(search=search, status=status, limit=limit)
    total = len(list_orders(search=search, status=status, limit=10000))
    return {"orders": orders, "total": total}


@app.get("/orders/{order_id}")
def order_detail(order_id: str) -> dict[str, Any]:
    """Return the complete transcript, cart, invoice, and confirmation snapshot."""
    try:
        return get_order(order_id)
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@app.get("/orders/{order_id}/invoice.pdf")
def download_invoice(order_id: str) -> FileResponse:
    """Generate and return a retained, printable invoice for an order."""
    try:
        order = get_order(order_id)
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error

    try:
        pdf_path = generate_invoice_pdf(order)
    except (OSError, KeyError, ValueError) as error:
        logger.exception("Could not generate invoice PDF for %s", order_id)
        raise HTTPException(
            status_code=500,
            detail="Invoice PDF could not be generated.",
        ) from error
    return FileResponse(
        pdf_path,
        media_type="application/pdf",
        filename=f"{order_id}-invoice.pdf",
    )


@app.get("/analytics")
def retailer_analytics() -> dict[str, Any]:
    """Return order, sales, revenue, and product/category metrics."""
    return build_analytics()