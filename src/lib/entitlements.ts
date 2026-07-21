import {
  PLAN_LIMITS,
  DEFAULT_LIMITS,
  type PlanId,
  type PlanLimits,
  type AddonType,
} from "@/lib/plans";

export interface SubscriptionAddons {
  extra_outlets: number;
  extra_staff: number;
  swiggy: boolean;
  zomato: boolean;
  customer_ordering: boolean;
  inventory: boolean;
  whatsapp: boolean;
  shiprocket: boolean;
  razorpay: boolean;
  google_pay_india: boolean;
}

export const EMPTY_ADDONS: SubscriptionAddons = {
  extra_outlets: 0,
  extra_staff: 0,
  swiggy: false,
  zomato: false,
  customer_ordering: false,
  inventory: false,
  whatsapp: false,
  shiprocket: false,
  razorpay: false,
  google_pay_india: false,
};

export function aggregateAddonsFromRows(
  rows: { addon_type: string; quantity: number }[]
): SubscriptionAddons {
  const out: SubscriptionAddons = { ...EMPTY_ADDONS };
  for (const row of rows) {
    const qty = Number(row.quantity) || 0;
    switch (row.addon_type as AddonType) {
      case "extra_outlet":
        out.extra_outlets += qty;
        break;
      case "extra_staff":
        out.extra_staff += qty;
        break;
      case "swiggy_integration":
        out.swiggy = out.swiggy || qty > 0;
        break;
      case "zomato_integration":
        out.zomato = out.zomato || qty > 0;
        break;
      case "customer_ordering":
        out.customer_ordering = out.customer_ordering || qty > 0;
        break;
      case "inventory_management":
        out.inventory = out.inventory || qty > 0;
        break;
      case "whatsapp_integration":
        out.whatsapp = out.whatsapp || qty > 0;
        break;
      case "shiprocket_delivery":
        out.shiprocket = out.shiprocket || qty > 0;
        break;
      case "razorpay_payments":
        out.razorpay = out.razorpay || qty > 0;
        break;
      case "google_pay_india":
        out.google_pay_india = out.google_pay_india || qty > 0;
        break;
      default:
        break;
    }
  }
  return out;
}

/** API sends null for unlimited numeric limits */
export type PlanLimitsApi = Omit<PlanLimits, "outlets" | "staffAccounts" | "qrMenus"> & {
  outlets: number | null;
  staffAccounts: number | null;
  qrMenus: number | null;
};

export function deserializeLimits(api: PlanLimitsApi): PlanLimits {
  return {
    ...api,
    outlets: api.outlets == null ? Infinity : api.outlets,
    staffAccounts: api.staffAccounts == null ? Infinity : api.staffAccounts,
    qrMenus: api.qrMenus == null ? Infinity : api.qrMenus,
  };
}

export function computeEffectiveLimits(
  planType: PlanId | string | null | undefined,
  addons: SubscriptionAddons,
  hasActiveSubscription: boolean
): PlanLimits {
  if (!hasActiveSubscription || !planType) {
    return { ...DEFAULT_LIMITS };
  }
  const base = PLAN_LIMITS[planType as PlanId] ?? DEFAULT_LIMITS;

  const outletBase = base.outlets === Infinity ? Infinity : base.outlets;
  const staffBase = base.staffAccounts === Infinity ? Infinity : base.staffAccounts;

  return {
    ...base,
    outlets:
      outletBase === Infinity ? Infinity : outletBase + addons.extra_outlets,
    staffAccounts:
      staffBase === Infinity ? Infinity : staffBase + addons.extra_staff,
    customerOrdering: base.customerOrdering || addons.customer_ordering,
    inventoryManagement: base.inventoryManagement || addons.inventory,
    swiggyIntegration: base.swiggyIntegration || addons.swiggy,
    zomatoIntegration: base.zomatoIntegration || addons.zomato,
    whatsappIntegration: base.whatsappIntegration || addons.whatsapp,
    shiprocketDelivery: base.shiprocketDelivery || addons.shiprocket,
    razorpayPayments: base.razorpayPayments || addons.razorpay,
    googlePayIndia: base.googlePayIndia || addons.google_pay_india,
    platformIntegrations:
      base.platformIntegrations || addons.swiggy || addons.zomato,
  };
}
