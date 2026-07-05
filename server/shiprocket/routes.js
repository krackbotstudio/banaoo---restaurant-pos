import pool from '../db.js';
import { mergeSettings, DEFAULT_SETTINGS } from './status-mapper.js';
import { saveConnectionCredentials, disconnectConnection, getConnection } from './auth.js';
import { formatShiprocketConnectError } from './client.js';
import {
  getShipmentDetails,
  retryShipmentBooking,
  cancelShipment,
  onOrderStatusChange,
  scheduleShipmentBooking,
} from './delivery-service.js';
import { handleShiprocketWebhook, getPublicDeliveryStatus } from './webhook.js';
import { logShiprocketAction } from './audit.js';
import { buildEntitlementsPayload } from '../entitlements.js';

async function assertOutletOwner(outletId, userId) {
  const { rows } = await pool.query(
    `SELECT id, name, address, phone, owner_id FROM public.outlets WHERE id = $1 LIMIT 1`,
    [outletId]
  );
  const outlet = rows[0];
  if (!outlet) return { error: 'Outlet not found', status: 404 };
  if (outlet.owner_id !== userId) return { error: 'Forbidden', status: 403 };
  return { outlet };
}

async function assertOrderOwner(orderId, userId) {
  const { rows } = await pool.query(
    `SELECT o.*, out.owner_id FROM public.orders o
     JOIN public.outlets out ON out.id = o.outlet_id
     WHERE o.id = $1`,
    [orderId]
  );
  const order = rows[0];
  if (!order) return { error: 'Order not found', status: 404 };
  if (order.owner_id !== userId) return { error: 'Forbidden', status: 403 };
  return { order };
}

async function hasShiprocketEntitlement(userId) {
  try {
    const ent = await buildEntitlementsPayload(userId);
    if (ent?.access_source || ent?.access?.is_complimentary_active) return true;
    return !!ent?.effective_limits?.shiprocketDelivery;
  } catch {
    return false;
  }
}

function publicConnection(conn, outletId, req) {
  const settings = mergeSettings(conn?.settings);
  const base = `${req.protocol}://${req.get('host')}`;
  return {
    is_connected: !!conn?.is_connected,
    connected_at: conn?.connected_at ?? null,
    settings: {
      auto_delivery_enabled: settings.auto_delivery_enabled,
      prep_time_minutes: settings.prep_time_minutes,
      default_weight_kg: settings.default_weight_kg,
      dimensions: settings.dimensions,
      pickup_address: settings.pickup_address,
      pickup_location_name: settings.pickup_location_name,
      cod_enabled: settings.cod_enabled,
      retry_max_attempts: settings.retry_max_attempts,
      retry_interval_seconds: settings.retry_interval_seconds,
      delivery_mode: settings.delivery_mode || 'quick_hyperlocal',
      vehicle_mode: settings.vehicle_mode || '2_wheeler',
      webhook_secret: settings.webhook_secret || null,
    },
    webhook_url: `${base}/api/webhooks/sr-callback?outlet_id=${outletId}`,
  };
}

