import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@supabase/supabase-js";

const rpc = vi.hoisted(() => vi.fn());

vi.mock("../lib/supabase", () => ({
  supabase: { rpc },
}));

import {
  assignBusinessOwnership,
  getUnassignedBusinesses,
  hasPilotAdminAccess,
} from "./pilotAdminService";

const business = {
  id: "business-1",
  owner_user_id: "auth-user-1",
  name: "Pilot store",
  owner_name: "Store owner",
  phone: "+919876543210",
  created_at: "2026-11-07T00:00:00Z",
};

describe("pilotAdminService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("recognizes only server-managed pilot administrator metadata", () => {
    expect(hasPilotAdminAccess({
      app_metadata: { pilot_admin: true },
    } as User)).toBe(true);
    expect(hasPilotAdminAccess({
      app_metadata: { pilot_admin: "true" },
    } as User)).toBe(false);
    expect(hasPilotAdminAccess(null)).toBe(false);
  });

  it("lists unassigned businesses through the protected admin RPC", async () => {
    const unassigned = [{ ...business, owner_user_id: undefined }];
    rpc.mockResolvedValue({ data: unassigned, error: null });

    await expect(getUnassignedBusinesses()).resolves.toEqual(unassigned);
    expect(rpc).toHaveBeenCalledWith("pilot_admin_list_unassigned_businesses");
  });

  it("assigns ownership through the protected RPC and accepts a returned row", async () => {
    rpc.mockResolvedValue({ data: [business], error: null });

    await expect(assignBusinessOwnership("business-1", "auth-user-1"))
      .resolves.toEqual(business);
    expect(rpc).toHaveBeenCalledWith("pilot_admin_assign_business", {
      p_business_id: "business-1",
      p_owner_user_id: "auth-user-1",
    });
  });

  it("reports missing ownership repair results instead of returning a fake success", async () => {
    rpc.mockResolvedValue({ data: null, error: null });

    await expect(assignBusinessOwnership("business-1", "auth-user-1"))
      .rejects.toThrow("The ownership repair did not return the updated business.");
  });
});
