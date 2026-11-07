import { useState, type FormEvent } from "react";

import { supabase } from "../lib/supabase";
import {
  getBusinessByPhone,
  normalizeBusinessPhone,
  setCurrentBusiness,
} from "../services/businessService";
import type { Business } from "../types/business";
import { ErrorBanner, PageTitle, Panel } from "./VoiceDashboard";
import {
  authErrorMessage,
  disablePhoneOtpForSession,
  isPhoneOtpEnabled,
  isPhoneProviderUnavailable,
} from "../services/authMessages";
import { requestPhoneOtp, verifyPhoneOtp } from "../services/authService";

export function BusinessLoginPage({
  onLoggedIn,
  onEmailLogin,
}: {
  onLoggedIn: (business: Business) => void;
  onEmailLogin: () => void;
}) {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [phoneOtpAvailable, setPhoneOtpAvailable] = useState(isPhoneOtpEnabled);

  if (!phoneOtpAvailable) {
    return (
      <>
        <PageTitle page="business-login" />
        <Panel eyebrow="PHONE LOGIN UNAVAILABLE" title="Use email and password">
          <p className="business-login-description">
            Phone login unavailable in this deployment.
          </p>
          <button className="button button-primary" onClick={onEmailLogin} type="button">
            Go to email sign in
          </button>
        </Panel>
      </>
    );
  }

  async function sendOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    let normalizedPhone: string;
    try {
      normalizedPhone = normalizeBusinessPhone(phone);
    } catch (validationError: unknown) {
      setError(authErrorMessage(validationError));
      return;
    }

    setBusy(true);
    try {
      await requestPhoneOtp(normalizedPhone);
      setPhone(normalizedPhone);
      setOtpSent(true);
      setNotice("A verification code has been sent to your phone.");
    } catch (requestError: unknown) {
      if (isPhoneProviderUnavailable(requestError)) {
        disablePhoneOtpForSession();
        setPhoneOtpAvailable(false);
      }
      setError(authErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);

    try {
      await verifyPhoneOtp(normalizeBusinessPhone(phone), otp.trim());

      const business = await getBusinessByPhone(phone);
      if (!business) {
        const { error: signOutError } = await supabase.auth.signOut();
        if (signOutError) throw signOutError;
        throw new Error("No business ownership is linked to this verified phone account.");
      }

      setCurrentBusiness(business.id);
      onLoggedIn(business);
    } catch (verificationError: unknown) {
      if (isPhoneProviderUnavailable(verificationError)) {
        disablePhoneOtpForSession();
        setPhoneOtpAvailable(false);
      }
      setError(authErrorMessage(verificationError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageTitle page="business-login" />
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
      <Panel eyebrow="BUSINESS ACCOUNT" title={otpSent ? "Verify your phone" : "Log in to your business"}>
        {notice && <p className="business-login-notice" role="status">{notice}</p>}
        <form
          className="store-registration-form business-login-form"
          onSubmit={(event) => void (otpSent ? verifyOtp(event) : sendOtp(event))}
        >
          {!otpSent ? (
            <label>
              Phone number
              <input
                autoComplete="tel"
                inputMode="tel"
                maxLength={20}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+91 98765 43210"
                required
                type="tel"
                value={phone}
              />
            </label>
          ) : (
            <>
              <p className="business-login-description">Enter the verification code sent to {phone}.</p>
              <label>
                Verification code
                <input
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  maxLength={10}
                  onChange={(event) => setOtp(event.target.value)}
                  required
                  value={otp}
                />
              </label>
            </>
          )}
          <button className="button button-primary" disabled={busy} type="submit">
            {busy
              ? "Please wait…"
              : otpSent
                ? "Verify and log in"
                : "Send verification code"}
          </button>
        </form>
        {otpSent && (
          <button
            className="business-login-change"
            disabled={busy}
            onClick={() => {
              setOtpSent(false);
              setOtp("");
              setNotice(null);
              setError(null);
            }}
            type="button"
          >
            Use a different phone number
          </button>
        )}
      </Panel>
    </>
  );
}
