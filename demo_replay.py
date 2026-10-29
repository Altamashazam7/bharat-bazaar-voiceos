from backend.app.services.session import OrderSession


session = OrderSession()

orders = [
    "5 packet amul butter",
    "2 packet parle g",
    "actually 4 packet amul butter",
]

for order in orders:
    print("INPUT:", order)
    print("CART :", session.handle(order))
    print("-" * 40)
