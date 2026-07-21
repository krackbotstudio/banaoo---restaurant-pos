import pool from '../db.js';
import { requireCmsAuth } from './middleware.js';
import { logAdminAction } from './audit.js';
import { buildEntitlementsPayload } from '../entitlements.js';
import { getDefaultOperationMode } from '../business-types.js';
import {
  applyProfileAccessUpdate,
  fetchProfileAccess,
  fetchComplimentarySubscriptionWindow,
  isComplimentaryAccessActive,
  listPlanFeatureSummary,
  resolveComplimentaryPlan,
} from '../access-grants.js';

const EDIT_ROLES = new Set(['super_admin', 'support', 'billing']);
const BILLING_ROLES = new Set(['super_admin', 'billing']);
const ACCOUNT_STATUS = new Set(['pending', 'approved', 'rejected']);
const OPERATION_MODES = new Set(['standard', 'self_service']);

const OUTLET_SELECT = `id, name, address, phone, latitude, longitude, is_active, operation_mode, created_at, updated_at`;

function parseCoordinate(value, min, max, field) {
  if (value === undefined) return { supplied: false, value: null };
  if (value === null || value === '') return { supplied: true, value: null };
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    const err = new Error(`Invalid ${field}`);
    err.status = 400;
    throw err;
  }
  return { supplied: true, value: parsed };
}

function canEdit(admin) {
  return admin && EDIT_ROLES.has(admin.role);
}

function canEditBilling(admin) {
  return admin && BILLING_ROLES.has(admin.role);
}

