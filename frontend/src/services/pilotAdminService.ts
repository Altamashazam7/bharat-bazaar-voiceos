import type { User } from "@supabase/supabase-js";

import { supabase } from "../lib/supabase";
import type { Business } from "../types/business";

export interface UnassignedBusiness {
  id: string;
  name: string;
  owner_name: string;
  phone: string;
  created_at: string;
}

export function hasPilotAdminAccess(user: User | null): boolean {
  return user?.app_metadata.pilot_admin === true;
}

export async function getUnassignedBusinesses(): Promise<UnassignedBusiness[]> {
  const { data, error } = await supabase.rpc("pilot_admin_list_unassigned_businesses");
  if (error) throw error;
  return (data ?? []) as UnassignedBusiness[];
}

export async function assignBusinessOwnership(
  businessId: string,
  ownerUserId: string,
): Promise<Business> {
  const { data, error } = await supabase.rpc("pilot_admin_assign_business", {
    p_business_id: businessId,
    p_owner_user_id: ownerUserId,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") {
    throw new Error("The ownership repair did not return the updated business.");
  }
  return row as Business;
}
