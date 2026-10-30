import json
from rapidfuzz import process


def load_catalog():
    with open("catalog/products.json", "r") as f:
        return json.load(f)


def find_product(text: str):
    catalog = load_catalog()

    choices = []

    for product in catalog:
        for alias in product["aliases"]:
            choices.append((alias, product))

    result = process.extractOne(
        text.lower(),
        [c[0] for c in choices]
    )

    if not result:
        return None

    match, score, index = result

    if score < 80:
        return None

    return {
        "product": choices[index][1]["name"],
        "confidence": score
    }
