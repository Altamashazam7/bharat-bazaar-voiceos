from collections import Counter
from datetime import datetime, timedelta
from typing import Any

from backend.app.services.orders import list_orders


def build_analytics(now: datetime | None = None) -> dict[str, Any]:
    """Aggregate order, revenue, product, and category metrics for the retailer."""
    current_time = now or datetime.now().astimezone()
    today = current_time.date()
    week_start = today - timedelta(days=today.weekday())
    orders = list_orders(limit=10000)

    orders_today = 0
    orders_this_week = 0
    revenue_paise = 0
    weekly_revenue_paise = 0
    products_sold = 0
    weekly_products_sold = 0
    weekly_baskets: list[int] = []
    product_totals: Counter[str] = Counter()
    category_totals: Counter[str] = Counter()

    for order in orders:
        try:
            timestamp = datetime.fromisoformat(order["timestamp"])
        except (KeyError, TypeError, ValueError):
            continue

        order_date = timestamp.date()
        invoice = order.get("invoice", {})
        items = invoice.get("items", [])
        item_count = int(invoice.get("total_items", 0))
        order_revenue = int(invoice.get("grand_total_paise", 0))

        if order_date == today:
            orders_today += 1
            products_sold += item_count
            revenue_paise += order_revenue

        if week_start <= order_date <= today:
            orders_this_week += 1
            weekly_products_sold += item_count
            weekly_revenue_paise += order_revenue
            weekly_baskets.append(item_count)
            for item in items:
                product_totals[item["product"]] += int(item["quantity"])
                category_totals[item.get("category", "Other")] += int(
                    item["quantity"]
                )

    return {
        "orders_today": orders_today,
        "orders_this_week": orders_this_week,
        "products_sold": products_sold,
        "average_order_size": (
            round(sum(weekly_baskets) / len(weekly_baskets), 1)
            if weekly_baskets
            else 0
        ),
        "revenue_paise": revenue_paise,
        "revenue": _format_rupees(revenue_paise),
        "weekly_revenue_paise": weekly_revenue_paise,
        "top_products": [
            {"product": name, "quantity": quantity}
            for name, quantity in product_totals.most_common(5)
        ],
        "top_categories": [
            {"category": name, "quantity": quantity}
            for name, quantity in category_totals.most_common(5)
        ],
    }


def _format_rupees(amount_paise: int) -> str:
    rupees, paise = divmod(amount_paise, 100)
    return f"₹{rupees:,}.{paise:02d}"
