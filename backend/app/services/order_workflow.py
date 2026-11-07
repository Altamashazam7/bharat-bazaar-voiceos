import logging
import math
import os
from typing import Any, Callable

from dotenv import load_dotenv

from backend.app.services.confirmation import build_confirmation
from backend.app.services.invoice import generate_invoice
from backend.app.services.inventory import deduct_stock
from backend.app.services.orders import save_order
from backend.app.services.order_parser import parse_order
from backend.app.services.session import OrderSession
from backend.app.services.transcript_splitter import split_commands

load_dotenv("backend/.env")
logger = logging.getLogger(__name__)


def process_audio(
    audio_path: str,
    include_audio: bool = True,
    *,
    record_order: bool = True,
    deduct_inventory: bool = True,
    product_catalog: list[dict[str, Any]] | None = None,
    progress_callback: Callable[[str], None] | None = None,
) -> dict[str, Any]:
    """Transcribe an order, create its cart and invoice, and optionally synthesize speech."""
    from gnani.stt import GnaniSTTClient

    if progress_callback:
        progress_callback("transcribing")
    client = GnaniSTTClient(api_key=os.getenv("GNANI_API_KEY"))
    result = client.transcribe(audio_path, language_code="en-IN")
    transcript = result["transcript"]
    transcript_confidence = result.get("confidence")
    if (
        isinstance(transcript_confidence, bool)
        or not isinstance(transcript_confidence, (int, float))
        or not math.isfinite(transcript_confidence)
        or transcript_confidence < 0
    ):
        transcript_confidence = None
    elif 0 <= transcript_confidence <= 1:
        transcript_confidence = round(transcript_confidence * 100)
    else:
        transcript_confidence = min(100, round(transcript_confidence))

    if progress_callback:
        progress_callback("parsing")
    session = (
        OrderSession()
        if product_catalog is None
        else OrderSession(catalog=product_catalog)
    )
    commands = split_commands(transcript)
    cart = session.cart.get_items()
    extracted_products: dict[str, dict[str, Any]] = {}
    corrections: list[dict[str, Any]] = []
    for command in commands:
        parsed = parse_order(command, catalog=product_catalog)
        if parsed:
            product = parsed["product"]
            previous = extracted_products.get(product)
            if previous and previous["quantity"] != parsed["quantity"]:
                corrections.append(
                    {
                        "product": product,
                        "from_quantity": previous["quantity"],
                        "to_quantity": parsed["quantity"],
                        "command": command,
                    }
                )
            extracted_products[product] = {
                "product": product,
                "quantity": parsed["quantity"],
                "confidence": parsed["confidence"],
            }
        cart = session.handle(command)

    if progress_callback:
        progress_callback("invoice_generation")
    if product_catalog is None:
        invoice = generate_invoice(cart, write_to_disk=record_order)
        confirmation_text = build_confirmation(cart, invoice)
    else:
        invoice = generate_invoice(
            cart,
            product_catalog=product_catalog,
            write_to_disk=False,
        )
        confirmation_text = build_confirmation(
            cart,
            invoice,
            product_catalog=product_catalog,
        )
    audio_file = None
    if include_audio:
        if progress_callback:
            progress_callback("audio_generation")
        from backend.app.services.tts_service import generate_speech

        audio_file = generate_speech(confirmation_text)

    extracted = list(extracted_products.values())
    product_match_confidence = (
        round(sum(product["confidence"] for product in extracted) / len(extracted))
        if extracted
        else None
    )
    order: dict[str, Any] = {
        "transcript": transcript,
        "transcript_confidence": transcript_confidence,
        "commands": commands,
        "cart": cart,
        "invoice": invoice,
        "extracted_products": extracted,
        "product_match_confidence": product_match_confidence,
        "corrections": corrections,
        "confirmation_text": confirmation_text,
        "confirmation_audio": audio_file,
    }
    if record_order and product_catalog is None:
        saved_order = save_order(order)
        order["order_id"] = saved_order["order_id"]
        order["timestamp"] = saved_order["timestamp"]
        logger.info("Saved VoiceOS order %s", saved_order["order_id"])
    if deduct_inventory and product_catalog is None:
        deduct_stock(cart)
    return order
