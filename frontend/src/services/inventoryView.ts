import type { Product } from "../types/business";

export type InventoryStockFilter = "all" | "in-stock" | "low-stock" | "out-of-stock";
export type InventorySortField = "name" | "stock" | "price" | "category";

export interface InventoryFilters {
  search: string;
  stock: InventoryStockFilter;
  category: string;
  sortBy: InventorySortField;
}

export function filterAndSortProducts(
  products: Product[],
  filters: InventoryFilters,
): Product[] {
  const normalizedSearch = filters.search.trim().toLocaleLowerCase();
  return products
    .filter((product) => {
      const matchesSearch = !normalizedSearch
        || [product.name, product.category, product.unit, ...(product.aliases ?? [])]
          .some((value) => value.toLocaleLowerCase().includes(normalizedSearch));
      const matchesStock = filters.stock === "all"
        || (filters.stock === "in-stock" && product.stock > 5)
        || (filters.stock === "low-stock" && product.stock > 0 && product.stock <= 5)
        || (filters.stock === "out-of-stock" && product.stock === 0);
      const matchesCategory = filters.category === "all"
        || product.category === filters.category;
      return matchesSearch && matchesStock && matchesCategory;
    })
    .sort((left, right) => {
      const comparison = filters.sortBy === "stock"
        ? left.stock - right.stock
        : filters.sortBy === "price"
          ? left.price_paise - right.price_paise
          : filters.sortBy === "category"
            ? left.category.localeCompare(right.category)
            : left.name.localeCompare(right.name);
      return comparison || left.name.localeCompare(right.name);
    });
}

export function paginateProducts(
  products: Product[],
  page: number,
  pageSize: number,
): Product[] {
  const safePageSize = Math.max(1, Math.floor(pageSize));
  const safePage = Math.max(1, Math.floor(page));
  return products.slice((safePage - 1) * safePageSize, safePage * safePageSize);
}
