import type { Product, ProductInput } from "../types/business";

const CSV_COLUMNS = [
  "name",
  "category",
  "unit",
  "price_paise",
  "stock",
  "image_url",
  "aliases",
] as const;

function escapeCsvCell(value: string | number): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function serializeInventoryCsv(products: Product[]): string {
  const rows = [
    CSV_COLUMNS.map(escapeCsvCell).join(","),
    ...products.map((product) => [
      product.name,
      product.category,
      product.unit,
      product.price_paise,
      product.stock,
      product.image_url ?? "",
      (product.aliases ?? []).join("|"),
    ].map(escapeCsvCell).join(",")),
  ];
  return `${rows.join("\r\n")}\r\n`;
}

export function exportInventoryCsv(products: Product[]): void {
  const blob = new Blob([serializeInventoryCsv(products)], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `inventory-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function parseCsvRows(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    if (quoted) {
      if (character === '"' && csv[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
    } else if (character === '"' && cell.length === 0) {
      quoted = true;
    } else if (character === ",") {
      row.push(cell);
      cell = "";
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && csv[index + 1] === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }

  if (quoted) throw new Error("Inventory CSV contains an unclosed quoted field.");
  if (cell.length || row.length) {
    row.push(cell);
    if (row.some((value) => value.trim())) rows.push(row);
  }
  return rows;
}

function positiveOrZeroNumber(value: string, label: string, line: number): number {
  const number = Number(value.trim());
  if (!Number.isFinite(number) || number < 0) {
    throw new Error(`CSV row ${line}: ${label} must be a non-negative number.`);
  }
  return number;
}

function validateImageUrl(value: string, line: number): string | null {
  const imageUrl = value.trim();
  if (!imageUrl) return null;
  try {
    const url = new URL(imageUrl);
    if (url.protocol === "https:" || url.protocol === "http:") return imageUrl;
  } catch {
    throw new Error(`CSV row ${line}: image_url must be a valid HTTP or HTTPS URL.`);
  }
  throw new Error(`CSV row ${line}: image_url must be a valid HTTP or HTTPS URL.`);
}

export function parseInventoryCsv(csv: string): ProductInput[] {
  const rows = parseCsvRows(csv.replace(/^\uFEFF/, ""));
  if (rows.length < 2) {
    throw new Error("CSV is empty or has no product rows.");
  }

  const headers = rows[0].map((header) => header.trim().toLowerCase());
  const columnIndex = (name: string) => headers.indexOf(name);
  const nameIndex = columnIndex("name");
  const categoryIndex = columnIndex("category");
  const unitIndex = columnIndex("unit");
  const pricePaiseIndex = columnIndex("price_paise");
  const priceIndex = columnIndex("price_rupees") >= 0
    ? columnIndex("price_rupees")
    : columnIndex("price");
  const stockIndex = columnIndex("stock");

  if ([nameIndex, categoryIndex, unitIndex, stockIndex].some((index) => index < 0)
    || (pricePaiseIndex < 0 && priceIndex < 0)) {
    throw new Error(
      "CSV must include name, category, unit, stock, and either price_paise or price_rupees columns.",
    );
  }

  return rows.slice(1).map((cells, rowIndex) => {
    const line = rowIndex + 2;
    const value = (index: number) => index < 0 ? "" : (cells[index] ?? "").trim();
    const name = value(nameIndex);
    const category = value(categoryIndex);
    const unit = value(unitIndex);
    if (!name || !category || !unit) {
      throw new Error(`CSV row ${line}: name, category, and unit are required.`);
    }

    const rawPrice = value(pricePaiseIndex >= 0 ? pricePaiseIndex : priceIndex);
    if (!rawPrice) throw new Error(`CSV row ${line}: price is required.`);
    const priceValue = positiveOrZeroNumber(rawPrice, "price", line);
    const pricePaise = pricePaiseIndex >= 0
      ? priceValue
      : Math.round(priceValue * 100);
    if (!Number.isSafeInteger(pricePaise)) {
      throw new Error(`CSV row ${line}: price is too large or has invalid precision.`);
    }

    const rawStock = value(stockIndex);
    if (!rawStock) throw new Error(`CSV row ${line}: stock is required.`);
    const stockValue = positiveOrZeroNumber(rawStock, "stock", line);
    if (!Number.isSafeInteger(stockValue)) {
      throw new Error(`CSV row ${line}: stock must be a whole number.`);
    }

    return {
      name,
      category,
      unit,
      price_paise: pricePaise,
      stock: stockValue,
      image_url: validateImageUrl(value(columnIndex("image_url")), line),
      aliases: value(columnIndex("aliases"))
        .split("|")
        .map((alias) => alias.trim())
        .filter(Boolean),
    };
  });
}
