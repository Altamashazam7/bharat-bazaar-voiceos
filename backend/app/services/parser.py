import json
import re

from rapidfuzz import fuzz, process

from backend.app.services.quantity_parser import NUMBER_MAP


CONFIDENCE_THRESHOLD = 80
FILLER_WORDS = {
    "actually",
    "no",
    "nahi",
    "correction",
}
UNITS = {
    "bottle",
    "bottles",
    "g",
    "gram",
    "grams",
    "kg",
    "kilo",
    "kilogram",
    "kilograms",
    "liter",
    "liters",
    "litre",
    "litres",
    "ltr",
    "pack",
    "packet",
    "packets",
    "packs",
    "pcs",
    "piece",
    "pieces",
    "pouch",
    "pouches",
    "pkt",
}


def load_catalog():
    with open("catalog/products.json", "r") as f:
        return json.load(f)


def _normalize(text: str):
    words = re.findall(r"[a-z0-9]+", text.lower())
    ignored_words = FILLER_WORDS | UNITS | set(NUMBER_MAP)
    return " ".join(
        word
        for word in words
        if word not in ignored_words and not word.isdigit()
    )


def find_product(text: str):
    normalized_text = _normalize(text)
    if not normalized_text:
        return None

    catalog = load_catalog()
    choices = []
    exact_matches = []

    for product in catalog:
        for alias in product["aliases"]:
            normalized_alias = _normalize(alias)
            if not normalized_alias:
                continue

            choices.append((normalized_alias, product))
            if f" {normalized_alias} " in f" {normalized_text} ":
                exact_matches.append((len(normalized_alias), product))

    if exact_matches:
        _, product = max(exact_matches, key=lambda match: match[0])
        return {
            "product": product["name"],
            "confidence": 100,
        }

    result = process.extractOne(
        normalized_text,
        [choice[0] for choice in choices],
        scorer=fuzz.WRatio,
    )
    if not result:
        return None

    _, score, index = result
    if score < CONFIDENCE_THRESHOLD:
        return None

    return {
        "product": choices[index][1]["name"],
        "confidence": score,
    }
