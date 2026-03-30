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

    // Verify caller is an admin using anon client
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

    const { data: callerProfile, error: profileError } = await anonClient
      .from("profiles")
      .select("is_admin")
      .eq("user_id", user.id)
      .single();

    if (profileError || !callerProfile?.is_admin) {
      return new Response(JSON.stringify({ error: "Forbidden: admin access required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role to read all profiles + auth.users emails
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { status: filterStatus } = await req.json().catch(() => ({ status: "all" })) as { status?: string };

    let query = serviceClient
      .from("profiles")
      .select("id, user_id, full_name, phone, business_type, role, account_status, is_admin, onboarding_completed, created_at")
      .eq("role", "owner")
      .order("created_at", { ascending: false });

    if (filterStatus && filterStatus !== "all") {
      query = query.eq("account_status", filterStatus);
    }

    const { data: profiles, error: profilesError } = await query;
    if (profilesError) throw profilesError;

    // Fetch emails from auth.users using admin API
    const userIds = (profiles || []).map((p) => p.user_id);
    const emailMap: Record<string, string> = {};

    for (const userId of userIds) {
      const { data: { user: authUser } } = await serviceClient.auth.admin.getUserById(userId);
      if (authUser?.email) emailMap[userId] = authUser.email;
    }

    const accounts = (profiles || []).map((p) => ({
      ...p,
      email: emailMap[p.user_id] || null,
    }));

    return new Response(JSON.stringify({ accounts }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("admin-list-accounts error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
