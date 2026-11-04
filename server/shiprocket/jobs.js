import pool from '../db.js';
import { bookShipment } from './delivery-service.js';
import { syncShipmentTracking } from './delivery-service.js';
import { getConnection } from './auth.js';
import { getValidToken } from './auth.js';

const ACTIVE_STATUSES = [
  'shipment_created',
  'awaiting_rider',
  'rider_assigned',
  'picked_up',
  'out_for_delivery',
];

export async function processDueBookings() {
  const { rows } = await pool.query(
    `SELECT * FROM public.shiprocket_shipments
     WHERE status = 'booking'
       AND booking_scheduled_at IS NOT NULL
       AND booking_scheduled_at <= now()
     ORDER BY booking_scheduled_at ASC
     LIMIT 10
     FOR UPDATE SKIP LOCKED`
  );

  for (const row of rows) {
    try {
      await bookShipment(row);
    } catch (err) {
      console.error('[shiprocket] booking failed:', row.order_id, err.message);
    }
  }
}

export async function processRetries() {
  const { rows } = await pool.query(
    `SELECT * FROM public.shiprocket_shipments
     WHERE status = 'booking_failed'
       AND next_retry_at IS NOT NULL
       AND next_retry_at <= now()
     ORDER BY next_retry_at ASC
     LIMIT 5
     FOR UPDATE SKIP LOCKED`
  );

  for (const row of rows) {
    try {
      await pool.query(
        `UPDATE public.shiprocket_shipments SET status = 'booking', booking_scheduled_at = now() WHERE id = $1`,
        [row.id]
      );
      await bookShipment({ ...row, status: 'booking' });
    } catch (err) {
      console.error('[shiprocket] retry failed:', row.order_id, err.message);
    }
  }
}

export async function processTrackingPoll() {
  const { rows } = await pool.query(
    `SELECT * FROM public.shiprocket_shipments
     WHERE status = ANY($1::text[])
       AND shipment_id IS NOT NULL
       AND updated_at < now() - interval '2 minutes'
     ORDER BY updated_at ASC
     LIMIT 10`,
    [ACTIVE_STATUSES]
  );

  for (const row of rows) {
    try {
      await syncShipmentTracking(row);
    } catch (err) {
      console.warn('[shiprocket] poll failed:', row.id, err.message);
    }
  }
}

export async function refreshExpiringTokens() {
  const { rows } = await pool.query(
    `SELECT outlet_id FROM public.shiprocket_connections
     WHERE is_connected = true
       AND (token_expires_at IS NULL OR token_expires_at < now() + interval '24 hours')
     LIMIT 20`
  );
  for (const row of rows) {
    try {
      await getValidToken(row.outlet_id);
    } catch (err) {
      console.warn('[shiprocket] token refresh:', row.outlet_id, err.message);
    }
  }
}

let intervalHandle = null;

export function startShiprocketJobs() {
  if (process.env.ENABLE_SHIPROCKET_JOBS !== 'true') return;
  if (intervalHandle) return;
  const tick = async () => {
    try {
      await processDueBookings();
      await processRetries();
      await processTrackingPoll();
      await refreshExpiringTokens();
    } catch (err) {
      console.error('[shiprocket] job tick error:', err);
    }
  };
  void tick();
  intervalHandle = setInterval(tick, 30_000);
  console.log('[shiprocket] background jobs started (30s interval)');
}
