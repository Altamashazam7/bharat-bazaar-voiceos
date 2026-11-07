import { describe, expect, it } from "vitest";

import { buildWeeklyTrend } from "./executiveDashboard";
import type { Order } from "../types/business";

describe("executive dashboard weekly trend", () => {
  it("groups orders and revenue by local day for the latest seven days", () => {
    const now = new Date(2026, 10, 7, 12);
    const orders = [
      {
        id: "today-1",
        business_id: "business-1",
        created_at: new Date(2026, 10, 7, 9).toISOString(),
        transcript: "tea",
        invoice: { grand_total_paise: 2500 },
      },
      {
        id: "today-2",
        business_id: "business-1",
        created_at: new Date(2026, 10, 7, 10).toISOString(),
        transcript: "rice",
        invoice: { grand_total_paise: 4000 },
      },
      {
        id: "older",
        business_id: "business-1",
        created_at: new Date(2026, 9, 31, 10).toISOString(),
        transcript: "salt",
        invoice: { grand_total_paise: 1000 },
      },
    ] as Order[];

    const trend = buildWeeklyTrend(orders, now);

    expect(trend).toHaveLength(7);
    expect(trend[0].date).toBe("2026-11-01");
    expect(trend[6]).toMatchObject({
      date: "2026-11-07",
      orders: 2,
      revenuePaise: 6500,
    });
  });

  it("returns seven zeroed points when there are no orders", () => {
    const trend = buildWeeklyTrend([], new Date(2026, 10, 7, 12));

    expect(trend).toHaveLength(7);
    expect(trend.every((point) => point.orders === 0 && point.revenuePaise === 0)).toBe(true);
  });
});
