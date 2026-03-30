import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller is an admin
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: callerProfile } = await anonClient
      .from("profiles")
      .select("is_admin, full_name")
      .eq("user_id", user.id)
      .single();

    if (!callerProfile?.is_admin) {
      return new Response(JSON.stringify({ error: "Forbidden: admin access required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { target_user_id, action } = await req.json() as {
      target_user_id: string;
      action: "approve" | "reject";
    };

    if (!target_user_id || !action) {
      return new Response(JSON.stringify({ error: "target_user_id and action required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const newStatus = action === "approve" ? "approved" : "rejected";

    // Update account status
    const { error: updateError } = await serviceClient
      .from("profiles")
      .update({ account_status: newStatus })
      .eq("user_id", target_user_id);

    if (updateError) throw updateError;

    // Send in-app notification to the user
    const notificationData =
      action === "approve"
        ? {
            user_id: target_user_id,
            type: "subscription",
            title: "Account Approved! 🎉",
            message: "Your banaoo.io account has been approved. You can now choose a plan and start managing your restaurant.",
            action_url: "/select-plan",
          }
        : {
            user_id: target_user_id,
            type: "subscription",
            title: "Account Application Update",
            message: "Your banaoo.io account application requires further review. Please contact connect@banaoo.in for assistance.",
            action_url: null,
          };

    await serviceClient.from("notifications").insert(notificationData);

    console.log(`Admin ${user.id} ${action}d account ${target_user_id}`);

    return new Response(
      JSON.stringify({ success: true, status: newStatus }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("admin-approve-account error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
