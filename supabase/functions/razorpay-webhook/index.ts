import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "https://deno.land/std@0.168.0/node/crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-razorpay-signature",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const razorpayKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET")!;

    const body = await req.text();
    const signature = req.headers.get("x-razorpay-signature");

    // Verify webhook signature
    if (signature) {
      const expectedSignature = createHmac("sha256", razorpayKeySecret)
        .update(body)
        .digest("hex");

      if (signature !== expectedSignature) {
        console.error("Invalid webhook signature");
        return new Response(JSON.stringify({ error: "Invalid signature" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const event = JSON.parse(body);
    console.log("Received webhook event:", event.event);

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    const payload = event.payload;

    switch (event.event) {
      case "subscription.authenticated": {
        // Payment method authorized, subscription is now authenticated
        const subscriptionId = payload.subscription?.entity?.id;
        if (subscriptionId) {
          console.log("Subscription authenticated:", subscriptionId);
          // Subscription stays in trialing status
        }
        break;
      }

      case "subscription.activated": {
        // First charge successful, subscription is now active
        const subscriptionId = payload.subscription?.entity?.id;
        if (subscriptionId) {
          console.log("Subscription activated:", subscriptionId);
          const { error } = await supabaseClient
            .from("subscriptions")
            .update({
              status: "active",
              current_period_start: new Date().toISOString(),
              current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            })
            .eq("razorpay_subscription_id", subscriptionId);

          if (error) console.error("Failed to update subscription:", error);
        }
        break;
      }

      case "subscription.charged": {
        // Recurring payment successful
        const subscriptionId = payload.subscription?.entity?.id;
        if (subscriptionId) {
          console.log("Subscription charged:", subscriptionId);
          const { error } = await supabaseClient
            .from("subscriptions")
            .update({
              status: "active",
              current_period_start: new Date().toISOString(),
              current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            })
            .eq("razorpay_subscription_id", subscriptionId);

          if (error) console.error("Failed to update subscription:", error);
        }
        break;
      }

      case "subscription.pending": {
        // Payment pending
        const subscriptionId = payload.subscription?.entity?.id;
        if (subscriptionId) {
          console.log("Subscription pending:", subscriptionId);
          const { error } = await supabaseClient
            .from("subscriptions")
            .update({ status: "past_due" })
            .eq("razorpay_subscription_id", subscriptionId);

          if (error) console.error("Failed to update subscription:", error);
        }
        break;
      }

      case "subscription.halted": {
        // Payment failed, subscription halted
        const subscriptionId = payload.subscription?.entity?.id;
        if (subscriptionId) {
          console.log("Subscription halted:", subscriptionId);
          const { error } = await supabaseClient
            .from("subscriptions")
            .update({ status: "past_due" })
            .eq("razorpay_subscription_id", subscriptionId);

          if (error) console.error("Failed to update subscription:", error);
        }
        break;
      }

      case "subscription.cancelled": {
        // Subscription cancelled
        const subscriptionId = payload.subscription?.entity?.id;
        if (subscriptionId) {
          console.log("Subscription cancelled:", subscriptionId);
          const { error } = await supabaseClient
            .from("subscriptions")
            .update({
              status: "cancelled",
              cancelled_at: new Date().toISOString(),
            })
            .eq("razorpay_subscription_id", subscriptionId);

          if (error) console.error("Failed to update subscription:", error);
        }
        break;
      }

      case "subscription.completed": {
        // Subscription completed all cycles
        const subscriptionId = payload.subscription?.entity?.id;
        if (subscriptionId) {
          console.log("Subscription completed:", subscriptionId);
          const { error } = await supabaseClient
            .from("subscriptions")
            .update({ status: "expired" })
            .eq("razorpay_subscription_id", subscriptionId);

          if (error) console.error("Failed to update subscription:", error);
        }
        break;
      }

      default:
        console.log("Unhandled event:", event.event);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    console.error("Webhook error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
