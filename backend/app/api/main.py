from fastapi import FastAPI

app = FastAPI(
    title="Bharat Bazaar VoiceOS"
)


@app.get("/")
def health():
    return {
        "status": "ok"
    }