import pool from '../db.js';
import { requireCmsAuth } from './middleware.js';
import { logAdminAction } from './audit.js';
import { mergeSettings, DEFAULT_SETTINGS } from '../shiprocket/status-mapper.js';
import {
  saveConnectionCredentials as saveShiprocketCredentials,
  disconnectConnection as disconnectShiprocket,
  getConnection as getShiprocketConnection,
} from '../shiprocket/auth.js';
import { formatShiprocketConnectError } from '../shiprocket/client.js';
import {
  disconnectConnection as disconnectRazorpay,
  getConnectionByOwner,
  isRazorpayConnectionActive,
  saveApiKeyConnection,
} from '../razorpay/auth.js';
import {
  getGooglePayConnection,
  getOnlinePaymentProvider,
  isGooglePayReady,
  isValidGooglePayVpa,
  isValidMcc,
  normalizeGooglePayConnection,
  setOnlinePaymentProvider,
} from '../google-pay/routes.js';

const EDIT_ROLES = new Set(['super_admin', 'support', 'billing']);

function canEdit(admin) {
  return admin && EDIT_ROLES.has(admin.role);
}

function parseRazorpaySettings(raw) {
  let settings = raw;
  if (typeof settings === 'string') {
    try {
      settings = JSON.parse(settings);
    } catch {
      settings = {};
    }
  }
  settings = settings && typeof settings === 'object' ? settings : {};
  return {
    online_payments_enabled: settings.online_payments_enabled !== false,
    allow_cod: settings.allow_cod !== false,
    allow_partial_refunds: settings.allow_partial_refunds !== false,
    has_webhook_secret: Boolean(settings.webhook_secret),
    webhook_secret: settings.webhook_secret || null,
  };
}

function publicRazorpaySettings(raw) {
  const parsed = parseRazorpaySettings(raw);
  return {
    online_payments_enabled: parsed.online_payments_enabled,
    allow_cod: parsed.allow_cod,
    allow_partial_refunds: parsed.allow_partial_refunds,
    has_webhook_secret: parsed.has_webhook_secret,
  };
}

function publicRazorpay(conn) {
  return {
    is_connected: isRazorpayConnectionActive(conn),
    connection_mode: conn?.connection_mode || null,
    connected_at: conn?.connected_at ?? null,
    account_id: conn?.account_id ?? conn?.merchant_key_id ?? null,
    account_name: conn?.account_name ?? null,
    merchant_key_id: conn?.merchant_key_id ?? null,
    settings: publicRazorpaySettings(conn?.settings),
  };
}

function publicShiprocket(conn, outletId, req) {
  const settings = mergeSettings(conn?.settings);
  const configuredBaseUrl = process.env.API_PUBLIC_URL?.trim().replace(/\/+$/, '');
  const baseUrl = configuredBaseUrl || `${req.protocol}://${req.get('host')}`;
  return {
    is_connected: !!conn?.is_connected,
    connected_at: conn?.connected_at ?? null,
    webhook_url: `${baseUrl}/api/webhooks/delivery-tracking?outlet_id=${outletId}`,
    settings: {
      auto_delivery_enabled: !!settings.auto_delivery_enabled,
      prep_time_minutes: settings.prep_time_minutes ?? DEFAULT_SETTINGS.prep_time_minutes,
      default_weight_kg: settings.default_weight_kg ?? DEFAULT_SETTINGS.default_weight_kg,
      dimensions: settings.dimensions || DEFAULT_SETTINGS.dimensions,
      pickup_address: settings.pickup_address || {},
      pickup_location_name: settings.pickup_location_name || 'Primary',
      cod_enabled: settings.cod_enabled !== false,
      retry_max_attempts: settings.retry_max_attempts ?? DEFAULT_SETTINGS.retry_max_attempts,
      retry_interval_seconds:
        settings.retry_interval_seconds ?? DEFAULT_SETTINGS.retry_interval_seconds,
      webhook_secret: settings.webhook_secret || null,
    },
  };
}

async function assertCustomerOutlet(userId, outletId) {
  const { rows } = await pool.query(
    `SELECT id, name, address, phone FROM public.outlets WHERE id = $1 AND owner_id = $2 LIMIT 1`,
    [outletId, userId]
  );
  return rows[0] ?? null;
}

