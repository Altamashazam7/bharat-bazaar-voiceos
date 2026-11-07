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

import {
  createProduct,
  deleteProduct,
  getProducts,
  updateProduct,
} from "./productService";

describe("productService tenant scoping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    from.mockReturnValue(query);
    query.delete.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.insert.mockReturnValue(query);
    query.order.mockResolvedValue({ data: [], error: null });
    query.select.mockReturnValue(query);
    query.single.mockResolvedValue({
      data: { id: "product-1", business_id: businessId },
      error: null,
    });
    query.update.mockReturnValue(query);
  });

  it("validates an explicitly requested business before reading products", async () => {
    await getProducts("business-other");

    expect(getOwnedBusiness).toHaveBeenCalledWith("business-other");
    expect(query.eq).toHaveBeenCalledWith("business_id", "business-other");
  });

  it("creates products in Supabase with the active business_id overriding supplied IDs", async () => {
    const input = {
      name: "Tea",
      category: "Grocery",
      unit: "packet",
      price_paise: 2500,
      stock: 12,
      business_id: "business-other",
    };

    await createProduct(input);

    expect(from).toHaveBeenCalledWith("products");
    expect(query.insert).toHaveBeenCalledWith({
      name: "Tea",
      category: "Grocery",
      unit: "packet",
      price_paise: 2500,
      stock: 12,
      business_id: businessId,
    });
    expect(query.select).toHaveBeenCalledWith("*");
  });

  it("updates products only within the active business", async () => {
    await updateProduct("product-1", {
      stock: 4,
      business_id: "business-other",
    });

    expect(from).toHaveBeenCalledWith("products");
    expect(query.update).toHaveBeenCalledWith({
      stock: 4,
      business_id: businessId,
    });
    expect(query.eq).toHaveBeenNthCalledWith(1, "id", "product-1");
    expect(query.eq).toHaveBeenNthCalledWith(2, "business_id", businessId);
    expect(query.select).toHaveBeenCalledWith("*");
  });

  it("deletes products only within the active business", async () => {
    await deleteProduct("product-1");

    expect(from).toHaveBeenCalledWith("products");
    expect(query.delete).toHaveBeenCalledOnce();
    expect(query.eq).toHaveBeenNthCalledWith(1, "id", "product-1");
    expect(query.eq).toHaveBeenNthCalledWith(2, "business_id", businessId);
  });

  it("propagates Supabase errors instead of reporting successful writes", async () => {
    const databaseError = new Error("write denied");
    query.single.mockResolvedValue({ data: null, error: databaseError });

    await expect(createProduct({
      name: "Tea",
      category: "Grocery",
      unit: "packet",
      price_paise: 2500,
      stock: 12,
    })).rejects.toBe(databaseError);
  });
});
