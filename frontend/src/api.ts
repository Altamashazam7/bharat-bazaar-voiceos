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
  transcript_confidence?: number | null;
  product_match_confidence?: number | null;
  extracted_products?: ExtractedProduct[];
  corrections?: OrderCorrection[];
}

export interface ExtractedProduct {
  product: string;
  quantity: number;
  confidence: number;
}

export interface OrderCorrection {
  product: string;
  from_quantity: number;
  to_quantity: number;
  command: string;
}

export type VoiceProcessingStep =
  | "transcribing"
  | "parsing"
  | "invoice_generation"
  | "audio_generation";

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

export async function transcribeOrder(
  file: File,
  products: Product[],
  onStep: (step: VoiceProcessingStep) => void,
  onUploadProgress: (progress: number) => void,
): Promise<OrderResult> {
  const formData = new FormData();
  formData.append("audio", file);
  formData.append("products", JSON.stringify(products.map((product) => ({
    name: product.name,
    aliases: product.aliases ?? [product.name],
    category: product.category,
    unit: product.unit,
    price_paise: product.price_paise,
  }))));

  return streamOrder("/transcribe-order/stream", formData, onStep, onUploadProgress);
}

export function runDemo(
  onStep: (step: VoiceProcessingStep) => void,
): Promise<OrderResult> {
  return streamOrder("/demo/stream", undefined, onStep, () => undefined);
}

function streamOrder(
  path: string,
  body: FormData | undefined,
  onStep: (step: VoiceProcessingStep) => void,
  onUploadProgress: (progress: number) => void,
): Promise<OrderResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let responseOffset = 0;
    let result: OrderResult | null = null;
    let streamError: string | null = null;

    const consumeEvents = () => {
      const response = xhr.responseText;
      let newline = response.indexOf("\n", responseOffset);
      while (newline >= 0) {
        const line = response.slice(responseOffset, newline).trim();
        responseOffset = newline + 1;
        if (line) {
          try {
            const event = JSON.parse(line) as {
              type: "step" | "result" | "error";
              step?: VoiceProcessingStep;
              order?: OrderResult;
              message?: string;
            };
            if (event.type === "step" && event.step) onStep(event.step);
            if (event.type === "result" && event.order) result = event.order;
            if (event.type === "error") streamError = event.message ?? "Voice order processing failed. Please try again.";
          } catch {
            streamError = "The server returned an unreadable processing update. Please retry the order.";
          }
        }
        newline = response.indexOf("\n", responseOffset);
      }
    };

    xhr.open("POST", `${API_BASE}${path}`);
    xhr.setRequestHeader("Accept", "application/x-ndjson");
    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        onUploadProgress(Math.round((event.loaded / event.total) * 100));
      }
    });
    xhr.addEventListener("progress", consumeEvents);
    xhr.addEventListener("error", () => reject(new Error("Could not reach the voice-order service. Check your connection and retry.")));
    xhr.addEventListener("abort", () => reject(new Error("Voice-order processing was interrupted. Please retry.")));
    xhr.addEventListener("load", () => {
      consumeEvents();
      if (xhr.status < 200 || xhr.status >= 300) {
        let message = `Request failed (${xhr.status})`;
        try {
          const response = JSON.parse(xhr.responseText) as { detail?: string };
          if (response.detail) message = response.detail;
        } catch {
          // Keep the HTTP status message when the server does not return JSON.
        }
        reject(new Error(message));
      } else if (streamError) {
        reject(new Error(streamError));
      } else if (result) {
        resolve(result);
      } else {
        reject(new Error("The voice-order service ended before returning an order. Please retry."));
      }
    });
    xhr.send(body ?? null);
  });
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
