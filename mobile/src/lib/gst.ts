export function resolveGstRate(
  gstCategory: string | null | undefined,
  gstCategories: Record<string, number> | null | undefined
): number {
  if (!gstCategory || !gstCategories) return 0;
  return gstCategories[gstCategory] ?? 0;
}
