import pool from './db.js';
import {
  fetchProfileAccess,
  isComplimentaryAccessActive,
  resolveComplimentaryPlan,
  buildComplimentaryEntitlements,
  mergeLimitsWithProfileOverrides,
  buildAccessMeta,
} from './access-grants.js';

export const PLAN_LIMITS = {
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
    razorpayPayments: true,
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
    razorpayPayments: true,
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
    razorpayPayments: true,
    qrMenus: Infinity,
  },
};

const DEFAULT_LIMITS = {
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
  razorpayPayments: false,
  qrMenus: 0,
};

export const ADDON_MONTHLY_PRICES = {
  extra_outlet: 250,
  extra_staff: 150,
  swiggy_integration: 499,
  zomato_integration: 499,
  customer_ordering: 299,
  inventory_management: 399,
  whatsapp_integration: 349,
  shiprocket_delivery: 0,
  razorpay_payments: 0,
};

const STACKABLE_ADDONS = new Set(['extra_outlet', 'extra_staff']);

export function aggregateAddonsFromRows(rows) {
  const out = {
    extra_outlets: 0,
    extra_staff: 0,
    swiggy: false,
    zomato: false,
    customer_ordering: false,
    inventory: false,
    whatsapp: false,
    shiprocket: false,
    razorpay: false,
  };
  for (const row of rows) {
    const qty = Number(row.quantity) || 0;
    switch (row.addon_type) {
      case 'extra_outlet':
        out.extra_outlets += qty;
        break;
      case 'extra_staff':
        out.extra_staff += qty;
        break;
      case 'swiggy_integration':
        out.swiggy = out.swiggy || qty > 0;
        break;
      case 'zomato_integration':
        out.zomato = out.zomato || qty > 0;
        break;
      case 'customer_ordering':
        out.customer_ordering = out.customer_ordering || qty > 0;
        break;
      case 'inventory_management':
        out.inventory = out.inventory || qty > 0;
        break;
      case 'whatsapp_integration':
        out.whatsapp = out.whatsapp || qty > 0;
        break;
      case 'shiprocket_delivery':
        out.shiprocket = out.shiprocket || qty > 0;
        break;
      case 'razorpay_payments':
        out.razorpay = out.razorpay || qty > 0;
        break;
      default:
        break;
    }
  }
  return out;
}

export function computeEffectiveLimits(planType, addons, hasActiveSubscription) {
  if (!hasActiveSubscription || !planType) {
    return { ...DEFAULT_LIMITS };
  }
  const base = PLAN_LIMITS[planType] ?? DEFAULT_LIMITS;
  const outletBase = base.outlets === Infinity ? Infinity : base.outlets;
  const staffBase = base.staffAccounts === Infinity ? Infinity : base.staffAccounts;

  return {
    ...base,
    outlets: outletBase === Infinity ? Infinity : outletBase + addons.extra_outlets,
    staffAccounts: staffBase === Infinity ? Infinity : staffBase + addons.extra_staff,
    customerOrdering: base.customerOrdering || addons.customer_ordering,
    inventoryManagement: base.inventoryManagement || addons.inventory,
    swiggyIntegration: base.swiggyIntegration || addons.swiggy,
    zomatoIntegration: base.zomatoIntegration || addons.zomato,
    whatsappIntegration: base.whatsappIntegration || addons.whatsapp,
    shiprocketDelivery: base.shiprocketDelivery || addons.shiprocket,
    razorpayPayments: base.razorpayPayments || addons.razorpay,
    platformIntegrations:
      base.platformIntegrations || addons.swiggy || addons.zomato,
  };
}

/** JSON-safe limits (Infinity → null) */
export function serializeLimits(limits) {
  return {
    ...limits,
    outlets: limits.outlets === Infinity ? null : limits.outlets,
    staffAccounts: limits.staffAccounts === Infinity ? null : limits.staffAccounts,
    qrMenus: limits.qrMenus === Infinity ? null : limits.qrMenus,
  };
}

export function isSubscriptionActive(sub) {
  if (!sub) return false;
  const expiresAt = sub.expires_at
    ? new Date(sub.expires_at)
    : sub.trial_ends_at
      ? new Date(sub.trial_ends_at)
      : null;
  const isExpired = expiresAt ? expiresAt < new Date() : false;
  const statusOk = sub.status === 'active' || sub.status === 'trialing';
  return statusOk && !isExpired;
}