async function assertCustomerExists(userId) {
  const { rows } = await pool.query(
    `SELECT user_id FROM public.profiles WHERE user_id = $1 LIMIT 1`,
    [userId]
  );
  return !!rows[0];
}

export function registerCmsCustomerSettingsRoutes(app) {
  app.patch('/api/cms/customers/:userId/branding', requireCmsAuth, async (req, res) => {
    if (!canEdit(req.cmsAdmin)) return res.status(403).json({ error: 'Not enough permissions' });
    const { userId } = req.params;
    const {
      brand_name,
      brand_color,
      logo_url,
      ordering_slug,
      app_theme,
    } = req.body || {};

    if (app_theme !== undefined && app_theme !== null && !['light', 'dark'].includes(String(app_theme))) {
      return res.status(400).json({ error: 'Invalid app_theme' });
    }

    let slug = ordering_slug;
    if (slug !== undefined) {
      slug = slug === null || slug === '' ? null : String(slug).trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
      if (slug) {
        const { rows: clash } = await pool.query(
          `SELECT user_id FROM public.profiles WHERE ordering_slug = $1 AND user_id <> $2 LIMIT 1`,
          [slug, userId]
        );
        if (clash[0]) {
          return res.status(409).json({ error: 'Ordering slug is already in use' });
        }
      }
    }

    try {
      const { rows } = await pool.query(
        `UPDATE public.profiles
         SET brand_name = CASE WHEN $2::boolean THEN $3 ELSE brand_name END,
             brand_color = CASE WHEN $4::boolean THEN $5 ELSE brand_color END,
             logo_url = CASE WHEN $6::boolean THEN $7 ELSE logo_url END,
             ordering_slug = CASE WHEN $8::boolean THEN $9 ELSE ordering_slug END,
             app_theme = CASE WHEN $10::boolean THEN $11 ELSE app_theme END
         WHERE user_id = $1
         RETURNING user_id, brand_name, brand_color, logo_url, ordering_slug, app_theme`,
        [
          userId,
          brand_name !== undefined,
          brand_name !== undefined ? (String(brand_name).trim() || null) : null,
          brand_color !== undefined,
          brand_color !== undefined ? String(brand_color).trim() || null : null,
          logo_url !== undefined,
          logo_url !== undefined ? logo_url || null : null,
          ordering_slug !== undefined,
          slug ?? null,
          app_theme !== undefined,
          app_theme !== undefined ? app_theme || null : null,
        ]
      );
      if (!rows[0]) return res.status(404).json({ error: 'Customer not found' });

      await logAdminAction({
        adminId: req.cmsAdmin?.source === 'admin_users' ? req.cmsAdmin.id : null,
        adminEmail: req.cmsAdmin?.email ?? null,
        action: 'cms.customers.branding.update',
        targetType: 'customer',
        targetId: userId,
        metadata: { brand_name, brand_color, logo_url, ordering_slug: slug, app_theme },
        req,
      });

      res.json({ branding: rows[0] });
    } catch (err) {
      console.error('PATCH /api/cms/customers/:userId/branding:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.patch('/api/cms/customers/:userId/payment-settings', requireCmsAuth, async (req, res) => {
    if (!canEdit(req.cmsAdmin)) return res.status(403).json({ error: 'Not enough permissions' });
    const { userId } = req.params;
    const {
      upi_vpa,
      upi_display_name,
      upi_qr_url,
      online_payments_enabled,
    } = req.body || {};

    try {
      const { rows } = await pool.query(
        `UPDATE public.profiles
         SET upi_vpa = CASE WHEN $2::boolean THEN $3 ELSE upi_vpa END,
             upi_display_name = CASE WHEN $4::boolean THEN $5 ELSE upi_display_name END,
             upi_qr_url = CASE WHEN $6::boolean THEN $7 ELSE upi_qr_url END,
             online_payments_enabled = COALESCE($8, online_payments_enabled)
         WHERE user_id = $1
         RETURNING user_id, upi_vpa, upi_display_name, upi_qr_url, online_payments_enabled`,
        [
          userId,
          upi_vpa !== undefined,
          upi_vpa !== undefined ? (upi_vpa ? String(upi_vpa).trim() || null : null) : null,
          upi_display_name !== undefined,
          upi_display_name !== undefined
            ? (upi_display_name ? String(upi_display_name).trim() || null : null)
            : null,
          upi_qr_url !== undefined,
          upi_qr_url !== undefined ? upi_qr_url || null : null,
          typeof online_payments_enabled === 'boolean' ? online_payments_enabled : null,
        ]
      );
      if (!rows[0]) return res.status(404).json({ error: 'Customer not found' });

      await logAdminAction({
        adminId: req.cmsAdmin?.source === 'admin_users' ? req.cmsAdmin.id : null,
        adminEmail: req.cmsAdmin?.email ?? null,
        action: 'cms.customers.payment_settings.update',
        targetType: 'customer',
        targetId: userId,
        metadata: {
          upi_vpa: rows[0].upi_vpa,
          online_payments_enabled: rows[0].online_payments_enabled,
        },
        req,
      });

      res.json({ payment_settings: rows[0] });
    } catch (err) {
      console.error('PATCH /api/cms/customers/:userId/payment-settings:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/cms/customers/:userId/delivery', requireCmsAuth, async (req, res) => {
    const { userId } = req.params;
    try {
      if (!(await assertCustomerExists(userId))) {
        return res.status(404).json({ error: 'Customer not found' });
      }
      const { rows: outlets } = await pool.query(
        `SELECT id, name, address, phone, is_active
         FROM public.outlets
         WHERE owner_id = $1
         ORDER BY is_active DESC, name ASC`,
        [userId]
      );
      const deliveries = [];
      for (const outlet of outlets) {
        const conn = await getShiprocketConnection(outlet.id);
        deliveries.push({
          outlet,
          shiprocket: publicShiprocket(conn, outlet.id, req),
        });
      }
      res.json({ deliveries });
    } catch (err) {
      console.error('GET /api/cms/customers/:userId/delivery:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/cms/customers/:userId/outlets/:outletId/shiprocket/connect', requireCmsAuth, async (req, res) => {
    if (!canEdit(req.cmsAdmin)) return res.status(403).json({ error: 'Not enough permissions' });
    const { userId, outletId } = req.params;
    const email = String(req.body?.email || '').trim();
    const password = String(req.body?.password || '');
    if (!email || !password) {
      return res.status(400).json({ error: 'Shiprocket email and password are required' });
    }

    try {
      const outlet = await assertCustomerOutlet(userId, outletId);
      if (!outlet) return res.status(404).json({ error: 'Outlet not found' });
      const conn = await saveShiprocketCredentials(outletId, email, password);

      await logAdminAction({
        adminId: req.cmsAdmin?.source === 'admin_users' ? req.cmsAdmin.id : null,
        adminEmail: req.cmsAdmin?.email ?? null,
        action: 'cms.customers.shiprocket.connect',
        targetType: 'outlet',
        targetId: outletId,
        metadata: { user_id: userId, email },
        req,
      });

      res.json({ outlet, shiprocket: publicShiprocket(conn, outletId, req) });
    } catch (err) {
      console.error('POST cms shiprocket connect:', err);
      res.status(400).json({ error: formatShiprocketConnectError(err) || err.message });
    }
  });

  app.post('/api/cms/customers/:userId/outlets/:outletId/shiprocket/disconnect', requireCmsAuth, async (req, res) => {
    if (!canEdit(req.cmsAdmin)) return res.status(403).json({ error: 'Not enough permissions' });
    const { userId, outletId } = req.params;
    try {
      const outlet = await assertCustomerOutlet(userId, outletId);
      if (!outlet) return res.status(404).json({ error: 'Outlet not found' });
      await disconnectShiprocket(outletId);

      await logAdminAction({
        adminId: req.cmsAdmin?.source === 'admin_users' ? req.cmsAdmin.id : null,
        adminEmail: req.cmsAdmin?.email ?? null,
        action: 'cms.customers.shiprocket.disconnect',
        targetType: 'outlet',
        targetId: outletId,
        metadata: { user_id: userId },
        req,
      });

      res.json({ success: true, outlet, shiprocket: publicShiprocket(null, outletId, req) });
    } catch (err) {
      console.error('POST cms shiprocket disconnect:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.patch('/api/cms/customers/:userId/outlets/:outletId/shiprocket', requireCmsAuth, async (req, res) => {
    if (!canEdit(req.cmsAdmin)) return res.status(403).json({ error: 'Not enough permissions' });
    const { userId, outletId } = req.params;
    const body = req.body || {};
    try {
      const outlet = await assertCustomerOutlet(userId, outletId);
      if (!outlet) return res.status(404).json({ error: 'Outlet not found' });

      const conn = await getShiprocketConnection(outletId);
      const current = mergeSettings(conn?.settings);
      const next = {
        ...current,
        ...(body.auto_delivery_enabled !== undefined
          ? { auto_delivery_enabled: !!body.auto_delivery_enabled }
          : {}),
        ...(body.prep_time_minutes !== undefined
          ? { prep_time_minutes: Math.max(0, Number(body.prep_time_minutes) || 0) }
          : {}),
        ...(body.default_weight_kg !== undefined
          ? { default_weight_kg: Math.max(0.1, Number(body.default_weight_kg) || 0.5) }
          : {}),
        ...(body.dimensions ? { dimensions: { ...current.dimensions, ...body.dimensions } } : {}),
        ...(body.pickup_address
          ? { pickup_address: { ...current.pickup_address, ...body.pickup_address } }
          : {}),
        ...(body.pickup_location_name
          ? { pickup_location_name: String(body.pickup_location_name).trim() || 'Primary' }
          : {}),
        ...(body.cod_enabled !== undefined ? { cod_enabled: !!body.cod_enabled } : {}),
        ...(body.retry_max_attempts !== undefined
          ? { retry_max_attempts: Math.max(0, Number(body.retry_max_attempts) || 0) }
          : {}),
        ...(body.retry_interval_seconds !== undefined
          ? { retry_interval_seconds: Math.max(30, Number(body.retry_interval_seconds) || 120) }
          : {}),
        ...(body.webhook_secret !== undefined
          ? { webhook_secret: String(body.webhook_secret || '').trim() || null }
          : {}),
      };

      const { rows } = await pool.query(
        `INSERT INTO public.shiprocket_connections (outlet_id, settings, is_connected)
         VALUES ($1, $2, false)
         ON CONFLICT (outlet_id) DO UPDATE SET settings = $2, updated_at = now()
         RETURNING *`,
        [outletId, JSON.stringify(next)]
      );

      await logAdminAction({
        adminId: req.cmsAdmin?.source === 'admin_users' ? req.cmsAdmin.id : null,
        adminEmail: req.cmsAdmin?.email ?? null,
        action: 'cms.customers.shiprocket.settings',
        targetType: 'outlet',
        targetId: outletId,
        metadata: {
          user_id: userId,
          auto_delivery_enabled: next.auto_delivery_enabled,
          cod_enabled: next.cod_enabled,
        },
        req,
      });

      res.json({ outlet, shiprocket: publicShiprocket(rows[0], outletId, req) });
    } catch (err) {
      console.error('PATCH cms shiprocket settings:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/cms/customers/:userId/razorpay', requireCmsAuth, async (req, res) => {
    const { userId } = req.params;
    try {
      if (!(await assertCustomerExists(userId))) {
        return res.status(404).json({ error: 'Customer not found' });
      }
      const conn = await getConnectionByOwner(userId);
      res.json({ razorpay: publicRazorpay(conn) });
    } catch (err) {
      console.error('GET /api/cms/customers/:userId/razorpay:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/cms/customers/:userId/razorpay/connect', requireCmsAuth, async (req, res) => {
    if (!canEdit(req.cmsAdmin)) return res.status(403).json({ error: 'Not enough permissions' });
    const { userId } = req.params;
    const keyId = String(req.body?.key_id || '').trim();
    const keySecret = String(req.body?.key_secret || '').trim();
    if (!keyId || !keySecret) {
      return res.status(400).json({ error: 'Razorpay key_id and key_secret are required' });
    }
    try {
      if (!(await assertCustomerExists(userId))) {
        return res.status(404).json({ error: 'Customer not found' });
      }
      const conn = await saveApiKeyConnection(userId, keyId, keySecret);
      await logAdminAction({
        adminId: req.cmsAdmin?.source === 'admin_users' ? req.cmsAdmin.id : null,
        adminEmail: req.cmsAdmin?.email ?? null,
        action: 'cms.customers.razorpay.connect',
        targetType: 'customer',
        targetId: userId,
        metadata: { merchant_key_id: keyId },
        req,
      });
      res.json({ razorpay: publicRazorpay(conn) });
    } catch (err) {
      console.error('POST cms razorpay connect:', err);
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/cms/customers/:userId/razorpay/disconnect', requireCmsAuth, async (req, res) => {
    if (!canEdit(req.cmsAdmin)) return res.status(403).json({ error: 'Not enough permissions' });
    const { userId } = req.params;
    try {
      if (!(await assertCustomerExists(userId))) {
        return res.status(404).json({ error: 'Customer not found' });
      }
      await disconnectRazorpay(userId);
      await logAdminAction({
        adminId: req.cmsAdmin?.source === 'admin_users' ? req.cmsAdmin.id : null,
        adminEmail: req.cmsAdmin?.email ?? null,
        action: 'cms.customers.razorpay.disconnect',
        targetType: 'customer',
        targetId: userId,
        metadata: {},
        req,
      });
      res.json({
        success: true,
        razorpay: publicRazorpay(null),
      });
    } catch (err) {
      console.error('POST cms razorpay disconnect:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.patch('/api/cms/customers/:userId/razorpay/settings', requireCmsAuth, async (req, res) => {
    if (!canEdit(req.cmsAdmin)) return res.status(403).json({ error: 'Not enough permissions' });
    const { userId } = req.params;
    const body = req.body || {};
    try {
      if (!(await assertCustomerExists(userId))) {
        return res.status(404).json({ error: 'Customer not found' });
      }
      const conn = await getConnectionByOwner(userId);
      const current = parseRazorpaySettings(conn?.settings);
      const next = {
        online_payments_enabled:
          body.online_payments_enabled !== undefined
            ? !!body.online_payments_enabled
            : current.online_payments_enabled,
        allow_cod: body.allow_cod !== undefined ? !!body.allow_cod : current.allow_cod,
        allow_partial_refunds:
          body.allow_partial_refunds !== undefined
            ? !!body.allow_partial_refunds
            : current.allow_partial_refunds,
        webhook_secret: current.webhook_secret || null,
      };

      const { rows } = await pool.query(
        `INSERT INTO public.razorpay_connections (owner_id, settings, is_connected)
         VALUES ($1, $2, false)
         ON CONFLICT (owner_id) DO UPDATE SET settings = $2, updated_at = now()
         RETURNING *`,
        [userId, JSON.stringify(next)]
      );

      await logAdminAction({
        adminId: req.cmsAdmin?.source === 'admin_users' ? req.cmsAdmin.id : null,
        adminEmail: req.cmsAdmin?.email ?? null,
        action: 'cms.customers.razorpay.settings',
        targetType: 'customer',
        targetId: userId,
        metadata: {
          online_payments_enabled: next.online_payments_enabled,
          allow_cod: next.allow_cod,
          allow_partial_refunds: next.allow_partial_refunds,
        },
        req,
      });

      res.json({ razorpay: publicRazorpay(rows[0]) });
    } catch (err) {
      console.error('PATCH cms razorpay settings:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/cms/customers/:userId/google-pay', requireCmsAuth, async (req, res) => {
    const { userId } = req.params;
    try {
      if (!(await assertCustomerExists(userId))) {
        return res.status(404).json({ error: 'Customer not found' });
      }
      const conn = await getGooglePayConnection(userId);
      const provider = await getOnlinePaymentProvider(userId);
      res.json({
        online_payment_provider: provider,
        google_pay: normalizeGooglePayConnection(conn),
        ready: isGooglePayReady(conn),
      });
    } catch (err) {
      console.error('GET cms google-pay:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/cms/customers/:userId/google-pay', requireCmsAuth, async (req, res) => {
    if (!canEdit(req.cmsAdmin)) return res.status(403).json({ error: 'Not enough permissions' });
    const { userId } = req.params;
    const body = req.body || {};
    const merchantVpa =
      body.merchant_vpa !== undefined ? String(body.merchant_vpa || '').trim() : undefined;
    const payeeName =
      body.payee_name !== undefined ? String(body.payee_name || '').trim() : undefined;
    const mcc = body.mcc !== undefined ? String(body.mcc || '').trim() : undefined;
    const isEnabled = body.is_enabled !== undefined ? !!body.is_enabled : undefined;
    const allowCod = body.allow_cod !== undefined ? !!body.allow_cod : undefined;

    if (merchantVpa !== undefined && merchantVpa && !isValidGooglePayVpa(merchantVpa)) {
      return res.status(400).json({ error: 'Invalid merchant VPA' });
    }
    if (mcc !== undefined && mcc && !isValidMcc(mcc)) {
      return res.status(400).json({ error: 'MCC must be a 4-digit code' });
    }

    try {
      if (!(await assertCustomerExists(userId))) {
        return res.status(404).json({ error: 'Customer not found' });
      }
      const existing = await getGooglePayConnection(userId);
      const nextVpa =
        merchantVpa !== undefined ? merchantVpa || null : existing?.merchant_vpa || null;
      const nextName =
        payeeName !== undefined ? payeeName || null : existing?.payee_name || null;
      const nextMcc = mcc !== undefined ? mcc || null : existing?.mcc || null;
      const configured =
        isValidGooglePayVpa(nextVpa || '') &&
        !!String(nextName || '').trim() &&
        isValidMcc(nextMcc || '');
      const nextEnabled =
        isEnabled !== undefined ? isEnabled && configured : !!existing?.is_enabled && configured;
      const prevSettings =
        existing?.settings && typeof existing.settings === 'object' ? existing.settings : {};
      const nextSettings = {
        ...prevSettings,
        allow_cod: allowCod !== undefined ? allowCod : prevSettings.allow_cod !== false,
      };

      const { rows } = await pool.query(
        `INSERT INTO public.google_pay_connections (
           owner_id, merchant_vpa, payee_name, mcc, is_enabled, is_configured, settings,
           connected_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, CASE WHEN $5 THEN now() ELSE NULL END, now())
         ON CONFLICT (owner_id) DO UPDATE SET
           merchant_vpa = EXCLUDED.merchant_vpa,
           payee_name = EXCLUDED.payee_name,
           mcc = EXCLUDED.mcc,
           is_enabled = EXCLUDED.is_enabled,
           is_configured = EXCLUDED.is_configured,
           settings = EXCLUDED.settings,
           connected_at = CASE
             WHEN EXCLUDED.is_enabled AND NOT google_pay_connections.is_enabled THEN now()
             WHEN EXCLUDED.is_enabled THEN COALESCE(google_pay_connections.connected_at, now())
             ELSE google_pay_connections.connected_at
           END,
           updated_at = now()
         RETURNING *`,
        [userId, nextVpa, nextName, nextMcc, nextEnabled, configured, JSON.stringify(nextSettings)]
      );

      if (nextEnabled) {
        await setOnlinePaymentProvider(userId, 'google_pay');
      }

      await logAdminAction({
        adminId: req.cmsAdmin?.source === 'admin_users' ? req.cmsAdmin.id : null,
        adminEmail: req.cmsAdmin?.email ?? null,
        action: 'cms.customers.google_pay.update',
        targetType: 'customer',
        targetId: userId,
        metadata: { merchant_vpa: nextVpa, is_enabled: nextEnabled },
        req,
      });

      const provider = await getOnlinePaymentProvider(userId);
      res.json({
        online_payment_provider: provider,
        google_pay: normalizeGooglePayConnection(rows[0]),
        ready: isGooglePayReady(rows[0]),
      });
    } catch (err) {
      console.error('PUT cms google-pay:', err);
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  app.patch('/api/cms/customers/:userId/online-payment-provider', requireCmsAuth, async (req, res) => {
    if (!canEdit(req.cmsAdmin)) return res.status(403).json({ error: 'Not enough permissions' });
    const { userId } = req.params;
    const provider = req.body?.provider ?? null;
    if (provider !== null && provider !== 'razorpay' && provider !== 'google_pay') {
      return res.status(400).json({ error: 'Invalid provider' });
    }
    try {
      if (!(await assertCustomerExists(userId))) {
        return res.status(404).json({ error: 'Customer not found' });
      }
      if (provider === 'google_pay') {
        const conn = await getGooglePayConnection(userId);
        if (!isGooglePayReady(conn)) {
          return res.status(400).json({ error: 'Google Pay is not configured for this customer' });
        }
      }
      const saved = await setOnlinePaymentProvider(userId, provider);
      await logAdminAction({
        adminId: req.cmsAdmin?.source === 'admin_users' ? req.cmsAdmin.id : null,
        adminEmail: req.cmsAdmin?.email ?? null,
        action: 'cms.customers.online_payment_provider',
        targetType: 'customer',
        targetId: userId,
        metadata: { provider: saved },
        req,
      });
      res.json({ online_payment_provider: saved });
    } catch (err) {
      console.error('PATCH cms online-payment-provider:', err);
      res.status(err.status || 500).json({ error: err.message });
    }
  });
}
