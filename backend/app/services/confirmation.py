def build_confirmation(cart):
    lines = []

    lines.append(
        "Your order has been confirmed."
    )

    for product, qty in cart.items():
        lines.append(
            f"{qty} units of {product}."
        )

    total_items = sum(
        cart.values()
    )

    lines.append(
        f"Total items {total_items}."
    )

    return " ".join(lines)