import os

from dotenv import load_dotenv

load_dotenv("backend/.env")


def generate_speech(text: str):
    from gnani.tts import GnaniTTSClient

    os.makedirs(
        "tts_output",
        exist_ok=True
    )

    client = GnaniTTSClient(
        api_key=os.getenv(
            "GNANI_API_KEY"
        )
    )

    output_file = (
        "tts_output/confirmation.wav"
    )

    client.synthesize(
        text=text,
        output_file=output_file
    )

    return output_file