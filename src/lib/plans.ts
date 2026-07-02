/** Internal plan IDs stored in DB / Razorpay — display names are Launcher / Growth / Expand */

export type PlanId = "starter" | "professional" | "enterprise";
export type PaidPlanId = "starter" | "professional";

export type FeatureCell =
  | { kind: "check" }
  | { kind: "dash" }
  | { kind: "addon" }
  | { kind: "text"; value: string };

export interface PlanDefinition {
  id: PlanId;
  displayName: string;
  tagline: string;
  monthlyPrice: number | null;
  mostPopular?: boolean;
  ctaLabel: string;
  ctaAction: "auth" | "settings" | "mailto";
  mailtoSubject?: string;
  /** Short bullets for Settings cards */
  highlights: string[];
}

export type AddonType =
  | "extra_outlet"
  | "extra_staff"
  | "swiggy_integration"
  | "zomato_integration"
  | "customer_ordering"
  | "inventory_management"
  | "whatsapp_integration"
  | "shiprocket_delivery";

export interface AddonCatalogItem {
  type: AddonType;
  name: string;
  description: string;
  /** Monthly price per unit (₹). null = contact sales */
  monthlyPrice: number | null;
  /** Stackable quantity (outlet / staff seats) */
  stackable: boolean;
}

export interface PlanLimits {
  outlets: number;
  staffAccounts: number;
  kitchenDisplay: boolean;
  analytics: boolean;
  tableManagement: boolean;
  mobileAppAccess: boolean;
  platformIntegrations: boolean;
  swiggyIntegration: boolean;
  zomatoIntegration: boolean;
  customerOrdering: boolean;
  inventoryManagement: boolean;
  whatsappIntegration: boolean;
  aiMenuImport: boolean;
  shiprocketDelivery: boolean;
  qrMenus: number;
}

export const BASE_PRICES: Record<PaidPlanId, number> = {
  starter: 499,
  professional: 699,
};

/** Platform subscription billing — minimum 3 months. */
export const BILLING_PERIOD_MONTHS = [3, 6, 12] as const;
export type BillingPeriodMonths = (typeof BILLING_PERIOD_MONTHS)[number];
export const DEFAULT_BILLING_PERIOD_MONTHS: BillingPeriodMonths = 3;

/** Add-on billing — can start from 1 month. */
export const ADDON_BILLING_PERIOD_MONTHS = [1, 3, 6, 12] as const;
export type AddonBillingPeriodMonths = (typeof ADDON_BILLING_PERIOD_MONTHS)[number];
export const DEFAULT_ADDON_BILLING_PERIOD_MONTHS: AddonBillingPeriodMonths = 1;

export const DISCOUNTS: Record<number, number> = {
  3: 0.05,
  6: 0.1,
  12: 0.2,
};

export function isValidBillingPeriodMonths(months: number): months is BillingPeriodMonths {
  return (BILLING_PERIOD_MONTHS as readonly number[]).includes(months);
}

export function isValidAddonBillingPeriodMonths(
  months: number
): months is AddonBillingPeriodMonths {
  return (ADDON_BILLING_PERIOD_MONTHS as readonly number[]).includes(months);
}

export function billingPeriodLabel(months: number): string {
  if (months === 3) return "3 Months";
  if (months === 6) return "6 Months";
  if (months === 12) return "12 Months";
  if (months === 1) return "1 Month";
  return `${months} months`;
}

export const ADDON_PRICES = {
  extraOutletPerMonth: 250,
  extraStaffPerMonth: 150,
  swiggyPerMonth: 499,
  zomatoPerMonth: 499,
  customerOrderingPerMonth: 299,
  inventoryPerMonth: 399,
  whatsappPerMonth: 349,
  shiprocketPerMonth: 0,
} as const;

export const ADDON_CATALOG: AddonCatalogItem[] = [
  {
    type: "extra_outlet",
    name: "Extra outlet",
    description: "Run an additional branch on the same account.",
    monthlyPrice: ADDON_PRICES.extraOutletPerMonth,
    stackable: true,
  },
  {
    type: "extra_staff",
    name: "Extra staff seat",
    description: "Add another staff login beyond your plan limit.",
    monthlyPrice: ADDON_PRICES.extraStaffPerMonth,
    stackable: true,
  },
  {
    type: "customer_ordering",
    name: "Customer ordering link",
    description: "Public menu & order link for your outlet (QR / shareable URL).",
    monthlyPrice: ADDON_PRICES.customerOrderingPerMonth,
    stackable: false,
  },
  {
    type: "swiggy_integration",
    name: "Swiggy integration",
    description: "Sync orders from Swiggy into your kitchen display.",
    monthlyPrice: ADDON_PRICES.swiggyPerMonth,
    stackable: false,
  },
  {
    type: "zomato_integration",
    name: "Zomato integration",
    description: "Sync orders from Zomato into your kitchen display.",
    monthlyPrice: ADDON_PRICES.zomatoPerMonth,
    stackable: false,
  },
  {
    type: "inventory_management",
    name: "Inventory management",
    description: "Track stock levels, low-stock alerts, and adjustments per outlet.",
    monthlyPrice: ADDON_PRICES.inventoryPerMonth,
    stackable: false,
  },
  {
    type: "whatsapp_integration",
    name: "WhatsApp integration",
    description:
      "Send digital bills and order updates to customers on WhatsApp — no manual typing or paper bills.",
    monthlyPrice: ADDON_PRICES.whatsappPerMonth,
    stackable: false,
  },
  {
    type: "shiprocket_delivery",
    name: "Shiprocket delivery",
    description: "Auto-book Shiprocket riders for your outlet's delivery orders.",
    monthlyPrice: ADDON_PRICES.shiprocketPerMonth,
    stackable: false,
  },
];

