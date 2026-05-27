import pool from './db.js';

const PLAN_LIMITS = {
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
    aiMenuImport: false,
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
    aiMenuImport: false,
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
    aiMenuImport: true,
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
  aiMenuImport: false,
  qrMenus: 0,
};

// Internal test accounts that should always get full feature access.
// Keep this list small and explicit.
const INTERNAL_FULL_ACCESS_EMAILS = new Set([
  "krackbotstudio@gmail.com",
]);

export const ADDON_MONTHLY_PRICES = {
  extra_outlet: 250,
  extra_staff: 150,
  swiggy_integration: 499,
  zomato_integration: 499,
  customer_ordering: 299,
  inventory_management: 399,
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
  // Special-case internal test account(s) so UI feature gates are stable
  // even if their real billing/subscription rows are incomplete/expired.
  const { rows: userRows } = await pool.query(
    "SELECT email FROM public.users WHERE id = $1",
    [userId]
  );
  const email = userRows?.[0]?.email?.toLowerCase?.() ?? null;
  if (email && INTERNAL_FULL_ACCESS_EMAILS.has(email)) {
    // Subscription fields are used by the frontend to compute "days remaining"
    // and to decide whether to show renewal banners.
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + 365);

    const subscription = {
      id: `test-enterprise-${userId}`,
      user_id: userId,
      plan_type: "enterprise",
      status: "active",
      trial_ends_at: null,
      expires_at: expiresAt.toISOString(),
      period_months: 12,
      razorpay_subscription_id: null,
      razorpay_order_id: null,
      razorpay_payment_id: null,
      current_period_start: now.toISOString(),
      current_period_end: expiresAt.toISOString(),
      cancelled_at: null,
      created_at: now.toISOString(),
    };

    // Addons are mostly informational in the UI; feature gating is driven by limits.
    const addons = {
      extra_outlets: 0,
      extra_staff: 0,
      swiggy: true,
      zomato: true,
      customer_ordering: true,
      inventory: true,
    };

    const usage = await fetchUsage(userId);

    return {
      subscription,
      addons,
      effective_limits: serializeLimits(PLAN_LIMITS.enterprise),
      usage,
      has_active_subscription: true,
    };
  }

  const subscription = await fetchActiveSubscription(userId);
  const hasActiveSubscription = isSubscriptionActive(subscription);
  const addons = await fetchActiveAddons(userId);
  const effective_limits = computeEffectiveLimits(
    subscription?.plan_type,
    addons,
    hasActiveSubscription
  );
  const usage = await fetchUsage(userId);
  return {
    subscription,
    addons,
    effective_limits: serializeLimits(effective_limits),
    usage,
    has_active_subscription: hasActiveSubscription,
  };
}

export function calcAddonAmount(addonType, quantity, months) {
  const monthly = ADDON_MONTHLY_PRICES[addonType];
  if (!monthly) throw new Error(`Unknown add-on: ${addonType}`);
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
