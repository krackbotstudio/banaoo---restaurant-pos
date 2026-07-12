import pool from '../db.js';
import { encryptSecret, decryptSecret } from './crypto.js';
import { loginShiprocket } from './client.js';

export async function getConnection(outletId) {
  const { rows } = await pool.query(
    `SELECT * FROM public.shiprocket_connections WHERE outlet_id = $1 LIMIT 1`,
    [outletId]
  );
  return rows[0] ?? null;
}

export async function saveConnectionCredentials(outletId, email, password) {
  const { token, expiresAt } = await loginShiprocket(email, password);
  const { rows } = await pool.query(
    `INSERT INTO public.shiprocket_connections (
       outlet_id, api_email_enc, api_password_enc, access_token_enc,
       token_expires_at, is_connected, connected_at, updated_at
     ) VALUES ($1, $2, $3, $4, $5, true, now(), now())
     ON CONFLICT (outlet_id) DO UPDATE SET
       api_email_enc = EXCLUDED.api_email_enc,
       api_password_enc = EXCLUDED.api_password_enc,
       access_token_enc = EXCLUDED.access_token_enc,
       token_expires_at = EXCLUDED.token_expires_at,
       is_connected = true,
       connected_at = COALESCE(shiprocket_connections.connected_at, now()),
       updated_at = now()
     RETURNING *`,
    [
      outletId,
      encryptSecret(email),
      encryptSecret(password),
      encryptSecret(token),
      expiresAt.toISOString(),
    ]
  );
  return rows[0];
}

export async function disconnectConnection(outletId) {
  await pool.query(
    `UPDATE public.shiprocket_connections SET
       is_connected = false,
       access_token_enc = NULL,
       token_expires_at = NULL,
       api_email_enc = NULL,
       api_password_enc = NULL,
       updated_at = now()
     WHERE outlet_id = $1`,
    [outletId]
  );
}

export function isShiprocketAuthError(err) {
  const msg = String(err?.message || err?.data?.message || err?.data?.error || '').toLowerCase();
  return (
    err?.status === 401 ||
    /token[_\s-]?expired|unauthorized|unauthenticated|invalid.?token|jwt.?expired/i.test(msg)
  );
}

/** Get a Shiprocket bearer token, refreshing when near expiry or when `force` is set. */
export async function getValidToken(outletId, { force = false } = {}) {
  const conn = await getConnection(outletId);
  if (!conn?.is_connected) throw new Error('Shiprocket not connected');

  const expires = conn.token_expires_at ? new Date(conn.token_expires_at) : null;
  const needsRefresh =
    force ||
    !conn.access_token_enc ||
    !expires ||
    expires < new Date(Date.now() + 60 * 60 * 1000);

  if (!needsRefresh) {
    return decryptSecret(conn.access_token_enc);
  }

  const email = decryptSecret(conn.api_email_enc);
  const password = decryptSecret(conn.api_password_enc);
  if (!email || !password) {
    throw new Error(
      'Shiprocket credentials missing. Disconnect and reconnect in Settings → Delivery.'
    );
  }

  const { token, expiresAt } = await loginShiprocket(email, password);
  await pool.query(
    `UPDATE public.shiprocket_connections
     SET access_token_enc = $2, token_expires_at = $3, updated_at = now()
     WHERE outlet_id = $1`,
    [outletId, encryptSecret(token), expiresAt.toISOString()]
  );
  return token;
}

/**
 * Run an API call with a valid token; on token_expired / 401, force-refresh once and retry.
 */
export async function withValidToken(outletId, fn) {
  let token = await getValidToken(outletId);
  try {
    return await fn(token);
  } catch (err) {
    if (!isShiprocketAuthError(err)) throw err;
    token = await getValidToken(outletId, { force: true });
    return await fn(token);
  }
}
