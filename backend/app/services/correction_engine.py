from cart import Cart

cart = Cart()

cart.set_item("Amul Butter", 5)

# nahi 2 packet
cart.set_item("Amul Butter", 2)

# actually 4
cart.set_item("Amul Butter", 4)

print(cart.get_items())
