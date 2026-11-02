from typing import Any

from backend.app.services.inventory import find_by_name


_NUMBER_WORDS = (
    "zero",
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
    "eleven",
    "twelve",
    "thirteen",
    "fourteen",
    "fifteen",
    "sixteen",
    "seventeen",
    "eighteen",
    "nineteen",
)
_TENS_WORDS = (
    "",
    "",
    "twenty",
    "thirty",
    "forty",
    "fifty",
    "sixty",
    "seventy",
    "eighty",
    "ninety",
)


def number_to_words(number: int) -> str:
    """Convert a non-negative integer into concise English speech text."""
    if number < 0:
        return f"minus {number_to_words(-number)}"
    if number < len(_NUMBER_WORDS):
        return _NUMBER_WORDS[number]
    if number < 100:
        tens, ones = divmod(number, 10)
        return _TENS_WORDS[tens] + (f"-{_NUMBER_WORDS[ones]}" if ones else "")
    if number < 1000:
        hundreds, remainder = divmod(number, 100)
        suffix = f" and {number_to_words(remainder)}" if remainder else ""
        return f"{_NUMBER_WORDS[hundreds]} hundred{suffix}"
    if number < 100000:
        thousands, remainder = divmod(number, 1000)
        suffix = f" {number_to_words(remainder)}" if remainder else ""
        return f"{number_to_words(thousands)} thousand{suffix}"
    if number < 10000000:
        lakhs, remainder = divmod(number, 100000)
        suffix = f" {number_to_words(remainder)}" if remainder else ""
        return f"{number_to_words(lakhs)} lakh{suffix}"
    return str(number)


def build_confirmation(
    cart: dict[str, int],
    invoice: dict[str, Any] | None = None,
) -> str:
    """Build a natural spoken summary of products and the priced order total."""
    lines = ["Your order has been confirmed."]

    for product, quantity in cart.items():
        record = find_by_name(product)
        unit = record.get("unit", "unit") if record else "unit"
        unit_names = {
            "kg": ("kilogram", "kilograms"),
            "g": ("gram", "grams"),
            "litre": ("litre", "litres"),
            "liter": ("liter", "liters"),
        }
        singular, plural = unit_names.get(
            unit,
            (unit, unit if unit.endswith("s") else f"{unit}s"),
        )
        spoken_unit = singular if quantity == 1 else plural
        lines.append(
            f"{number_to_words(quantity).capitalize()} {spoken_unit} of {product}."
        )

    total_items = sum(cart.values())
    lines.append(f"Total items: {number_to_words(total_items)}.")
    if invoice and "grand_total_paise" in invoice:
        amount_paise = int(invoice["grand_total_paise"])
        rupees, paise = divmod(amount_paise, 100)
        total = f"{number_to_words(rupees)} rupees"
        if paise:
            total += f" and {number_to_words(paise)} paise"
        lines.append(f"Total amount: {total}.")
    return " ".join(lines)
