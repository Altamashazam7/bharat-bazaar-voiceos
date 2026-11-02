import json
import os
import tempfile
import threading
from datetime import datetime
from pathlib import Path
from typing import Any
from uuid import uuid4


PROJECT_ROOT = Path(__file__).resolve().parents[3]
ORDERS_PATH = PROJECT_ROOT / "data" / "orders.json"
_LOCK = threading.RLock()


def _read_orders() -> list[dict[str, Any]]:
    if not ORDERS_PATH.exists():
        return []
    try:
        with ORDERS_PATH.open(encoding="utf-8") as orders_file:
            orders = json.load(orders_file)
    except (OSError, json.JSONDecodeError) as error:
        raise RuntimeError(f"Unable to read order history: {error}") from error
    if not isinstance(orders, list):
        raise RuntimeError("Order history must be a JSON list.")
    return orders


def _write_orders(orders: list[dict[str, Any]]) -> None:
    ORDERS_PATH.parent.mkdir(parents=True, exist_ok=True)
    temporary_path: str | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            dir=ORDERS_PATH.parent,
            delete=False,
            suffix=".tmp",
        ) as orders_file:
            json.dump(orders, orders_file, ensure_ascii=False, indent=2)
            orders_file.write("\n")
            temporary_path = orders_file.name
        os.replace(temporary_path, ORDERS_PATH)
    except OSError as error:
        if temporary_path and os.path.exists(temporary_path):
            os.unlink(temporary_path)
        raise RuntimeError(f"Unable to save order history: {error}") from error


def save_order(order: dict[str, Any]) -> dict[str, Any]:
    """Persist an immutable snapshot of an order and its invoice."""
    snapshot = {
        **order,
        "order_id": order.get("order_id", f"BB-{uuid4().hex[:10].upper()}"),
        "timestamp": order.get("timestamp", datetime.now().astimezone().isoformat()),
    }
    with _LOCK:
        orders = _read_orders()
        orders.insert(0, snapshot)
        _write_orders(orders)
    return snapshot


def list_orders(
    *,
    search: str = "",
    status: str | None = None,
    limit: int = 100,
) -> list[dict[str, Any]]:
    """Search recent orders by ID, transcript, or product name."""
    normalized_search = search.casefold().strip()
    with _LOCK:
        orders = _read_orders()

    filtered = []
    for order in orders:
        if status and order.get("status", "confirmed") != status:
            continue
        searchable = " ".join(
            [
                order.get("order_id", ""),
                order.get("transcript", ""),
                *order.get("cart", {}).keys(),
            ]
        ).casefold()
        if normalized_search and normalized_search not in searchable:
            continue
        filtered.append(order)
        if len(filtered) >= limit:
            break
    return filtered


def get_order(order_id: str) -> dict[str, Any]:
    """Return a stored order, or raise when its ID is unknown."""
    with _LOCK:
        for order in _read_orders():
            if order["order_id"] == order_id:
                return order
    raise KeyError(f"Order '{order_id}' was not found.")