export const PLANS: PlanDefinition[] = [
  {
    id: "starter",
    displayName: "Launcher",
    tagline: "Everything you need to run one outlet.",
    monthlyPrice: 499,
    ctaLabel: "Get Started",
    ctaAction: "auth",
    highlights: [
      "1 Outlet",
      "1 staff account",
      "Order, menu, kitchen & table management",
      "Analytics & reports",
      "Email support",
    ],
  },
  {
    id: "professional",
    displayName: "Growth",
    tagline: "Launcher plus mobile app and priority support.",
    monthlyPrice: 699,
    mostPopular: true,
    ctaLabel: "Upgrade Now",
    ctaAction: "auth",
    highlights: [
      "1 Outlet",
      "2 staff accounts",
      "All Launcher features",
      "Mobile app access",
      "Priority support",
    ],
  },
  {
    id: "enterprise",
    displayName: "Expand",
    tagline: "For multi-branch brands with custom needs.",
    monthlyPrice: null,
    ctaLabel: "Contact Us",
    ctaAction: "mailto",
    mailtoSubject: "Expand Plan Enquiry",
    highlights: [
      "Unlimited outlets",
      "Flexible staff scaling",
      "All Growth features",
      "Custom integrations",
      "Multi-branch management",
      "Dedicated support",
    ],
  },
];

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  starter: {
    outlets: 1,
    staffAccounts: 1,
    kitchenDisplay: true,
    analytics: true,
    tableManagement: true,
    mobileAppAccess: false,
    platformIntegrations: false,
    swiggyIntegration: false,
    zomatoIntegration: false,
    customerOrdering: false,
    inventoryManagement: false,
    whatsappIntegration: false,
    aiMenuImport: false,
    shiprocketDelivery: false,
    qrMenus: 3,
  },
  professional: {
    outlets: 1,
    staffAccounts: 2,
    kitchenDisplay: true,
    analytics: true,
    tableManagement: true,
    mobileAppAccess: true,
    platformIntegrations: false,
    swiggyIntegration: false,
    zomatoIntegration: false,
    customerOrdering: true,
    inventoryManagement: false,
    whatsappIntegration: false,
    aiMenuImport: false,
    shiprocketDelivery: false,
    qrMenus: 3,
  },
  enterprise: {
    outlets: Infinity,
    staffAccounts: Infinity,
    kitchenDisplay: true,
    analytics: true,
    tableManagement: true,
    mobileAppAccess: true,
    platformIntegrations: true,
    swiggyIntegration: true,
    zomatoIntegration: true,
    customerOrdering: true,
    inventoryManagement: true,
    whatsappIntegration: true,
    aiMenuImport: true,
    shiprocketDelivery: true,
    qrMenus: Infinity,
  },
};

export const DEFAULT_LIMITS: PlanLimits = {
  outlets: 0,
  staffAccounts: 0,
  kitchenDisplay: false,
  analytics: false,
  tableManagement: false,
  mobileAppAccess: false,
  platformIntegrations: false,
  swiggyIntegration: false,
  zomatoIntegration: false,
  customerOrdering: false,
  inventoryManagement: false,
  whatsappIntegration: false,
  aiMenuImport: false,
  shiprocketDelivery: false,
  qrMenus: 0,
};

export interface ComparisonRow {
  label: string;
  starter: FeatureCell;
  professional: FeatureCell;
  enterprise: FeatureCell;
  /** Row is about pricing / add-ons (styled differently on mobile) */
  isPricingRow?: boolean;
}

