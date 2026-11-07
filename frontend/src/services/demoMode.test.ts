import { describe, expect, it } from "vitest";

import { DEMO_BUSINESS_NAME, findDemoBusiness } from "./demoMode";
import type { Business } from "../types/business";

const business = (id: string, name: string): Business => ({
  id,
  owner_user_id: "demo-user",
  name,
  owner_name: "Demo Retailer",
  phone: "+919876543210",
  created_at: "2026-11-07T00:00:00Z",
});

describe("demoMode", () => {
  it("finds Sharma Kirana without depending on the name's casing or surrounding whitespace", () => {
    const sharmaKirana = business("sharma-store", `  ${DEMO_BUSINESS_NAME.toUpperCase()} `);
    expect(findDemoBusiness([business("other", "Other Store"), sharmaKirana]))
      .toEqual(sharmaKirana);
  });

  it("does not silently select a different store when Sharma Kirana is absent", () => {
    expect(findDemoBusiness([business("other", "Other Store")])).toBeNull();
  });
});
