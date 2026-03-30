import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Address {
  id?: string;
  label: string;
  address_text: string;
  lat?: number | null;
  lng?: number | null;
  is_default: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const body = await req.json();
    const { action, phone, name, address } = body as {
      action: "lookup" | "upsert";
      phone: string;
      name?: string;
      address?: Address;
    };

    if (!phone) {
      return new Response(JSON.stringify({ error: "Phone is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Normalize phone: strip spaces/dashes
    const normalizedPhone = phone.replace(/[\s\-\(\)]/g, "");

    if (action === "lookup") {
      const { data: customer, error } = await supabase
        .from("customers")
        .select("id, phone, name, customer_addresses(id, label, address_text, lat, lng, is_default)")
        .eq("phone", normalizedPhone)
        .maybeSingle();

      if (error) throw error;

      return new Response(JSON.stringify({ customer: customer ?? null }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "upsert") {
      // Upsert customer record
      const { data: customer, error: upsertError } = await supabase
        .from("customers")
        .upsert(
          { phone: normalizedPhone, name: name ?? null, updated_at: new Date().toISOString() },
          { onConflict: "phone", ignoreDuplicates: false }
        )
        .select("id, phone, name")
        .single();

      if (upsertError || !customer) throw upsertError ?? new Error("Upsert failed");

      // Handle address
      if (address) {
        if (address.id) {
          // Update existing address
          await supabase
            .from("customer_addresses")
            .update({
              label: address.label,
              address_text: address.address_text,
              lat: address.lat ?? null,
              lng: address.lng ?? null,
              is_default: address.is_default,
            })
            .eq("id", address.id)
            .eq("customer_id", customer.id);
        } else {
          // If setting as default, clear existing defaults first
          if (address.is_default) {
            await supabase
              .from("customer_addresses")
              .update({ is_default: false })
              .eq("customer_id", customer.id);
          }
          // Insert new address
          await supabase.from("customer_addresses").insert({
            customer_id: customer.id,
            label: address.label,
            address_text: address.address_text,
            lat: address.lat ?? null,
            lng: address.lng ?? null,
            is_default: address.is_default,
          });
        }
      }

      // Return full profile
      const { data: full } = await supabase
        .from("customers")
        .select("id, phone, name, customer_addresses(id, label, address_text, lat, lng, is_default)")
        .eq("id", customer.id)
        .single();

      return new Response(JSON.stringify({ customer: full }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
