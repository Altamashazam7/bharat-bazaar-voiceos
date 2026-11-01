import re


NUMBER_WORDS = (
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
    "ten",
    "ek",
    "do",
    "teen",
    "char",
    "chaar",
    "paanch",
    "panch",
    "chhe",
    "chhah",
    "cheh",
    "saat",
    "aath",
    "nau",
    "das",
    "dus",
)

UNITS = (
    "packet",
    "packets",
    "pack",
    "packs",
    "pkt",
    "kilo",
    "kg",
    "kilogram",
    "kilograms",
    "litre",
    "litres",
    "liter",
    "liters",
    "ltr",
    "gram",
    "grams",
    "g",
    "piece",
    "pieces",
    "pcs",
    "bottle",
    "bottles",
    "pouch",
    "pouches",
)


def split_commands(text: str):
    text = text.lower().strip()
    if not text:
        return []

    number_pattern = "|".join(
        re.escape(word)
        for word in sorted(NUMBER_WORDS, key=len, reverse=True)
    )
    unit_pattern = "|".join(
        re.escape(unit)
        for unit in sorted(UNITS, key=len, reverse=True)
    )

    text = re.sub(
        r"\b(actually|correction)\b",
        r"|\1",
        text,
    )
    text = re.sub(
        rf"\b(?:\d+|{number_pattern})\b(?=\s+(?:{unit_pattern})\b)",
        lambda match: f"|{match.group(0)}",
        text,
    )

    return [
        part.strip()
        for part in text.split("|")
        if part.strip()
    ]


if __name__ == "__main__":
    sample = (
        "three packet maggie "
        "two packet good day biscuit "
        "one kilo tata salt"
    )

    print(split_commands(sample))
