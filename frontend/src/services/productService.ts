import { supabase } from "../lib/supabase";
import { getCurrentBusiness } from "./businessService";
import type { Product, ProductInput } from "../types/business";

export async function getProducts(): Promise<Product[]> {
  const business = await getCurrentBusiness();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("business_id", business.id)
    .order("name", { ascending: true });
  if (error) throw error;
  return data as Product[];
}

export async function createProduct(input: ProductInput): Promise<Product> {
  const business = await getCurrentBusiness();
  const { data, error } = await supabase
    .from("products")
    .insert({ ...input, business_id: business.id })
    .select("*")
    .single();
  if (error) throw error;
  return data as Product;
}

export async function updateProduct(
  productId: string,
  changes: Partial<ProductInput>,
): Promise<Product> {
  const business = await getCurrentBusiness();
  const { data, error } = await supabase
    .from("products")
    .update({ ...changes, business_id: business.id })
    .eq("id", productId)
    .eq("business_id", business.id)
    .select("*")
    .single();
  if (error) throw error;
  return data as Product;
}

export async function deleteProduct(productId: string): Promise<void> {
  const business = await getCurrentBusiness();
  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", productId)
    .eq("business_id", business.id);
  if (error) throw error;
}