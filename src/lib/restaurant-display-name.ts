/** Brand / restaurant label for receipts (from owner profile). */
export function restaurantDisplayName(profile: {
  brand_name?: string | null;
  full_name?: string | null;
} | null | undefined): string {
  const brand = profile?.brand_name?.trim();
  if (brand) return brand;
  return profile?.full_name?.trim() ?? "";
}
