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
  const { data, error } = await supabase
    .from("businesses")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data as Business[];
}

export async function getCurrentBusiness(): Promise<Business> {
  const activeId = getStoredBusinessId();

  if (activeId) {
    const { data, error } = await supabase
      .from("businesses")
      .select("*")
      .eq("id", activeId)
      .maybeSingle();
    if (error) throw error;
    if (data) return data as Business;
    clearStoredBusinessId();
  }

  const businesses = await getBusinesses();
  if (!businesses.length) {
    throw new Error("Create a business before managing its products or orders.");
  }

  const currentBusiness = businesses[0];
  if (typeof window !== "undefined") {
    window.localStorage.setItem(ACTIVE_BUSINESS_KEY, currentBusiness.id);
  }
  return currentBusiness;
}

export function setCurrentBusiness(businessId: string): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(ACTIVE_BUSINESS_KEY, businessId);
  }
}

export async function createBusiness(input: BusinessInput): Promise<Business> {
  const { data, error } = await supabase
    .from("businesses")
    .insert(input)
    .select("*")
    .single();
  if (error) throw error;
  return data as Business;
}

export async function updateBusiness(
  businessId: string,
  changes: Partial<BusinessInput>,
): Promise<Business> {
  const { data, error } = await supabase
    .from("businesses")
    .update(changes)
    .eq("id", businessId)
    .select("*")
    .single();
  if (error) throw error;
  return data as Business;
}

export async function deleteBusiness(businessId: string): Promise<void> {
  const { error } = await supabase
    .from("businesses")
    .delete()
    .eq("id", businessId);
  if (error) throw error;
  if (getStoredBusinessId() === businessId) clearStoredBusinessId();
}