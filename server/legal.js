// Server mirror of src/lib/legal.ts. Keep CURRENT_TERMS_VERSION in sync.

export const CURRENT_TERMS_VERSION = '2026-05-25';

/**
 * Best-effort extraction of the client's IP address. Falls back through the
 * X-Forwarded-For chain and `req.ip` (set by Express's `trust proxy`).
 *
 * @param {import('express').Request} req
 * @returns {string | null}
 */
export function extractClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return String(forwarded[0]).trim();
  }
  return req.ip || (req.socket && req.socket.remoteAddress) || null;
}
