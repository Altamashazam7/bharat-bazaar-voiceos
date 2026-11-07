import { supabase } from "../lib/supabase";
import { getCurrentBusiness } from "./businessService";
import type { Customer, CustomerInput } from "../types/business";

export async function getCustomers(search = ""): Promise<Customer[]> {
  const business = await getCurrentBusiness();
  const normalizedSearch = search.trim();

  if (!normalizedSearch) {
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .eq("business_id", business.id)
      .order("name", { ascending: true });
    if (error) throw error;
    return data as Customer[];
  }

  const pattern = `%${normalizedSearch}%`;
  const [nameResult, phoneResult] = await Promise.all([
    supabase
      .from("customers")
      .select("*")
      .eq("business_id", business.id)
      .ilike("name", pattern),
    supabase
      .from("customers")
      .select("*")
      .eq("business_id", business.id)
      .ilike("phone", pattern),
  ]);
  if (nameResult.error) throw nameResult.error;
  if (phoneResult.error) throw phoneResult.error;

  const customers = new Map<string, Customer>();
  for (const customer of [...nameResult.data, ...phoneResult.data] as Customer[]) {
    customers.set(customer.id, customer);
  }
  return [...customers.values()].sort((left, right) => left.name.localeCompare(right.name));
}

export async function createCustomer(input: CustomerInput): Promise<Customer> {
  const business = await getCurrentBusiness();
  const { data, error } = await supabase
    .from("customers")
    .insert({ ...input, business_id: business.id })
    .select("*")
    .single();
  if (error) throw error;
  return data as Customer;
}

export async function updateCustomer(
  customerId: string,
  changes: Partial<CustomerInput>,
): Promise<Customer> {
  const business = await getCurrentBusiness();
  const { data, error } = await supabase
    .from("customers")
    .update(changes)
    .eq("id", customerId)
    .eq("business_id", business.id)
    .select("*")
    .single();
  if (error) throw error;
  return data as Customer;
}

export async function deleteCustomer(customerId: string): Promise<void> {
  const business = await getCurrentBusiness();
  const { error } = await supabase
    .from("customers")
    .delete()
    .eq("id", customerId)
    .eq("business_id", business.id);
  if (error) throw error;
}
