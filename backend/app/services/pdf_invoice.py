import re
from datetime import datetime
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[3]
INVOICE_DIRECTORY = PROJECT_ROOT / "invoices"
STORE_NAME = "Bharat Bazaar"


def _pdf_text(value: str) -> str:
    """Escape text for a PDF literal string and replace unsupported glyphs."""
    normalized = value.replace("₹", "Rs. ")
    normalized = re.sub(r"[\x00-\x1f\x7f]", " ", normalized)
    normalized = normalized.encode("cp1252", errors="replace").decode("cp1252")
    return normalized.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def _build_pdf(lines: list[str]) -> bytes:
    """Create a small, dependency-free, printable one-page PDF."""
    content = ["BT", "/F1 11 Tf", "50 790 Td", "15 TL"]
    for index, line in enumerate(lines):
        if index:
            content.append("T*")
        font_size = 16 if index == 0 else 10
        content.extend(
            [
                f"/F1 {font_size} Tf",
                f"({_pdf_text(line)}) Tj",
                "/F1 10 Tf",
            ]
        )
    content.append("ET")
    stream = "\n".join(content).encode("cp1252")

    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] "
        b"/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica "
        b"/Encoding /WinAnsiEncoding >>",
        b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n"
        + stream
        + b"\nendstream",
    ]

    document = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets = [0]
    for number, body in enumerate(objects, start=1):
        offsets.append(len(document))
        document.extend(f"{number} 0 obj\n".encode())
        document.extend(body)
        document.extend(b"\nendobj\n")

    xref_offset = len(document)
    document.extend(f"xref\n0 {len(offsets)}\n".encode())
    document.extend(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        document.extend(f"{offset:010d} 00000 n \n".encode())
    document.extend(
        (
            f"trailer\n<< /Size {len(offsets)} /Root 1 0 R >>\n"
            f"startxref\n{xref_offset}\n%%EOF\n"
        ).encode()
    )
    return bytes(document)


def generate_invoice_pdf(order: dict[str, Any]) -> Path:
    """Generate and retain a printable PDF for a saved order."""
    invoice = order["invoice"]
    timestamp = datetime.fromisoformat(order["timestamp"]).strftime(
        "%d %b %Y, %I:%M %p"
    )
    lines = [
        STORE_NAME,
        f"Order: {order['order_id']}",
        f"Date: {timestamp}",
        "",
        "Product                 Qty       Unit       Amount",
        "-" * 55,
    ]
    for item in invoice["items"]:
        product = re.sub(r"\s+", " ", item["product"])
        lines.append(
            f"{product[:24]:24} {item['quantity']:>3} "
            f"{item['unit'][:8]:>9} "
            f"Rs. {item['line_total_paise'] / 100:,.2f}"
        )
    lines.extend(
        [
            "-" * 55,
            f"Subtotal: Rs. {invoice['subtotal_paise'] / 100:,.2f}",
            f"GST included: Rs. {invoice['tax_paise'] / 100:,.2f}",
            f"Grand Total: Rs. {invoice['grand_total_paise'] / 100:,.2f}",
            f"Total items: {invoice['total_items']}",
            "",
            order.get("confirmation_text", ""),
        ]
    )
    output_path = INVOICE_DIRECTORY / f"{order['order_id']}.pdf"
    INVOICE_DIRECTORY.mkdir(parents=True, exist_ok=True)
    output_path.write_bytes(_build_pdf(lines))
    return output_path
