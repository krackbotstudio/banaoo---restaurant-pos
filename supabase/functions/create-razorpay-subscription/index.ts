import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const razorpayKeyId = Deno.env.get("RAZORPAY_KEY_ID")!;
    const razorpayKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET")!;
    const starterPlanId = Deno.env.get("RAZORPAY_STARTER_PLAN_ID")!;
    const professionalPlanId = Deno.env.get("RAZORPAY_PROFESSIONAL_PLAN_ID")!;

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      console.error("Auth error:", userError);
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { plan_type, action } = await req.json();
    console.log(`Subscription request for user ${user.id}, plan: ${plan_type}, action: ${action || 'create'}`);

    if (!["starter", "professional"].includes(plan_type)) {
      return new Response(JSON.stringify({ error: "Invalid plan type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const razorpayPlanId = plan_type === "starter" ? starterPlanId : professionalPlanId;
    const razorpayAuth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);

    // Check for existing subscription
    const { data: existingSub } = await supabaseClient
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .in("status", ["trialing", "active"])
      .single();

    // If user already has an active/trialing subscription
    if (existingSub) {
      // If they want to convert trial to paid or change plan
      if (action === "convert" || action === "change_plan") {
        // For trial users wanting to pay now or change plan
        // Return the existing payment link so they can complete payment
        if (existingSub.razorpay_subscription_id) {
          // If same plan, just return the existing payment URL
          if (existingSub.plan_type === plan_type) {
            // Fetch the subscription from Razorpay to get the short_url
            const subRes = await fetch(
              `https://api.razorpay.com/v1/subscriptions/${existingSub.razorpay_subscription_id}`,
              {
                headers: { "Authorization": `Basic ${razorpayAuth}` },
              }
            );
            
            if (subRes.ok) {
              const subData = await subRes.json();
              console.log("Returning existing subscription payment link");
              return new Response(JSON.stringify({
                subscription_id: existingSub.razorpay_subscription_id,
                short_url: subData.short_url,
                status: existingSub.status,
                trial_ends_at: existingSub.trial_ends_at,
                message: "Complete payment to activate your subscription",
              }), {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              });
            }
          } else {
            // Different plan - need to cancel old and create new
            // Cancel existing Razorpay subscription
            console.log("Changing plan - cancelling old subscription");
            await fetch(
              `https://api.razorpay.com/v1/subscriptions/${existingSub.razorpay_subscription_id}/cancel`,
              {
                method: "POST",
                headers: { "Authorization": `Basic ${razorpayAuth}` },
              }
            );

            // Mark old subscription as cancelled in DB
            await supabaseClient
              .from("subscriptions")
              .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
              .eq("id", existingSub.id);
            
            // Continue to create new subscription below
          }
        }
      } else {
        // Default behavior - block if already has subscription
        return new Response(JSON.stringify({ 
          error: "You already have an active subscription",
          existing_plan: existingSub.plan_type,
          status: existingSub.status
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Get or create Razorpay customer
    let razorpayCustomerId: string;

    // Check if user has an existing subscription with customer ID
    const { data: prevSub } = await supabaseClient
      .from("subscriptions")
      .select("razorpay_customer_id")
      .eq("user_id", user.id)
      .not("razorpay_customer_id", "is", null)
      .limit(1)
      .single();

    if (prevSub?.razorpay_customer_id) {
      razorpayCustomerId = prevSub.razorpay_customer_id;
      console.log("Using existing Razorpay customer:", razorpayCustomerId);
    } else {
      // Create new customer
      const customerRes = await fetch("https://api.razorpay.com/v1/customers", {
        method: "POST",
        headers: {
          "Authorization": `Basic ${razorpayAuth}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: user.user_metadata?.full_name || user.email?.split("@")[0] || "Customer",
          email: user.email,
          contact: user.user_metadata?.phone || "",
          notes: { user_id: user.id },
        }),
      });

      if (!customerRes.ok) {
        const errorText = await customerRes.text();
        console.error("Failed to create customer:", errorText);
        return new Response(JSON.stringify({ error: "Failed to create customer" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const customer = await customerRes.json();
      razorpayCustomerId = customer.id;
      console.log("Created Razorpay customer:", razorpayCustomerId);
    }

    // Calculate trial end (14 days from now) - only for new subscriptions
    const trialEnd = Math.floor(Date.now() / 1000) + 14 * 24 * 60 * 60;

    // Create subscription with trial
    const subscriptionRes = await fetch("https://api.razorpay.com/v1/subscriptions", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${razorpayAuth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        plan_id: razorpayPlanId,
        customer_id: razorpayCustomerId,
        total_count: 120, // 10 years max
        start_at: trialEnd, // Start billing after trial
        customer_notify: 1,
        notes: {
          user_id: user.id,
          plan_type: plan_type,
        },
      }),
    });

    if (!subscriptionRes.ok) {
      const errorText = await subscriptionRes.text();
      console.error("Failed to create subscription:", errorText);
      return new Response(JSON.stringify({ error: "Failed to create subscription" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const subscription = await subscriptionRes.json();
    console.log("Created Razorpay subscription:", subscription.id);

    // Save to database
    const trialEndsAt = new Date(trialEnd * 1000).toISOString();
    const { error: insertError } = await supabaseClient.from("subscriptions").insert({
      user_id: user.id,
      plan_type: plan_type,
      status: "trialing",
      trial_ends_at: trialEndsAt,
      razorpay_customer_id: razorpayCustomerId,
      razorpay_subscription_id: subscription.id,
      razorpay_plan_id: razorpayPlanId,
    });

    if (insertError) {
      console.error("Failed to save subscription:", insertError);
      return new Response(JSON.stringify({ error: "Failed to save subscription" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      subscription_id: subscription.id,
      short_url: subscription.short_url,
      status: subscription.status,
      trial_ends_at: trialEndsAt,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
