import { PLAN_LIMITS, type PlanId, type PlanLimits } from "@/lib/plans";

export type FeatureOverrideKey = keyof PlanLimits;
export type FeatureOverrides = Partial<Record<FeatureOverrideKey, boolean | number>>;

export const CMS_BOOLEAN_FEATURES: { key: FeatureOverrideKey; label: string }[] = [
  { key: "kitchenDisplay", label: "Kitchen display" },
  { key: "analytics", label: "Analytics" },
  { key: "tableManagement", label: "Table management" },
  { key: "mobileAppAccess", label: "Mobile app" },
  { key: "platformIntegrations", label: "Platform integrations" },
  { key: "swiggyIntegration", label: "Swiggy" },
  { key: "zomatoIntegration", label: "Zomato" },
  { key: "customerOrdering", label: "Customer ordering" },
  { key: "inventoryManagement", label: "Inventory" },
  { key: "whatsappIntegration", label: "WhatsApp bills & messaging" },
  { key: "aiMenuImport", label: "AI menu import" },
];

export const CMS_NUMERIC_FEATURES: { key: FeatureOverrideKey; label: string }[] = [
  { key: "outlets", label: "Max outlets" },
  { key: "staffAccounts", label: "Max staff seats" },
  { key: "qrMenus", label: "Max QR menus" },
];

export function planBaseLimits(planType: PlanId | null | undefined): PlanLimits {
  if (!planType || !(planType in PLAN_LIMITS)) {
    return { ...PLAN_LIMITS.starter, outlets: 0, staffAccounts: 0, qrMenus: 0 };
  }
  return { ...PLAN_LIMITS[planType] };
}

export function applyFeatureOverrides(
  limits: PlanLimits,
  overrides: FeatureOverrides | null | undefined
): PlanLimits {
  if (!overrides) return limits;
  const next = { ...limits };
  for (const [key, val] of Object.entries(overrides) as [FeatureOverrideKey, boolean | number][]) {
    if (typeof val === "boolean" && key in next) {
      (next as Record<string, boolean | number>)[key] = val;
    } else if (typeof val === "number" && Number.isFinite(val) && val >= 0) {
      (next as Record<string, boolean | number>)[key] = val;
    }
  }
  return next;
}

export function isFeatureEnabled(value: boolean | number): boolean {
  if (typeof value === "boolean") return value;
  return value > 0;
}

export function featureOverrideValue(
  overrides: FeatureOverrides,
  key: FeatureOverrideKey
): boolean | number | undefined {
  return overrides[key];
}

export function hasOverride(overrides: FeatureOverrides, key: FeatureOverrideKey): boolean {
  return overrides[key] !== undefined;
}
