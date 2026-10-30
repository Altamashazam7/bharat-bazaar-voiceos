from fastapi import FastAPI

app = FastAPI(
    title="Bharat Bazaar VoiceOS"
)


@app.get("/")
def health():
    return {
        "status": "ok"
    }


@app.get("/demo-cart")
def demo_cart():
    return {
        "cart": {
            "Amul Butter": 4,
            "Parle G": 2
        }
    }


@app.get("/demo-invoice")
def demo_invoice():
    return {
        "invoice": {
            "Amul Butter": 4,
            "Parle G": 2,
            "total_items": 6
        }
    }