export async function fetchActiveSubscription(userId) {
  const { rows } = await pool.query(
    `SELECT * FROM public.subscriptions
     WHERE user_id = $1 AND status IN ('active', 'trialing', 'past_due')
     ORDER BY created_at DESC LIMIT 1`,
    [userId]
  );
  return rows[0] ?? null;
}

export async function fetchActiveAddons(userId) {
  try {
    const { rows } = await pool.query(
      `SELECT addon_type, SUM(quantity)::int AS quantity
       FROM public.subscription_addons
       WHERE user_id = $1
         AND status = 'active'
         AND (expires_at IS NULL OR expires_at > NOW())
       GROUP BY addon_type`,
      [userId]
    );
    return aggregateAddonsFromRows(rows);
  } catch (err) {
    if (err.code === '42P01') {
      return aggregateAddonsFromRows([]);
    }
    throw err;
  }
}

export async function fetchUsage(userId) {
  const [outletsRes, staffRes] = await Promise.all([
    pool.query(
      'SELECT COUNT(*)::int AS count FROM public.outlets WHERE owner_id = $1',
      [userId]
    ),
    pool.query(
      'SELECT COUNT(*)::int AS count FROM public.staff_members WHERE owner_id = $1',
      [userId]
    ),
  ]);
  return {
    outlets: outletsRes.rows[0]?.count ?? 0,
    staff: staffRes.rows[0]?.count ?? 0,
  };
}

export async function buildEntitlementsPayload(userId) {
  const profileAccess = await fetchProfileAccess(userId);
  if (isComplimentaryAccessActive(profileAccess)) {
    const plan = resolveComplimentaryPlan(profileAccess);
    return buildComplimentaryEntitlements(userId, plan, {
      isTestAccount: !!profileAccess?.is_test_account,
    });
  }

  const subscription = await fetchActiveSubscription(userId);
  const hasActiveSubscription = isSubscriptionActive(subscription);
  const addons = await fetchActiveAddons(userId);
  const rawLimits = computeEffectiveLimits(
    subscription?.plan_type,
    addons,
    hasActiveSubscription
  );
  const effective_limits = serializeLimits(
    mergeLimitsWithProfileOverrides(rawLimits, profileAccess)
  );
  const usage = await fetchUsage(userId);
  const complimentaryActive = isComplimentaryAccessActive(profileAccess);

  return {
    subscription,
    addons,
    effective_limits,
    usage,
    has_active_subscription: hasActiveSubscription || complimentaryActive,
    feature_overrides: profileAccess?.feature_overrides ?? {},
    access: buildAccessMeta(profileAccess),
    access_source: complimentaryActive
      ? profileAccess?.is_test_account
        ? 'test_account'
        : 'complimentary'
      : null,
  };
}

export function calcAddonAmount(addonType, quantity, months) {
  if (!(addonType in ADDON_MONTHLY_PRICES)) {
    throw new Error(`Unknown add-on: ${addonType}`);
  }
  const monthly = ADDON_MONTHLY_PRICES[addonType];
  const qty = STACKABLE_ADDONS.has(addonType) ? Math.max(1, Number(quantity) || 1) : 1;
  const DISCOUNTS = { 3: 0.05, 6: 0.1, 12: 0.2 };
  const discount = DISCOUNTS[months] ?? 0;
  return Math.round(monthly * qty * months * (1 - discount));
}

export function normalizeAddonQuantity(addonType, quantity) {
  if (STACKABLE_ADDONS.has(addonType)) {
    return Math.max(1, Math.min(50, Number(quantity) || 1));
  }
  return 1;
}

export async function assertWithinOutletLimit(userId) {
  const payload = await buildEntitlementsPayload(userId);
  const max = payload.effective_limits.outlets;
  if (max == null) return payload;
  if (payload.usage.outlets >= max) {
    const err = new Error('Outlet limit reached. Purchase an extra outlet add-on or upgrade your plan.');
    err.code = 'OUTLET_LIMIT';
    err.status = 403;
    throw err;
  }
  return payload;
}
