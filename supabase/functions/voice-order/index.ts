import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MenuItem {
  id: string;
  name: string;
  price: number;
}

interface RecognizedItem {
  menu_item_id: string;
  name: string;
  quantity: number;
}

interface VoiceOrderResult {
  items: RecognizedItem[];
  order_type: "dine_in" | "takeaway";
  table_number: string | null;
  transcript: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { transcript, menu_items, mode } = await req.json() as {
      transcript: string;
      menu_items: MenuItem[];
      mode?: "customer" | "pos";
    };

    if (!transcript?.trim() || !menu_items?.length) {
      return new Response(JSON.stringify({ error: "transcript and menu_items required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

    const menuText = menu_items
      .map((item) => `ID: ${item.id} | Name: "${item.name}" | Price: ₹${item.price}`)
      .join("\n");

    const isPOS = mode === "pos";

    const systemPrompt = isPOS
      ? `You are a restaurant billing counter assistant. Extract order details from spoken customer orders.
Return ONLY a raw JSON object — no markdown, no explanation:
{"items":[{"menu_item_id":"exact-id","name":"Exact Menu Name","quantity":1}],"order_type":"dine_in","table_number":null}
Rules:
- Match to closest available menu items only
- order_type: "dine_in" (mentions table/inside/baith ke) or "takeaway" (parcel/pack/bahar/ghar)
- table_number: extract number as string if mentioned, else null
- Default order_type to "dine_in"
- Understand ANY language: Hindi, Telugu, Tamil, Kannada, English, or mixed`
      : `You are a restaurant ordering assistant. Extract items from a spoken customer order.
Return ONLY a raw JSON array — no markdown, no explanation:
[{"menu_item_id":"exact-id-from-menu","name":"Exact Menu Name","quantity":1}]
Rules:
- Match to closest available menu items only
- If quantity not mentioned, assume 1
- If nothing matches, return []
- Understand ANY language: Hindi, Telugu, Tamil, Kannada, English, or mixed`;

    const userPrompt = `Customer said: "${transcript}"\n\nAvailable menu:\n${menuText}`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("OpenAI error:", response.status, err);
      throw new Error("AI service error");
    }

    const aiData = await response.json();
    let raw: string = aiData.choices?.[0]?.message?.content ?? "";

    // Strip markdown code fences if present
    raw = raw.replace(/```json\n?/gi, "").replace(/```\n?/g, "").trim();

    const menuIds = new Set(menu_items.map((m) => m.id));

    const validateItems = (arr: unknown[]): RecognizedItem[] =>
      arr
        .filter((i: unknown) => {
          const item = i as Record<string, unknown>;
          return item.menu_item_id && menuIds.has(item.menu_item_id as string) && Number(item.quantity) > 0;
        })
        .map((i: unknown) => {
          const item = i as Record<string, unknown>;
          return {
            menu_item_id: String(item.menu_item_id),
            name: String(item.name),
            quantity: Math.max(1, Math.round(Number(item.quantity) || 1)),
          };
        });

    let result: VoiceOrderResult = {
      items: [],
      order_type: "dine_in",
      table_number: null,
      transcript,
    };

    try {
      const parsed = JSON.parse(raw);
      if (isPOS) {
        const obj = parsed as Record<string, unknown>;
        result.items = validateItems(Array.isArray(obj.items) ? obj.items : []);
        result.order_type = obj.order_type === "takeaway" ? "takeaway" : "dine_in";
        result.table_number = obj.table_number ? String(obj.table_number) : null;
      } else {
        result.items = validateItems(Array.isArray(parsed) ? parsed : []);
      }
    } catch {
      result.items = [];
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("voice-order error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
