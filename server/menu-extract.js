/**
 * Shared OpenAI vision menu extraction (owner + CMS).
 */
export async function extractMenuItemsFromImage(imageBase64, mimeType = 'image/jpeg') {
  if (!imageBase64) {
    throw new Error('Image data is required');
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('AI API key not configured');
  }

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
      Authorization: `Bearer ${apiKey}`,
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
    const err = new Error('Failed to process image');
    err.details = errorText;
    throw err;
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '[]';

  let items = [];
  try {
    let clean = content.trim();
    clean = clean.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '').trim();
    items = JSON.parse(clean);
    if (!Array.isArray(items)) items = [];
  } catch (parseError) {
    const err = new Error('Failed to parse menu items');
    err.raw = content;
    throw err;
  }

  return items;
}
