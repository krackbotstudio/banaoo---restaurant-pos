// Server-side mirror of the business_type → defaults map.
//
// Keep this in sync with `src/lib/business-types.ts`. The frontend file owns
// presentation (labels, icons, capabilities); this file owns only the bits
// the API uses today (the default outlet operation_mode per type).

/** @type {Record<string, 'standard' | 'self_service'>} */
export const DEFAULT_OPERATION_MODE_BY_BUSINESS_TYPE = {
  restaurant: 'standard',
  hotel: 'standard',
  cloud_kitchen: 'self_service',
  cafe: 'standard',
  qsr: 'self_service',
  bar: 'standard',
  sweet_shop: 'self_service',
  bakery: 'self_service',
  food_cart: 'self_service',
  resto_bar: 'standard',
};

/**
 * Returns the operation_mode that a new outlet should be created with,
 * based on the owner's profile.business_type. Falls back to 'standard'
 * for unknown / unselected business types.
 *
 * @param {string | null | undefined} businessType
 * @returns {'standard' | 'self_service'}
 */
export function getDefaultOperationMode(businessType) {
  if (!businessType) return 'standard';
  return DEFAULT_OPERATION_MODE_BY_BUSINESS_TYPE[businessType] ?? 'standard';
}
