NUMBER_MAP = {
    "ek": 1,
    "one": 1,

    "do": 2,
    "two": 2,

    "teen": 3,
    "three": 3,

    "char": 4,
    "four": 4,

    "paanch": 5,
    "five": 5,

    "chhe": 6,
    "six": 6,

    "saat": 7,
    "seven": 7,

    "aath": 8,
    "eight": 8,

    "nau": 9,
    "nine": 9,

    "dus": 10,
    "ten": 10
}


def extract_quantity(text: str):
    words = text.lower().split()

    for word in words:
        if word.isdigit():
            return int(word)

        if word in NUMBER_MAP:
            return NUMBER_MAP[word]

    return 1


if __name__ == "__main__":
    print(extract_quantity("do packet butter"))
    print(extract_quantity("5 packet butter"))
