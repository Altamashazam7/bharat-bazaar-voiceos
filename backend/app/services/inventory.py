import json
import os
import tempfile
import threading
from pathlib import Path
from typing import Any
from uuid import uuid4


PROJECT_ROOT = Path(__file__).resolve().parents[3]
CATALOG_PATH = PROJECT_ROOT / "catalog" / "products.json"
INVENTORY_PATH = PROJECT_ROOT / "data" / "inventory.json"
_LOCK = threading.RLock()
DEFAULT_STOCK = 20


def _read_catalog() -> list[dict[str, Any]]:
    with CATALOG_PATH.open(encoding="utf-8") as catalog_file:
        return json.load(catalog_file)


def _read_inventory() -> list[dict[str, Any]]:
    if not INVENTORY_PATH.exists():
        products = [
            {
                **product,
                "stock": DEFAULT_STOCK,
            }
            for product in _read_catalog()
        ]
        _write_inventory(products)
        return products

    try:
        with INVENTORY_PATH.open(encoding="utf-8") as inventory_file:
            products = json.load(inventory_file)
    except (OSError, json.JSONDecodeError) as error:
        raise RuntimeError(f"Unable to read inventory: {error}") from error

    if not isinstance(products, list):
        raise RuntimeError("Inventory data must be a JSON list.")
    return products


def _write_inventory(products: list[dict[str, Any]]) -> None:
    INVENTORY_PATH.parent.mkdir(parents=True, exist_ok=True)
    temporary_path: str | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            dir=INVENTORY_PATH.parent,
            delete=False,
            suffix=".tmp",
        ) as inventory_file:
            json.dump(products, inventory_file, ensure_ascii=False, indent=2)
            inventory_file.write("\n")
            temporary_path = inventory_file.name
        os.replace(temporary_path, INVENTORY_PATH)
    except OSError as error:
        if temporary_path and os.path.exists(temporary_path):
            os.unlink(temporary_path)
        raise RuntimeError(f"Unable to save inventory: {error}") from error


def list_products() -> list[dict[str, Any]]:
    """Return all inventory records, initializing stock from the product catalog."""
    with _LOCK:
        return _read_inventory()


def get_product(product_id: str) -> dict[str, Any]:
    """Return one inventory record by ID."""
    with _LOCK:
        for product in _read_inventory():
            if product["id"] == product_id:
                return product
    raise KeyError(f"Product '{product_id}' was not found.")


def add_product(product: dict[str, Any]) -> dict[str, Any]:
    """Create a product with a stable generated ID when one is not supplied."""
    with _LOCK:
        products = _read_inventory()
        new_product = dict(product)
        new_product.setdefault("id", f"custom_{uuid4().hex[:12]}")
        if any(item["id"] == new_product["id"] for item in products):
            raise ValueError(f"Product ID '{new_product['id']}' already exists.")
        new_product["aliases"] = _product_aliases(new_product)
        products.append(new_product)
        _write_inventory(products)
        return new_product


def update_product(product_id: str, changes: dict[str, Any]) -> dict[str, Any]:
    """Update an existing product while keeping its ID stable."""
    with _LOCK:
        products = _read_inventory()
        for index, product in enumerate(products):
            if product["id"] == product_id:
                updated = {**product, **changes, "id": product_id}
                updated["aliases"] = _product_aliases(updated)
                products[index] = updated
                _write_inventory(products)
                return updated
    raise KeyError(f"Product '{product_id}' was not found.")


def delete_product(product_id: str) -> None:
    """Remove a product from the persisted inventory."""
    with _LOCK:
        products = _read_inventory()
        remaining = [product for product in products if product["id"] != product_id]
        if len(remaining) == len(products):
            raise KeyError(f"Product '{product_id}' was not found.")
        _write_inventory(remaining)


def deduct_stock(cart: dict[str, int]) -> None:
    """Deduct sold quantities without allowing stock to become negative."""
    with _LOCK:
        products = _read_inventory()
        quantities = {name.casefold(): quantity for name, quantity in cart.items()}
        changed = False
        for product in products:
            quantity = quantities.get(product["name"].casefold())
            if quantity is None:
                continue
            product["stock"] = max(0, product["stock"] - quantity)
            changed = True
        if changed:
            _write_inventory(products)


def find_by_name(name: str) -> dict[str, Any] | None:
    """Find a product by its customer-facing name, ignoring case."""
    normalized_name = name.casefold()
    with _LOCK:
        for product in _read_inventory():
            if product["name"].casefold() == normalized_name:
                return product
    return None


def _product_aliases(product: dict[str, Any]) -> list[str]:
    aliases = [product["name"], *product.get("aliases", [])]
    unique_aliases: dict[str, str] = {}
    for alias in aliases:
        normalized = alias.strip()
        if normalized:
            unique_aliases.setdefault(normalized.casefold(), normalized)
    return list(unique_aliases.values())
