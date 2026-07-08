import { API_URL } from "@/lib/api-url";

export interface InventoryItem {
  id: string;
  outlet_id: string;
  name: string;
  sku: string | null;
  unit: string;
  quantity: number;
  low_stock_threshold: number;
  notes: string | null;
  category: string | null;
  unit_cost: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface InventorySummary {
  totalItems: number;
  lowStock: number;
  outOfStock: number;
  stockValue: number;
}

export interface InventoryMovement {
  id: string;
  inventory_item_id: string;
  item_name: string;
  delta: number;
  reason: string | null;
  notes: string | null;
  created_at: string;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 20_000);
  try {
    const res = await fetch(`${API_URL}${path}`, {
      credentials: "include",
      headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
      signal: controller.signal,
      ...init,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
    return json as T;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("Request timed out. Check that the API server is running on port 5000.");
    }
    throw err;
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function fetchInventoryItems(outletId: string) {
  return apiFetch<{ items: InventoryItem[]; summary: InventorySummary }>(
    `/api/outlets/${outletId}/inventory`
  );
}

export async function fetchInventoryMovements(outletId: string, limit = 50) {
  return apiFetch<{ movements: InventoryMovement[] }>(
    `/api/outlets/${outletId}/inventory/movements?limit=${limit}`
  );
}

export async function createInventoryItem(
  outletId: string,
  payload: Partial<InventoryItem> & { name: string }
) {
  return apiFetch<{ item: InventoryItem }>(`/api/outlets/${outletId}/inventory`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateInventoryItem(itemId: string, payload: Partial<InventoryItem>) {
  return apiFetch<{ item: InventoryItem }>(`/api/inventory/${itemId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteInventoryItem(itemId: string) {
  return apiFetch<{ success: boolean }>(`/api/inventory/${itemId}`, { method: "DELETE" });
}

export async function adjustInventoryStock(
  itemId: string,
  payload: { delta: number; reason?: string; notes?: string }
) {
  return apiFetch<{ item: InventoryItem }>(`/api/inventory/${itemId}/adjust`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function exportInventoryCsv(items: InventoryItem[]): string {
  const header = "name,sku,category,unit,quantity,low_stock_threshold,unit_cost,notes";
  const rows = items.map((i) =>
    [
      i.name,
      i.sku ?? "",
      i.category ?? "",
      i.unit,
      i.quantity,
      i.low_stock_threshold,
      i.unit_cost ?? "",
      (i.notes ?? "").replace(/"/g, '""'),
    ]
      .map((v) => `"${String(v)}"`)
      .join(",")
  );
  return [header, ...rows].join("\n");
}
