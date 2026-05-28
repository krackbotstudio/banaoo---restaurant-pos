import pool from '../db.js';
import { requireCmsAuth } from './middleware.js';
import { logAdminAction } from './audit.js';
import { sanitizeFeatureOverrides } from '../cms-features.js';

const EDIT_ROLES = new Set(['super_admin', 'billing']);
const ALLOWED_STATUS = new Set(['trialing', 'active', 'past_due', 'cancelled']);
const ALLOWED_PLAN = new Set(['starter', 'professional', 'enterprise']);

function canEdit(admin) {
  return admin && EDIT_ROLES.has(admin.role);
}

export function registerCmsSubscriptionsRoutes(app) {
  app.get('/api/cms/subscriptions', requireCmsAuth, async (req, res) => {
    const status = String(req.query.status || 'all').toLowerCase();
    const search = String(req.query.search || '').trim().toLowerCase();
    const values = [];

    let where = `WHERE p.role = 'owner'`;
    if (status !== 'all') {
      values.push(status);
      where += ` AND s.status = $${values.length}`;
    }
    if (search) {
      values.push(`%${search}%`);
      where += ` AND (lower(u.email) LIKE $${values.length} OR lower(coalesce(p.full_name, '')) LIKE $${values.length})`;
    }

    try {
      const { rows } = await pool.query(
        `SELECT s.id, s.user_id, s.plan_type, s.status, s.period_months,
                s.current_period_start, s.current_period_end, s.expires_at, s.cancelled_at, s.created_at,
                u.email,
                p.full_name,
                p.is_test_account,
                p.billing_exempt,
                p.complimentary_plan,
                p.feature_overrides
         FROM public.subscriptions s
         JOIN public.users u ON u.id = s.user_id
         LEFT JOIN public.profiles p ON p.user_id = s.user_id
         ${where}
         ORDER BY s.created_at DESC
         LIMIT 300`,
        values
      );
      const subscriptions = rows.map((row) => ({
        ...row,
        feature_overrides: sanitizeFeatureOverrides(row.feature_overrides ?? {}),
      }));
      res.json({ subscriptions });
    } catch (err) {
      console.error('GET /api/cms/subscriptions:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.patch('/api/cms/subscriptions/:id', requireCmsAuth, async (req, res) => {
    if (!canEdit(req.cmsAdmin)) {
      return res.status(403).json({ error: 'Billing or super admin access required' });
    }

    const { id } = req.params;
    const nextStatus = req.body?.status !== undefined ? String(req.body.status).toLowerCase() : undefined;
    const nextPlan = req.body?.plan_type !== undefined ? String(req.body.plan_type).toLowerCase() : undefined;
    const nextPeriodMonths = req.body?.period_months;
    const nextExpiresAt = req.body?.expires_at;

    if (nextStatus !== undefined && !ALLOWED_STATUS.has(nextStatus)) {
      return res.status(400).json({ error: 'Invalid subscription status' });
    }
    if (nextPlan !== undefined && !ALLOWED_PLAN.has(nextPlan)) {
      return res.status(400).json({ error: 'Invalid plan_type' });
    }
    if (
      nextPeriodMonths !== undefined &&
      (!Number.isInteger(nextPeriodMonths) || nextPeriodMonths < 1 || nextPeriodMonths > 36)
    ) {
      return res.status(400).json({ error: 'period_months must be an integer between 1 and 36' });
    }
    if (nextExpiresAt !== undefined && Number.isNaN(Date.parse(String(nextExpiresAt)))) {
      return res.status(400).json({ error: 'Invalid expires_at date' });
    }

    try {
      const { rows } = await pool.query(
        `UPDATE public.subscriptions
         SET status = COALESCE($2, status),
             plan_type = COALESCE($3, plan_type),
             period_months = COALESCE($4, period_months),
             expires_at = COALESCE($5, expires_at),
             cancelled_at = CASE
               WHEN COALESCE($2, status) = 'cancelled' THEN COALESCE(cancelled_at, now())
               ELSE cancelled_at
             END,
             updated_at = now()
         WHERE id = $1
         RETURNING id, user_id, plan_type, status, period_months,
                   current_period_start, current_period_end, expires_at, cancelled_at, created_at`,
        [
          id,
          nextStatus ?? null,
          nextPlan ?? null,
          nextPeriodMonths ?? null,
          nextExpiresAt ?? null,
        ]
      );
      const updated = rows[0];
      if (!updated) return res.status(404).json({ error: 'Subscription not found' });

      if (nextPlan !== undefined) {
        await pool.query(
          `UPDATE public.profiles
           SET complimentary_plan = CASE WHEN billing_exempt OR is_test_account THEN $2 ELSE complimentary_plan END
           WHERE user_id = $1`,
          [updated.user_id, nextPlan]
        );
      }

      await logAdminAction({
        adminId: req.cmsAdmin?.source === 'admin_users' ? req.cmsAdmin.id : null,
        adminEmail: req.cmsAdmin?.email ?? null,
        action: 'cms.subscriptions.update',
        targetType: 'subscription',
        targetId: updated.id,
        metadata: {
          status: nextStatus ?? null,
          plan_type: nextPlan ?? null,
          period_months: nextPeriodMonths ?? null,
          expires_at: nextExpiresAt ?? null,
        },
        req,
      });

      res.json({ subscription: updated });
    } catch (err) {
      console.error('PATCH /api/cms/subscriptions/:id:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.patch('/api/cms/customers/:userId/features', requireCmsAuth, async (req, res) => {
    if (!canEdit(req.cmsAdmin)) {
      return res.status(403).json({ error: 'Billing or super admin access required' });
    }
    const { userId } = req.params;
    const feature_overrides = sanitizeFeatureOverrides(req.body?.feature_overrides ?? {});
    try {
      const { rows } = await pool.query(
        `UPDATE public.profiles
         SET feature_overrides = $2::jsonb
         WHERE user_id = $1
         RETURNING user_id, feature_overrides, is_test_account, billing_exempt, complimentary_plan`,
        [userId, JSON.stringify(feature_overrides)]
      );
      if (!rows[0]) return res.status(404).json({ error: 'Customer not found' });

      await logAdminAction({
        adminId: req.cmsAdmin?.source === 'admin_users' ? req.cmsAdmin.id : null,
        adminEmail: req.cmsAdmin?.email ?? null,
        action: 'cms.customers.features.update',
        targetType: 'customer',
        targetId: userId,
        metadata: { feature_overrides },
        req,
      });

      res.json({ profile: rows[0], feature_overrides });
    } catch (err) {
      console.error('PATCH /api/cms/customers/:userId/features:', err);
      res.status(500).json({ error: err.message });
    }
  });

}
