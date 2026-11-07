import asyncio
import json
import sys
import unittest
from types import ModuleType
from unittest.mock import patch

from backend.app.api.main import _stream_order
from backend.app.services.order_workflow import process_audio


class VoiceOrderProgressTests(unittest.TestCase):
    def test_pipeline_returns_confidence_corrections_and_progress(self):
        gnani_module = ModuleType("gnani")
        gnani_module.__path__ = []
        stt_module = ModuleType("gnani.stt")

        class FakeSttClient:
            def __init__(self, api_key):
                pass

            def transcribe(self, audio_path, language_code):
                return {
                    "transcript": "two packet tea actually four packet tea",
                    "confidence": 0.92,
                }

        stt_module.GnaniSTTClient = FakeSttClient
        tts_module = ModuleType("backend.app.services.tts_service")
        tts_module.generate_speech = lambda text: "confirmation.wav"
        progress = []

        with (
            patch.dict(
                sys.modules,
                {
                    "gnani": gnani_module,
                    "gnani.stt": stt_module,
                    "backend.app.services.tts_service": tts_module,
                },
            ),
            patch(
                "backend.app.services.order_workflow.generate_invoice",
                return_value={"total_items": 4},
            ),
            patch(
                "backend.app.services.order_workflow.build_confirmation",
                return_value="Order ready",
            ),
        ):
            order = process_audio(
                "unused.wav",
                record_order=False,
                deduct_inventory=False,
                product_catalog=[
                    {
                        "name": "Tea",
                        "aliases": ["tea"],
                        "category": "Grocery",
                        "unit": "packet",
                        "price_paise": 2500,
                    }
                ],
                progress_callback=progress.append,
            )

        self.assertEqual(
            progress,
            ["transcribing", "parsing", "invoice_generation", "audio_generation"],
        )
        self.assertEqual(order["transcript_confidence"], 92)
        self.assertEqual(
            order["extracted_products"],
            [{"product": "Tea", "quantity": 4, "confidence": 100}],
        )
        self.assertEqual(
            order["corrections"],
            [
                {
                    "product": "Tea",
                    "from_quantity": 2,
                    "to_quantity": 4,
                    "command": "four packet tea",
                }
            ],
        )

    def test_stream_emits_progress_then_order_as_ndjson(self):
        response = _stream_order(
            lambda report: (report("transcribing"), {"transcript": "tea"})[1]
        )

        async def collect():
            return [chunk async for chunk in response.body_iterator]

        events = [json.loads(line) for line in asyncio.run(collect())]
        self.assertEqual(
            events,
            [
                {"type": "step", "step": "transcribing"},
                {"type": "result", "order": {"transcript": "tea"}},
            ],
        )


if __name__ == "__main__":
    unittest.main()
