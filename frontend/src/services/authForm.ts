const REMEMBERED_EMAIL_KEY = "bharat-bazaar-remembered-email";

export type PasswordStrength = "weak" | "fair" | "good" | "strong";

export function normalizeEmailAddress(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmailAddress(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalizeEmailAddress(email));
}

export function getPasswordStrength(password: string): {
  score: number;
  label: PasswordStrength;
} {
  const score = [
    password.length >= 8,
    password.length >= 12,
    /[a-z]/.test(password) && /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;

  return {
    score,
    label: score <= 1 ? "weak" : score <= 2 ? "fair" : score <= 3 ? "good" : "strong",
  };
}

export function getRememberedEmail(): string {
  return typeof window === "undefined"
    ? ""
    : window.localStorage.getItem(REMEMBERED_EMAIL_KEY) ?? "";
}

// Supabase already persists the auth session; this preference stores only the email address.
export function rememberEmail(email: string, remember: boolean): void {
  if (typeof window === "undefined") return;
  if (remember) {
    window.localStorage.setItem(REMEMBERED_EMAIL_KEY, normalizeEmailAddress(email));
  } else {
    window.localStorage.removeItem(REMEMBERED_EMAIL_KEY);
  }
}
