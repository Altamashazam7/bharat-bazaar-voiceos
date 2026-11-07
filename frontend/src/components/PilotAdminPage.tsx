import { useEffect, useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";

import { supabase } from "../lib/supabase";
import { authErrorMessage } from "../services/authMessages";
import { createBusiness } from "../services/businessService";
import {
  assignBusinessOwnership,
  getUnassignedBusinesses,
  hasPilotAdminAccess,
  type UnassignedBusiness,
} from "../services/pilotAdminService";
import type { Business } from "../types/business";
import { ErrorBanner, PageTitle, Panel } from "./VoiceDashboard";

export function PilotAdminPage({
  onAssigned,
}: {
  onAssigned: (business: Business) => void;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [businesses, setBusinesses] = useState<UnassignedBusiness[]>([]);
  const [ownerUserId, setOwnerUserId] = useState("");
  const [storeName, setStoreName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function loadBusinesses() {
    const unassigned = await getUnassignedBusinesses();
    setBusinesses(unassigned);
  }

  useEffect(() => {
    let active = true;

    async function initialize() {
      try {
        const { data, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (!active) return;
        setUser(data.user);
        const admin = hasPilotAdminAccess(data.user);
        setIsAdmin(admin);
        if (!admin) return;
        setOwnerUserId(data.user.id);
        await loadBusinesses();
      } catch (loadError: unknown) {
        if (active) setError(authErrorMessage(loadError));
      }
    }

    void initialize();
    return () => {
      active = false;
    };
  }, []);

  async function assignOwner(business: UnassignedBusiness, targetUserId: string) {
    const verifiedOwnerId = targetUserId.trim();
    if (!window.confirm(`Confirm that ${business.name} belongs to Auth user ${verifiedOwnerId}?`)) {
      return;
    }

    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const updatedBusiness = await assignBusinessOwnership(business.id, verifiedOwnerId);
      await loadBusinesses();
      setNotice(`${business.name} ownership was assigned.`);
      if (updatedBusiness.owner_user_id === user?.id) onAssigned(updatedBusiness);
    } catch (assignmentError: unknown) {
      setError(authErrorMessage(assignmentError));
    } finally {
      setBusy(false);
    }
  }

  async function createDemoBusiness(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const business = await createBusiness({
        name: storeName.trim(),
        owner_name: ownerName.trim(),
        phone: phone.trim(),
      });
      setStoreName("");
      setOwnerName("");
      setPhone("");
      setNotice(`${business.name} was created for the signed-in pilot administrator.`);
      onAssigned(business);
    } catch (createError: unknown) {
      setError(authErrorMessage(createError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageTitle page="pilot-admin" />
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
      {notice && <p className="business-login-notice" role="status">{notice}</p>}
      {isAdmin === false ? (
        <Panel eyebrow="RESTRICTED ACCESS" title="Pilot Admin">
          <p className="business-login-description">
            This screen is available only to accounts designated as pilot administrators.
          </p>
        </Panel>
      ) : (
        <>
          <Panel eyebrow="OWNERSHIP REPAIR" title="Unassigned businesses">
            <p className="business-login-description">
              Verify the business owner before assigning it. The selected owner must already have an account.
            </p>
            <label className="pilot-admin-owner">
              Auth user ID for assignment
              <input
                autoComplete="off"
                onChange={(event) => setOwnerUserId(event.target.value)}
                placeholder={user?.id ?? "Supabase Auth user UUID"}
                value={ownerUserId}
              />
            </label>
            {businesses.length ? (
              <div className="pilot-admin-list">
                {businesses.map((business) => (
                  <article className="pilot-admin-business" key={business.id}>
                    <div>
                      <strong>{business.name}</strong>
                      <span>{business.owner_name} · {business.phone}</span>
                      <small>{business.id}</small>
                    </div>
                    <div className="pilot-admin-actions">
                      <button
                        className="button button-secondary"
                        disabled={busy || !ownerUserId.trim()}
                        onClick={() => void assignOwner(business, ownerUserId)}
                        type="button"
                      >
                        Assign to selected user
                      </button>
                      {user && ownerUserId !== user.id && (
                        <button
                          className="text-button"
                          disabled={busy}
                          onClick={() => void assignOwner(business, user.id)}
                          type="button"
                        >
                          Assign to me
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="business-login-description">
                {isAdmin === null ? "Checking administrator access…" : "There are no unassigned businesses to repair."}
              </p>
            )}
          </Panel>
          <Panel eyebrow="PILOT SETUP" title="Create a demo business">
            <form className="store-registration-form" onSubmit={(event) => void createDemoBusiness(event)}>
              <label>
                Store name
                <input maxLength={120} minLength={2} onChange={(event) => setStoreName(event.target.value)} required value={storeName} />
              </label>
              <label>
                Owner name
                <input maxLength={120} minLength={2} onChange={(event) => setOwnerName(event.target.value)} required value={ownerName} />
              </label>
              <label>
                Phone number
                <input autoComplete="tel" maxLength={20} onChange={(event) => setPhone(event.target.value)} required type="tel" value={phone} />
              </label>
              <button className="button button-primary" disabled={busy} type="submit">
                {busy ? "Please wait…" : "Create demo business"}
              </button>
            </form>
          </Panel>
        </>
      )}
    </>
  );
}
