import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OrderItem {
  menu_item_id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  notes?: string;
}

interface PlaceOrderRequest {
  outlet_id: string;
  customer_name: string;
  customer_phone: string;
  order_type: "dine_in" | "takeaway" | "delivery";
  table_number?: string;
  delivery_address?: string;
  items: OrderItem[];
  notes?: string;
  payment_method: "cod" | "online";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body: PlaceOrderRequest = await req.json();
    const { outlet_id, customer_name, customer_phone, order_type, table_number, items, notes, payment_method } = body;

    if (!outlet_id || !customer_name || !items || items.length === 0) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify outlet exists and is active
    const { data: outlet, error: outletError } = await supabase
      .from("outlets")
      .select("id, owner_id")
      .eq("id", outlet_id)
      .eq("is_active", true)
      .single();

    if (outletError || !outlet) {
      return new Response(
        JSON.stringify({ error: "Outlet not found or inactive" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate order number
    const orderNumber = `ONL-${Date.now().toString(36).toUpperCase()}`;

    // Calculate totals
    const subtotal = items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
    const total = subtotal; // No tax for now

    // Create the order using service role (bypasses RLS)
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        outlet_id,
        order_number: orderNumber,
        order_type,
        table_number: table_number || null,
        subtotal,
        total,
        notes: notes || null,
        status: "pending",
        source: "online",
        customer_name,
        customer_phone,
        created_by: outlet.owner_id, // attribute to outlet owner
      })
      .select("id, order_number")
      .single();

    if (orderError || !order) {
      console.error("Order insert error:", orderError);
      return new Response(
        JSON.stringify({ error: "Failed to create order" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert order items
    const orderItems = items.map((item) => ({
      order_id: order.id,
      menu_item_id: item.menu_item_id,
      item_name: item.item_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.unit_price * item.quantity,
      notes: item.notes || null,
    }));

    const { error: itemsError } = await supabase.from("order_items").insert(orderItems);

    if (itemsError) {
      console.error("Order items insert error:", itemsError);
      // Rollback order
      await supabase.from("orders").delete().eq("id", order.id);
      return new Response(
        JSON.stringify({ error: "Failed to create order items" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        order_id: order.id,
        order_number: order.order_number,
        payment_method,
        total,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
