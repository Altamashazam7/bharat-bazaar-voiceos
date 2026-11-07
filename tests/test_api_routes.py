import asyncio
from io import BytesIO
from pathlib import Path

import pytest
from fastapi import UploadFile

from backend.app.api import main as api
from backend.app.api.main import app
from backend.app.services import audio as audio_service


@pytest.mark.parametrize(
    "origin",
    [
        "https://bharat-bazaar-voiceos.vercel.app",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
)
@pytest.mark.parametrize("method", ["GET", "POST", "PUT", "DELETE", "OPTIONS"])
def test_cors_preflight_allows_configured_origins_and_methods(origin, method):
    messages = []

    async def receive():
        return {"type": "http.request", "body": b"", "more_body": False}

    async def send(message):
        messages.append(message)

    asyncio.run(
        app(
            {
                "type": "http",
                "asgi": {"version": "3.0"},
                "http_version": "1.1",
                "method": "OPTIONS",
                "scheme": "http",
                "path": "/transcribe-order",
                "raw_path": b"/transcribe-order",
                "query_string": b"",
                "headers": [
                    (b"origin", origin.encode()),
                    (b"access-control-request-method", method.encode()),
                    (b"access-control-request-headers", b"content-type"),
                ],
                "server": ("testserver", 80),
                "client": ("testclient", 50000),
            },
            receive,
            send,
        )
    )

    response = next(
        message for message in messages if message["type"] == "http.response.start"
    )
    headers = dict(response["headers"])
    assert response["status"] == 200
    assert headers[b"access-control-allow-origin"] == origin.encode()
    assert headers[b"access-control-allow-credentials"] == b"true"
    assert method.encode() in headers[b"access-control-allow-methods"]


def test_original_and_new_workflow_routes_are_available():
    paths = {route.path for route in app.routes}

    assert "/transcribe-order" in paths
    assert "/demo" in paths
    assert "/evaluate" in paths
    assert "/inventory" in paths
    assert "/inventory/{product_id}" in paths
    assert "/orders" in paths
    assert "/orders/{order_id}" in paths
    assert "/orders/{order_id}/invoice.pdf" in paths
    assert "/analytics" in paths


@pytest.mark.parametrize(
    "handler, args",
    [
        (api.legacy_inventory_api, ()),
        (api.legacy_inventory_item_api, ("product-id",)),
        (api.legacy_orders_api, ()),
        (api.legacy_order_api, ("order-id",)),
        (api.legacy_invoice_api, ("order-id",)),
        (api.legacy_analytics_api, ()),
    ],
)
def test_unscoped_legacy_retail_endpoints_are_gone(handler, args):
    with pytest.raises(api.HTTPException) as error:
        handler(*args)

    assert error.value.status_code == 410


def test_transcribe_order_converts_webm_before_processing(tmp_path, monkeypatch):
    upload_directory = tmp_path / "uploads"
    monkeypatch.setattr(api, "UPLOAD_DIRECTORY", upload_directory)
    monkeypatch.setattr(audio_service.shutil, "which", lambda _: "/usr/bin/ffmpeg")

    def convert_to_wav(command, **_kwargs):
        assert command[command.index("-i") + 1].endswith(".webm")
        assert command[-1].endswith(".wav")
        Path(command[-1]).write_bytes(b"wav audio")

    monkeypatch.setattr(audio_service.subprocess, "run", convert_to_wav)
    processed_paths = []

    received_options = []

    def process_audio(audio_path, **options):
        received_options.append(options)
        assert options == {
            "record_order": False,
            "deduct_inventory": False,
            "product_catalog": [
                {
                    "name": "Maggi",
                    "aliases": ["Maggi"],
                    "category": "Noodles",
                    "unit": "packet",
                    "price_paise": 1400,
                }
            ],
        }
        processed_paths.append(Path(audio_path))
        assert Path(audio_path).read_bytes() == b"wav audio"
        return {"transcript": "two packets maggi"}

    monkeypatch.setattr(api, "process_audio", process_audio)
    upload = UploadFile(
        filename="recording.webm",
        file=BytesIO(b"webm audio"),
    )

    result = asyncio.run(
        api.transcribe_order(
            upload,
            products='[{"name":"Maggi","aliases":["Maggi"],"category":"Noodles","unit":"packet","price_paise":1400}]',
        )
    )

    assert result == {"transcript": "two packets maggi"}
    assert received_options[0]["product_catalog"][0]["price_paise"] == 1400
    assert processed_paths[0].suffix == ".wav"
    assert not processed_paths[0].exists()
    assert list(upload_directory.glob("*.webm"))


def test_transcribe_order_keeps_m4a_upload_unchanged(tmp_path, monkeypatch):
    upload_directory = tmp_path / "uploads"
    monkeypatch.setattr(api, "UPLOAD_DIRECTORY", upload_directory)
    monkeypatch.setattr(
        audio_service.subprocess,
        "run",
        lambda *_args, **_kwargs: pytest.fail("M4A uploads must not be converted."),
    )
    processed_paths = []
    monkeypatch.setattr(
        api,
        "process_audio",
        lambda audio_path, **options: (
            processed_paths.append(Path(audio_path))
            or options == {
                "record_order": False,
                "deduct_inventory": False,
                "product_catalog": [],
            }
        ) and {"ok": True},
    )
    upload = UploadFile(
        filename="order.m4a",
        file=BytesIO(b"m4a audio"),
    )

    result = asyncio.run(api.transcribe_order(upload, products="[]"))

    assert result == {"ok": True}
    assert processed_paths[0].suffix == ".m4a"
    assert processed_paths[0].read_bytes() == b"m4a audio"


def test_transcribe_order_reports_missing_ffmpeg_for_webm(tmp_path, monkeypatch):
    monkeypatch.setattr(api, "UPLOAD_DIRECTORY", tmp_path / "uploads")

    def missing_converter(_audio_path):
        raise audio_service.AudioConverterUnavailableError("FFmpeg is missing.")

    monkeypatch.setattr(api, "normalize_audio_for_stt", missing_converter)
    upload = UploadFile(
        filename="recording.webm",
        file=BytesIO(b"webm audio"),
    )

    with pytest.raises(api.HTTPException) as error:
        asyncio.run(api.transcribe_order(upload, products="[]"))

    assert error.value.status_code == 503
    assert "requires FFmpeg" in error.value.detail


def test_transcribe_order_rejects_invalid_tenant_catalog():
    upload = UploadFile(filename="order.m4a", file=BytesIO(b"m4a audio"))

    with pytest.raises(api.HTTPException) as error:
        asyncio.run(api.transcribe_order(upload, products='[{"name":""}]'))

    assert error.value.status_code == 422
    assert error.value.detail == "The business product catalog is invalid."
