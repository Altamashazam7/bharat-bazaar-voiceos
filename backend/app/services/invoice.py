from pathlib import Path
from typing import Any

from backend.app.services.inventory import list_products


TAX_RATE_BPS = 500
PROJECT_ROOT = Path(__file__).resolve().parents[3]
INVOICE_DIRECTORY = PROJECT_ROOT / "invoices"


def _format_rupees(amount_paise: int) -> str:
    """Format paise as a two-decimal INR amount."""
    rupees, paise = divmod(amount_paise, 100)
    return f"₹{rupees:,}.{paise:02d}"


def generate_invoice(
    cart: dict[str, int],
    *,
    product_catalog: list[dict[str, Any]] | None = None,
    tax_rate_bps: int = TAX_RATE_BPS,
    store_name: str = "Bharat Bazaar",
    write_to_disk: bool = True,
) -> dict[str, Any]:
    """Create a price-aware invoice while retaining the legacy text and item count."""
    products_by_name = {
        product["name"].casefold(): product
        for product in (
            list_products() if product_catalog is None else product_catalog
        )
    }

    items = []
    subtotal_paise = 0
    total_items = 0
    for name, quantity in cart.items():
        product = products_by_name.get(name.casefold(), {})
        unit_price_paise = int(product.get("price_paise", 0))
        line_total_paise = unit_price_paise * quantity
        subtotal_paise += line_total_paise
        total_items += quantity
        items.append(
            {
                "product": name,
                "quantity": quantity,
                "unit": product.get("unit", "unit"),
                "category": product.get("category", "Other"),
                "unit_price_paise": unit_price_paise,
                "line_total_paise": line_total_paise,
            }
        )

    tax_divisor = 10000 + tax_rate_bps
    tax_paise = (
        (subtotal_paise * tax_rate_bps + tax_divisor // 2) // tax_divisor
        if tax_rate_bps
        else 0
    )
    grand_total_paise = subtotal_paise
    lines = [
        store_name.upper(),
        "=" * 38,
    ]
    for item in items:
        lines.append(
            f"{item['product']} × {item['quantity']} = "
            f"{_format_rupees(item['line_total_paise'])}"
        )
    lines.extend(
        [
            "=" * 38,
            f"Subtotal: {_format_rupees(subtotal_paise)}",
            f"GST included ({tax_rate_bps / 100:g}%): {_format_rupees(tax_paise)}",
            f"Grand Total: {_format_rupees(grand_total_paise)}",
            f"Total Items: {total_items}",
        ]
    )
    invoice = {
        "text": "\n".join(lines),
        "items": items,
        "subtotal_paise": subtotal_paise,
        "tax_rate_bps": tax_rate_bps,
        "tax_paise": tax_paise,
        "tax_included": True,
        "grand_total_paise": grand_total_paise,
        "subtotal": _format_rupees(subtotal_paise),
        "tax": _format_rupees(tax_paise),
        "grand_total": _format_rupees(grand_total_paise),
        "total_items": total_items,
        "currency": "INR",
    }

    if write_to_disk:
        INVOICE_DIRECTORY.mkdir(parents=True, exist_ok=True)
        (INVOICE_DIRECTORY / "invoice.txt").write_text(
            invoice["text"],
            encoding="utf-8",
        )
    return invoice
