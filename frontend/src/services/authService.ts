import type { Session } from "@supabase/supabase-js";

import { supabase } from "../lib/supabase";
import { authFailureDetails, logAuthEvent } from "./authDiagnostics";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function signUpWithEmail(
  email: string,
  password: string,
): Promise<{ confirmationRequired: boolean }> {
  try {
    const { data, error } = await supabase.auth.signUp({
      email: normalizeEmail(email),
      password,
    });
    if (error) throw error;
    const confirmationRequired = !data.session;
    logAuthEvent("email-sign-up", "success", {
      hasSession: Boolean(data.session),
      confirmationRequired,
    });
    return { confirmationRequired };
  } catch (error: unknown) {
    logAuthEvent("email-sign-up", "failure", authFailureDetails(error));
    throw error;
  }
}

export async function signInWithEmail(
  email: string,
  password: string,
): Promise<{ session: Session }> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizeEmail(email),
      password,
    });
    logAuthEvent("signInWithPassword-response", error ? "failure" : "success", {
      hasSession: Boolean(data.session),
      userId: data.user?.id ?? data.session?.user.id ?? null,
      ...authFailureDetails(error),
    });
    if (error) throw error;
    if (!data.session) {
      throw new Error("Supabase did not return an active session after sign-in.");
    }

    const session = await restoreAuthSession();
    if (!session) {
      throw new Error("Sign-in succeeded, but the session could not be restored.");
    }
    return { session };
  } catch (error: unknown) {
    logAuthEvent("email-sign-in-request", "failure", authFailureDetails(error));
    throw error;
  }
}

export async function restoreAuthSession(): Promise<Session | null> {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    logAuthEvent("session-restoration", "success", {
      hasSession: Boolean(data.session),
      hasUser: Boolean(data.session?.user),
      userId: data.session?.user.id ?? null,
    });
    return data.session;
  } catch (error: unknown) {
    logAuthEvent("session-restoration", "failure", authFailureDetails(error));
    throw error;
  }
}

export async function requestPhoneOtp(phone: string): Promise<void> {
  try {
    const { error } = await supabase.auth.signInWithOtp({
      phone,
      options: { shouldCreateUser: false },
    });
    if (error) throw error;
    logAuthEvent("phone-otp-request", "success");
  } catch (error: unknown) {
    logAuthEvent("phone-otp-request", "failure", authFailureDetails(error));
    throw error;
  }
}

export async function verifyPhoneOtp(phone: string, token: string): Promise<void> {
  try {
    const { error } = await supabase.auth.verifyOtp({
      phone,
      token,
      type: "sms",
    });
    if (error) throw error;
    logAuthEvent("phone-otp-verify", "success");
  } catch (error: unknown) {
    logAuthEvent("phone-otp-verify", "failure", authFailureDetails(error));
    throw error;
  }
}
