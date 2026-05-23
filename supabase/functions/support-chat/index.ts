import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const systemPrompt = `You are the banaoo.in support assistant. banaoo.in is a restaurant management platform that helps restaurant owners manage their business efficiently.

**Platform Features:**
- Multi-outlet management - Manage multiple restaurant locations from one dashboard
- Order management - Take and track orders with ease
- Kitchen Display System (KDS) - Real-time order display for kitchen staff
- Menu management - Create and update menus with AI-powered menu import from images
- Staff management - Manage roles, schedules, and permissions
- Table management - Floor plans and table status tracking
- QR Menu Builder - Free tool to create digital menus with QR codes
- Analytics & Reports - Track sales, orders, and performance

**Pricing Plans:**
- Launcher: ₹499/month (1 outlet, 1 staff account, order/menu/KDS/analytics/table management, email support; no mobile app)
- Growth: ₹699/month (Most Popular — 1 outlet, 2 staff accounts, all Launcher features plus mobile app access and priority support)
- Expand: Custom pricing (unlimited outlets, flexible staff, custom integrations, multi-branch management, dedicated support)
- Add-ons on Launcher/Growth: extra outlet ₹300/month, extra staff ₹150/month per account

All plans include a 14-day free trial with no credit card required.

**Contact Information:**
- Email: connect@banaoo.in
- For any billing, technical, or account issues, users can reach the team at connect@banaoo.in

**Guidelines:**
- Be helpful, friendly, and concise
- Answer questions about features, pricing, and how to use the platform
- For billing issues, account problems, or complex technical requests, offer to connect them with the team at connect@banaoo.in
- If you don't know something specific, acknowledge it and suggest contacting support
- Keep responses brief but informative
- Use bullet points for lists when helpful
- When users want to talk to a human, provide the email connect@banaoo.in`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "We're experiencing high demand. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("OpenAI error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "Something went wrong. Please try again or contact connect@banaoo.in" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("Support chat error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
