import type { Order } from "../types/business";

export interface WeeklyTrendPoint {
  date: string;
  label: string;
  orders: number;
  revenuePaise: number;
}

export function buildWeeklyTrend(
  orders: Order[],
  now = new Date(),
): WeeklyTrendPoint[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const firstDay = new Date(today);
  firstDay.setDate(today.getDate() - 6);
  const points = new Map<string, WeeklyTrendPoint>();

  for (let offset = 0; offset < 7; offset += 1) {
    const date = new Date(firstDay);
    date.setDate(firstDay.getDate() + offset);
    const key = localDateKey(date);
    points.set(key, {
      date: key,
      label: date.toLocaleDateString("en-IN", { weekday: "short" }),
      orders: 0,
      revenuePaise: 0,
    });
  }

  for (const order of orders) {
    const createdAt = new Date(order.created_at);
    if (Number.isNaN(createdAt.getTime())) continue;
    const point = points.get(localDateKey(createdAt));
    if (!point) continue;
    point.orders += 1;
    point.revenuePaise += order.invoice.grand_total_paise ?? 0;
  }

  return [...points.values()];
}

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
