from backend.app.services.parser import find_product
from backend.app.services.quantity_parser import extract_quantity


def parse_order(text: str, catalog=None):
    product = find_product(text, catalog=catalog)

    if not product:
        return None

    quantity = extract_quantity(text)

    return {
        "product": product["product"],
        "quantity": quantity,
        "confidence": product["confidence"],
    }
