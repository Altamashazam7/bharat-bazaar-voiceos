export function authErrorMessage(error: unknown): string {
  const candidate = error as { message?: unknown; code?: unknown } | null;
  const message = typeof candidate?.message === "string" ? candidate.message : "";
  const code = typeof candidate?.code === "string" ? candidate.code.toLocaleLowerCase() : "";
  const normalized = message.toLocaleLowerCase();

  if (
    code.includes("rate_limit")
    || normalized.includes("rate limit")
    || normalized.includes("too many requests")
  ) {
    return "Supabase temporarily rate-limited this authentication request. Wait before retrying, or configure a custom SMTP provider for testing.";
  }
  if (code === "email_not_confirmed" || normalized.includes("email not confirmed")) {
    return "This email is not verified yet. Open the confirmation link from Supabase, then try signing in again.";
  }
  if (code === "user_not_found" || normalized.includes("user not found")) {
    return "No account was found for this email in the configured Supabase project. Check the email and project.";
  }
  if (
    code === "invalid_credentials"
    || code === "invalid_login_credentials"
    || normalized.includes("invalid login credentials")
    || normalized.includes("invalid credentials")
    || normalized.includes("invalid password")
  ) {
    return "Wrong password or account not found in this Supabase project. Supabase intentionally returns the same response for both; confirm the email and project, or use Forgot Password to reset the password.";
  }
  if (
    normalized.includes("unsupported phone provider")
    || normalized.includes("phone provider is not enabled")
    || normalized.includes("sms provider")
  ) {
    return "Phone login unavailable in this deployment.";
  }
  if (normalized.includes("column") && normalized.includes("owner_user_id")) {
    return "Business ownership migration is not fully applied. Ask a Supabase administrator to apply the latest ownership migrations.";
  }
  if (
    normalized.includes("business ownership")
    || normalized.includes("no business assigned")
    || normalized.includes("owner_user_id")
    || normalized.includes("not owned by the signed-in user")
  ) {
    return "No business is linked to this account yet. Create your first store or contact a pilot administrator to repair ownership.";
  }
  return message || "The request could not be completed.";
}

export function isPhoneProviderUnavailable(error: unknown): boolean {
  const candidate = error as { message?: unknown; code?: unknown } | null;
  const message = typeof candidate?.message === "string"
    ? candidate.message.toLocaleLowerCase()
    : "";
  const code = typeof candidate?.code === "string"
    ? candidate.code.toLocaleLowerCase()
    : "";
  return code.includes("unsupported_phone_provider")
    || message.includes("unsupported phone provider")
    || message.includes("phone provider is not enabled")
    || message.includes("sms provider");
}

const PHONE_OTP_DISABLED_KEY = "bharat-bazaar-phone-otp-disabled";

export function isPhoneOtpEnabled(): boolean {
  if (import.meta.env.VITE_ENABLE_PHONE_OTP !== "true") return false;
  return typeof window === "undefined"
    || window.sessionStorage.getItem(PHONE_OTP_DISABLED_KEY) !== "true";
}

export function disablePhoneOtpForSession(): void {
  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(PHONE_OTP_DISABLED_KEY, "true");
  }
}
