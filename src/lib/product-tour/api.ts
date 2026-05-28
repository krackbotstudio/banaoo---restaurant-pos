import { API_URL } from "@/lib/api-url";
import type { TourModuleId } from "./types";

export const TOUR_STORAGE_KEY = "banaoo-product-tour-dismissed";

export async function dismissProductTour(): Promise<void> {
  localStorage.setItem(TOUR_STORAGE_KEY, "1");
  try {
    await fetch(`${API_URL}/api/product-tour/dismiss`, {
      method: "POST",
      credentials: "include",
    });
  } catch {
    /* localStorage fallback is enough for staff / offline */
  }
}

export async function completeProductTourModule(moduleId: TourModuleId): Promise<void> {
  try {
    await fetch(`${API_URL}/api/product-tour/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ module: moduleId }),
    });
  } catch {
    /* non-blocking */
  }
}
