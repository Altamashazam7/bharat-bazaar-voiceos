import re


def split_commands(text: str):
    text = text.lower()

    text = text.replace("actually", "|actually")
    text = text.replace("five", "|five")
    text = text.replace("two", "|two")
    text = text.replace("three", "|three")
    text = text.replace("four", "|four")

    commands = [
        part.strip()
        for part in text.split("|")
        if part.strip()
    ]

    return commands


if __name__ == "__main__":
    sample = (
        "five packet amul butter "
        "two packet parle ji "
        "actually four packet amul butter"
    )

    print(split_commands(sample))
