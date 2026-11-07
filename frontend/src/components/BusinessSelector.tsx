import { useEffect, useRef, useState, type FormEvent } from "react";

import { supabase } from "../lib/supabase";
import {
  clearStoredBusinessId,
  getBusinesses,
  getStoredBusinessId,
  setCurrentBusiness,
} from "../services/businessService";
import type { Business } from "../types/business";
import type { User } from "@supabase/supabase-js";
import {
  authErrorMessage,
  isPhoneOtpEnabled,
} from "../services/authMessages";
import {
  authFailureDetails,
  getAuthProjectHost,
  logAuthEvent,
  sendPasswordRecovery,
  updateRecoveredPassword,
} from "../services/authDiagnostics";
import {
  restoreAuthSession,
  signInWithEmail,
  signUpWithEmail,
} from "../services/authService";
import {
  getUnassignedBusinesses,
  hasPilotAdminAccess,
} from "../services/pilotAdminService";
import {
  DEMO_BUSINESS_NAME,
  findDemoBusiness,
  getDemoCredentials,
  isDemoMode,
} from "../services/demoMode";
import {
  getPasswordStrength,
  getRememberedEmail,
  isValidEmailAddress,
  rememberEmail,
} from "../services/authForm";

export function BusinessSelector({
  onBusinessChange,
  onLoadComplete,
  onBusinessLogin,
  onAuthSuccess,
  onNotice,
  onPilotAdmin,
  onCreateStore,
  businessListVersion,
}: {
  onBusinessChange: (businessId: string | null, businessName: string | null) => void;
  onLoadComplete: (loaded: boolean) => void;
  onBusinessLogin: () => void;
  onAuthSuccess: () => void;
  onNotice: (message: string) => void;
  onPilotAdmin: () => void;
  onCreateStore: () => void;
  businessListVersion: number;
}) {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loadedVersion, setLoadedVersion] = useState(-1);
  const [loadedUserId, setLoadedUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [sessionExists, setSessionExists] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState<"sign_in" | "sign_up">("sign_in");
  const [email, setEmail] = useState(getRememberedEmail);
  const [rememberMe, setRememberMe] = useState(() => Boolean(getRememberedEmail()));
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const phoneOtpAvailable = isPhoneOtpEnabled();
  const demoMode = isDemoMode();
  const [authBusy, setAuthBusy] = useState(false);
  const [resetPasswordMode, setResetPasswordMode] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const authEventRevision = useRef(0);
  const userId = user?.id ?? null;
  const pilotAdmin = hasPilotAdminAccess(user);
  const passwordStrength = getPasswordStrength(password);
  const loading = authLoading
    || loadedVersion !== businessListVersion
    || loadedUserId !== userId;

  useEffect(() => {
    let active = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!active) return;
        authEventRevision.current += 1;
        logAuthEvent("auth-state-change", "state", {
          event,
          hasSession: Boolean(session),
          hasUser: Boolean(session?.user),
          userId: session?.user.id ?? null,
        });
        setSessionExists(Boolean(session));
        setUser(session?.user ?? null);
        setAuthLoading(demoMode && event === "INITIAL_SESSION");
        setAuthMessage(null);
        if (event === "PASSWORD_RECOVERY") setResetPasswordMode(true);
        if (event === "SIGNED_IN" && session) onAuthSuccess();
        if (session && (event === "INITIAL_SESSION" || event === "SIGNED_IN")) {
          onLoadComplete(false);
        } else if (event === "INITIAL_SESSION" || event === "SIGNED_OUT") {
          clearStoredBusinessId();
          setBusinesses([]);
          setSelectedId("");
          setLoadedUserId(null);
          setError(null);
          onBusinessChange(null, null);
          onLoadComplete(true);
        }
      },
    );

    if (demoMode) {
      void (async () => {
        try {
          const credentials = getDemoCredentials();
          const { session } = await signInWithEmail(
            credentials.email,
            credentials.password,
          );
          if (!active) return;
          setError(null);
          setSessionExists(true);
          setUser(session.user);
          setAuthLoading(false);
          onAuthSuccess();
        } catch (demoError: unknown) {
          if (!active) return;
          setError(messageOf(demoError));
          setAuthLoading(false);
        }
      })();
    } else {
      const revisionAtRestoreStart = authEventRevision.current;
      void restoreAuthSession()
        .then((session) => {
          if (!active) return;
          if (authEventRevision.current !== revisionAtRestoreStart) return;
          setSessionExists(Boolean(session));
          setUser(session?.user ?? null);
          setAuthLoading(false);
        })
        .catch((sessionError: unknown) => {
          if (!active) return;
          setError(messageOf(sessionError));
          setAuthLoading(false);
        });
    }

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [demoMode, onAuthSuccess, onBusinessChange, onLoadComplete]);

  useEffect(() => {
    if (authLoading) return;
    let active = true;

    if (!userId) return;

    void getBusinesses()
      .then(async (loadedBusinesses) => {
        if (!active) return;
        logAuthEvent("owned-businesses-loaded", "success", {
          count: loadedBusinesses.length,
          hasUnassignedVisibleBusiness: false,
        });
        setError(null);
        setBusinesses(loadedBusinesses);

        const selectedBusiness = demoMode
          ? findDemoBusiness(loadedBusinesses)
          : loadedBusinesses.find(
              (business) => business.id === getStoredBusinessId(),
            ) ?? loadedBusinesses[0];

        if (selectedBusiness) {
          setCurrentBusiness(selectedBusiness.id);
          setSelectedId(selectedBusiness.id);
          onBusinessChange(selectedBusiness.id, selectedBusiness.name);
        } else if (demoMode) {
          setError(`The demo account does not own the required "${DEMO_BUSINESS_NAME}" business.`);
          clearStoredBusinessId();
          setSelectedId("");
          onBusinessChange(null, null);
        } else {
          clearStoredBusinessId();
          onBusinessChange(null, null);
          logAuthEvent("business-ownership-onboarding", "state", {
            userId,
            reason: "no-owned-business",
          });
          if (pilotAdmin) {
            const unassignedBusinesses = await getUnassignedBusinesses();
            if (active && unassignedBusinesses.length) {
              setAuthMessage("Unassigned businesses need an ownership repair before continuing.");
              onPilotAdmin();
              return;
            }
          }
          setAuthMessage("You’re signed in, but no business is assigned yet. Create your first store to continue.");
          onCreateStore();
        }
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        logAuthEvent("owned-businesses-loaded", "failure", authFailureDetails(loadError));
        setError(authErrorMessage(loadError));
        onBusinessChange(null, null);
      })
      .finally(() => {
        if (!active) return;
        setLoadedVersion(businessListVersion);
        setLoadedUserId(userId);
        onLoadComplete(true);
      });

    return () => {
      active = false;
    };
  }, [authLoading, businessListVersion, demoMode, onBusinessChange, onCreateStore, onLoadComplete, onPilotAdmin, pilotAdmin, userId]);

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setAuthMessage(null);
    if (!isValidEmailAddress(email)) {
      setError("Enter a valid email address, such as name@example.com.");
      return;
    }
    if (authMode === "sign_up" && password.length < 8) {
      setError("Choose a password with at least 8 characters.");
      return;
    }
    onLoadComplete(false);
    setAuthBusy(true);
    try {
      if (authMode === "sign_up") {
        const { confirmationRequired } = await signUpWithEmail(email, password);
        rememberEmail(email, rememberMe);
        setPassword("");
        if (confirmationRequired) {
          onLoadComplete(true);
          const confirmationMessage = "Account created. Check your inbox to verify your email, then sign in.";
          setAuthMode("sign_in");
          setAuthMessage(confirmationMessage);
          onNotice(confirmationMessage);
        } else {
          const session = await restoreAuthSession();
          if (!session) throw new Error("Sign-up succeeded, but the session could not be restored.");
          setSessionExists(true);
          setUser(session.user);
          setAuthLoading(false);
          onAuthSuccess();
          onNotice("Your account is ready. You’re signed in and can create your first store.");
        }
      } else {
        const { session } = await signInWithEmail(email, password);
        rememberEmail(email, rememberMe);
        setPassword("");
        setSessionExists(true);
        setUser(session.user);
        setAuthLoading(false);
        onAuthSuccess();
        onNotice("Welcome back. Your session is securely restored.");
      }
    } catch (authError: unknown) {
      onLoadComplete(true);
      setError(authErrorMessage(authError));
    } finally {
      setAuthBusy(false);
    }
  }

  async function requestPasswordReset() {
    setError(null);
    setAuthMessage(null);
    if (!isValidEmailAddress(email)) {
      setError(email.trim()
        ? "Enter a valid email address, such as name@example.com."
        : "Enter your account email first.");
      return;
    }
    setAuthBusy(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      await sendPasswordRecovery(normalizedEmail);
      logAuthEvent("password-recovery-request", "success");
      const recoveryMessage = "If an account exists for that email, a password reset link is on its way.";
      setAuthMessage(recoveryMessage);
      onNotice(recoveryMessage);
    } catch (recoveryError: unknown) {
      logAuthEvent("password-recovery-request", "failure", authFailureDetails(recoveryError));
      setError(authErrorMessage(recoveryError));
    } finally {
      setAuthBusy(false);
    }
  }

  async function saveRecoveredPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (newPassword.length < 8) {
      setError("Choose a password with at least 8 characters.");
      return;
    }
    setAuthBusy(true);
    try {
      await updateRecoveredPassword(newPassword);
      logAuthEvent("password-recovery-update", "success");
      setResetPasswordMode(false);
      setNewPassword("");
      const passwordMessage = "Password updated successfully.";
      setAuthMessage(passwordMessage);
      onNotice(passwordMessage);
    } catch (recoveryError: unknown) {
      logAuthEvent("password-recovery-update", "failure", authFailureDetails(recoveryError));
      setError(authErrorMessage(recoveryError));
    } finally {
      setAuthBusy(false);
    }
  }

  function startStoreRegistration() {
    onLoadComplete(false);
    onCreateStore();
  }

  function selectBusiness(businessId: string) {
    setCurrentBusiness(businessId);
    setSelectedId(businessId);
    onBusinessChange(
      businessId,
      businesses.find((business) => business.id === businessId)?.name ?? null,
    );
  }

  async function signOut() {
    setError(null);
    onLoadComplete(false);
    try {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
      logAuthEvent("sign-out", "success");
    } catch (signOutError: unknown) {
      logAuthEvent("sign-out", "failure", authFailureDetails(signOutError));
      onLoadComplete(true);
      setError(authErrorMessage(signOutError));
    }
  }

  if (authLoading) {
    return (
      <div className="business-selector">
        <span className="business-selector-label">{demoMode ? "DEMO RETAILER" : "RETAIL ACCOUNT"}</span>
        <span className="business-selector-status auth-loading-status" role="status">
          <span aria-hidden="true" className="spinner spinner-small" />
          {demoMode ? "Signing in to the demo account…" : "Checking sign-in…"}
        </span>
        {import.meta.env.DEV && (
          <AuthDebugPanel
            authStatus="checking-session"
            businessId={selectedId || getStoredBusinessId()}
            sessionExists={sessionExists}
            user={user}
          />
        )}
      </div>
    );
  }

  if (!user) {
    if (demoMode) {
      return (
        <div className="business-selector business-auth">
          <span className="business-selector-label">DEMO RETAILER</span>
          <span className="business-selector-status" role="alert">
            Demo sign-in is unavailable. Check the demo account configuration.
          </span>
          {error && <span className="business-selector-error" role="alert">{error}</span>}
          {import.meta.env.DEV && (
            <AuthDebugPanel
              authStatus="demo-sign-in-error"
              businessId={selectedId || getStoredBusinessId()}
              sessionExists={sessionExists}
              user={user}
            />
          )}
        </div>
      );
    }
    return (
      <div className="business-selector business-auth">
        <span className="business-selector-label">STEP 1 · ACCOUNT</span>
        <span className="business-selector-status">
          {authMode === "sign_up"
            ? "Create your account, then set up your first store."
            : "Sign in to continue to your store."}
        </span>
        <form
          aria-busy={authBusy}
          className="business-auth-form"
          noValidate
          onSubmit={(event) => void submitAuth(event)}
        >
          <input
            autoComplete="email"
            aria-label="Account email"
            disabled={authBusy}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email"
            required
            type="email"
            value={email}
          />
          <div className="auth-password-field">
            <input
              autoComplete={authMode === "sign_up" ? "new-password" : "current-password"}
              aria-label="Account password"
              disabled={authBusy}
              minLength={authMode === "sign_up" ? 8 : undefined}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              required
              type={passwordVisible ? "text" : "password"}
              value={password}
            />
            <button
              aria-label={passwordVisible ? "Hide password" : "Show password"}
              aria-pressed={passwordVisible}
              className="auth-password-toggle"
              disabled={authBusy}
              onClick={() => setPasswordVisible((visible) => !visible)}
              type="button"
            >
              {passwordVisible ? "Hide" : "Show"}
            </button>
          </div>
          {authMode === "sign_up" && password.length > 0 && (
            <div
              aria-label={`Password strength: ${passwordStrength.label}`}
              className={`password-strength strength-${passwordStrength.label}`}
              role="status"
            >
              <span className="password-strength-meter" aria-hidden="true">
                {Array.from({ length: 4 }, (_, index) => (
                  <i className={index < passwordStrength.score ? "is-filled" : ""} key={index} />
                ))}
              </span>
              <span>Password strength: {passwordStrength.label}</span>
            </div>
          )}
          <label className="auth-remember">
            <input
              checked={rememberMe}
              disabled={authBusy}
              onChange={(event) => {
                const checked = event.target.checked;
                setRememberMe(checked);
                if (!checked) rememberEmail("", false);
              }}
              type="checkbox"
            />
            <span>Remember my email on this device</span>
          </label>
          <button className="business-auth-submit" disabled={authBusy} type="submit">
            {authBusy && <span aria-hidden="true" className="spinner spinner-small" />}
            {authBusy ? "Signing you in…" : authMode === "sign_up" ? "Create account" : "Sign in"}
          </button>
        </form>
        {authMode === "sign_in" && (
          <button
            disabled={authBusy}
            className="business-selector-add"
            onClick={() => void requestPasswordReset()}
            type="button"
          >
            Forgot password?
          </button>
        )}
        <div className="business-auth-switch">
          <button
            aria-pressed={authMode === "sign_in"}
            className="business-selector-add"
            onClick={() => {
              setAuthMode("sign_in");
              setAuthMessage(null);
              setError(null);
            }}
            type="button"
          >
            Sign in
          </button>
          <button
            aria-pressed={authMode === "sign_up"}
            className="business-selector-add"
            onClick={() => {
              setAuthMode("sign_up");
              setAuthMessage(null);
              setError(null);
            }}
            type="button"
          >
            Sign up
          </button>
        </div>
        {authMessage && <span className="business-selector-status" role="status">{authMessage}</span>}
        {phoneOtpAvailable
          ? <button className="business-selector-add" onClick={onBusinessLogin} type="button">Phone OTP login</button>
          : <span className="business-selector-status">Phone login unavailable in this deployment.</span>}
        {error && <span className="business-selector-error" role="alert">{error}</span>}
        {import.meta.env.DEV && (
          <AuthDebugPanel
            authStatus={error ? "sign-in-error" : "signed-out"}
            businessId={selectedId || getStoredBusinessId()}
            sessionExists={sessionExists}
            user={user}
          />
        )}
      </div>
    );
  }

  return (
    <div className="business-selector">
      {resetPasswordMode ? (
        <form
          aria-busy={authBusy}
          className="business-auth-form"
          onSubmit={(event) => void saveRecoveredPassword(event)}
        >
          <span className="business-selector-label">RESET PASSWORD</span>
          <div className="auth-password-field">
            <input
              aria-label="New password"
              autoComplete="new-password"
              disabled={authBusy}
              minLength={8}
              onChange={(event) => setNewPassword(event.target.value)}
              required
              type={passwordVisible ? "text" : "password"}
              value={newPassword}
            />
            <button
              aria-label={passwordVisible ? "Hide password" : "Show password"}
              aria-pressed={passwordVisible}
              className="auth-password-toggle"
              disabled={authBusy}
              onClick={() => setPasswordVisible((visible) => !visible)}
              type="button"
            >
              {passwordVisible ? "Hide" : "Show"}
            </button>
          </div>
          <button className="business-auth-submit" disabled={authBusy} type="submit">
            {authBusy ? "Updating password…" : "Update password"}
          </button>
          {error && <span className="business-selector-error" role="alert">{error}</span>}
        </form>
      ) : (
      <>
      {authMessage && <span className="business-selector-status" role="status">{authMessage}</span>}
      <span className="business-selector-label">{demoMode ? "DEMO RETAILER" : "CURRENT STORE"}</span>
      {loading ? (
        <span className="business-selector-status auth-loading-status" role="status">
          <span aria-hidden="true" className="spinner spinner-small" />
          Loading your stores…
        </span>
      ) : error ? (
        <span className="business-selector-status" role="alert">Stores unavailable</span>
      ) : businesses.length ? (
        <select
          aria-label="Current business"
          onChange={(event) => selectBusiness(event.target.value)}
          value={selectedId}
        >
          {businesses.map((business) => (
            <option key={business.id} value={business.id}>{business.name}</option>
          ))}
        </select>
      ) : (
        <span className="business-selector-status">Create your first store.</span>
      )}
      <div className="business-selector-actions">
        <button className="business-selector-add" onClick={startStoreRegistration} type="button">
          {businesses.length ? "+ Add store" : "Create your first store"}
        </button>
        {!demoMode && phoneOtpAvailable && (
          <button className="business-selector-signout" onClick={onBusinessLogin} type="button">
            Phone login
          </button>
        )}
        {!demoMode && (
          <button className="business-selector-signout" onClick={() => void signOut()} type="button">
            Sign out
          </button>
        )}
      </div>
      {error && <span className="business-selector-error" role="alert">{error}</span>}
      {import.meta.env.DEV && (
        <AuthDebugPanel
          authStatus={loading
            ? "loading-businesses"
            : error
              ? "business-load-error"
              : selectedId
                ? "authenticated"
                : "authenticated-no-business"}
          businessId={selectedId || getStoredBusinessId()}
          sessionExists={sessionExists}
          user={user}
        />
      )}
      </>
      )}
    </div>
  );
}

function AuthDebugPanel({
  authStatus,
  businessId,
  sessionExists,
  user,
}: {
  authStatus: string;
  businessId: string | null;
  sessionExists: boolean;
  user: User | null;
}) {
  if (!import.meta.env.DEV) return null;

  return (
    <details className="auth-debug-panel">
      <summary>Auth debug</summary>
      <dl>
        <dt>Session exists</dt>
        <dd>{sessionExists ? "Yes" : "No"}</dd>
        <dt>User ID</dt>
        <dd>{user?.id ?? "—"}</dd>
        <dt>User email</dt>
        <dd>{user?.email ?? "—"}</dd>
        <dt>Auth status</dt>
        <dd>{authStatus}</dd>
        <dt>Supabase project</dt>
        <dd>{getAuthProjectHost()}</dd>
        <dt>Business ID</dt>
        <dd>{businessId ?? "—"}</dd>
      </dl>
    </details>
  );
}

function messageOf(error: unknown): string {
  return authErrorMessage(error);
}