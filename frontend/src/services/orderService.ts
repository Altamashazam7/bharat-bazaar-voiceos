import { supabase } from "../lib/supabase";
import { getCurrentBusiness, getOwnedBusiness } from "./businessService";
import type { BusinessAnalytics, Order, OrderInput } from "../types/business";

export async function getOrders(
  search = "",
): Promise<{ orders: Order[]; total: number }> {
  const business = await getCurrentBusiness();
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("business_id", business.id)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const normalizedSearch = search.trim().toLocaleLowerCase();
  const orders = (data as Order[]).filter((order) => {
    const searchableText = [
      order.id,
      order.transcript,
      ...(order.invoice.items ?? []).map((item) => item.product),
    ].join(" ").toLocaleLowerCase();
    return !normalizedSearch || searchableText.includes(normalizedSearch);
  });

  return { orders, total: orders.length };
}

export async function getOrder(orderId: string): Promise<Order> {
  const business = await getCurrentBusiness();
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("business_id", business.id)
    .eq("id", orderId)
    .single();
  if (error) throw error;
  return data as Order;
}

export async function createOrder(
  input: OrderInput,
  activeBusinessId?: string,
): Promise<Order> {
  const business = activeBusinessId
    ? await getOwnedBusiness(activeBusinessId)
    : await getCurrentBusiness();
  console.debug("[tenant] persisting order for business_id=%s", business.id);
  const { data, error } = await supabase
    .from("orders")
    .insert({ ...input, business_id: business.id })
    .select("*")
    .single();
  if (error) throw error;
  return data as Order;
}

export async function updateOrder(
  orderId: string,
  changes: Partial<OrderInput>,
): Promise<Order> {
  const business = await getCurrentBusiness();
  const { data, error } = await supabase
    .from("orders")
    .update({ ...changes, business_id: business.id })
    .eq("business_id", business.id)
    .eq("id", orderId)
    .select("*")
    .single();
  if (error) throw error;
  return data as Order;
}

export async function deleteOrder(orderId: string): Promise<void> {
  const business = await getCurrentBusiness();
  const { error } = await supabase
    .from("orders")
    .delete()
    .eq("business_id", business.id)
    .eq("id", orderId);
  if (error) throw error;
}

export async function getBusinessAnalytics(): Promise<BusinessAnalytics> {
  const { orders } = await getOrders();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const todayOrders = orders.filter((order) => new Date(order.created_at) >= today);
  const weekOrders = orders.filter((order) => new Date(order.created_at) >= weekStart);
  const quantityByProduct = new Map<string, number>();
  const quantityByCategory = new Map<string, number>();

  for (const order of orders) {
    for (const item of order.invoice.items ?? []) {
      quantityByProduct.set(item.product, (quantityByProduct.get(item.product) ?? 0) + item.quantity);
      quantityByCategory.set(item.category, (quantityByCategory.get(item.category) ?? 0) + item.quantity);
    }
  }

  const revenue = (group: Order[]) => group.reduce(
    (total, order) => total + (order.invoice.grand_total_paise ?? 0),
    0,
  );
  const totalItems = orders.reduce(
    (total, order) => total + (order.invoice.total_items ?? 0),
    0,
  );
  const revenueToday = revenue(todayOrders);

  return {
    orders_today: todayOrders.length,
    orders_this_week: weekOrders.length,
    products_sold: todayOrders.reduce(
      (total, order) => total + (order.invoice.total_items ?? 0),
      0,
    ),
    average_order_size: orders.length ? Number((totalItems / orders.length).toFixed(1)) : 0,
    revenue_paise: revenueToday,
    revenue: new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
    }).format(revenueToday / 100),
    weekly_revenue_paise: revenue(weekOrders),
    top_products: [...quantityByProduct].map(([product, quantity]) => ({ product, quantity }))
      .sort((left, right) => right.quantity - left.quantity)
      .slice(0, 5),
    top_categories: [...quantityByCategory].map(([category, quantity]) => ({ category, quantity }))
      .sort((left, right) => right.quantity - left.quantity)
      .slice(0, 5),
  };
}