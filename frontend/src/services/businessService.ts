import { supabase } from "../lib/supabase";
import type { Business, BusinessInput } from "../types/business";

const ACTIVE_BUSINESS_KEY = "bharat-bazaar-active-business-id";

export function getStoredBusinessId(): string | null {
  return typeof window === "undefined"
    ? null
    : window.localStorage.getItem(ACTIVE_BUSINESS_KEY);
}

export function clearStoredBusinessId(): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(ACTIVE_BUSINESS_KEY);
  }
}

export async function getBusinesses(): Promise<Business[]> {
  const userId = await requireAuthenticatedUserId();
  const { data, error } = await supabase
    .from("businesses")
    .select("*")
    .eq("owner_user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data as Business[];
}

async function requireAuthenticatedUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error("Sign in before accessing a business.");
  return data.user.id;
}

export async function getOwnedBusiness(businessId: string): Promise<Business> {
  const userId = await requireAuthenticatedUserId();
  const { data, error } = await supabase
    .from("businesses")
    .select("*")
    .eq("id", businessId)
    .eq("owner_user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("This business is not owned by the signed-in user.");
  return data as Business;
}

export function normalizeBusinessPhone(phone: string): string {
  const trimmedPhone = phone.trim();
  const digits = trimmedPhone.replace(/\D/g, "");

  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) {
    return `+91${digits.slice(1)}`;
  }
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  if (trimmedPhone.startsWith("+") && digits.length >= 7 && digits.length <= 15) {
    return `+${digits}`;
  }

  throw new Error("Enter a 10-digit Indian number or an international number with country code.");
}

export async function getBusinessByPhone(phone: string): Promise<Business | null> {
  const normalizedPhone = normalizeBusinessPhone(phone);
  const businesses = await getBusinesses();
  return businesses.find((business) => {
    try {
      return normalizeBusinessPhone(business.phone) === normalizedPhone;
    } catch {
      return false;
    }
  }) ?? null;
}

export async function getCurrentBusiness(): Promise<Business> {
  const businesses = await getBusinesses();
  const activeId = getStoredBusinessId();
  if (activeId) {
    const business = businesses.find((candidate) => candidate.id === activeId);
    if (business) {
      console.debug("[tenant] active business_id=%s", business.id);
      return business;
    }
    clearStoredBusinessId();
  }

  if (!businesses.length) {
    throw new Error(
      "No business ownership is linked to this account. Create your first store, or ask an administrator to verify and backfill the existing store owner.",
    );
  }

  const currentBusiness = businesses[0];
  if (typeof window !== "undefined") {
    window.localStorage.setItem(ACTIVE_BUSINESS_KEY, currentBusiness.id);
  }
  console.debug("[tenant] active business_id=%s", currentBusiness.id);
  return currentBusiness;
}

export function setCurrentBusiness(businessId: string): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(ACTIVE_BUSINESS_KEY, businessId);
  }
  console.debug("[tenant] active business_id=%s", businessId);
}

export async function createBusiness(input: BusinessInput): Promise<Business> {
  const userId = await requireAuthenticatedUserId();
  const { data, error } = await supabase
    .from("businesses")
    .insert({ ...input, owner_user_id: userId })
    .select("*")
    .single();
  if (error) throw error;
  const business = data as Business;
  if (business.owner_user_id !== userId) {
    throw new Error("Business ownership was not saved for the signed-in user.");
  }
  setCurrentBusiness(business.id);
  return business;
}

export async function updateBusiness(
  businessId: string,
  changes: Partial<BusinessInput>,
): Promise<Business> {
  await getOwnedBusiness(businessId);
  const { data, error } = await supabase
    .from("businesses")
    .update(changes)
    .eq("id", businessId)
    .eq("owner_user_id", await requireAuthenticatedUserId())
    .select("*")
    .single();
  if (error) throw error;
  return data as Business;
}

export async function deleteBusiness(businessId: string): Promise<void> {
  await getOwnedBusiness(businessId);
  const { error } = await supabase
    .from("businesses")
    .delete()
    .eq("id", businessId)
    .eq("owner_user_id", await requireAuthenticatedUserId());
  if (error) throw error;
  if (getStoredBusinessId() === businessId) clearStoredBusinessId();
}