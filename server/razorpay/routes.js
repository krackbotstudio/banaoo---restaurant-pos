import crypto from 'crypto';
import pool from '../db.js';
import { buildEntitlementsPayload } from '../entitlements.js';
import {
  completeOAuthCode,
  disconnectConnection,
  getConnectionByOwner,
  getConnectedAccount,
  isRazorpayConnectionActive,
  saveApiKeyConnection,
} from './auth.js';
import { createRefundForAccount } from './client.js';
import { createOrderFromSession } from '../customer-orders.js';
import {
  getRazorpayOAuthClientId,
  isRazorpayOAuthConfigured,
} from './config.js';

function getBaseUrl(req) {
  return `${req.protocol}://${req.get('host')}`;
}

function parseSettings(raw) {
  const settings = raw && typeof raw === 'object' ? raw : {};
  return {
    online_payments_enabled: settings.online_payments_enabled !== false,
    allow_cod: settings.allow_cod !== false,
    allow_partial_refunds: settings.allow_partial_refunds !== false,
    webhook_secret: settings.webhook_secret || null,
  };
}

async function assertOutletOwner(outletId, userId) {
  const { rows } = await pool.query(
    `SELECT id, owner_id, name FROM public.outlets WHERE id = $1 LIMIT 1`,
    [outletId]
  );
  const outlet = rows[0];
  if (!outlet) return { status: 404, error: 'Outlet not found' };
  if (outlet.owner_id !== userId) return { status: 403, error: 'Forbidden' };
  return { outlet };
}

async function hasRazorpayEntitlement(userId) {
  const ent = await buildEntitlementsPayload(userId);
  if (ent?.access_source || ent?.access?.is_complimentary_active) return true;
  return Boolean(ent?.effective_limits?.razorpayPayments);
}

function publicConnection(conn, req) {
  const settings = parseSettings(conn?.settings);
  const oauthAvailable = isRazorpayOAuthConfigured();
  return {
    is_connected: isRazorpayConnectionActive(conn),
    connection_mode: conn?.connection_mode || null,
    connected_at: conn?.connected_at ?? null,
    account_id: conn?.account_id ?? conn?.merchant_key_id ?? null,
    account_name: conn?.account_name ?? null,
    merchant_key_id: conn?.merchant_key_id ?? null,
    settings: {
      online_payments_enabled: settings.online_payments_enabled,
      allow_cod: settings.allow_cod,
      allow_partial_refunds: settings.allow_partial_refunds,
      has_webhook_secret: Boolean(settings.webhook_secret),
    },
    oauth_connect_url: `${getBaseUrl(req)}/api/razorpay/oauth/start`,
    oauth_callback_url: `${getBaseUrl(req)}/api/razorpay/oauth/callback`,
    webhook_url: `${getBaseUrl(req)}/api/webhooks/razorpay`,
    oauth_available: oauthAvailable,
    api_key_connect_available: true,
  };
}

function verifyRazorpaySignature(rawBody, signature, secret) {
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return expected === signature;
}

