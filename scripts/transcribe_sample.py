from gnani.stt import GnaniSTTClient

client = GnaniSTTClient()

result = client.transcribe(
    "samples/order1.wav",
    language_code="en-IN"
)

print(result)
