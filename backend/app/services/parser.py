from rapidfuzz import process
import json


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

    return {
        "product": choices[index][1]["name"],
        "confidence": score
    }


if __name__ == "__main__":
    print(find_product("amul butter"))