export function registerRazorpayRoutes(app, { requireAuth }) {
  app.get('/api/outlets/:outletId/razorpay', requireAuth, async (req, res) => {
    try {
      const { outletId } = req.params;
      const access = await assertOutletOwner(outletId, req.user.id);
      if (access.error) return res.status(access.status).json({ error: access.error });
      const conn = await getConnectionByOwner(req.user.id);
      const entitled = await hasRazorpayEntitlement(req.user.id);
      res.json({ ...publicConnection(conn, req), entitled });
    } catch (err) {
      console.error('GET /api/outlets/:outletId/razorpay:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/razorpay/oauth/start', requireAuth, async (req, res) => {
    const outletId = req.query.outlet_id?.toString();
    if (!outletId) return res.status(400).json({ error: 'outlet_id required' });
    const access = await assertOutletOwner(outletId, req.user.id);
    if (access.error) return res.status(access.status).json({ error: access.error });
    if (!(await hasRazorpayEntitlement(req.user.id))) {
      return res.status(403).json({ error: 'Razorpay integration is not enabled on your plan' });
    }

    const clientId = getRazorpayOAuthClientId();
    if (!clientId) {
      return res.status(503).json({
        error:
          'Razorpay OAuth is not configured on this server. Add RAZORPAY_OAUTH_CLIENT_ID and RAZORPAY_OAUTH_CLIENT_SECRET from the Razorpay Partner Dashboard to server/.env, then restart npm run server.',
        code: 'razorpay_oauth_not_configured',
      });
    }

    const redirectUri = `${getBaseUrl(req)}/api/razorpay/oauth/callback`;
    const state = crypto.randomUUID();
    req.session.razorpay_oauth_state = state;
    req.session.razorpay_oauth_outlet_id = outletId;
    req.session.razorpay_oauth_owner_id = req.user.id;
    req.session.razorpay_oauth_redirect_uri = redirectUri;

    const authUrl = new URL('https://auth.razorpay.com/authorize');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', 'read_write');

    res.json({ auth_url: authUrl.toString() });
  });

  app.post('/api/outlets/:outletId/razorpay/connect', requireAuth, async (req, res) => {
    const { outletId } = req.params;
    const { key_id, key_secret } = req.body || {};
    const access = await assertOutletOwner(outletId, req.user.id);
    if (access.error) return res.status(access.status).json({ error: access.error });
    if (!(await hasRazorpayEntitlement(req.user.id))) {
      return res.status(403).json({ error: 'Razorpay integration is not enabled on your plan' });
    }
    if (!key_id?.trim() || !key_secret?.trim()) {
      return res.status(400).json({ error: 'Razorpay Key ID and Key Secret are required' });
    }

    try {
      const conn = await saveApiKeyConnection(req.user.id, key_id, key_secret);
      res.json(publicConnection(conn, req));
    } catch (err) {
      console.error('razorpay api-key connect:', err);
      res.status(400).json({ error: err.message || 'Could not connect Razorpay account' });
    }
  });

  app.get('/api/razorpay/oauth/callback', async (req, res) => {
    const { code, state } = req.query;
    const expected = req.session.razorpay_oauth_state;
    const ownerId = req.session.razorpay_oauth_owner_id;
    const outletId = req.session.razorpay_oauth_outlet_id;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
    const redirectUri = req.session.razorpay_oauth_redirect_uri;
    const clearSession = () => {
      delete req.session.razorpay_oauth_state;
      delete req.session.razorpay_oauth_owner_id;
      delete req.session.razorpay_oauth_outlet_id;
      delete req.session.razorpay_oauth_redirect_uri;
    };

    if (!code || !state || !expected || state !== expected || !ownerId || !redirectUri) {
      clearSession();
      return res.redirect(`${frontendUrl.replace(/\/+$/, '')}/settings?tab=payments&razorpay=error`);
    }

    try {
      await completeOAuthCode(ownerId, String(code), String(redirectUri));
      clearSession();
      return res.redirect(
        `${frontendUrl.replace(/\/+$/, '')}/settings?tab=payments&outlet=${encodeURIComponent(outletId || '')}&razorpay=connected`
      );
    } catch (err) {
      clearSession();
      console.error('razorpay oauth callback:', err);
      return res.redirect(`${frontendUrl.replace(/\/+$/, '')}/settings?tab=payments&razorpay=error`);
    }
  });

  app.post('/api/outlets/:outletId/razorpay/disconnect', requireAuth, async (req, res) => {
    const { outletId } = req.params;
    const access = await assertOutletOwner(outletId, req.user.id);
    if (access.error) return res.status(access.status).json({ error: access.error });
    await disconnectConnection(req.user.id);
    res.json({ success: true });
  });

  app.patch('/api/outlets/:outletId/razorpay/settings', requireAuth, async (req, res) => {
    const { outletId } = req.params;
    const access = await assertOutletOwner(outletId, req.user.id);
    if (access.error) return res.status(access.status).json({ error: access.error });

    const conn = await getConnectionByOwner(req.user.id);
    const current = parseSettings(conn?.settings);
    const body = req.body || {};
    const next = {
      ...current,
      ...(body.online_payments_enabled !== undefined ? { online_payments_enabled: !!body.online_payments_enabled } : {}),
      ...(body.allow_cod !== undefined ? { allow_cod: !!body.allow_cod } : {}),
      ...(body.allow_partial_refunds !== undefined ? { allow_partial_refunds: !!body.allow_partial_refunds } : {}),
      ...(body.webhook_secret !== undefined ? { webhook_secret: body.webhook_secret || null } : {}),
    };

    const { rows } = await pool.query(
      `INSERT INTO public.razorpay_connections (owner_id, settings, is_connected)
       VALUES ($1, $2, false)
       ON CONFLICT (owner_id) DO UPDATE SET settings = $2, updated_at = now()
       RETURNING *`,
      [req.user.id, JSON.stringify(next)]
    );
    res.json(publicConnection(rows[0], req));
  });

  app.post('/api/orders/:orderId/refunds', requireAuth, async (req, res) => {
    const { orderId } = req.params;
    const amount = Number(req.body?.amount || 0);
    const reason = String(req.body?.reason || '').trim() || null;

    const { rows } = await pool.query(
      `SELECT o.id, o.outlet_id, o.total, o.payment_status,
              out.owner_id,
              op.id AS order_payment_id, op.gateway_payment_id, op.currency, op.gateway
       FROM public.orders o
       JOIN public.outlets out ON out.id = o.outlet_id
       LEFT JOIN public.order_payments op ON op.order_id = o.id
       WHERE o.id = $1
       LIMIT 1`,
      [orderId]
    );
    const row = rows[0];
    if (!row) return res.status(404).json({ error: 'Order not found' });
    if (row.owner_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
    if (!row.gateway_payment_id || row.gateway !== 'razorpay') {
      return res.status(400).json({ error: 'No Razorpay payment found for this order' });
    }
    const refundAmount = amount > 0 ? amount : Number(row.total || 0);
    if (!(refundAmount > 0)) return res.status(400).json({ error: 'Invalid refund amount' });

    try {
      const accountId = await getConnectedAccount(req.user.id);
      const refund = await createRefundForAccount(accountId, row.gateway_payment_id, {
        amount: Math.round(refundAmount * 100),
        speed: 'normal',
        notes: { order_id: row.id, outlet_id: row.outlet_id, reason: reason || '' },
      });

      await pool.query(
        `INSERT INTO public.order_refunds (
           order_payment_id, outlet_id, order_id, gateway_refund_id, amount, currency, status, reason, initiated_by, metadata
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          row.order_payment_id,
          row.outlet_id,
          row.id,
          refund.id || null,
          refundAmount,
          refund.currency || row.currency || 'INR',
          refund.status || 'pending',
          reason,
          req.user.id,
          JSON.stringify(refund),
        ]
      );

      res.json({ success: true, refund });
    } catch (err) {
      console.error('razorpay refund:', err);
      res.status(400).json({ error: err.message || 'Refund failed' });
    }
  });

  app.post('/api/webhooks/razorpay', async (req, res) => {
    try {
      const signature = req.headers['x-razorpay-signature']?.toString() || '';
      const event = req.body || {};
      const payloadStr = JSON.stringify(event);
      const notes =
        event?.payload?.payment?.entity?.notes ||
        event?.payload?.refund?.entity?.notes ||
        {};
      const ownerId = notes.owner_id || null;
      const outletId = notes.outlet_id || null;
      const orderId = notes.order_id || null;

      const conn = ownerId ? await getConnectionByOwner(ownerId) : null;
      const webhookSecret = parseSettings(conn?.settings).webhook_secret;
      if (webhookSecret && !verifyRazorpaySignature(payloadStr, signature, webhookSecret)) {
        return res.status(400).json({ error: 'Invalid webhook signature' });
      }

      const eventId = event?.id || null;
      if (eventId) {
        const { rows: existing } = await pool.query(
          `SELECT id FROM public.razorpay_events WHERE event_id = $1 LIMIT 1`,
          [eventId]
        );
        if (existing[0]) return res.json({ ok: true, duplicate: true });
      }

      await pool.query(
        `INSERT INTO public.razorpay_events (owner_id, outlet_id, order_id, event_id, event_type, payload)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [ownerId, outletId, orderId, eventId, event?.event || 'unknown', event]
      );

      if (event?.event === 'payment.authorized' || event?.event === 'payment.captured') {
        const entity = event.payload.payment.entity;

        if (orderId) {
          const { rows: orderRows } = await pool.query(
            `SELECT id FROM public.orders WHERE id = $1 LIMIT 1`,
            [orderId]
          );
          if (orderRows.length === 0) {
            const paymentStatus = event.event === 'payment.captured' ? 'captured' : 'authorized';
            try {
              await createOrderFromSession(orderId, entity.id, signature, paymentStatus);
            } catch (sessionErr) {
              console.error('Webhook createOrderFromSession error:', sessionErr);
            }
          }
        }

        await pool.query(
          `UPDATE public.order_payments
             SET gateway_payment_id = COALESCE($2, gateway_payment_id),
                 status = $3,
                 paid_at = CASE WHEN $3 = 'paid' THEN now() ELSE paid_at END,
                 authorized_at = CASE WHEN $3 = 'authorized' THEN now() ELSE authorized_at END,
                 metadata = metadata || $4::jsonb
           WHERE gateway_order_id = $1`,
          [
            entity.order_id,
            entity.id,
            event.event === 'payment.captured' ? 'paid' : 'authorized',
            JSON.stringify({ webhook_payment: entity }),
          ]
        );
        await pool.query(
          `UPDATE public.orders
             SET payment_status = $2,
                 paid_at = CASE WHEN $2 = 'paid' THEN now() ELSE paid_at END
           WHERE id = $1`,
          [orderId, event.event === 'payment.captured' ? 'paid' : 'authorized']
        );
      } else if (event?.event === 'payment.failed') {
        const entity = event.payload.payment.entity;
        await pool.query(
          `UPDATE public.order_payments
             SET status = 'failed',
                 failed_at = now(),
                 gateway_payment_id = COALESCE($2, gateway_payment_id),
                 metadata = metadata || $3::jsonb
           WHERE gateway_order_id = $1`,
          [entity.order_id, entity.id, JSON.stringify({ webhook_payment: entity })]
        );
        await pool.query(`UPDATE public.orders SET payment_status = 'failed' WHERE id = $1`, [orderId]);
      } else if (event?.event === 'refund.processed' || event?.event === 'refund.created') {
        const refund = event.payload.refund.entity;
        await pool.query(
          `UPDATE public.order_refunds
             SET status = $2,
                 metadata = metadata || $3::jsonb,
                 updated_at = now()
           WHERE gateway_refund_id = $1`,
          [refund.id, refund.status || 'processed', JSON.stringify({ webhook_refund: refund })]
        );
      }

      res.json({ ok: true });
    } catch (err) {
      console.error('razorpay webhook:', err);
      res.status(500).json({ error: err.message || 'Webhook error' });
    }
  });
}
