export const SAMPLE_MENU_CATEGORY_NAMES = new Set([
  "Starters",
  "Main Course",
  "Breads",
  "Beverages",
  "Desserts",
]);

export const SAMPLE_MENU_ITEM_NAMES = new Set([
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

export function isUnmodifiedSampleMenu(
  categories: { name: string }[],
  items: { name: string }[]
): boolean {
  if (items.length === 0) return false;
  if (!items.every((i) => SAMPLE_MENU_ITEM_NAMES.has(i.name.trim()))) return false;
  if (categories.length > 0) {
    if (!categories.every((c) => SAMPLE_MENU_CATEGORY_NAMES.has(c.name.trim()))) return false;
  }
  return true;
}
