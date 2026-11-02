const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000"
).replace(/\/$/, "");

export interface OrderResult {
  order_id?: string;
  timestamp?: string;
  transcript: string;
  commands: string[];
  cart: Record<string, number>;
  invoice: {
    text: string;
    total_items: number;
    items?: InvoiceLine[];
    subtotal_paise?: number;
    tax_paise?: number;
    grand_total_paise?: number;
    subtotal?: string;
    tax?: string;
    grand_total?: string;
  };
  confirmation_text: string;
  confirmation_audio: string | null;
}

export interface InvoiceLine {
  product: string;
  quantity: number;
  unit: string;
  category: string;
  unit_price_paise: number;
  line_total_paise: number;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  aliases: string[];
  unit: string;
  price_paise: number;
  stock: number;
}

export interface InventoryReport {
  products: Product[];
  total_products: number;
  low_stock_items: number;
  out_of_stock_items: number;
  low_stock_threshold: number;
}

export interface OrderRecord extends OrderResult {
  order_id: string;
  timestamp: string;
}

export interface AnalyticsReport {
  orders_today: number;
  orders_this_week: number;
  products_sold: number;
  average_order_size: number;
  revenue_paise: number;
  revenue: string;
  weekly_revenue_paise: number;
  top_products: { product: string; quantity: number }[];
  top_categories: { category: string; quantity: number }[];
}

export interface EvaluationRow {
  file: string;
  status: "passed" | "failed" | "error";
  expected: Record<string, number>;
  actual: Record<string, number>;
  transcript: string;
  error: string | null;
}

export interface EvaluationReport {
  total_samples: number;
  passed: number;
  failed: number;
  accuracy: number;
  results: EvaluationRow[];
}

async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, options);
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = (await response.json()) as { detail?: string };
      if (body.detail) message = body.detail;
    } catch {
      // Keep the HTTP status message when the server does not return JSON.
    }
    throw new Error(message);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function transcribeOrder(file: File): Promise<OrderResult> {
  const formData = new FormData();
  formData.append("audio", file);

  return request<OrderResult>("/transcribe-order", {
    method: "POST",
    body: formData,
  });
}

export function runDemo(): Promise<OrderResult> {
  return request<OrderResult>("/demo", { method: "POST" });
}

export function runEvaluation(): Promise<EvaluationReport> {
  return request<EvaluationReport>("/evaluate", { method: "POST" });
}

export function getInventory(): Promise<InventoryReport> {
  return request<InventoryReport>("/inventory");
}

export function createProduct(product: Omit<Product, "id">): Promise<Product> {
  return request<Product>("/inventory", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(product),
  });
}

export function updateProduct(product: Product): Promise<Product> {
  return request<Product>(`/inventory/${encodeURIComponent(product.id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(product),
  });
}

export function deleteProduct(productId: string): Promise<void> {
  return request<void>(`/inventory/${encodeURIComponent(productId)}`, {
    method: "DELETE",
  });
}

export function getOrders(
  search = "",
  status = "",
): Promise<{ orders: OrderRecord[]; total: number }> {
  const query = new URLSearchParams();
  if (search) query.set("search", search);
  if (status) query.set("status", status);
  const suffix = query.size ? `?${query.toString()}` : "";
  return request(`/orders${suffix}`);
}

export function getOrder(orderId: string): Promise<OrderRecord> {
  return request<OrderRecord>(`/orders/${encodeURIComponent(orderId)}`);
}

export function getAnalytics(): Promise<AnalyticsReport> {
  return request<AnalyticsReport>("/analytics");
}

export function invoicePdfUrl(orderId: string): string {
  return `${API_BASE}/orders/${encodeURIComponent(orderId)}/invoice.pdf`;
}

export function audioUrl(audioPath: string | null): string | null {
  if (!audioPath) return null;
  if (/^https?:\/\//.test(audioPath)) return audioPath;

  const filename = audioPath.split(/[\\/]/).pop();
  return filename ? `${API_BASE}/audio/${encodeURIComponent(filename)}` : null;
}
