export interface Business {
  id: string;
  name: string;
  owner_name: string;
  phone: string;
  created_at: string;
}

export interface Product {
  id: string;
  business_id: string;
  name: string;
  category: string;
  unit: string;
  price_paise: number;
  stock: number;
}
