import logging
import os
from typing import Any

from dotenv import load_dotenv

from backend.app.services.confirmation import build_confirmation
from backend.app.services.invoice import generate_invoice
from backend.app.services.inventory import deduct_stock
from backend.app.services.orders import save_order
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
) -> dict[str, Any]:
    """Transcribe an order, create its cart and invoice, and optionally synthesize speech."""
    from gnani.stt import GnaniSTTClient

    client = GnaniSTTClient(api_key=os.getenv("GNANI_API_KEY"))
    result = client.transcribe(audio_path, language_code="en-IN")
    transcript = result["transcript"]

    session = (
        OrderSession()
        if product_catalog is None
        else OrderSession(catalog=product_catalog)
    )
    commands = split_commands(transcript)
    cart = session.cart.get_items()
    for command in commands:
        cart = session.handle(command)

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
        from backend.app.services.tts_service import generate_speech

        audio_file = generate_speech(confirmation_text)

    order: dict[str, Any] = {
        "transcript": transcript,
        "commands": commands,
        "cart": cart,
        "invoice": invoice,
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
