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

export function BusinessSelector({
  onBusinessChange,
  onLoadComplete,
  onBusinessLogin,
  onAuthSuccess,
  onPilotAdmin,
  onCreateStore,
  businessListVersion,
}: {
  onBusinessChange: (businessId: string | null) => void;
  onLoadComplete: (loaded: boolean) => void;
  onBusinessLogin: () => void;
  onAuthSuccess: () => void;
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const phoneOtpAvailable = isPhoneOtpEnabled();
  const [authBusy, setAuthBusy] = useState(false);
  const [resetPasswordMode, setResetPasswordMode] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const authEventRevision = useRef(0);
  const userId = user?.id ?? null;
  const pilotAdmin = hasPilotAdminAccess(user);
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
        setAuthLoading(false);
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
          onBusinessChange(null);
          onLoadComplete(true);
        }
      },
    );

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

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [onAuthSuccess, onBusinessChange, onLoadComplete]);

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

        const selectedBusiness = loadedBusinesses.find(
          (business) => business.id === getStoredBusinessId(),
        ) ?? loadedBusinesses[0];

        if (selectedBusiness) {
          setCurrentBusiness(selectedBusiness.id);
          setSelectedId(selectedBusiness.id);
          onBusinessChange(selectedBusiness.id);
        } else {
          clearStoredBusinessId();
          onBusinessChange(null);
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
        onBusinessChange(null);
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
  }, [authLoading, businessListVersion, onBusinessChange, onCreateStore, onLoadComplete, onPilotAdmin, pilotAdmin, userId]);

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setAuthMessage(null);
    onLoadComplete(false);
    setAuthBusy(true);
    try {
      if (authMode === "sign_up") {
        const { confirmationRequired } = await signUpWithEmail(email, password);
        if (confirmationRequired) {
          onLoadComplete(true);
          setAuthMessage("Check your email to confirm your account, then sign in.");
        } else {
          const session = await restoreAuthSession();
          if (!session) throw new Error("Sign-up succeeded, but the session could not be restored.");
          setSessionExists(true);
          setUser(session.user);
          setAuthLoading(false);
          onAuthSuccess();
        }
      } else {
        const { session } = await signInWithEmail(email, password);
        setSessionExists(true);
        setUser(session.user);
        setAuthLoading(false);
        onAuthSuccess();
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
    try {
      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail) {
        setError("Enter your account email first.");
        return;
      }
      await sendPasswordRecovery(normalizedEmail);
      logAuthEvent("password-recovery-request", "success");
      setAuthMessage("If an account exists for that email, Supabase will send a password recovery link.");
    } catch (recoveryError: unknown) {
      logAuthEvent("password-recovery-request", "failure", authFailureDetails(recoveryError));
      setError(authErrorMessage(recoveryError));
    }
  }

  async function saveRecoveredPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      await updateRecoveredPassword(newPassword);
      logAuthEvent("password-recovery-update", "success");
      setResetPasswordMode(false);
      setNewPassword("");
      setAuthMessage("Password updated. You can continue with your signed-in account.");
    } catch (recoveryError: unknown) {
      logAuthEvent("password-recovery-update", "failure", authFailureDetails(recoveryError));
      setError(authErrorMessage(recoveryError));
    }
  }

  function startStoreRegistration() {
    onLoadComplete(false);
    onCreateStore();
  }

  function selectBusiness(businessId: string) {
    setCurrentBusiness(businessId);
    setSelectedId(businessId);
    onBusinessChange(businessId);
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
        <span className="business-selector-label">RETAIL ACCOUNT</span>
        <span className="business-selector-status">Checking sign-in…</span>
        <AuthDebugPanel
          authStatus="checking-session"
          businessId={selectedId || getStoredBusinessId()}
          sessionExists={sessionExists}
          user={user}
        />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="business-selector business-auth">
        <span className="business-selector-label">STEP 1 · ACCOUNT</span>
        <span className="business-selector-status">
          {authMode === "sign_up"
            ? "Create your account, then set up your first store."
            : "Sign in to continue to your store."}
        </span>
        <form className="business-auth-form" onSubmit={(event) => void submitAuth(event)}>
          <input
            autoComplete="email"
            aria-label="Account email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email"
            required
            type="email"
            value={email}
          />
          <input
            autoComplete={authMode === "sign_up" ? "new-password" : "current-password"}
            aria-label="Account password"
            minLength={authMode === "sign_up" ? 8 : undefined}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
            required
            type="password"
            value={password}
          />
          <button className="business-auth-submit" disabled={authBusy} type="submit">
            {authBusy ? "Please wait…" : authMode === "sign_up" ? "Create account" : "Sign in"}
          </button>
        </form>
        {authMode === "sign_in" && (
          <button
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
        <AuthDebugPanel
          authStatus={error ? "sign-in-error" : "signed-out"}
          businessId={selectedId || getStoredBusinessId()}
          sessionExists={sessionExists}
          user={user}
        />
      </div>
    );
  }

  return (
    <div className="business-selector">
      {resetPasswordMode ? (
        <form className="business-auth-form" onSubmit={(event) => void saveRecoveredPassword(event)}>
          <span className="business-selector-label">RESET PASSWORD</span>
          <input
            aria-label="New password"
            autoComplete="new-password"
            minLength={8}
            onChange={(event) => setNewPassword(event.target.value)}
            required
            type="password"
            value={newPassword}
          />
          <button className="business-auth-submit" type="submit">Update password</button>
          {error && <span className="business-selector-error" role="alert">{error}</span>}
        </form>
      ) : (
      <>
      {authMessage && <span className="business-selector-status" role="status">{authMessage}</span>}
      <span className="business-selector-label">CURRENT STORE</span>
      {loading ? (
        <span className="business-selector-status">Loading stores…</span>
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
        {phoneOtpAvailable && (
          <button className="business-selector-signout" onClick={onBusinessLogin} type="button">
            Phone login
          </button>
        )}
        <button className="business-selector-signout" onClick={() => void signOut()} type="button">
          Sign out
        </button>
      </div>
      {error && <span className="business-selector-error" role="alert">{error}</span>}
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