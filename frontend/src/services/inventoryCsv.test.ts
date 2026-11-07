import { describe, expect, it } from "vitest";

import {
  parseInventoryCsv,
  serializeInventoryCsv,
} from "./inventoryCsv";
import type { Product } from "../types/business";

const products: Product[] = [
  {
    id: "product-1",
    business_id: "business-1",
    name: "Tea, Assam",
    category: "Grocery",
    unit: "packet",
    price_paise: 12550,
    stock: 12,
    image_url: "https://example.com/tea.jpg",
    aliases: ["Assam \"Gold\"", "tea"],
  },
  {
    id: "product-2",
    business_id: "business-1",
    name: "Rice",
    category: "Grocery",
    unit: "kg",
    price_paise: 9000,
    stock: 0,
  },
];

describe("inventoryCsv", () => {
  it("round-trips CSV fields including commas, quotes, image URLs, and aliases", () => {
    expect(parseInventoryCsv(serializeInventoryCsv(products))).toEqual([
      {
        name: "Tea, Assam",
        category: "Grocery",
        unit: "packet",
        price_paise: 12550,
        stock: 12,
        image_url: "https://example.com/tea.jpg",
        aliases: ["Assam \"Gold\"", "tea"],
      },
      {
        name: "Rice",
        category: "Grocery",
        unit: "kg",
        price_paise: 9000,
        stock: 0,
        image_url: null,
        aliases: [],
      },
    ]);
  });

  it("accepts UTF-8 BOM, CRLF, and prices in rupees", () => {
    expect(parseInventoryCsv(
      "\uFEFFname,category,unit,price_rupees,stock\r\nTea,Grocery,packet,12.5,4\r\n",
    )).toEqual([{
      name: "Tea",
      category: "Grocery",
      unit: "packet",
      price_paise: 1250,
      stock: 4,
      image_url: null,
      aliases: [],
    }]);
  });

  it("reports missing columns and invalid product data with row numbers", () => {
    expect(() => parseInventoryCsv("name,stock\nTea,4"))
      .toThrow("CSV must include name, category, unit, stock");
    expect(() => parseInventoryCsv(
      "name,category,unit,price_paise,stock\nTea,Grocery,packet,250,1.5",
    )).toThrow("CSV row 2: stock must be a whole number.");
    expect(() => parseInventoryCsv(
      "name,category,unit,price_paise,stock\nTea,Grocery,packet,,1",
    )).toThrow("CSV row 2: price is required.");
    expect(() => parseInventoryCsv(
      "name,category,unit,price_paise,stock,image_url\nTea,Grocery,packet,250,1,javascript:alert(1)",
    )).toThrow("CSV row 2: image_url must be a valid HTTP or HTTPS URL.");
  });

  it("rejects empty CSV files and unclosed quoted fields", () => {
    expect(() => parseInventoryCsv("")).toThrow("CSV is empty or has no product rows.");
    expect(() => parseInventoryCsv(
      'name,category,unit,price_paise,stock\n"Tea,Grocery,packet,250,1',
    )).toThrow("Inventory CSV contains an unclosed quoted field.");
  });
});
