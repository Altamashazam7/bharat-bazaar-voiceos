import re


NUMBER_MAP = {
    "ek": 1,
    "aik": 1,
    "one": 1,
    "do": 2,
    "two": 2,
    "teen": 3,
    "theen": 3,
    "three": 3,
    "char": 4,
    "chaar": 4,
    "four": 4,
    "paanch": 5,
    "panch": 5,
    "five": 5,
    "chhe": 6,
    "chhah": 6,
    "cheh": 6,
    "six": 6,
    "saat": 7,
    "sat": 7,
    "seven": 7,
    "aath": 8,
    "aatth": 8,
    "eight": 8,
    "nau": 9,
    "nine": 9,
    "das": 10,
    "dus": 10,
    "ten": 10,
}


def extract_quantity(text: str):
    for token in re.findall(r"\d+|[a-z]+", text.lower()):
        if token.isdigit():
            return int(token)

        if token in NUMBER_MAP:
            return NUMBER_MAP[token]

    return 1


if __name__ == "__main__":
    print(extract_quantity("do packet butter"))
    print(extract_quantity("5 packet butter"))
