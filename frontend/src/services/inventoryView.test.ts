import { describe, expect, it } from "vitest";

import {
  filterAndSortProducts,
  paginateProducts,
} from "./inventoryView";
import type { Product } from "../types/business";

const products: Product[] = [
  { id: "1", business_id: "b", name: "Rice", category: "Grocery", unit: "kg", price_paise: 9000, stock: 0 },
  { id: "2", business_id: "b", name: "Tea", category: "Grocery", unit: "packet", price_paise: 2500, stock: 4, aliases: ["Assam"] },
  { id: "3", business_id: "b", name: "Soap", category: "Personal care", unit: "bar", price_paise: 3500, stock: 18 },
  { id: "4", business_id: "b", name: "Oil", category: "Grocery", unit: "litre", price_paise: 12000, stock: 8 },
];

describe("inventoryView", () => {
  it("searches product, category, unit, and aliases", () => {
    expect(filterAndSortProducts(products, {
      search: " assam ",
      stock: "all",
      category: "all",
      sortBy: "name",
    }).map((product) => product.name)).toEqual(["Tea"]);
  });

  it("filters in-stock, low-stock, out-of-stock, and category combinations", () => {
    expect(filterAndSortProducts(products, {
      search: "",
      stock: "in-stock",
      category: "Grocery",
      sortBy: "name",
    }).map((product) => product.name)).toEqual(["Oil"]);
    expect(filterAndSortProducts(products, {
      search: "",
      stock: "low-stock",
      category: "all",
      sortBy: "name",
    }).map((product) => product.name)).toEqual(["Tea"]);
    expect(filterAndSortProducts(products, {
      search: "",
      stock: "out-of-stock",
      category: "all",
      sortBy: "name",
    }).map((product) => product.name)).toEqual(["Rice"]);
  });

  it.each([
    ["name", ["Oil", "Rice", "Soap", "Tea"]],
    ["stock", ["Rice", "Tea", "Oil", "Soap"]],
    ["price", ["Tea", "Soap", "Rice", "Oil"]],
    ["category", ["Oil", "Rice", "Tea", "Soap"]],
  ] as const)("sorts inventory by %s", (sortBy, expected) => {
    expect(filterAndSortProducts(products, {
      search: "",
      stock: "all",
      category: "all",
      sortBy,
    }).map((product) => product.name)).toEqual(expected);
  });

  it("paginates without mutating the source product list", () => {
    const originalNames = products.map((product) => product.name);
    expect(paginateProducts(products, 2, 2).map((product) => product.name))
      .toEqual(["Soap", "Oil"]);
    expect(paginateProducts(products, 0, 0)).toEqual([products[0]]);
    expect(products.map((product) => product.name)).toEqual(originalNames);
  });
});
