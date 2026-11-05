import { useEffect, useState } from "react";

import {
  clearStoredBusinessId,
  getBusinesses,
  getStoredBusinessId,
  setCurrentBusiness,
} from "../services/businessService";
import type { Business } from "../types/business";

export function BusinessSelector({
  onBusinessChange,
  onLoadComplete,
}: {
  onBusinessChange: (businessId: string | null) => void;
  onLoadComplete: (loaded: boolean) => void;
}) {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void getBusinesses()
      .then((loadedBusinesses) => {
        if (!active) return;
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
        }
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Businesses could not be loaded.");
        onBusinessChange(null);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
        onLoadComplete(true);
      });

    return () => {
      active = false;
    };
  }, [onBusinessChange, onLoadComplete]);

  function selectBusiness(businessId: string) {
    setCurrentBusiness(businessId);
    setSelectedId(businessId);
    onBusinessChange(businessId);
  }

  return (
    <div className="business-selector">
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
    </div>
  );
}