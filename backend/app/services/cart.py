class Cart:
    def __init__(self):
        self.items = {}

    def set_item(self, product, quantity):
        self.items[product] = quantity

    def remove_item(self, product):
        if product in self.items:
            del self.items[product]

    def get_items(self):
        return self.items


if __name__ == "__main__":
    cart = Cart()

    cart.set_item("Amul Butter", 2)

    print(cart.get_items())