export function registerShiprocketRoutes(app, { requireAuth }) {
  app.get('/api/outlets/:outletId/shiprocket', requireAuth, async (req, res) => {
    const { outletId } = req.params;
    const access = await assertOutletOwner(outletId, req.user.id);
    if (access.error) return res.status(access.status).json({ error: access.error });

    const entitled = await hasShiprocketEntitlement(req.user.id);
    const conn = await getConnection(outletId);
    res.json({ ...publicConnection(conn, outletId, req), entitled });
  });

  app.post('/api/outlets/:outletId/shiprocket/connect', requireAuth, async (req, res) => {
    const { outletId } = req.params;
    const { email, password } = req.body || {};
    const access = await assertOutletOwner(outletId, req.user.id);
    if (access.error) return res.status(access.status).json({ error: access.error });
    if (!(await hasShiprocketEntitlement(req.user.id))) {
      return res.status(403).json({ error: 'Shiprocket delivery is not enabled on your plan' });
    }
    if (!email?.trim() || !password) {
      return res.status(400).json({ error: 'API email and password are required' });
    }

    try {
      const conn = await saveConnectionCredentials(outletId, email.trim(), password);
      await logShiprocketAction({ outletId, action: 'connection.connect', metadata: { email: email.trim() } });
      res.json(publicConnection(conn, outletId, req));
    } catch (err) {
      console.error('shiprocket connect:', err);
      res.status(400).json({ error: formatShiprocketConnectError(err) });
    }
  });

  app.post('/api/outlets/:outletId/shiprocket/disconnect', requireAuth, async (req, res) => {
    const { outletId } = req.params;
    const access = await assertOutletOwner(outletId, req.user.id);
    if (access.error) return res.status(access.status).json({ error: access.error });

    await disconnectConnection(outletId);
    await logShiprocketAction({ outletId, action: 'connection.disconnect' });
    res.json({ success: true, is_connected: false });
  });

  app.patch('/api/outlets/:outletId/shiprocket/settings', requireAuth, async (req, res) => {
    const { outletId } = req.params;
    const access = await assertOutletOwner(outletId, req.user.id);
    if (access.error) return res.status(access.status).json({ error: access.error });

    const body = req.body || {};
    const conn = await getConnection(outletId);
    const current = mergeSettings(conn?.settings);
    const next = {
      ...current,
      ...(body.auto_delivery_enabled !== undefined ? { auto_delivery_enabled: !!body.auto_delivery_enabled } : {}),
      ...(body.prep_time_minutes != null ? { prep_time_minutes: Number(body.prep_time_minutes) } : {}),
      ...(body.default_weight_kg != null ? { default_weight_kg: Number(body.default_weight_kg) } : {}),
      ...(body.dimensions ? { dimensions: { ...current.dimensions, ...body.dimensions } } : {}),
      ...(body.pickup_address ? { pickup_address: { ...current.pickup_address, ...body.pickup_address } } : {}),
      ...(body.pickup_location_name ? { pickup_location_name: body.pickup_location_name } : {}),
      ...(body.cod_enabled !== undefined ? { cod_enabled: !!body.cod_enabled } : {}),
      ...(body.retry_max_attempts != null ? { retry_max_attempts: Number(body.retry_max_attempts) } : {}),
      ...(body.retry_interval_seconds != null ? { retry_interval_seconds: Number(body.retry_interval_seconds) } : {}),
      ...(body.webhook_secret !== undefined ? { webhook_secret: body.webhook_secret } : {}),
    };

    const { rows } = await pool.query(
      `INSERT INTO public.shiprocket_connections (outlet_id, settings, is_connected)
       VALUES ($1, $2, false)
       ON CONFLICT (outlet_id) DO UPDATE SET settings = $2, updated_at = now()
       RETURNING *`,
      [outletId, JSON.stringify(next)]
    );

    res.json(publicConnection(rows[0], outletId, req));
  });

  app.get('/api/orders/:orderId/shiprocket', requireAuth, async (req, res) => {
    const access = await assertOrderOwner(req.params.orderId, req.user.id);
    if (access.error) return res.status(access.status).json({ error: access.error });
    const details = await getShipmentDetails(req.params.orderId);
    res.json(details || { shipment: null, events: [] });
  });

  app.post('/api/orders/:orderId/shiprocket/retry', requireAuth, async (req, res) => {
    const access = await assertOrderOwner(req.params.orderId, req.user.id);
    if (access.error) return res.status(access.status).json({ error: access.error });
    try {
      const result = await retryShipmentBooking(req.params.orderId, access.order.outlet_id);
      res.json({ success: true, shipment: result });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/orders/:orderId/shiprocket/cancel', requireAuth, async (req, res) => {
    const access = await assertOrderOwner(req.params.orderId, req.user.id);
    if (access.error) return res.status(access.status).json({ error: access.error });
    try {
      const result = await cancelShipment(req.params.orderId, access.order.outlet_id);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.patch('/api/orders/:orderId/status', requireAuth, async (req, res) => {
    const { status } = req.body || {};
    const valid = ['pending', 'preparing', 'ready', 'completed', 'paid', 'cancelled'];
    if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status' });

    const access = await assertOrderOwner(req.params.orderId, req.user.id);
    if (access.error) return res.status(access.status).json({ error: access.error });

    const oldStatus = access.order.status;
    const { rows } = await pool.query(
      `UPDATE public.orders SET status = $2, updated_at = now() WHERE id = $1 RETURNING *`,
      [req.params.orderId, status]
    );

    try {
      await onOrderStatusChange(req.params.orderId, oldStatus, status);
    } catch (err) {
      console.warn('shiprocket schedule on status change:', err.message);
    }

    res.json({ order: rows[0] });
  });

  app.get('/api/dashboard/delivery-overview', requireAuth, async (req, res) => {
    const outletId = req.query.outlet_id;
    if (!outletId) return res.status(400).json({ error: 'outlet_id required' });
    const access = await assertOutletOwner(outletId, req.user.id);
    if (access.error) return res.status(access.status).json({ error: access.error });

    const { rows } = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'booking')::int AS pending_booking,
         COUNT(*) FILTER (WHERE status IN ('shipment_created', 'awaiting_rider', 'rider_assigned'))::int AS awaiting_pickup,
         COUNT(*) FILTER (WHERE status = 'out_for_delivery')::int AS out_for_delivery,
         COUNT(*) FILTER (WHERE status = 'delivered' AND delivered_at >= date_trunc('day', now()))::int AS delivered_today,
         COUNT(*) FILTER (WHERE status = 'cancelled' AND updated_at >= date_trunc('day', now()))::int AS cancelled_today,
         COUNT(*)::int AS total_deliveries,
         AVG(EXTRACT(EPOCH FROM (delivered_at - booked_at)) / 60) FILTER (WHERE delivered_at IS NOT NULL AND booked_at IS NOT NULL) AS avg_delivery_minutes
       FROM public.shiprocket_shipments
       WHERE outlet_id = $1`,
      [outletId]
    );

    res.json({
      pending_booking: rows[0]?.pending_booking ?? 0,
      awaiting_pickup: rows[0]?.awaiting_pickup ?? 0,
      out_for_delivery: rows[0]?.out_for_delivery ?? 0,
      delivered_today: rows[0]?.delivered_today ?? 0,
      cancelled: rows[0]?.cancelled_today ?? 0,
      total_deliveries: rows[0]?.total_deliveries ?? 0,
      avg_delivery_minutes: rows[0]?.avg_delivery_minutes
        ? Math.round(Number(rows[0].avg_delivery_minutes))
        : null,
    });
  });

  const handleWebhookRoute = async (req, res) => {
    const outletId = req.query.outlet_id;
    if (!outletId) return res.status(400).json({ error: 'outlet_id required' });
    try {
      const result = await handleShiprocketWebhook(outletId, req.body || {}, req.headers);
      if (!result.ok) return res.status(result.error === 'Invalid webhook secret' ? 401 : 404).json(result);
      res.json({ success: true });
    } catch (err) {
      console.error('shiprocket webhook:', err);
      res.status(500).json({ error: err.message });
    }
  };

  app.post('/api/webhooks/shiprocket', handleWebhookRoute);
  app.post('/api/webhooks/sr-callback', handleWebhookRoute);

  app.post('/api/orders/:orderId/shiprocket/schedule', requireAuth, async (req, res) => {
    const access = await assertOrderOwner(req.params.orderId, req.user.id);
    if (access.error) return res.status(access.status).json({ error: access.error });
    if (access.order.order_type !== 'delivery') {
      return res.json({ scheduled: false, reason: 'not_delivery' });
    }
    try {
      const row = await scheduleShipmentBooking(req.params.orderId, access.order.outlet_id);
      res.json({ scheduled: !!row });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/public/orders/:orderId/delivery-status', async (req, res) => {
    const phone = req.query.phone?.toString() || '';
    try {
      const data = await getPublicDeliveryStatus(req.params.orderId, phone || null);
      if (!data) return res.status(404).json({ error: 'Not found' });
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}

export { onOrderStatusChange };
