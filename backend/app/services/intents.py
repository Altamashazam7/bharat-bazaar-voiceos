CORRECTION_WORDS = [
    "nahi",
    "actually",
    "galat",
    "change"
]


def is_correction(text):
    text = text.lower()

    return any(
        word in text
        for word in CORRECTION_WORDS
    )
