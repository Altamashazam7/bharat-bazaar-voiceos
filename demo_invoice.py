from backend.app.services.invoice import generate_invoice


cart = {
    "Amul Butter": 4,
    "Parle G": 2
}

print(
    generate_invoice(cart)
)