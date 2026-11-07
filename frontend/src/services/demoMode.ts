import type { Business } from "../types/business";

export const DEMO_BUSINESS_NAME = "Sharma Kirana";

export interface DemoCredentials {
  email: string;
  password: string;
}

export function isDemoMode(): boolean {
  return import.meta.env.VITE_DEMO_MODE === "true";
}

export function getDemoCredentials(): DemoCredentials {
  const email = import.meta.env.VITE_DEMO_EMAIL?.trim().toLowerCase();
  const password = import.meta.env.VITE_DEMO_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "Demo mode requires VITE_DEMO_EMAIL and VITE_DEMO_PASSWORD for a dedicated demo account.",
    );
  }
  return { email, password };
}

export function findDemoBusiness(businesses: Business[]): Business | null {
  return businesses.find(
    (business) => business.name.trim().toLocaleLowerCase() === DEMO_BUSINESS_NAME.toLocaleLowerCase(),
  ) ?? null;
}
