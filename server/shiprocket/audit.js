import pool from '../db.js';

export async function logShiprocketAction({ outletId = null, orderId = null, action, metadata = {} }) {
  try {
    await pool.query(
      `INSERT INTO public.shiprocket_audit_log (outlet_id, order_id, action, metadata)
       VALUES ($1, $2, $3, $4)`,
      [outletId, orderId, action, JSON.stringify(metadata)]
    );
  } catch (err) {
    console.warn('[shiprocket] audit log failed:', err.message);
  }
}
