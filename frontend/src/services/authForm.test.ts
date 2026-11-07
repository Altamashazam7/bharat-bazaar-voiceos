import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getPasswordStrength,
  getRememberedEmail,
  isValidEmailAddress,
  rememberEmail,
} from "./authForm";

describe("auth form helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("normalizes and validates email addresses", () => {
    expect(isValidEmailAddress("  Retailer@Example.COM ")).toBe(true);
    expect(isValidEmailAddress("not-an-email")).toBe(false);
    expect(isValidEmailAddress("retailer@example")).toBe(false);
    expect(isValidEmailAddress("retailer @example.com")).toBe(false);
  });

  it("reports password strength based on length and character variety", () => {
    expect(getPasswordStrength("short").label).toBe("weak");
    expect(getPasswordStrength("longpassword").label).toBe("fair");
    expect(getPasswordStrength("Longword1").label).toBe("good");
    expect(getPasswordStrength("Longword1!").label).toBe("strong");
  });

  it("remembers only the normalized email and clears it when opted out", () => {
    let value: string | null = null;
    vi.stubGlobal("window", {
      localStorage: {
        getItem: vi.fn(() => value),
        removeItem: vi.fn(() => {
          value = null;
        }),
        setItem: vi.fn((_key: string, nextValue: string) => {
          value = nextValue;
        }),
      },
    });

    rememberEmail(" Retailer@Example.COM ", true);
    expect(getRememberedEmail()).toBe("retailer@example.com");
    rememberEmail("", false);
    expect(getRememberedEmail()).toBe("");
  });
});
