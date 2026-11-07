import sys
from types import ModuleType

import pytest

from backend.app.services import confirmation, invoice, order_workflow


class FakeSession:
    def __init__(self):
        self.cart = self
        self.items = {}

    def get_items(self):
        return self.items

    def handle(self, command):
        if command == "two packets maggi":
            self.items["Maggi"] = 2
        return self.items


def install_fake_stt(monkeypatch, transcript):
    class FakeClient:
        def __init__(self, api_key):
            self.api_key = api_key

        def transcribe(self, audio_path, language_code):
            assert language_code == "en-IN"
            return {"transcript": transcript}

    gnani_module = ModuleType("gnani")
    stt_module = ModuleType("gnani.stt")
    stt_module.GnaniSTTClient = FakeClient
    monkeypatch.setitem(sys.modules, "gnani", gnani_module)
    monkeypatch.setitem(sys.modules, "gnani.stt", stt_module)


def test_order_workflow_preserves_legacy_fields_and_allows_safe_benchmark(
    monkeypatch,
):
    install_fake_stt(monkeypatch, "two packets maggi")
    monkeypatch.setattr(order_workflow, "OrderSession", FakeSession)
    monkeypatch.setattr(
        order_workflow,
        "generate_invoice",
        lambda cart, write_to_disk: {
            "text": "invoice",
            "total_items": sum(cart.values()),
            "grand_total_paise": 2800,
        },
    )
    monkeypatch.setattr(
        order_workflow,
        "build_confirmation",
        lambda cart, invoice: "Your order is confirmed.",
    )
    deducted = []
    saved = []
    monkeypatch.setattr(order_workflow, "deduct_stock", deducted.append)
    monkeypatch.setattr(order_workflow, "save_order", saved.append)

    result = order_workflow.process_audio(
        "sample.m4a",
        include_audio=False,
        record_order=False,
        deduct_inventory=False,
    )

    assert {
        "transcript",
        "commands",
        "cart",
        "invoice",
        "confirmation_text",
        "confirmation_audio",
    } <= result.keys()
    assert result["cart"] == {"Maggi": 2}
    assert result["confirmation_audio"] is None
    assert saved == []
    assert deducted == []


def test_order_workflow_records_order_and_updates_inventory(monkeypatch):
    install_fake_stt(monkeypatch, "two packets maggi")
    monkeypatch.setattr(order_workflow, "OrderSession", FakeSession)
    monkeypatch.setattr(
        order_workflow,
        "generate_invoice",
        lambda cart, write_to_disk: {"total_items": sum(cart.values())},
    )
    monkeypatch.setattr(
        order_workflow,
        "build_confirmation",
        lambda cart, invoice: "Confirmed.",
    )
    monkeypatch.setattr(
        order_workflow,
        "save_order",
        lambda order: {
            **order,
            "order_id": "BB-123",
            "timestamp": "2026-11-02T10:00:00+05:30",
        },
    )
    deducted = []
    monkeypatch.setattr(order_workflow, "deduct_stock", deducted.append)

    result = order_workflow.process_audio("sample.m4a", include_audio=False)

    assert result["order_id"] == "BB-123"
    assert result["timestamp"].startswith("2026-11-02")
    assert deducted == [{"Maggi": 2}]


def test_tenant_order_uses_business_catalog_without_shared_json_writes(monkeypatch):
    install_fake_stt(monkeypatch, "two packets maggi")

    class TenantSession(FakeSession):
        def __init__(self, catalog):
            super().__init__()
            assert catalog == [
                {
                    "name": "Maggi",
                    "aliases": ["Maggi"],
                    "category": "Noodles",
                    "unit": "packet",
                    "price_paise": 1400,
                }
            ]

    monkeypatch.setattr(order_workflow, "OrderSession", TenantSession)
    invoices = []
    monkeypatch.setattr(
        order_workflow,
        "generate_invoice",
        lambda cart, **options: (
            invoices.append(options)
            or {
                "text": "tenant invoice",
                "total_items": sum(cart.values()),
                "grand_total_paise": 2800,
            }
        ),
    )
    confirmations = []
    monkeypatch.setattr(
        order_workflow,
        "build_confirmation",
        lambda cart, invoice, **options: (
            confirmations.append(options)
            or "Your business order is confirmed."
        ),
    )
    monkeypatch.setattr(
        order_workflow,
        "save_order",
        lambda _order: pytest.fail("Tenant order must be persisted by the Supabase client."),
    )
    monkeypatch.setattr(
        order_workflow,
        "deduct_stock",
        lambda _cart: pytest.fail("Tenant processing must not mutate shared JSON stock."),
    )

    catalog = [
        {
            "name": "Maggi",
            "aliases": ["Maggi"],
            "category": "Noodles",
            "unit": "packet",
            "price_paise": 1400,
        }
    ]
    result = order_workflow.process_audio(
        "sample.m4a",
        include_audio=False,
        product_catalog=catalog,
    )

    assert result["invoice"]["grand_total_paise"] == 2800
    assert invoices == [{"product_catalog": catalog, "write_to_disk": False}]
    assert confirmations == [{"product_catalog": catalog}]


def test_tenant_invoice_and_confirmation_use_only_business_catalog(
    tmp_path,
    monkeypatch,
):
    catalog = [
        {
            "name": "Maggi",
            "aliases": [],
            "category": "Noodles",
            "unit": "packet",
            "price_paise": 1400,
        }
    ]
    monkeypatch.setattr(
        invoice,
        "list_products",
        lambda: pytest.fail("Tenant invoice must not read shared inventory."),
    )
    monkeypatch.setattr(
        invoice,
        "INVOICE_DIRECTORY",
        tmp_path,
    )
    monkeypatch.setattr(
        confirmation,
        "find_by_name",
        lambda _name: pytest.fail("Tenant confirmation must not read shared inventory."),
    )

    order_invoice = invoice.generate_invoice(
        {"Maggi": 2},
        product_catalog=catalog,
        write_to_disk=False,
    )
    spoken_confirmation = confirmation.build_confirmation(
        {"Maggi": 2},
        order_invoice,
        product_catalog=catalog,
    )

    assert order_invoice["grand_total_paise"] == 2800
    assert order_invoice["items"][0]["unit"] == "packet"
    assert not list(tmp_path.iterdir())
    assert "Two packets of Maggi." in spoken_confirmation
