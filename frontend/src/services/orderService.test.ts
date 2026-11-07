import { beforeEach, describe, expect, it, vi } from "vitest";

const { businessId, from, getOwnedBusiness, query } = vi.hoisted(() => {
  const query = {
    delete: vi.fn(),
    eq: vi.fn(),
    insert: vi.fn(),
    order: vi.fn(),
    select: vi.fn(),
    single: vi.fn(),
    update: vi.fn(),
  };
  return {
    businessId: "business-current",
    from: vi.fn(),
    getOwnedBusiness: vi.fn(async (id: string) => ({ id })),
    query,
  };
});

vi.mock("../lib/supabase", () => ({
  supabase: { from },
}));

vi.mock("./businessService", () => ({
  getCurrentBusiness: vi.fn(async () => ({ id: businessId })),
  getOwnedBusiness,
}));

import { createOrder, getBusinessAnalytics, getOrders } from "./orderService";
import type { Order } from "../types/business";

describe("orderService Supabase persistence and reads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    from.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.insert.mockReturnValue(query);
    query.order.mockResolvedValue({ data: [], error: null });
    query.select.mockReturnValue(query);
    query.single.mockResolvedValue({
      data: { id: "order-1", business_id: businessId },
      error: null,
    });
  });

  it("persists the transcript and invoice with active business_id and created_at", async () => {
    const createdAt = "2026-11-07T09:00:00+05:30";
    const input = {
      transcript: "two packets chai",
      invoice: {
        text: "Two packets chai",
        total_items: 2,
        grand_total_paise: 5000,
      },
      created_at: createdAt,
    };

    await createOrder(input);

    expect(from).toHaveBeenCalledWith("orders");
    expect(query.insert).toHaveBeenCalledWith({
      ...input,
      business_id: businessId,
    });
    expect(query.select).toHaveBeenCalledWith("*");
  });

  it("validates the explicit business owner before persisting an order", async () => {
    await createOrder(
      { transcript: "two packets chai", invoice: { total_items: 2 } },
      "business-explicit",
    );

    expect(getOwnedBusiness).toHaveBeenCalledWith("business-explicit");
    expect(query.insert).toHaveBeenCalledWith({
      transcript: "two packets chai",
      invoice: { total_items: 2 },
      business_id: "business-explicit",
    });
  });

  it("scopes order reads to the active business", async () => {
    await getOrders();

    expect(from).toHaveBeenCalledWith("orders");
    expect(query.select).toHaveBeenCalledWith("*");
    expect(query.eq).toHaveBeenCalledWith("business_id", businessId);
    expect(query.order).toHaveBeenCalledWith("created_at", { ascending: false });
  });

  it("calculates analytics from Supabase orders scoped to the current business", async () => {
    const order: Order = {
      id: "order-today",
      business_id: businessId,
      created_at: new Date().toISOString(),
      transcript: "two packets chai",
      invoice: {
        total_items: 2,
        grand_total_paise: 5000,
        items: [
          {
            product: "Chai",
            quantity: 2,
            unit: "packet",
            category: "Tea",
            unit_price_paise: 2500,
            line_total_paise: 5000,
          },
        ],
      },
    };
    query.order.mockResolvedValue({ data: [order], error: null });

    const analytics = await getBusinessAnalytics();

    expect(query.eq).toHaveBeenCalledWith("business_id", businessId);
    expect(analytics.orders_today).toBe(1);
    expect(analytics.revenue_paise).toBe(5000);
    expect(analytics.top_products).toEqual([{ product: "Chai", quantity: 2 }]);
  });

  it("surfaces Supabase write errors", async () => {
    const databaseError = new Error("insert denied");
    query.single.mockResolvedValue({ data: null, error: databaseError });

    await expect(createOrder({
      transcript: "two packets chai",
      invoice: { text: "Two packets chai", total_items: 2 },
    })).rejects.toBe(databaseError);
  });
});
