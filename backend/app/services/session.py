from backend.app.services.cart import Cart
from backend.app.services.order_parser import parse_order
from backend.app.services.intents import is_correction


class OrderSession:
    def __init__(self):
        self.cart = Cart()

    def handle(self, text):
        result = parse_order(text)

        product = result["product"]
        quantity = result["quantity"]

        if is_correction(text):
            self.cart.set_item(product, quantity)
        else:
            self.cart.set_item(product, quantity)

        return self.cart.get_items()


if __name__ == "__main__":
    session = OrderSession()

    print(session.handle("5 packet amul butter"))
    print(session.handle("nahi 2 packet amul butter"))
    print(session.handle("actually 4 packet amul butter"))