export const COMPARISON_ROWS: ComparisonRow[] = [
  {
    label: "Pricing",
    isPricingRow: true,
    starter: { kind: "text", value: "₹499/month" },
    professional: { kind: "text", value: "₹699/month" },
    enterprise: { kind: "text", value: "Custom Pricing" },
  },
  {
    label: "Outlets Included",
    starter: { kind: "text", value: "1 Outlet" },
    professional: { kind: "text", value: "1 Outlet" },
    enterprise: { kind: "text", value: "Unlimited" },
  },
  {
    label: "Staff Accounts Included",
    starter: { kind: "text", value: "1 Staff" },
    professional: { kind: "text", value: "2 Staff" },
    enterprise: { kind: "text", value: "Flexible Scaling" },
  },
  { label: "Order Management", starter: { kind: "check" }, professional: { kind: "check" }, enterprise: { kind: "check" } },
  { label: "Menu Management", starter: { kind: "check" }, professional: { kind: "check" }, enterprise: { kind: "check" } },
  { label: "Kitchen Display System", starter: { kind: "check" }, professional: { kind: "check" }, enterprise: { kind: "check" } },
  { label: "Analytics & Reports", starter: { kind: "check" }, professional: { kind: "check" }, enterprise: { kind: "check" } },
  { label: "Table Management", starter: { kind: "check" }, professional: { kind: "check" }, enterprise: { kind: "check" } },
  { label: "Inventory Management", starter: { kind: "addon" }, professional: { kind: "addon" }, enterprise: { kind: "check" } },
  { label: "Mobile App Access", starter: { kind: "dash" }, professional: { kind: "check" }, enterprise: { kind: "check" } },
  { label: "Email Support", starter: { kind: "check" }, professional: { kind: "check" }, enterprise: { kind: "check" } },
  { label: "Priority Support", starter: { kind: "dash" }, professional: { kind: "check" }, enterprise: { kind: "check" } },
  { label: "Custom Integrations", starter: { kind: "dash" }, professional: { kind: "dash" }, enterprise: { kind: "check" } },
  { label: "Multi-Branch Management", starter: { kind: "addon" }, professional: { kind: "addon" }, enterprise: { kind: "check" } },
  { label: "Dedicated Support", starter: { kind: "dash" }, professional: { kind: "dash" }, enterprise: { kind: "check" } },
  {
    label: "Additional Outlet",
    isPricingRow: true,
    starter: { kind: "text", value: "₹250/month" },
    professional: { kind: "text", value: "₹250/month" },
    enterprise: { kind: "text", value: "Custom" },
  },
  {
    label: "Extra Staff Account",
    isPricingRow: true,
    starter: { kind: "text", value: "₹150/month" },
    professional: { kind: "text", value: "₹150/month" },
    enterprise: { kind: "text", value: "Custom" },
  },
];

export function getPlanById(id: PlanId): PlanDefinition {
  return PLANS.find((p) => p.id === id) ?? PLANS[0];
}

export function getPlanDisplayName(id: string | null | undefined): string {
  if (!id) return "No Plan";
  const plan = PLANS.find((p) => p.id === id);
  return plan?.displayName ?? id.charAt(0).toUpperCase() + id.slice(1);
}

export function calcPlanTotal(planId: PaidPlanId, months: number): number {
  const base = BASE_PRICES[planId];
  const discount = DISCOUNTS[months] ?? 0;
  return Math.round(base * months * (1 - discount));
}

export function calcPlanSavings(planId: PaidPlanId, months: number): number {
  return Math.round(BASE_PRICES[planId] * months) - calcPlanTotal(planId, months);
}

export function formatPlanPrice(plan: PlanDefinition): string {
  if (plan.monthlyPrice == null) return "Custom";
  return `₹${plan.monthlyPrice.toLocaleString("en-IN")}/month`;
}

export const UPGRADE_MESSAGES: Record<keyof PlanLimits, string> = {
  outlets: "Add an extra outlet (₹250/month) or upgrade to Expand for unlimited outlets",
  staffAccounts: "Add extra staff (₹150/month per account) or upgrade to Expand",
  kitchenDisplay: "Kitchen Display is included on all paid plans",
  analytics: "Analytics is included on Launcher and above",
  tableManagement: "Table Management is included on Launcher and above",
  mobileAppAccess: "Mobile app access is available on Growth and Expand plans",
  platformIntegrations: "Platform integrations are available as add-ons or on Expand",
  swiggyIntegration: "Purchase the Swiggy add-on or upgrade to Expand",
  zomatoIntegration: "Purchase the Zomato add-on or upgrade to Expand",
  customerOrdering: "Purchase the customer ordering add-on or upgrade to Growth",
  inventoryManagement: "Purchase the Inventory Management add-on or upgrade to Expand",
  whatsappIntegration:
    "Purchase the WhatsApp integration add-on to send digital bills and updates on WhatsApp",
  aiMenuImport: "AI Menu Import is available on the Expand plan",
  shiprocketDelivery: "Activate the free Shiprocket delivery add-on or upgrade to Expand",
  qrMenus: "Upgrade to Expand for unlimited QR menus",
};

export function getAddonCatalogItem(type: AddonType): AddonCatalogItem | undefined {
  return ADDON_CATALOG.find((a) => a.type === type);
}

export function calcAddonTotal(
  addonType: AddonType,
  quantity: number,
  months: number
): number {
  const item = getAddonCatalogItem(addonType);
  if (!item?.monthlyPrice) return 0;
  const qty = item.stackable ? Math.max(1, quantity) : 1;
  const discount = DISCOUNTS[months] ?? 0;
  return Math.round(item.monthlyPrice * qty * months * (1 - discount));
}
