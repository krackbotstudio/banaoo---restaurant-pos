import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64, mimeType } = await req.json();

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: 'Image data is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) {
      console.error('OPENAI_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'AI API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processing menu image with OpenAI vision...');

    const prompt = `You are a menu extraction specialist. Extract all menu items from the provided restaurant menu image.

For each item, extract:
- name: The item name (required)
- description: Brief description if available (optional, null if not present)
- price: The price as a number only (required, extract just the numeric value, no currency symbol)
- is_veg: true if marked as vegetarian/veg, false if non-veg, null if unclear (look for green/red symbols)
- category: The category/section name if visible (e.g., "Starters", "Main Course", "Beverages")

Return ONLY a valid JSON array of items. No explanation, no markdown, no code blocks. Example:
[{"name":"Paneer Tikka","description":"Marinated cottage cheese grilled in tandoor","price":280,"is_veg":true,"category":"Starters"}]

If you cannot extract any items, return an empty array: []`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType || 'image/jpeg'};base64,${imageBase64}`,
                  detail: 'high',
                },
              },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to process image', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '[]';

    console.log('Raw OpenAI response:', content);

    // Parse the JSON response — strip any accidental markdown fences
    let items = [];
    try {
      let clean = content.trim();
      clean = clean.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '').trim();
      items = JSON.parse(clean);
      if (!Array.isArray(items)) items = [];
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError, 'raw:', content);
      return new Response(
        JSON.stringify({ error: 'Failed to parse menu items', raw: content }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Extracted ${items.length} menu items`);

    return new Response(
      JSON.stringify({ items }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error extracting menu:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to extract menu';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
