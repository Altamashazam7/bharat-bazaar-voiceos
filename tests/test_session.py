from backend.app.services.cart import Cart


def test_multiple_products():
    cart = Cart()

    cart.set_item("Amul Butter", 4)
    cart.set_item("Parle G", 2)

    items = cart.get_items()

    assert items["Amul Butter"] == 4
    assert items["Parle G"] == 2
