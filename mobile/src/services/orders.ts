import { supabase } from "../lib/supabase";

export type OrderStatus =
  | "pending"
  | "preparing"
  | "ready"
  | "completed"
  | "cancelled"
  | "paid";

export type ItemStatus = "pending" | "preparing" | "ready" | "completed" | "cancelled";

export interface OrderRow {
  id: string;
  order_number: string;
  status: OrderStatus;
  total: number;
  created_at: string;
  table_number: string | null;
  order_type: string;
  source: string;
  customer_name: string | null;
}

export interface OrderItemRow {
  id: string;
  order_id: string;
  item_name: string;
  quantity: number;
  total_price: number;
  status: ItemStatus;
  gst_rate: number | null;
  created_at: string;
}

export async function fetchOrdersForOutlet(
  outletId: string,
  status: OrderStatus | "all" = "all"
): Promise<OrderRow[]> {
  let query = supabase
    .from("orders")
    .select("id, order_number, status, total, created_at, table_number, order_type, source, customer_name")
    .eq("outlet_id", outletId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as OrderRow[];
}

export async function fetchOrderItems(orderId: string): Promise<OrderItemRow[]> {
  const { data, error } = await supabase
    .from("order_items")
    .select("id, order_id, item_name, quantity, total_price, status, gst_rate, created_at")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((item: any) => ({
    ...item,
    status: (item.status ?? "pending") as ItemStatus,
    gst_rate: item.gst_rate ?? 0,
  })) as OrderItemRow[];
}

export async function updateOrderStatus(orderId: string, status: OrderStatus): Promise<void> {
  const { error } = await supabase.from("orders").update({ status }).eq("id", orderId);
  if (error) throw error;
}

export interface PaymentUpdatePayload {
  discount: number;
  tax: number;
  total: number;
}

export async function markOrderPaid(
  orderId: string,
  payload: PaymentUpdatePayload
): Promise<void> {
  const { error } = await supabase
    .from("orders")
    .update({
      status: "paid",
      discount: payload.discount,
      tax: payload.tax,
      total: payload.total,
    })
    .eq("id", orderId);
  if (error) throw error;
}

export async function updateOrderItemStatus(itemId: string, status: ItemStatus): Promise<void> {
  const { error } = await supabase.from("order_items").update({ status }).eq("id", itemId);
  if (error) throw error;
}

export function deriveOrderStatus(items: OrderItemRow[]): OrderStatus {
  if (!items.length) return "pending";
  const active = items.filter((item) => item.status !== "cancelled");
  if (!active.length) return "cancelled";
  if (active.some((item) => item.status === "pending")) return "pending";
  if (active.some((item) => item.status === "preparing")) return "preparing";
  if (active.some((item) => item.status === "ready")) return "ready";
  return "completed";
}

export const NEXT_ORDER_STATUS: Record<OrderStatus, OrderStatus | null> = {
  pending: "preparing",
  preparing: "ready",
  ready: "completed",
  completed: "paid",
  cancelled: null,
  paid: null,
};

export const NEXT_ITEM_STATUS: Record<ItemStatus, ItemStatus | null> = {
  pending: "preparing",
  preparing: "ready",
  ready: "completed",
  completed: null,
  cancelled: null,
};
