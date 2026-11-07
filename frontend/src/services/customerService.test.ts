import { beforeEach, describe, expect, it, vi } from "vitest";

const { businessId, from, query } = vi.hoisted(() => {
  const query = {
    delete: vi.fn(),
    eq: vi.fn(),
    ilike: vi.fn(),
    insert: vi.fn(),
    order: vi.fn(),
    select: vi.fn(),
    single: vi.fn(),
    update: vi.fn(),
  };
  return {
    businessId: "business-current",
    from: vi.fn(),
    query,
  };
});

vi.mock("../lib/supabase", () => ({
  supabase: { from },
}));

vi.mock("./businessService", () => ({
  getCurrentBusiness: vi.fn(async () => ({ id: businessId })),
}));

import {
  createCustomer,
  deleteCustomer,
  getCustomers,
  updateCustomer,
} from "./customerService";
import type { Customer } from "../types/business";

describe("customerService tenant scoping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    from.mockReturnValue(query);
    query.delete.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.insert.mockReturnValue(query);
    query.order.mockResolvedValue({ data: [], error: null });
    query.select.mockReturnValue(query);
    query.single.mockResolvedValue({
      data: { id: "customer-1", business_id: businessId },
      error: null,
    });
    query.update.mockReturnValue(query);
  });

  it("creates a customer with the active business_id overriding supplied IDs", async () => {
    await createCustomer({
      name: "Asha Sharma",
      phone: "+919876543210",
      business_id: "business-other",
    } as Customer);

    expect(from).toHaveBeenCalledWith("customers");
    expect(query.insert).toHaveBeenCalledWith({
      name: "Asha Sharma",
      phone: "+919876543210",
      business_id: businessId,
    });
    expect(query.select).toHaveBeenCalledWith("*");
  });

  it("updates only a customer owned by the active business", async () => {
    await updateCustomer("customer-1", { phone: "+919876543211" });

    expect(from).toHaveBeenCalledWith("customers");
    expect(query.update).toHaveBeenCalledWith({ phone: "+919876543211" });
    expect(query.eq).toHaveBeenNthCalledWith(1, "id", "customer-1");
    expect(query.eq).toHaveBeenNthCalledWith(2, "business_id", businessId);
  });

  it("deletes only a customer owned by the active business", async () => {
    await deleteCustomer("customer-1");

    expect(from).toHaveBeenCalledWith("customers");
    expect(query.delete).toHaveBeenCalledOnce();
    expect(query.eq).toHaveBeenNthCalledWith(1, "id", "customer-1");
    expect(query.eq).toHaveBeenNthCalledWith(2, "business_id", businessId);
  });

  it("searches customer name and phone within the active business", async () => {
    const asha = { id: "customer-1", name: "Asha Sharma" } as Customer;
    const result = { data: [asha], error: null };
    query.ilike.mockImplementation((field: string) => Promise.resolve({
      ...result,
      data: field === "name" ? [asha] : [],
    }));

    const customers = await getCustomers("Asha");

    expect(query.ilike).toHaveBeenNthCalledWith(1, "name", "%Asha%");
    expect(query.ilike).toHaveBeenNthCalledWith(2, "phone", "%Asha%");
    expect(query.eq).toHaveBeenNthCalledWith(1, "business_id", businessId);
    expect(query.eq).toHaveBeenNthCalledWith(2, "business_id", businessId);
    expect(customers).toEqual([asha]);
  });
});
