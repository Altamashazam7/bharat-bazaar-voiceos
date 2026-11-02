import pytest

from backend.app.api import main as api
from backend.app.api.main import app


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


def test_inventory_summary_reports_low_and_out_of_stock(monkeypatch):
    monkeypatch.setattr(
        api,
        "list_products",
        lambda: [
            {"id": "a", "stock": 0},
            {"id": "b", "stock": 2},
            {"id": "c", "stock": 10},
        ],
    )

    report = api.inventory_dashboard()

    assert report["total_products"] == 3
    assert report["low_stock_items"] == 1
    assert report["out_of_stock_items"] == 1


def test_missing_order_returns_not_found(monkeypatch):
    def missing_order(order_id):
        raise KeyError(order_id)

    monkeypatch.setattr(api, "get_order", missing_order)

    with pytest.raises(api.HTTPException) as error:
        api.order_detail("unknown")

    assert error.value.status_code == 404
