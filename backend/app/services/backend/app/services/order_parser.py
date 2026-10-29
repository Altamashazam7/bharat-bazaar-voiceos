from parser import find_product
from quantity_parser import extract_quantity


def parse_order(text: str):
    product = find_product(text)
    quantity = extract_quantity(text)

    return {
        "product": product["product"],
        "quantity": quantity,
        "confidence": product["confidence"]
    }


if __name__ == "__main__":
    print(parse_order("do packet amul butter"))
