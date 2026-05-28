import pool from '../db.js';

/**
 * Record a CMS action to admin_audit_log.
 * @param {object} opts
 * @param {string|null} opts.adminId
 * @param {string|null} opts.adminEmail
 * @param {string} opts.action
 * @param {string} [opts.targetType]
 * @param {string} [opts.targetId]
 * @param {object} [opts.metadata]
 * @param {import('express').Request} [opts.req]
 */
export async function logAdminAction({
  adminId = null,
  adminEmail = null,
  action,
  targetType = null,
  targetId = null,
  metadata = {},
  req = null,
}) {
  try {
    const ip =
      req?.headers?.['x-forwarded-for']?.toString().split(',')[0]?.trim() ||
      req?.socket?.remoteAddress ||
      null;
    const userAgent = req?.get?.('user-agent') || null;

    await pool.query(
      `INSERT INTO public.admin_audit_log
         (admin_id, admin_email, action, target_type, target_id, metadata, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)`,
      [
        adminId,
        adminEmail,
        action,
        targetType,
        targetId,
        JSON.stringify(metadata),
        ip,
        userAgent,
      ]
    );
  } catch (err) {
    console.error('admin_audit_log insert failed:', err.message);
  }
}
