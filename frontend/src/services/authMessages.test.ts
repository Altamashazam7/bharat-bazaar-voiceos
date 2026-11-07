import { afterEach, describe, expect, it, vi } from "vitest";

import {
  authErrorMessage,
  isPhoneOtpEnabled,
  isPhoneProviderUnavailable,
} from "./authMessages";

describe("authErrorMessage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("explains email rate limits and suggests configured SMTP", () => {
    expect(authErrorMessage(new Error("email rate limit exceeded"))).toContain(
      "temporarily rate-limited this authentication request",
    );
  });

  it("explains invalid credentials without leaking auth internals", () => {
    expect(authErrorMessage(new Error("Invalid login credentials"))).toBe(
      "Wrong password or account not found in this Supabase project. Supabase intentionally returns the same response for both; confirm the email and project, or use Forgot Password to reset the password.",
    );
  });

  it("explains when a specific Supabase response says the email is not confirmed", () => {
    expect(authErrorMessage({
      code: "email_not_confirmed",
      message: "Email not confirmed",
    })).toContain("Open the confirmation link");
  });

  it("explains an explicit account-not-found response", () => {
    expect(authErrorMessage({
      code: "user_not_found",
      message: "User not found",
    })).toContain("No account was found");
  });

  it("directs unsupported phone providers to email/password", () => {
    expect(authErrorMessage(new Error("Unsupported phone provider"))).toContain(
      "Phone login unavailable in this deployment.",
    );
    expect(isPhoneProviderUnavailable(new Error("Unsupported phone provider"))).toBe(true);
  });

  it("keeps phone login disabled for the browser session after provider rejection", () => {
    vi.stubGlobal("window", {
      sessionStorage: {
        getItem: () => "true",
      },
    });

    expect(isPhoneOtpEnabled()).toBe(false);
  });

  it("provides an administrator ownership recovery path", () => {
    expect(authErrorMessage(new Error("No business ownership linked"))).toContain(
      "pilot administrator to repair ownership",
    );
  });

  it("explains that the ownership schema migration is missing", () => {
    expect(authErrorMessage(new Error('column "owner_user_id" does not exist')))
      .toContain("apply the latest ownership migrations");
  });
});
