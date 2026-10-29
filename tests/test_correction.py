from backend.app.services.cart import Cart


def test_quantity_replacement():
    cart = Cart()

    cart.set_item("Amul Butter", 5)
    cart.set_item("Amul Butter", 2)
    cart.set_item("Amul Butter", 4)

    assert cart.get_items()["Amul Butter"] == 4
