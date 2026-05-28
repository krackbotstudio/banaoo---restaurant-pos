import pool from './db.js';
import {
  PLAN_LIMITS,
  aggregateAddonsFromRows,
  computeEffectiveLimits,
  fetchUsage,
  serializeLimits,
} from './entitlements.js';
import { applyFeatureOverrides, sanitizeFeatureOverrides } from './cms-features.js';

const PLAN_TYPES = new Set(['starter', 'professional', 'enterprise']);

export function buildAccessMeta(profile) {
  const active = isComplimentaryAccessActive(profile);
  return {
    is_test_account: !!profile?.is_test_account,
    billing_exempt: !!profile?.billing_exempt,
    complimentary_plan: profile?.complimentary_plan ?? null,
    complimentary_expires_at: profile?.complimentary_expires_at ?? null,
    is_complimentary_active: active,
    effective_plan: active ? resolveComplimentaryPlan(profile) : null,
    access_source: profile?.is_test_account
      ? 'test_account'
      : active
        ? 'complimentary'
        : null,
  };
}

export async function fetchProfileAccess(userId) {
  try {
    const { rows } = await pool.query(
      `SELECT is_test_account, billing_exempt, complimentary_plan, complimentary_expires_at,
              account_status, feature_overrides
       FROM public.profiles
       WHERE user_id = $1
       LIMIT 1`,
      [userId]
    );
    const row = rows[0] ?? null;
    if (row && row.feature_overrides && typeof row.feature_overrides === 'object') {
      row.feature_overrides = sanitizeFeatureOverrides(row.feature_overrides);
    } else if (row) {
      row.feature_overrides = {};
    }
    return row;
  } catch (err) {
    if (err.code !== '42703') throw err;
    const { rows } = await pool.query(
      `SELECT account_status FROM public.profiles WHERE user_id = $1 LIMIT 1`,
      [userId]
    );
    return rows[0]
      ? {
          ...rows[0],
          is_test_account: false,
          billing_exempt: false,
          complimentary_plan: null,
          complimentary_expires_at: null,
          feature_overrides: {},
        }
      : null;
  }
}

export function mergeLimitsWithProfileOverrides(limits, profileAccess) {
  if (!profileAccess?.feature_overrides) return limits;
  const merged = applyFeatureOverrides(limits, profileAccess.feature_overrides);
  // Test accounts from CMS always keep enterprise capacity caps (overrides cannot shrink outlets/staff).
  if (profileAccess.is_test_account) {
    const enterprise = PLAN_LIMITS.enterprise;
    return {
      ...merged,
      outlets: enterprise.outlets,
      staffAccounts: enterprise.staffAccounts,
      qrMenus: enterprise.qrMenus,
    };
  }
  return merged;
}

export function isComplimentaryAccessActive(profile) {
  if (!profile) return false;
  if (profile.is_test_account) return true;
  if (!profile.billing_exempt || !profile.complimentary_plan) return false;
  if (profile.complimentary_expires_at) {
    const exp = new Date(profile.complimentary_expires_at);
    if (!Number.isNaN(exp.getTime()) && exp < new Date()) return false;
  }
  return true;
}

export function resolveComplimentaryPlan(profile) {
  if (!profile) return null;
  if (profile.is_test_account) return 'enterprise';
  if (profile.billing_exempt && profile.complimentary_plan) return profile.complimentary_plan;
  return null;
}

function fullEnterpriseAddons() {
  return {
    extra_outlets: 0,
    extra_staff: 0,
    swiggy: true,
    zomato: true,
    customer_ordering: true,
    inventory: true,
    whatsapp: true,
  };
}

export async function buildComplimentaryEntitlements(userId, planType, { isTestAccount = false } = {}) {
  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setFullYear(expiresAt.getFullYear() + (isTestAccount ? 10 : 1));

  const subscription = {
    id: `cms-complimentary-${userId}`,
    user_id: userId,
    plan_type: planType,
    status: 'active',
    trial_ends_at: null,
    expires_at: expiresAt.toISOString(),
    period_months: isTestAccount ? 120 : 12,
    razorpay_subscription_id: null,
    razorpay_order_id: `cms-grant-${userId}`,
    razorpay_payment_id: `cms-grant-${userId}`,
    current_period_start: now.toISOString(),
    current_period_end: expiresAt.toISOString(),
    cancelled_at: null,
    created_at: now.toISOString(),
  };

  const addons =
    planType === 'enterprise' || isTestAccount
      ? fullEnterpriseAddons()
      : await fetchActiveAddonsSafe(userId);

  const profileAccess = await fetchProfileAccess(userId);
  const rawLimits = computeEffectiveLimits(planType, addons, true);
  const effective_limits = serializeLimits(
    mergeLimitsWithProfileOverrides(rawLimits, profileAccess)
  );
  const usage = await fetchUsage(userId);

  return {
    subscription,
    addons,
    effective_limits,
    usage,
    has_active_subscription: true,
    access_source: isTestAccount ? 'test_account' : 'complimentary',
    feature_overrides: profileAccess?.feature_overrides ?? {},
    access: buildAccessMeta(profileAccess),
  };
}

