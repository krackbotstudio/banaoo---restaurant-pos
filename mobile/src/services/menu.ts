import { supabase } from "../lib/supabase";
import { resolveGstRate } from "../lib/gst";

export interface MenuCategoryRow {
  id: string;
  name: string;
  sort_order: number | null;
}

export interface MenuItemRow {
  id: string;
  name: string;
  description: string | null;
  base_price: number;
  is_veg: boolean;
  is_available: boolean;
  category_id: string | null;
  gst_category: string | null;
}

export interface CartLine {
  menuItem: MenuItemRow;
  quantity: number;
}

export interface PlaceOrderInput {
  outletId: string;
  createdBy: string | null;
  orderType: "dine_in" | "takeaway";
  tableNumber?: string;
  cart: CartLine[];
  gstCategories?: Record<string, number> | null;
}

function createBatchId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function fetchMenuCategories(outletId: string): Promise<MenuCategoryRow[]> {
  const { data, error } = await supabase
    .from("menu_categories")
    .select("id, name, sort_order")
    .eq("outlet_id", outletId)
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as MenuCategoryRow[];
}

export async function fetchMenuItems(outletId: string): Promise<MenuItemRow[]> {
  const { data, error } = await supabase
    .from("menu_items")
    .select("id, name, description, base_price, is_veg, is_available, category_id, gst_category")
    .eq("outlet_id", outletId)
    .eq("is_available", true)
    .order("name");
  if (error) throw error;
  return (data ?? []) as MenuItemRow[];
}

export async function placeNewOrder(input: PlaceOrderInput): Promise<{ id: string; orderNumber: string }> {
  const subtotal = input.cart.reduce(
    (sum, line) => sum + line.menuItem.base_price * line.quantity,
    0
  );

  const { data: orderNumData } = await supabase.rpc("generate_order_number", {
    outlet_id: input.outletId,
  });

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      order_number: orderNumData || `${Date.now()}`,
      outlet_id: input.outletId,
      order_type: input.orderType,
      table_number: input.orderType === "dine_in" ? input.tableNumber?.trim() || null : null,
      subtotal,
      total: subtotal,
      created_by: input.createdBy,
      status: "pending",
    })
    .select("id, order_number")
    .single();

  if (orderError) throw orderError;

  const batchId = createBatchId();
  const orderItems = input.cart.map((line) => ({
    order_id: order.id,
    menu_item_id: line.menuItem.id,
    item_name: line.menuItem.name,
    quantity: line.quantity,
    unit_price: line.menuItem.base_price,
    total_price: line.menuItem.base_price * line.quantity,
    batch_id: batchId,
    status: "pending",
    gst_rate: resolveGstRate(line.menuItem.gst_category, input.gstCategories),
  }));

  const { error: itemsError } = await supabase.from("order_items").insert(orderItems);
  if (itemsError) throw itemsError;

  return { id: order.id, orderNumber: order.order_number };
}
