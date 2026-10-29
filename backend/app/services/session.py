from cart import Cart
from order_parser import parse_order


class OrderSession:
    def __init__(self):
        self.cart = Cart()

    def handle(self, text):
        result = parse_order(text)

        self.cart.set_item(
            result["product"],
            result["quantity"]
        )

        return self.cart.get_items()


if __name__ == "__main__":
    session = OrderSession()

    print(session.handle("do packet amul butter"))
    print(session.handle("5 packet butter"))

