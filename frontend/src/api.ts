const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000"
).replace(/\/$/, "");

export interface OrderResult {
  transcript: string;
  commands: string[];
  cart: Record<string, number>;
  invoice: {
    text: string;
    total_items: number;
  };
  confirmation_text: string;
  confirmation_audio: string | null;
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

export function audioUrl(audioPath: string | null): string | null {
  if (!audioPath) return null;
  if (/^https?:\/\//.test(audioPath)) return audioPath;

  const filename = audioPath.split(/[\\/]/).pop();
  return filename ? `${API_BASE}/audio/${encodeURIComponent(filename)}` : null;
}
