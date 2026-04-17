export interface GstCategory {
  key: string;
  label: string;
  defaultRate: number;
}

export const GST_CATEGORIES: GstCategory[] = [
  { key: "standard_food",  label: "Standard Food",         defaultRate: 5  },
  { key: "luxury",         label: "Luxury / Catering",      defaultRate: 18 },
  { key: "sugary_drinks",  label: "Sugary / Soft Drinks",   defaultRate: 12 },
  { key: "alcoholic",      label: "Alcoholic Drinks (VAT)", defaultRate: 0  },
  { key: "packaged_water", label: "Packaged Water",         defaultRate: 18 },
  { key: "exempt",         label: "Exempt / Zero Tax",      defaultRate: 0  },
];

/** Returns the effective GST rate for an item given the outlet's configured rates */
export function resolveGstRate(
  gstCategory: string | null | undefined,
  gstCategories: Record<string, number> | null | undefined
): number {
  if (!gstCategory || !gstCategories) return 0;
  return gstCategories[gstCategory] ?? 0;
}