async function fetchActiveAddonsSafe(userId) {
  try {
    const { rows } = await pool.query(
      `SELECT addon_type, SUM(quantity)::int AS quantity
       FROM public.subscription_addons
       WHERE user_id = $1 AND status = 'active'
         AND (expires_at IS NULL OR expires_at > NOW())
       GROUP BY addon_type`,
      [userId]
    );
    return aggregateAddonsFromRows(rows);
  } catch {
    return aggregateAddonsFromRows([]);
  }
}

export async function syncComplimentarySubscription(userId, planType, expiresAt) {
  if (!PLAN_TYPES.has(planType)) {
    throw new Error('Invalid plan type');
  }

  const exp = expiresAt ? new Date(expiresAt) : new Date();
  if (!expiresAt) {
    exp.setFullYear(exp.getFullYear() + 1);
  }
  const now = new Date();
  const orderId = `cms-grant-${userId}`;

  await pool.query(
    `UPDATE public.subscriptions
     SET status = 'cancelled', cancelled_at = COALESCE(cancelled_at, NOW()), updated_at = NOW()
     WHERE user_id = $1 AND status IN ('active', 'trialing', 'past_due')`,
    [userId]
  );

  const { rows } = await pool.query(
    `INSERT INTO public.subscriptions (
       user_id, plan_type, status, period_months, expires_at,
       current_period_start, current_period_end,
       razorpay_order_id, razorpay_payment_id, trial_ends_at
     ) VALUES ($1, $2, 'active', $3, $4, $5, $4, $6, $6, NULL)
     ON CONFLICT (razorpay_order_id) WHERE razorpay_order_id IS NOT NULL
     DO UPDATE SET
       plan_type = EXCLUDED.plan_type,
       status = 'active',
       period_months = EXCLUDED.period_months,
       expires_at = EXCLUDED.expires_at,
       current_period_start = EXCLUDED.current_period_start,
       current_period_end = EXCLUDED.current_period_end,
       cancelled_at = NULL,
       updated_at = NOW()
     RETURNING *`,
    [
      userId,
      planType,
      Math.max(1, Math.round((exp.getTime() - now.getTime()) / (30 * 24 * 60 * 60 * 1000))),
      exp.toISOString(),
      now.toISOString(),
      orderId,
    ]
  );

  return rows[0];
}

export async function applyProfileAccessUpdate(userId, body) {
  const {
    is_test_account,
    billing_exempt,
    complimentary_plan,
    complimentary_expires_at,
    feature_overrides,
    sync_subscription = true,
  } = body;

  let isTest = !!is_test_account;
  let exempt = !!billing_exempt;
  let plan = complimentary_plan ? String(complimentary_plan).toLowerCase() : null;

  if (isTest) {
    exempt = true;
    plan = 'enterprise';
  }

  if (exempt && plan && !PLAN_TYPES.has(plan)) {
    throw new Error('Invalid complimentary_plan');
  }
  if (exempt && !plan) {
    plan = 'professional';
  }

  const overrides =
    feature_overrides !== undefined ? sanitizeFeatureOverrides(feature_overrides) : undefined;

  const { rows } = await pool.query(
    `UPDATE public.profiles
     SET is_test_account = $2,
         billing_exempt = $3,
         complimentary_plan = $4,
         complimentary_expires_at = $5,
         feature_overrides = COALESCE($6, feature_overrides),
         account_status = CASE WHEN ($2 OR $3) THEN 'approved' ELSE account_status END,
         onboarding_completed = CASE WHEN ($2 OR $3) THEN true ELSE onboarding_completed END
     WHERE user_id = $1
     RETURNING user_id, is_test_account, billing_exempt, complimentary_plan, complimentary_expires_at,
               account_status, feature_overrides`,
    [
      userId,
      isTest,
      exempt,
      exempt ? plan : null,
      complimentary_expires_at || null,
      overrides !== undefined ? JSON.stringify(overrides) : null,
    ]
  );

  if (!rows[0]) throw new Error('Customer not found');

  let subscription = null;
  if (sync_subscription && (isTest || exempt)) {
    const exp = complimentary_expires_at
      ? new Date(complimentary_expires_at)
      : null;
    if (isTest && !exp) {
      const far = new Date();
      far.setFullYear(far.getFullYear() + 10);
      subscription = await syncComplimentarySubscription(userId, 'enterprise', far.toISOString());
    } else {
      subscription = await syncComplimentarySubscription(userId, plan, exp ? exp.toISOString() : null);
    }
  }

  return { profile: rows[0], subscription };
}

export function listPlanFeatureSummary(planType) {
  const limits = PLAN_LIMITS[planType];
  if (!limits) return [];
  const labels = {
    outlets: 'Outlets',
    staffAccounts: 'Staff seats',
    kitchenDisplay: 'Kitchen',
    analytics: 'Analytics',
    tableManagement: 'Tables',
    mobileAppAccess: 'Mobile app',
    customerOrdering: 'Customer ordering',
    inventoryManagement: 'Inventory',
    swiggyIntegration: 'Swiggy',
    zomatoIntegration: 'Zomato',
    platformIntegrations: 'Integrations',
    aiMenuImport: 'AI menu import',
  };
  return Object.entries(labels)
    .filter(([key]) => {
      const v = limits[key];
      return v === true || (typeof v === 'number' && v > 0);
    })
    .map(([, label]) => label);
}
