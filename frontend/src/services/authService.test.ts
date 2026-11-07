import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  getSession: vi.fn(),
  signInWithOtp: vi.fn(),
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  verifyOtp: vi.fn(),
}));

vi.mock("../lib/supabase", () => ({
  supabase: { auth },
}));

import {
  requestPhoneOtp,
  restoreAuthSession,
  signInWithEmail,
  signUpWithEmail,
  verifyPhoneOtp,
} from "./authService";

describe("authService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
  });

  it("normalizes email during signup and reports confirmation flow", async () => {
    auth.signUp.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    await expect(signUpWithEmail("  Retailer@Example.COM ", "password123"))
      .resolves.toEqual({ confirmationRequired: true });

    expect(auth.signUp).toHaveBeenCalledWith({
      email: "retailer@example.com",
      password: "password123",
    });
  });

  it("normalizes email on password login and returns the restored session", async () => {
    const user = { id: "auth-user-1", email: "retailer@example.com" };
    const session = { access_token: "test-token", user };
    auth.signInWithPassword.mockResolvedValue({
      data: { session, user },
      error: null,
    });
    auth.getSession.mockResolvedValue({
      data: { session },
      error: null,
    });

    await expect(signInWithEmail(" Retailer@Example.COM ", "password123"))
      .resolves.toEqual({ session });

    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: "retailer@example.com",
      password: "password123",
    });
  });

  it("logs the sanitized password-login response without logging credentials", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const user = { id: "auth-user-1", email: "retailer@example.com" };
    auth.signInWithPassword.mockResolvedValue({
      data: { session: { access_token: "private-token", user }, user },
      error: null,
    });
    auth.getSession.mockResolvedValue({
      data: { session: { access_token: "private-token", user } },
      error: null,
    });

    await signInWithEmail("retailer@example.com", "private-password");

    expect(info).toHaveBeenCalledWith(
      "[auth]",
      expect.objectContaining({
        action: "signInWithPassword-response",
        outcome: "success",
        hasSession: true,
        userId: user.id,
      }),
    );
    expect(JSON.stringify(info.mock.calls)).not.toContain("private-password");
    expect(JSON.stringify(info.mock.calls)).not.toContain("private-token");
    info.mockRestore();
  });

  it("returns null when no previous session exists", async () => {
    auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    await expect(restoreAuthSession()).resolves.toBeNull();
  });

  it("rejects a login response when its session was not persisted", async () => {
    const user = { id: "auth-user-1", email: "retailer@example.com" };
    auth.signInWithPassword.mockResolvedValue({
      data: { session: { access_token: "test-token", user }, user },
      error: null,
    });

    await expect(signInWithEmail("retailer@example.com", "password123"))
      .rejects.toThrow("Sign-in succeeded, but the session could not be restored.");
  });

  it("does not allow phone OTP to create an unlinked auth user", async () => {
    auth.signInWithOtp.mockResolvedValue({ error: null });
    auth.verifyOtp.mockResolvedValue({ error: null });

    await requestPhoneOtp("+919876543210");
    await verifyPhoneOtp("+919876543210", "123456");

    expect(auth.signInWithOtp).toHaveBeenCalledWith({
      phone: "+919876543210",
      options: { shouldCreateUser: false },
    });
    expect(auth.verifyOtp).toHaveBeenCalledWith({
      phone: "+919876543210",
      token: "123456",
      type: "sms",
    });
  });

  it("logs and propagates an authentication failure", async () => {
    const authError = Object.assign(new Error("Invalid login credentials"), {
      code: "invalid_credentials",
      status: 400,
    });
    auth.signInWithPassword.mockResolvedValue({
      data: { session: null },
      error: authError,
    });

    await expect(signInWithEmail("retailer@example.com", "wrong"))
      .rejects.toBe(authError);
  });
});
