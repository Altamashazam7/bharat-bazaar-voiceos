import { useState, type FormEvent } from "react";

import { createBusiness } from "../services/businessService";
import type { Business } from "../types/business";
import { ErrorBanner, PageTitle, Panel } from "./VoiceDashboard";

export function StoreRegistrationPage({
  onCreated,
}: {
  onCreated: (business: Business) => void;
}) {
  const [storeName, setStoreName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const name = storeName.trim();
    const owner = ownerName.trim();
    const normalizedPhone = phone.trim();
    const phoneDigits = normalizedPhone.replace(/\D/g, "");

    if (name.length < 2) {
      setError("Store name must be at least 2 characters.");
      return;
    }
    if (owner.length < 2) {
      setError("Owner name must be at least 2 characters.");
      return;
    }
    if (!/^\+?[0-9\s()-]{7,20}$/.test(normalizedPhone) || phoneDigits.length < 7 || phoneDigits.length > 15) {
      setError("Enter a valid phone number with 7 to 15 digits.");
      return;
    }

    setBusy(true);
    try {
      const business = await createBusiness({
        name,
        owner_name: owner,
        phone: normalizedPhone,
      });
      onCreated(business);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "The store could not be created.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageTitle page="store-registration" />
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}
      <Panel eyebrow="STORE DETAILS" title="New store">
        <p className="business-login-description">
          This store will be owned by your signed-in account. Existing stores with unassigned ownership must be verified and backfilled by an administrator before they appear here.
        </p>
        <form className="store-registration-form" onSubmit={submit}>
          <label>
            Store name
            <input
              autoComplete="organization"
              maxLength={120}
              minLength={2}
              onChange={(event) => setStoreName(event.target.value)}
              required
              value={storeName}
            />
          </label>
          <label>
            Owner name
            <input
              autoComplete="name"
              maxLength={120}
              minLength={2}
              onChange={(event) => setOwnerName(event.target.value)}
              required
              value={ownerName}
            />
          </label>
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
          <button className="button button-primary" disabled={busy} type="submit">
            {busy ? "Creating store…" : "Create store"}
          </button>
        </form>
      </Panel>
    </>
  );
}