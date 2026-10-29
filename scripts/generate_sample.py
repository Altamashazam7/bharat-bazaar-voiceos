from gnani.tts import GnaniTTSClient

client = GnaniTTSClient()

audio = client.synthesize(
    "5 packet amul butter. 2 packet parle g. actually 4 packet amul butter",
    voice="Poorvi",
    model="timbre-v2.5",
    language="auto",
    output_file="samples/order1.wav"
)

print("Generated samples/order1.wav")
