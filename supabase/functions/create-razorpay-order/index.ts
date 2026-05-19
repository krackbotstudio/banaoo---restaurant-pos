import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Base prices in rupees per month
const BASE_PRICES: Record<string, number> = {
  starter: 499,
  professional: 699,
};

// Discount by duration
const DISCOUNTS: Record<number, number> = {
  1: 0,
  3: 0.05,
  6: 0.10,
  12: 0.20,
};

function calcAmount(planType: string, months: number): number {
  const base = BASE_PRICES[planType];
  if (!base) throw new Error(`Unknown plan: ${planType}`);
  const discount = DISCOUNTS[months] ?? 0;
  return Math.round(base * months * (1 - discount));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { plan_type, period_months } = await req.json() as {
      plan_type: string;
      period_months: number;
    };

    if (!plan_type || !period_months) {
      return new Response(JSON.stringify({ error: "plan_type and period_months required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const KEY_ID = Deno.env.get("RAZORPAY_KEY_ID");
    const KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET");
    if (!KEY_ID || !KEY_SECRET) throw new Error("Razorpay credentials not configured");

    const amountRupees = calcAmount(plan_type, period_months);
    const amountPaise = amountRupees * 100;

    // Create Razorpay order
    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${btoa(`${KEY_ID}:${KEY_SECRET}`)}`,
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: "INR",
        receipt: `sub_${user.id.slice(0, 8)}_${Date.now()}`,
        notes: {
          user_id: user.id,
          plan_type,
          period_months: String(period_months),
        },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Razorpay order creation failed:", err);
      return new Response(
        JSON.stringify({ error: `Razorpay: ${err}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const order = await response.json();

    return new Response(
      JSON.stringify({
        order_id: order.id,
        amount: amountPaise,
        amount_rupees: amountRupees,
        currency: "INR",
        key_id: KEY_ID,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("create-razorpay-order error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
