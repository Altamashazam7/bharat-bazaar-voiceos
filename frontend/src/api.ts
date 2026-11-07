import type { Product } from "./types/business";

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ?? "https://bharat-bazaar-voiceos-2.onrender.com"
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

export async function transcribeOrder(file: File, products: Product[]): Promise<OrderResult> {
  const formData = new FormData();
  formData.append("audio", file);
  formData.append("products", JSON.stringify(products.map((product) => ({
    name: product.name,
    aliases: product.aliases ?? [product.name],
    category: product.category,
    unit: product.unit,
    price_paise: product.price_paise,
  }))));

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

export function audioUrl(audioPath: string | null): string | null {
  if (!audioPath) return null;
  if (/^https?:\/\//.test(audioPath)) return audioPath;

  const filename = audioPath.split(/[\\/]/).pop();
  return filename ? `${API_BASE}/audio/${encodeURIComponent(filename)}` : null;
}
