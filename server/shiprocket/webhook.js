import pool from '../db.js';
import { mapShiprocketStatus, deliveryStatusForOrder, CUSTOMER_STATUS_LABELS } from './status-mapper.js';
import { mergeSettings } from './status-mapper.js';
import { getConnection } from './auth.js';
import { logShiprocketAction } from './audit.js';
import { syncShipmentTracking } from './delivery-service.js';

const ACTIVE_TRACKING_STATUSES = [
  'shipment_created',
  'awaiting_rider',
  'rider_assigned',
  'picked_up',
  'out_for_delivery',
];

const TRACK_REFRESH_MS = 90_000;

function parseSnapshotActivities(snapshot) {
  if (!snapshot) return [];
  const raw = typeof snapshot === 'string' ? JSON.parse(snapshot) : snapshot;
  return Array.isArray(raw?.activities) ? raw.activities : [];
}

function parseSnapshotCourier(snapshot) {
  if (!snapshot) return null;
  const raw = typeof snapshot === 'string' ? JSON.parse(snapshot) : snapshot;
  const agent = raw?.courier_agent;
  if (!agent || typeof agent !== 'object') return null;
  return {
    name: agent.name || agent.courier_name || null,
    phone: agent.phone || agent.courier_phone || null,
  };
}

async function maybeRefreshShipmentTracking(row) {
  if (!row.shipment_row_id || !row.shipment_id || !ACTIVE_TRACKING_STATUSES.includes(row.status)) {
    return row;
  }
  const age = Date.now() - new Date(row.shipment_updated_at || 0).getTime();
  if (age < TRACK_REFRESH_MS) return row;

  try {
    const updated = await syncShipmentTracking({
      id: row.shipment_row_id,
      order_id: row.id,
      outlet_id: row.outlet_id,
      shipment_id: row.shipment_id,
      awb_code: row.awb_code,
      status: row.status,
      tracking_url: row.tracking_url,
    });
    return {
      ...row,
      status: updated.status,
      tracking_url: updated.tracking_url,
      last_track_snapshot: updated.last_track_snapshot,
      shipment_updated_at: new Date().toISOString(),
    };
  } catch (err) {
    console.warn('[shiprocket] public track refresh:', row.id, err.message);
    return row;
  }
}

export async function handleShiprocketWebhook(outletId, body, headers = {}) {
  const conn = await getConnection(outletId);
  if (!conn) return { ok: false, error: 'Unknown outlet' };

  const settings = mergeSettings(conn.settings);
  if (settings.webhook_secret) {
    const key = headers['x-api-key'] || headers['x-api_key'];
    if (key !== settings.webhook_secret) {
      return { ok: false, error: 'Invalid webhook secret' };
    }
  }

  const awb = body?.awb || body?.awb_code;
  const shipmentId = body?.shipment_id || body?.sr_order_id;
  const orderNumber = body?.order_id;
  const rawStatus = body?.current_status || body?.current_status_id || body?.status;

  let shipRow = null;
  if (awb) {
    const { rows } = await pool.query(
      `SELECT * FROM public.shiprocket_shipments WHERE outlet_id = $1 AND awb_code = $2 LIMIT 1`,
      [outletId, String(awb)]
    );
    shipRow = rows[0];
  }
  if (!shipRow && shipmentId) {
    const { rows } = await pool.query(
      `SELECT * FROM public.shiprocket_shipments WHERE outlet_id = $1 AND shipment_id = $2 LIMIT 1`,
      [outletId, String(shipmentId)]
    );
    shipRow = rows[0];
  }
  if (!shipRow && orderNumber) {
    const { rows } = await pool.query(
      `SELECT s.* FROM public.shiprocket_shipments s
       JOIN public.orders o ON o.id = s.order_id
       WHERE s.outlet_id = $1 AND o.order_number = $2
       LIMIT 1`,
      [outletId, String(orderNumber)]
    );
    shipRow = rows[0];
  }

  if (!shipRow) {
    await logShiprocketAction({
      outletId,
      action: 'webhook.unmatched',
      metadata: { body },
    });
    return { ok: true, unmatched: true };
  }

  const mapped = mapShiprocketStatus(rawStatus) || shipRow.status;
  await pool.query(
    `UPDATE public.shiprocket_shipments SET
       status = $2,
       awb_code = COALESCE($3, awb_code),
       courier_name = COALESCE($4, courier_name),
       delivered_at = CASE WHEN $2 = 'delivered' THEN now() ELSE delivered_at END,
       updated_at = now()
     WHERE id = $1`,
    [shipRow.id, mapped, awb || null, body?.courier_name || null]
  );

  await pool.query(
    `UPDATE public.orders SET delivery_status = $2 WHERE id = $1`,
    [shipRow.order_id, deliveryStatusForOrder(mapped)]
  );

  await pool.query(
    `INSERT INTO public.shiprocket_tracking_events (shipment_id, event_code, event_message, raw)
     VALUES ($1, $2, $3, $4)`,
    [shipRow.id, rawStatus || mapped, body?.remarks || 'Webhook update', JSON.stringify(body)]
  );

  await logShiprocketAction({
    outletId,
    orderId: shipRow.order_id,
    action: 'webhook.received',
    metadata: { status: mapped, raw: rawStatus },
  });

  return { ok: true, status: mapped };
}

