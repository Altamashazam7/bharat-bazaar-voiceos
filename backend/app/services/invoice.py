from pathlib import Path


def generate_invoice(cart):
    lines = []

    lines.append("BHARAT BAZAAR")
    lines.append("=" * 30)

    total_items = 0

    for product, qty in cart.items():
        total_items += qty

        lines.append(
            f"{product}: {qty}"
        )

    lines.append("=" * 30)
    lines.append(
        f"Total Items: {total_items}"
    )

    output = "\n".join(lines)

    Path("invoices").mkdir(
        exist_ok=True
    )

    with open(
        "invoices/invoice.txt",
        "w"
    ) as f:
        f.write(output)

    return {
        "text": output,
        "total_items": total_items
    }