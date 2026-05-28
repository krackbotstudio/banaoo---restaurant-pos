/** CMS-manageable module/feature keys (boolean toggles + numeric caps). */

export const CMS_BOOLEAN_FEATURES = [
  { key: 'kitchenDisplay', label: 'Kitchen display' },
  { key: 'analytics', label: 'Analytics' },
  { key: 'tableManagement', label: 'Table management' },
  { key: 'mobileAppAccess', label: 'Mobile app' },
  { key: 'platformIntegrations', label: 'Platform integrations' },
  { key: 'swiggyIntegration', label: 'Swiggy' },
  { key: 'zomatoIntegration', label: 'Zomato' },
  { key: 'customerOrdering', label: 'Customer ordering' },
  { key: 'inventoryManagement', label: 'Inventory' },
  { key: 'whatsappIntegration', label: 'WhatsApp bills & messaging' },
  { key: 'aiMenuImport', label: 'AI menu import' },
];

export const CMS_NUMERIC_FEATURES = [
  { key: 'outlets', label: 'Max outlets' },
  { key: 'staffAccounts', label: 'Max staff seats' },
  { key: 'qrMenus', label: 'Max QR menus' },
];

const BOOLEAN_KEYS = new Set(CMS_BOOLEAN_FEATURES.map((f) => f.key));
const NUMERIC_KEYS = new Set(CMS_NUMERIC_FEATURES.map((f) => f.key));

export function sanitizeFeatureOverrides(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out = {};
  for (const [key, val] of Object.entries(raw)) {
    if (BOOLEAN_KEYS.has(key) && typeof val === 'boolean') {
      out[key] = val;
    } else if (NUMERIC_KEYS.has(key) && typeof val === 'number' && Number.isFinite(val) && val >= 0) {
      out[key] = Math.round(val);
    }
  }
  return out;
}

export function applyFeatureOverrides(limits, overrides) {
  if (!overrides || typeof overrides !== 'object') return limits;
  const next = { ...limits };
  for (const [key, val] of Object.entries(overrides)) {
    if (BOOLEAN_KEYS.has(key) && typeof val === 'boolean') {
      next[key] = val;
    } else if (NUMERIC_KEYS.has(key) && typeof val === 'number') {
      next[key] = val;
    }
  }
  return next;
}

export function deserializeLimits(serialized) {
  if (!serialized) return {};
  return {
    ...serialized,
    outlets: serialized.outlets == null ? Infinity : serialized.outlets,
    staffAccounts: serialized.staffAccounts == null ? Infinity : serialized.staffAccounts,
    qrMenus: serialized.qrMenus == null ? Infinity : serialized.qrMenus,
  };
}
