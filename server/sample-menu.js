const SAMPLE_MENU_CATEGORY_NAMES = new Set([
  "Starters",
  "Main Course",
  "Breads",
  "Beverages",
  "Desserts",
]);

const SAMPLE_MENU_ITEM_NAMES = new Set([
  "Paneer Tikka",
  "Chicken 65",
  "Veg Spring Rolls",
  "Dal Makhani",
  "Butter Chicken",
  "Palak Paneer",
  "Butter Naan",
  "Garlic Naan",
  "Tandoori Roti",
  "Mango Lassi",
  "Masala Chai",
  "Fresh Lime Soda",
  "Gulab Jamun",
  "Rasmalai",
]);

export function isUnmodifiedSampleMenu(categories, items) {
  if (!items?.length) return false;
  if (!items.every((i) => SAMPLE_MENU_ITEM_NAMES.has(i.name?.trim()))) return false;
  if (categories?.length && !categories.every((c) => SAMPLE_MENU_CATEGORY_NAMES.has(c.name?.trim()))) {
    return false;
  }
  return true;
}

export async function clearUnmodifiedSampleMenu(pool, outletId) {
  const { rows: categories } = await pool.query(
    "SELECT name FROM public.menu_categories WHERE outlet_id = $1",
    [outletId]
  );
  const { rows: items } = await pool.query(
    "SELECT name FROM public.menu_items WHERE outlet_id = $1",
    [outletId]
  );
  if (!isUnmodifiedSampleMenu(categories, items)) return false;

  await pool.query("DELETE FROM public.menu_items WHERE outlet_id = $1", [outletId]);
  await pool.query("DELETE FROM public.menu_categories WHERE outlet_id = $1", [outletId]);
  return true;
}
