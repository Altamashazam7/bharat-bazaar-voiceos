export interface Business {
  id: string;
  owner_user_id: string;
  name: string;
  owner_name: string;
  phone: string;
  created_at: string;
}

export interface Product {
  id: string;
  business_id: string;
  name: string;
  aliases?: string[];
  category: string;
  unit: string;
  price_paise: number;
  stock: number;
  image_url?: string | null;
}

export type BusinessInput = Omit<Business, "id" | "created_at" | "owner_user_id">;
export type ProductInput = Omit<Product, "id" | "business_id">;

export interface Customer {
  id: string;
  business_id: string;
  name: string;
  phone: string;
  created_at: string;
}

export type CustomerInput = Pick<Customer, "name" | "phone">;

export interface InvoiceLine {
  product: string;
  quantity: number;
  unit: string;
  category: string;
  unit_price_paise: number;
  line_total_paise: number;
}

export interface OrderInvoice {
  text?: string;
  total_items?: number;
  items?: InvoiceLine[];
  subtotal_paise?: number;
  tax_paise?: number;
  grand_total_paise?: number;
  subtotal?: string;
  tax?: string;
  grand_total?: string;
}

export interface Order {
  id: string;
  business_id: string;
  created_at: string;
  transcript: string;
  invoice: OrderInvoice;
}

export type OrderInput = Omit<Order, "id" | "business_id" | "created_at"> & {
  created_at?: string;
};

export interface BusinessAnalytics {
  orders_today: number;
  orders_this_week: number;
  products_sold: number;
  average_order_size: number;
  revenue_paise: number;
  revenue: string;
  weekly_revenue_paise: number;
  top_products: { product: string; quantity: number }[];
  top_categories: { category: string; quantity: number }[];
}