export function registerCmsCustomerRoutes(app) {
  app.get('/api/cms/customers/:userId/overview', requireCmsAuth, async (req, res) => {
    const { userId } = req.params;
    try {
      const [profileRes, usageRes, outletsRes, subscriptionRes] = await Promise.all([
        pool.query(
          `SELECT p.*, u.email
           FROM public.profiles p
           JOIN public.users u ON u.id = p.user_id
           WHERE p.user_id = $1
           LIMIT 1`,
          [userId]
        ),
        Promise.all([
          pool.query('SELECT COUNT(*)::int AS count FROM public.outlets WHERE owner_id = $1', [userId]),
          pool.query('SELECT COUNT(*)::int AS count FROM public.staff_members WHERE owner_id = $1', [userId]),
        ]),
        pool.query(
          `SELECT ${OUTLET_SELECT}
           FROM public.outlets
           WHERE owner_id = $1
           ORDER BY is_active DESC, name ASC`,
          [userId]
        ),
        pool.query(
          `SELECT id, plan_type, status, period_months, expires_at, current_period_start, current_period_end, created_at
           FROM public.subscriptions
           WHERE user_id = $1
           ORDER BY created_at DESC
           LIMIT 1`,
          [userId]
        ),
      ]);

      const profile = profileRes.rows[0];
      if (!profile) return res.status(404).json({ error: 'Customer not found' });

      let entitlements_preview = null;
      try {
        entitlements_preview = await buildEntitlementsPayload(userId);
      } catch (entErr) {
        console.warn('overview entitlements preview:', entErr.message);
      }

      const effectivePlan = resolveComplimentaryPlan(profile);
      const subscriptionWindow = await fetchComplimentarySubscriptionWindow(userId);
      res.json({
        profile,
        usage: {
          outlets: usageRes[0].rows[0]?.count ?? 0,
          staff: usageRes[1].rows[0]?.count ?? 0,
        },
        outlets: outletsRes.rows,
        latest_subscription: subscriptionRes.rows[0] ?? null,
        access: {
          is_test_account: !!profile.is_test_account,
          billing_exempt: !!profile.billing_exempt,
          complimentary_plan: profile.complimentary_plan ?? null,
          complimentary_starts_at:
            subscriptionWindow.complimentary_starts_at ?? null,
          complimentary_expires_at:
            profile.complimentary_expires_at ??
            subscriptionWindow.complimentary_expires_at ??
            null,
          period_months: subscriptionWindow.period_months ?? null,
          feature_overrides: profile.feature_overrides ?? {},
          is_active: isComplimentaryAccessActive(profile),
          effective_plan: effectivePlan,
          feature_summary: effectivePlan ? listPlanFeatureSummary(effectivePlan) : [],
        },
        entitlements_preview,
      });
    } catch (err) {
      console.error('GET /api/cms/customers/:userId/overview:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/cms/customers/:userId/outlets', requireCmsAuth, async (req, res) => {
    const { userId } = req.params;
    try {
      const { rows } = await pool.query(
        `SELECT ${OUTLET_SELECT}
         FROM public.outlets
         WHERE owner_id = $1
         ORDER BY is_active DESC, name ASC`,
        [userId]
      );
      res.json({ outlets: rows });
    } catch (err) {
      console.error('GET /api/cms/customers/:userId/outlets:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/cms/customers/:userId/outlets', requireCmsAuth, async (req, res) => {
    if (!canEdit(req.cmsAdmin)) return res.status(403).json({ error: 'Not enough permissions' });
    const { userId } = req.params;
    const {
      name,
      address,
      phone,
      latitude,
      longitude,
      operation_mode: requestedMode,
      activate,
    } = req.body || {};
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Outlet name is required' });
    }

    const client = await pool.connect();
    try {
      const lat = parseCoordinate(latitude, -90, 90, 'latitude');
      const lng = parseCoordinate(longitude, -180, 180, 'longitude');
      if (lat.value === null !== (lng.value === null)) {
        return res.status(400).json({ error: 'Both latitude and longitude are required' });
      }
      const { rows: owners } = await client.query(
        `SELECT p.user_id, p.business_type
         FROM public.profiles p
         WHERE p.user_id = $1
         LIMIT 1`,
        [userId]
      );
      if (!owners[0]) return res.status(404).json({ error: 'Customer not found' });

      let operationMode = requestedMode;
      if (!OPERATION_MODES.has(operationMode)) {
        operationMode = getDefaultOperationMode(owners[0].business_type);
      }

      const { rows: countRows } = await client.query(
        `SELECT COUNT(*)::int AS total FROM public.outlets WHERE owner_id = $1`,
        [userId]
      );
      const isFirstOutlet = (countRows[0]?.total ?? 0) === 0;
      const makeActive = activate === true || isFirstOutlet;

      await client.query('BEGIN');
      if (makeActive) {
        await client.query(
          `UPDATE public.outlets SET is_active = false, updated_at = NOW() WHERE owner_id = $1`,
          [userId]
        );
      }

      const { rows } = await client.query(
        `INSERT INTO public.outlets (
           owner_id, name, address, phone, latitude, longitude, operation_mode, is_active
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING ${OUTLET_SELECT}`,
        [
          userId,
          String(name).trim(),
          address ? String(address).trim() || null : null,
          phone ? String(phone).trim() || null : null,
          lat.value,
          lng.value,
          operationMode,
          makeActive,
        ]
      );
      await client.query('COMMIT');

      await logAdminAction({
        adminId: req.cmsAdmin?.source === 'admin_users' ? req.cmsAdmin.id : null,
        adminEmail: req.cmsAdmin?.email ?? null,
        action: 'cms.customers.outlet.create',
        targetType: 'outlet',
        targetId: rows[0].id,
        metadata: { user_id: userId, name: rows[0].name, is_active: rows[0].is_active },
        req,
      });

      res.status(201).json({ outlet: rows[0] });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('POST /api/cms/customers/:userId/outlets:', err);
      res.status(err.status || 500).json({ error: err.message });
    } finally {
      client.release();
    }
  });

  app.patch('/api/cms/customers/:userId/outlets/:outletId', requireCmsAuth, async (req, res) => {
    if (!canEdit(req.cmsAdmin)) return res.status(403).json({ error: 'Not enough permissions' });
    const { userId, outletId } = req.params;
    const {
      name,
      address,
      phone,
      latitude,
      longitude,
      operation_mode: requestedMode,
    } = req.body || {};

    if (name !== undefined && !String(name).trim()) {
      return res.status(400).json({ error: 'Outlet name cannot be empty' });
    }
    if (requestedMode !== undefined && !OPERATION_MODES.has(requestedMode)) {
      return res.status(400).json({ error: 'Invalid operation_mode' });
    }

    try {
      const lat = parseCoordinate(latitude, -90, 90, 'latitude');
      const lng = parseCoordinate(longitude, -180, 180, 'longitude');
      if (lat.supplied !== lng.supplied || (lat.value === null) !== (lng.value === null)) {
        return res.status(400).json({
          error: 'Latitude and longitude must be provided together',
        });
      }
      const { rows } = await pool.query(
        `UPDATE public.outlets
         SET name = COALESCE($3, name),
             address = CASE WHEN $4::boolean THEN $5 ELSE address END,
             phone = CASE WHEN $6::boolean THEN $7 ELSE phone END,
             operation_mode = COALESCE($8, operation_mode),
             latitude = CASE WHEN $9::boolean THEN $10 ELSE latitude END,
             longitude = CASE WHEN $9::boolean THEN $11 ELSE longitude END,
             updated_at = NOW()
         WHERE id = $1 AND owner_id = $2
         RETURNING ${OUTLET_SELECT}`,
        [
          outletId,
          userId,
          name !== undefined ? String(name).trim() : null,
          address !== undefined,
          address !== undefined ? (address ? String(address).trim() || null : null) : null,
          phone !== undefined,
          phone !== undefined ? (phone ? String(phone).trim() || null : null) : null,
          requestedMode ?? null,
          lat.supplied,
          lat.value,
          lng.value,
        ]
      );
      if (!rows[0]) return res.status(404).json({ error: 'Outlet not found' });

      if (lat.supplied) {
        await pool.query(
          `UPDATE public.shiprocket_connections
           SET settings =
             COALESCE(settings, '{}'::jsonb) ||
             jsonb_build_object(
               'pickup_address',
               COALESCE(settings->'pickup_address', '{}'::jsonb) ||
               jsonb_build_object('latitude', $2::numeric, 'longitude', $3::numeric)
             ),
             updated_at = NOW()
           WHERE outlet_id = $1`,
          [outletId, lat.value, lng.value]
        );
      }

      await logAdminAction({
        adminId: req.cmsAdmin?.source === 'admin_users' ? req.cmsAdmin.id : null,
        adminEmail: req.cmsAdmin?.email ?? null,
        action: 'cms.customers.outlet.update',
        targetType: 'outlet',
        targetId: outletId,
        metadata: {
          user_id: userId,
          name,
          address,
          phone,
          latitude: lat.supplied ? lat.value : undefined,
          longitude: lng.supplied ? lng.value : undefined,
          operation_mode: requestedMode ?? null,
        },
        req,
      });

      res.json({ outlet: rows[0] });
    } catch (err) {
      console.error('PATCH /api/cms/customers/:userId/outlets/:outletId:', err);
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  app.post('/api/cms/customers/:userId/outlets/:outletId/activate', requireCmsAuth, async (req, res) => {
    if (!canEdit(req.cmsAdmin)) return res.status(403).json({ error: 'Not enough permissions' });
    const { userId, outletId } = req.params;
    const client = await pool.connect();
    try {
      const { rows: owned } = await client.query(
        `SELECT id FROM public.outlets WHERE id = $1 AND owner_id = $2`,
        [outletId, userId]
      );
      if (!owned[0]) return res.status(404).json({ error: 'Outlet not found' });

      await client.query('BEGIN');
      await client.query(
        `UPDATE public.outlets SET is_active = false, updated_at = NOW() WHERE owner_id = $1`,
        [userId]
      );
      const { rows } = await client.query(
        `UPDATE public.outlets
         SET is_active = true, updated_at = NOW()
         WHERE id = $1 AND owner_id = $2
         RETURNING ${OUTLET_SELECT}`,
        [outletId, userId]
      );
      await client.query('COMMIT');

      await logAdminAction({
        adminId: req.cmsAdmin?.source === 'admin_users' ? req.cmsAdmin.id : null,
        adminEmail: req.cmsAdmin?.email ?? null,
        action: 'cms.customers.outlet.activate',
        targetType: 'outlet',
        targetId: outletId,
        metadata: { user_id: userId },
        req,
      });

      res.json({ outlet: rows[0] });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('POST /api/cms/customers/:userId/outlets/:outletId/activate:', err);
      res.status(500).json({ error: err.message });
    } finally {
      client.release();
    }
  });

  app.delete('/api/cms/customers/:userId/outlets/:outletId', requireCmsAuth, async (req, res) => {
    if (!canEdit(req.cmsAdmin)) return res.status(403).json({ error: 'Not enough permissions' });
    const { userId, outletId } = req.params;
    const client = await pool.connect();
    try {
      const { rows: target } = await client.query(
        `SELECT id, name, is_active FROM public.outlets WHERE id = $1 AND owner_id = $2`,
        [outletId, userId]
      );
      if (!target[0]) return res.status(404).json({ error: 'Outlet not found' });

      await client.query('BEGIN');
      await client.query(`DELETE FROM public.outlets WHERE id = $1 AND owner_id = $2`, [outletId, userId]);

      if (target[0].is_active) {
        const { rows: next } = await client.query(
          `SELECT id FROM public.outlets
           WHERE owner_id = $1
           ORDER BY created_at ASC
           LIMIT 1`,
          [userId]
        );
        if (next[0]) {
          await client.query(
            `UPDATE public.outlets SET is_active = true, updated_at = NOW() WHERE id = $1`,
            [next[0].id]
          );
        }
      }
      await client.query('COMMIT');

      await logAdminAction({
        adminId: req.cmsAdmin?.source === 'admin_users' ? req.cmsAdmin.id : null,
        adminEmail: req.cmsAdmin?.email ?? null,
        action: 'cms.customers.outlet.delete',
        targetType: 'outlet',
        targetId: outletId,
        metadata: { user_id: userId, name: target[0].name },
        req,
      });

      res.json({ success: true });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('DELETE /api/cms/customers/:userId/outlets/:outletId:', err);
      res.status(500).json({ error: err.message });
    } finally {
      client.release();
    }
  });

  app.get('/api/cms/customers/:userId/orders', requireCmsAuth, async (req, res) => {
    const { userId } = req.params;
    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 50;
    try {
      const { rows } = await pool.query(
        `SELECT o.id, o.order_number, o.order_type, o.status, o.payment_status, o.payment_method,
                o.total, o.customer_name, o.customer_phone, o.created_at, out.name AS outlet_name
         FROM public.orders o
         JOIN public.outlets out ON out.id = o.outlet_id
         WHERE out.owner_id = $1
         ORDER BY o.created_at DESC
         LIMIT $2`,
        [userId, limit]
      );
      res.json({ orders: rows });
    } catch (err) {
      console.error('GET /api/cms/customers/:userId/orders:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/cms/customers/:userId/payments', requireCmsAuth, async (req, res) => {
    const { userId } = req.params;
    try {
      const [subRows, orderPaymentRows] = await Promise.all([
        pool.query(
          `SELECT id, plan_type, status, period_months, razorpay_order_id, razorpay_payment_id, created_at
           FROM public.subscriptions
           WHERE user_id = $1
           ORDER BY created_at DESC
           LIMIT 100`,
          [userId]
        ),
        pool
          .query(
            `SELECT op.id, op.status, op.payment_method, op.customer_reference, op.created_at,
                    op.submitted_at, op.confirmed_at, op.failed_at, op.amount,
                    o.order_number, o.total AS order_total, o.payment_status AS order_payment_status
             FROM public.order_payments op
             JOIN public.orders o ON o.id = op.order_id
             JOIN public.outlets out ON out.id = o.outlet_id
             WHERE out.owner_id = $1
             ORDER BY op.created_at DESC
             LIMIT 150`,
            [userId]
          )
          .catch((err) => {
            if (err.code === '42P01') return { rows: [] };
            throw err;
          }),
      ]);

      res.json({
        subscription_payments: subRows.rows,
        order_payments: orderPaymentRows.rows,
      });
    } catch (err) {
      console.error('GET /api/cms/customers/:userId/payments:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/cms/customers/:userId/subscriptions', requireCmsAuth, async (req, res) => {
    const { userId } = req.params;
    try {
      const { rows } = await pool.query(
        `SELECT id, plan_type, status, period_months, current_period_start, current_period_end,
                expires_at, cancelled_at, created_at
         FROM public.subscriptions
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT 100`,
        [userId]
      );
      res.json({ subscriptions: rows });
    } catch (err) {
      console.error('GET /api/cms/customers/:userId/subscriptions:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.patch('/api/cms/customers/:userId/profile', requireCmsAuth, async (req, res) => {
    if (!canEdit(req.cmsAdmin)) return res.status(403).json({ error: 'Not enough permissions' });
    const { userId } = req.params;
    const { full_name, phone, business_type, account_status, onboarding_completed } = req.body || {};

    if (account_status !== undefined && !ACCOUNT_STATUS.has(String(account_status))) {
      return res.status(400).json({ error: 'Invalid account_status' });
    }

    try {
      const { rows } = await pool.query(
        `UPDATE public.profiles
         SET full_name = COALESCE($2, full_name),
             phone = COALESCE($3, phone),
             business_type = COALESCE($4, business_type),
             account_status = COALESCE($5, account_status),
             onboarding_completed = COALESCE($6, onboarding_completed)
         WHERE user_id = $1
         RETURNING *`,
        [
          userId,
          full_name !== undefined ? String(full_name).trim() : null,
          phone !== undefined ? String(phone).trim() : null,
          business_type !== undefined ? String(business_type).trim() : null,
          account_status ?? null,
          typeof onboarding_completed === 'boolean' ? onboarding_completed : null,
        ]
      );
      if (!rows[0]) return res.status(404).json({ error: 'Customer not found' });

      await logAdminAction({
        adminId: req.cmsAdmin?.source === 'admin_users' ? req.cmsAdmin.id : null,
        adminEmail: req.cmsAdmin?.email ?? null,
        action: 'cms.customers.profile.update',
        targetType: 'customer',
        targetId: userId,
        metadata: { full_name, phone, business_type, account_status, onboarding_completed },
        req,
      });

      res.json({ profile: rows[0] });
    } catch (err) {
      console.error('PATCH /api/cms/customers/:userId/profile:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.patch('/api/cms/customers/:userId/subscriptions/:subscriptionId', requireCmsAuth, async (req, res) => {
    if (!canEditBilling(req.cmsAdmin)) return res.status(403).json({ error: 'Billing or super admin required' });
    const { userId, subscriptionId } = req.params;
    const { status, plan_type, period_months, expires_at } = req.body || {};

    const s = status !== undefined ? String(status).toLowerCase() : undefined;
    const p = plan_type !== undefined ? String(plan_type).toLowerCase() : undefined;
    if (s !== undefined && !['trialing', 'active', 'past_due', 'cancelled'].includes(s)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    if (p !== undefined && !['starter', 'professional', 'enterprise'].includes(p)) {
      return res.status(400).json({ error: 'Invalid plan_type' });
    }

    try {
      const { rows } = await pool.query(
        `UPDATE public.subscriptions
         SET status = COALESCE($3, status),
             plan_type = COALESCE($4, plan_type),
             period_months = COALESCE($5, period_months),
             expires_at = COALESCE($6, expires_at),
             cancelled_at = CASE
               WHEN COALESCE($3, status) = 'cancelled' THEN COALESCE(cancelled_at, now())
               ELSE cancelled_at
             END,
             updated_at = now()
         WHERE id = $1 AND user_id = $2
         RETURNING id, user_id, plan_type, status, period_months, expires_at, current_period_end, cancelled_at, created_at`,
        [
          subscriptionId,
          userId,
          s ?? null,
          p ?? null,
          period_months ?? null,
          expires_at ?? null,
        ]
      );
      if (!rows[0]) return res.status(404).json({ error: 'Subscription not found' });

      await logAdminAction({
        adminId: req.cmsAdmin?.source === 'admin_users' ? req.cmsAdmin.id : null,
        adminEmail: req.cmsAdmin?.email ?? null,
        action: 'cms.customers.subscription.update',
        targetType: 'subscription',
        targetId: subscriptionId,
        metadata: { user_id: userId, status: s ?? null, plan_type: p ?? null, period_months, expires_at },
        req,
      });

      res.json({ subscription: rows[0] });
    } catch (err) {
      console.error('PATCH /api/cms/customers/:userId/subscriptions/:subscriptionId:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/cms/customers/:userId/access', requireCmsAuth, async (req, res) => {
    const { userId } = req.params;
    try {
      const profile = await fetchProfileAccess(userId);
      if (!profile) return res.status(404).json({ error: 'Customer not found' });
      const effectivePlan = resolveComplimentaryPlan(profile);
      const subscriptionWindow = await fetchComplimentarySubscriptionWindow(userId);
      const entitlements = await buildEntitlementsPayload(userId);
      res.json({
        access: {
          ...profile,
          complimentary_starts_at: subscriptionWindow.complimentary_starts_at ?? null,
          complimentary_expires_at:
            profile.complimentary_expires_at ??
            subscriptionWindow.complimentary_expires_at ??
            null,
          period_months: subscriptionWindow.period_months ?? null,
          is_active: isComplimentaryAccessActive(profile),
          effective_plan: effectivePlan,
          feature_summary: effectivePlan ? listPlanFeatureSummary(effectivePlan) : [],
        },
        entitlements,
      });
    } catch (err) {
      console.error('GET /api/cms/customers/:userId/access:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.patch('/api/cms/customers/:userId/access', requireCmsAuth, async (req, res) => {
    if (!canEditBilling(req.cmsAdmin)) {
      return res.status(403).json({ error: 'Billing or super admin required' });
    }
    const { userId } = req.params;
    const body = req.body || {};
    try {
      const result = await applyProfileAccessUpdate(userId, body);
      const entitlements = await buildEntitlementsPayload(userId);

      await logAdminAction({
        adminId: req.cmsAdmin?.source === 'admin_users' ? req.cmsAdmin.id : null,
        adminEmail: req.cmsAdmin?.email ?? null,
        action: 'cms.customers.access.update',
        targetType: 'customer',
        targetId: userId,
        metadata: {
          is_test_account: result.profile.is_test_account,
          billing_exempt: result.profile.billing_exempt,
          complimentary_plan: result.profile.complimentary_plan,
          complimentary_starts_at: result.subscription?.current_period_start ?? body.complimentary_starts_at ?? null,
          complimentary_expires_at: result.profile.complimentary_expires_at,
          period_months: result.subscription?.period_months ?? body.period_months ?? null,
        },
        req,
      });

      res.json({
        profile: result.profile,
        subscription: result.subscription,
        entitlements,
      });
    } catch (err) {
      console.error('PATCH /api/cms/customers/:userId/access:', err);
      const validation =
        err.message?.includes('Invalid') ||
        err.message?.includes('must be') ||
        err.message?.includes('Expiration');
      const status = err.message === 'Customer not found' ? 404 : validation ? 400 : 500;
      res.status(status).json({ error: err.message });
    }
  });

  app.get('/api/cms/customers/:userId/audit', requireCmsAuth, async (req, res) => {
    const { userId } = req.params;
    try {
      const { rows } = await pool.query(
        `SELECT id, admin_email, action, target_type, target_id, metadata, created_at
         FROM public.admin_audit_log
         WHERE target_id = $1
            OR metadata->>'user_id' = $1
            OR metadata->>'target_user_id' = $1
         ORDER BY created_at DESC
         LIMIT 200`,
        [userId]
      );
      res.json({ audit: rows });
    } catch (err) {
      console.error('GET /api/cms/customers/:userId/audit:', err);
      res.status(500).json({ error: err.message });
    }
  });
}