export async function getPublicDeliveryStatus(orderId, customerPhone) {
  const { rows } = await pool.query(
    `SELECT o.id, o.outlet_id, o.customer_phone, o.status AS order_status, o.order_type,
            o.delivery_latitude, o.delivery_longitude, o.delivery_address,
            out.name AS outlet_name, out.latitude AS outlet_latitude, out.longitude AS outlet_longitude,
            s.id AS shipment_row_id, s.status, s.shipment_id, s.awb_code, s.courier_name, s.tracking_url,
            s.estimated_pickup_at, s.estimated_delivery_at, s.updated_at AS shipment_updated_at,
            s.last_track_snapshot
     FROM public.orders o
     JOIN public.outlets out ON out.id = o.outlet_id
     LEFT JOIN public.shiprocket_shipments s ON s.order_id = o.id
     WHERE o.id = $1
     LIMIT 1`,
    [orderId]
  );
  let row = rows[0];
  if (!row) return null;
  if (customerPhone && row.customer_phone !== customerPhone) return null;

  row = await maybeRefreshShipmentTracking(row);

  const deliveryStatus = row.status || (row.order_status === 'preparing' ? 'booking' : 'not_booked');
  const { rows: events } = row.status
    ? await pool.query(
        `SELECT e.event_code, e.event_message, e.occurred_at
         FROM public.shiprocket_tracking_events e
         JOIN public.shiprocket_shipments s ON s.id = e.shipment_id
         WHERE s.order_id = $1
         ORDER BY e.occurred_at ASC`,
        [orderId]
      )
    : { rows: [] };

  const trackActivities = parseSnapshotActivities(row.last_track_snapshot);
  const rider = parseSnapshotCourier(row.last_track_snapshot);

  return {
    order_status: row.order_status,
    order_type: row.order_type,
    delivery_status: deliveryStatus,
    label: CUSTOMER_STATUS_LABELS[deliveryStatus] || deliveryStatus,
    awb_code: row.awb_code,
    courier_name: row.courier_name,
    tracking_url: row.tracking_url,
    estimated_pickup_at: row.estimated_pickup_at,
    estimated_delivery_at: row.estimated_delivery_at,
    delivery_latitude: row.delivery_latitude != null ? Number(row.delivery_latitude) : null,
    delivery_longitude: row.delivery_longitude != null ? Number(row.delivery_longitude) : null,
    delivery_address: row.delivery_address,
    outlet_name: row.outlet_name,
    outlet_latitude: row.outlet_latitude != null ? Number(row.outlet_latitude) : null,
    outlet_longitude: row.outlet_longitude != null ? Number(row.outlet_longitude) : null,
    rider_name: rider?.name || null,
    rider_phone: rider?.phone || null,
    track_activities: trackActivities,
    timeline: events,
  };
}
