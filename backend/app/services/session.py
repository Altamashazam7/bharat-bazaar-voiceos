from backend.app.services.cart import Cart
from backend.app.services.order_parser import parse_order
from backend.app.services.intents import is_correction


class OrderSession:
    def __init__(self, catalog=None):
        self.cart = Cart()
        self.catalog = catalog

    def handle(self, text):
        result = parse_order(text, catalog=self.catalog)

        if not result:
            return self.cart.get_items()

        product = result["product"]
        quantity = result["quantity"]

        self.cart.set_item(product, quantity)

        return self.cart.get_items()


if __name__ == "__main__":
    session = OrderSession()

    print(session.handle("5 packet amul butter"))
    print(session.handle("2 packet parle g"))
    print(session.handle("actually 4 packet amul butter"))
