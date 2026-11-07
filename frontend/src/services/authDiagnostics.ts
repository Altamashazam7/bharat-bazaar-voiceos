import { supabase } from "../lib/supabase";

type AuthOutcome = "success" | "failure" | "state";

export function getAuthProjectHost(): string {
  try {
    return new URL(import.meta.env.VITE_SUPABASE_URL).host;
  } catch {
    return "unconfigured";
  }
}

export function logAuthEvent(
  action: string,
  outcome: AuthOutcome,
  details: Record<string, string | number | boolean | null> = {},
): void {
  if (!import.meta.env.DEV) return;
  const record = {
    action,
    outcome,
    project: getAuthProjectHost(),
    ...details,
  };
  if (outcome === "failure") {
    console.warn("[auth]", record);
  } else {
    console.info("[auth]", record);
  }
}

export function authFailureDetails(error: unknown): {
  errorCode: string | null;
  status: number | null;
} {
  if (typeof error !== "object" || error === null) {
    return { errorCode: null, status: null };
  }
  const candidate = error as { code?: unknown; status?: unknown };
  return {
    errorCode: typeof candidate.code === "string" ? candidate.code : null,
    status: typeof candidate.status === "number" ? candidate.status : null,
  };
}

export async function sendPasswordRecovery(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/`,
  });
  if (error) throw error;
}

export async function updateRecoveredPassword(password: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}
