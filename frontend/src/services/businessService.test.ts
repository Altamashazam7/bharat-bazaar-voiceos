import { beforeEach, describe, expect, it, vi } from "vitest";

const { from, query, getUser } = vi.hoisted(() => {
  const query = {
    eq: vi.fn(),
    insert: vi.fn(),
    maybeSingle: vi.fn(),
    order: vi.fn(),
    select: vi.fn(),
    single: vi.fn(),
    update: vi.fn(),
  };
  return {
    from: vi.fn(),
    getUser: vi.fn(),
    query,
  };
});

vi.mock("../lib/supabase", () => ({
  supabase: {
    auth: { getUser },
    from,
  },
}));

import {
  createBusiness,
  getBusinesses,
  getCurrentBusiness,
  getOwnedBusiness,
  getStoredBusinessId,
  updateBusiness,
} from "./businessService";

const userId = "auth-user-1";
const ownedBusiness = {
  id: "business-1",
  owner_user_id: userId,
  name: "Owned store",
  owner_name: "Store owner",
  phone: "+919876543210",
  created_at: "2026-11-07T00:00:00Z",
};

function installLocalStorage(initialValue: string | null = null) {
  let storedValue = initialValue;
  vi.stubGlobal("window", {
    localStorage: {
      getItem: vi.fn(() => storedValue),
      removeItem: vi.fn(() => {
        storedValue = null;
      }),
      setItem: vi.fn((_key: string, value: string) => {
        storedValue = value;
      }),
    },
  });
}

describe("businessService ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
    from.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.insert.mockReturnValue(query);
    query.select.mockReturnValue(query);
    query.update.mockReturnValue(query);
  });

  it("lists only businesses owned by the authenticated user", async () => {
    query.order.mockResolvedValue({ data: [ownedBusiness], error: null });

    await expect(getBusinesses()).resolves.toEqual([ownedBusiness]);

    expect(from).toHaveBeenCalledWith("businesses");
    expect(query.eq).toHaveBeenCalledWith("owner_user_id", userId);
  });

  it("isolates business lists for two authenticated users and omits null owners", async () => {
    const userB = "auth-user-2";
    const businessB = { ...ownedBusiness, id: "business-2", owner_user_id: userB };
    const unassignedBusiness = {
      ...ownedBusiness,
      id: "business-unassigned",
      owner_user_id: null,
    };
    let activeUserId = userId;
    getUser.mockImplementation(async () => ({
      data: { user: { id: activeUserId } },
      error: null,
    }));
    query.order.mockImplementation(async () => ({
      data: [ownedBusiness, businessB, unassignedBusiness].filter(
        (business) => business.owner_user_id === activeUserId,
      ),
      error: null,
    }));

    await expect(getBusinesses()).resolves.toEqual([ownedBusiness]);
    activeUserId = userB;
    await expect(getBusinesses()).resolves.toEqual([businessB]);
  });

  it("creates a business with the authenticated user as owner", async () => {
    installLocalStorage();
    query.single.mockResolvedValue({ data: ownedBusiness, error: null });

    await createBusiness({
      name: ownedBusiness.name,
      owner_name: ownedBusiness.owner_name,
      phone: ownedBusiness.phone,
    });

    expect(query.insert).toHaveBeenCalledWith({
      name: ownedBusiness.name,
      owner_name: ownedBusiness.owner_name,
      phone: ownedBusiness.phone,
      owner_user_id: userId,
    });
    expect(window.localStorage.setItem).toHaveBeenCalledWith(
      "bharat-bazaar-active-business-id",
      ownedBusiness.id,
    );
  });

  it("fails explicitly if the database response does not confirm the requested owner", async () => {
    query.single.mockResolvedValue({
      data: { ...ownedBusiness, owner_user_id: "auth-user-other" },
      error: null,
    });

    await expect(createBusiness({
      name: ownedBusiness.name,
      owner_name: ownedBusiness.owner_name,
      phone: ownedBusiness.phone,
    })).rejects.toThrow("Business ownership was not saved for the signed-in user.");
  });

  it("rejects access to a business owned by another user", async () => {
    query.maybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(getOwnedBusiness("business-other"))
      .rejects.toThrow("This business is not owned by the signed-in user.");

    expect(query.eq).toHaveBeenNthCalledWith(1, "id", "business-other");
    expect(query.eq).toHaveBeenNthCalledWith(2, "owner_user_id", userId);
  });

  it("updates store profile fields only after validating ownership", async () => {
    const updatedBusiness = { ...ownedBusiness, name: "Updated store" };
    query.maybeSingle.mockResolvedValue({ data: ownedBusiness, error: null });
    query.single.mockResolvedValue({ data: updatedBusiness, error: null });

    await expect(updateBusiness(ownedBusiness.id, { name: "Updated store" }))
      .resolves.toEqual(updatedBusiness);

    expect(query.update).toHaveBeenCalledWith({ name: "Updated store" });
    expect(query.eq).toHaveBeenNthCalledWith(1, "id", ownedBusiness.id);
    expect(query.eq).toHaveBeenNthCalledWith(2, "owner_user_id", userId);
    expect(query.eq).toHaveBeenNthCalledWith(3, "id", ownedBusiness.id);
    expect(query.eq).toHaveBeenNthCalledWith(4, "owner_user_id", userId);
  });

  it("replaces a stored business ID that is not in the signed-in user's owned list", async () => {
    installLocalStorage("business-other");
    query.order.mockResolvedValue({ data: [ownedBusiness], error: null });

    await expect(getCurrentBusiness()).resolves.toEqual(ownedBusiness);

    expect(getStoredBusinessId()).toBe(ownedBusiness.id);
    expect(window.localStorage.removeItem).toHaveBeenCalledWith(
      "bharat-bazaar-active-business-id",
    );
    expect(window.localStorage.setItem).toHaveBeenCalledWith(
      "bharat-bazaar-active-business-id",
      ownedBusiness.id,
    );
  });

  it("requires an authenticated Supabase user", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });

    await expect(getBusinesses()).rejects.toThrow(
      "Sign in before accessing a business.",
    );
    expect(from).not.toHaveBeenCalled();
  });

  it("explains that empty ownership needs first-store setup or verified backfill", async () => {
    query.order.mockResolvedValue({ data: [], error: null });

    await expect(getCurrentBusiness()).rejects.toThrow(
      "No business ownership is linked to this account.",
    );
  });
});
