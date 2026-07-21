/**
 * Shared OpenAI vision menu extraction (owner + CMS).
 */
export function normalizeExtractedMenuItems(items) {
  if (!Array.isArray(items)) return [];
  return items.map((raw) => {
    const variants = (Array.isArray(raw?.variants)
      ? raw.variants
      : Array.isArray(raw?.sizes)
        ? raw.sizes
        : [])
      .map((variant) => ({
        name: String(variant?.name || variant?.size || '').trim(),
        price: Number(variant?.price ?? variant?.amount),
        is_default: variant?.is_default === true || variant?.default === true,
      }))
      .filter(
        (variant) =>
          variant.name &&
          Number.isFinite(variant.price) &&
          variant.price >= 0
      );

    if (variants.length > 0) {
      let defaultIndex = variants.findIndex((variant) => variant.is_default);
      if (defaultIndex < 0) {
        const lowestPrice = Math.min(...variants.map((variant) => variant.price));
        defaultIndex = variants.findIndex((variant) => variant.price === lowestPrice);
      }
      variants.forEach((variant, index) => {
        variant.is_default = index === defaultIndex;
      });
    }

    const defaultVariant = variants.find((variant) => variant.is_default) || variants[0];
    const rawPrice = Number(raw?.price ?? raw?.base_price);
    const price = defaultVariant?.price ?? (Number.isFinite(rawPrice) ? rawPrice : undefined);

    return {
      ...raw,
      price,
      variants,
    };
  }).filter(
    (item) =>
      String(item?.name || '').trim() &&
      Number.isFinite(item.price) &&
      item.price >= 0
  );
}

export async function extractMenuItemsFromImage(imageBase64, mimeType = 'image/jpeg') {
  if (!imageBase64) {
    throw new Error('Menu file data is required');
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('AI API key not configured');
  }

  const isPdf = mimeType === 'application/pdf';
  const prompt = `You are a menu extraction specialist. Extract all menu items from every page of the provided restaurant menu ${isPdf ? 'PDF' : 'image'}.

For each item, extract:
- name: The item name (required)
- description: Brief description if available (optional, null if not present)
- price: The base/default price as a number only (required, no currency symbol). If the item has
  sizes or variants, use the default variant price; if no default is indicated, use the lowest price.
- is_veg: true if marked as vegetarian/veg, false if non-veg, null if unclear (look for green/red symbols)
- category: The category/section name if visible (e.g., "Starters", "Main Course", "Beverages")
- variants: An array for sizes/options that have distinct prices, otherwise []. Each variant must be:
  {"name":"Half","price":180,"is_default":true}. The variant price is the full displayed price,
  not a price difference. Mark exactly one variant as default. If the menu shows a row such as
  "Half / Full" or columns such as "Regular / Large", keep it as one item with variants instead of
  creating duplicate menu items.

Return ONLY a valid JSON array of items. No explanation, no markdown, no code blocks. Example:
[{"name":"Paneer Tikka","description":"Marinated cottage cheese grilled in tandoor","price":180,"is_veg":true,"category":"Starters","variants":[{"name":"Half","price":180,"is_default":true},{"name":"Full","price":320,"is_default":false}]}]

If you cannot extract any items, return an empty array: []`;

  const endpoint = isPdf
    ? 'https://api.openai.com/v1/responses'
    : 'https://api.openai.com/v1/chat/completions';
  const requestBody = isPdf
    ? {
        model: 'gpt-4o',
        input: [
          {
            role: 'user',
            content: [
              {
                type: 'input_file',
                filename: 'menu.pdf',
                file_data: `data:application/pdf;base64,${imageBase64}`,
              },
              { type: 'input_text', text: prompt },
            ],
          },
        ],
        temperature: 0.1,
        max_output_tokens: 8192,
      }
    : {
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
      };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    const err = new Error(`Failed to process menu ${isPdf ? 'PDF' : 'image'}`);
    err.details = errorText;
    throw err;
  }

  const data = await response.json();
  const responseOutputText = Array.isArray(data.output)
    ? data.output
        .flatMap((output) => (Array.isArray(output?.content) ? output.content : []))
        .filter((part) => part?.type === 'output_text')
        .map((part) => part.text || '')
        .join('')
    : '';
  const content =
    data.choices?.[0]?.message?.content ||
    data.output_text ||
    responseOutputText ||
    '[]';

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

  return normalizeExtractedMenuItems(items);
}
