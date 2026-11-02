import json
from datetime import datetime
from pathlib import Path

import pytest

from backend.app.services import analytics, inventory, invoice, orders, pdf_invoice
from backend.app.services.confirmation import build_confirmation, number_to_words


@pytest.fixture
def inventory_paths(tmp_path, monkeypatch):
    catalog_path = tmp_path / "catalog.json"
    catalog_path.write_text(
        json.dumps(
            [
                {
                    "id": "amul_butter",
                    "name": "Amul Butter",
                    "category": "Dairy",
                    "aliases": ["amul butter"],
                    "unit": "packet",
                    "price_paise": 5800,
                },
                {
                    "id": "parle_g",
                    "name": "Parle G",
                    "category": "Biscuits",
                    "aliases": ["parle g"],
                    "unit": "packet",
                    "price_paise": 1000,
                },
            ]
        ),
        encoding="utf-8",
    )
    monkeypatch.setattr(inventory, "CATALOG_PATH", catalog_path)
    monkeypatch.setattr(inventory, "INVENTORY_PATH", tmp_path / "inventory.json")
    return inventory.INVENTORY_PATH


def test_inventory_initializes_from_catalog_and_supports_crud(inventory_paths):
    products = inventory.list_products()
    assert len(products) == 2
    assert all(product["stock"] == inventory.DEFAULT_STOCK for product in products)

    created = inventory.add_product(
        {
            "name": "Masala Chai",
            "category": "Tea",
            "aliases": ["chai"],
            "unit": "packet",
            "price_paise": 12000,
            "stock": 7,
        }
    )
    assert created["id"].startswith("custom_")
    updated = inventory.update_product(created["id"], {"stock": 3})
    assert updated["stock"] == 3
    inventory.delete_product(created["id"])
    assert len(inventory.list_products()) == 2


def test_inventory_rejects_duplicate_ids(inventory_paths):
    product = inventory.list_products()[0]
    with pytest.raises(ValueError, match="already exists"):
        inventory.add_product(product)


def test_inventory_stock_deduction_never_goes_negative(inventory_paths):
    inventory.deduct_stock({"Amul Butter": 25})

    assert inventory.get_product("amul_butter")["stock"] == 0


def test_invoice_uses_catalog_prices_and_inclusive_tax(
    inventory_paths,
    tmp_path,
    monkeypatch,
):
    monkeypatch.setattr(invoice, "INVOICE_DIRECTORY", tmp_path / "invoices")

    result = invoice.generate_invoice({"Amul Butter": 4, "Parle G": 2})

    assert [item["line_total_paise"] for item in result["items"]] == [23200, 2000]
    assert result["subtotal_paise"] == 25200
    assert result["tax_paise"] == 1200
    assert result["grand_total_paise"] == 25200
    assert "Amul Butter × 4 = ₹232.00" in result["text"]
    assert result["total_items"] == 6


def test_confirmation_uses_natural_quantities_and_total(inventory_paths):
    text = build_confirmation(
        {"Amul Butter": 4, "Parle G": 2},
        {"grand_total_paise": 25200},
    )

    assert text == (
        "Your order has been confirmed. Four packets of Amul Butter. "
        "Two packets of Parle G. Total items: six. "
        "Total amount: two hundred and fifty-two rupees."
    )


def test_number_to_words_supports_large_totals():
    assert number_to_words(42) == "forty-two"
    assert number_to_words(305) == "three hundred and five"


def test_order_history_searches_and_preserves_snapshots(tmp_path, monkeypatch):
    monkeypatch.setattr(orders, "ORDERS_PATH", tmp_path / "orders.json")
    saved = orders.save_order(
        {
            "transcript": "two packets maggi",
            "cart": {"Maggi": 2},
            "invoice": {"grand_total_paise": 2800},
            "confirmation_text": "Confirmed.",
        }
    )

    assert saved["order_id"].startswith("BB-")
    assert orders.get_order(saved["order_id"])["cart"] == {"Maggi": 2}
    assert orders.list_orders(search="maggi")[0]["order_id"] == saved["order_id"]
    assert orders.list_orders(search="not found") == []


def test_analytics_calculates_today_week_and_best_sellers(tmp_path, monkeypatch):
    monkeypatch.setattr(orders, "ORDERS_PATH", tmp_path / "orders.json")
    orders.save_order(
        {
            "timestamp": "2026-11-02T10:00:00+05:30",
            "cart": {"Amul Butter": 4},
            "invoice": {
                "total_items": 4,
                "grand_total_paise": 23200,
                "items": [
                    {
                        "product": "Amul Butter",
                        "quantity": 4,
                        "category": "Dairy",
                    }
                ],
            },
        }
    )

    report = analytics.build_analytics(
        datetime.fromisoformat("2026-11-02T12:00:00+05:30")
    )

    assert report["orders_today"] == 1
    assert report["orders_this_week"] == 1
    assert report["products_sold"] == 4
    assert report["average_order_size"] == 4
    assert report["top_products"] == [{"product": "Amul Butter", "quantity": 4}]
    assert report["top_categories"] == [{"category": "Dairy", "quantity": 4}]


def test_invoice_pdf_is_valid_and_saved(tmp_path, monkeypatch):
    monkeypatch.setattr(pdf_invoice, "INVOICE_DIRECTORY", tmp_path)
    order = {
        "order_id": "BB-123",
        "timestamp": "2026-11-02T10:00:00+05:30",
        "confirmation_text": "Your order is ready.",
        "invoice": {
            "items": [
                {
                    "product": "Amul Butter",
                    "quantity": 4,
                    "unit": "packet",
                    "line_total_paise": 23200,
                }
            ],
            "subtotal_paise": 23200,
            "tax_paise": 1105,
            "grand_total_paise": 23200,
            "total_items": 4,
        },
    }

    output = pdf_invoice.generate_invoice_pdf(order)
    contents = output.read_bytes()

    assert output.name == "BB-123.pdf"
    assert contents.startswith(b"%PDF-1.4")
    assert contents.endswith(b"%%EOF\n")
    assert b"Amul Butter" in contents
    assert Path(output).parent == tmp_path
