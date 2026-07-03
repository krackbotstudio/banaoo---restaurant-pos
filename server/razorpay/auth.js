import pool from '../db.js';
import { encryptSecret, decryptSecret } from './crypto.js';
import { exchangeOAuthCode, refreshOAuthToken, validateMerchantKeys } from './client.js';

function isMissingRazorpayTable(err) {
  return err?.code === '42P01';
}

export function isRazorpayConnectionActive(conn) {
  if (!conn?.is_connected) return false;
  if (conn.connection_mode === 'api_keys') {
    return Boolean(conn.merchant_key_id && conn.merchant_key_secret_enc);
  }
  return Boolean(conn.account_id && conn.access_token_enc);
}

export function getCheckoutKeyId(conn) {
  if (!isRazorpayConnectionActive(conn)) return null;
  if (conn.connection_mode === 'api_keys') return conn.merchant_key_id;
  return conn.public_token || conn.merchant_key_id || null;
}

export async function getMerchantAuth(ownerId) {
  const conn = await getConnectionByOwner(ownerId);
  if (!isRazorpayConnectionActive(conn)) return null;

  if (conn.connection_mode === 'api_keys') {
    return {
      mode: 'api_keys',
      keyId: conn.merchant_key_id,
      keySecret: decryptSecret(conn.merchant_key_secret_enc),
      accountId: null,
    };
  }

  return {
    mode: 'oauth',
    keyId: null,
    keySecret: null,
    accountId: conn.account_id,
    accessToken: await getValidAccessToken(ownerId),
  };
}

export async function getConnectionByOwner(ownerId) {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM public.razorpay_connections WHERE owner_id = $1 LIMIT 1`,
      [ownerId]
    );
    return rows[0] || null;
  } catch (err) {
    if (isMissingRazorpayTable(err)) return null;
    throw err;
  }
}

export async function saveOAuthConnection(ownerId, oauthData) {
  const accountId =
    oauthData?.razorpay_account_id ||
    oauthData?.merchant_id ||
    oauthData?.razorpay_account_id ||
    oauthData?.account_id ||
    null;
  const accountName = oauthData?.merchant_name || null;
  const accessToken = oauthData?.access_token || null;
  const refreshToken = oauthData?.refresh_token || null;
  const publicToken = oauthData?.public_token || null;
  const expiresIn = Number(oauthData?.expires_in) || 0;
  const expiresAt = expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000) : null;

  const { rows } = await pool.query(
    `INSERT INTO public.razorpay_connections (
       owner_id, connection_mode, account_id, account_name, merchant_key_id,
       access_token_enc, refresh_token_enc, token_expires_at, is_connected, connected_at
     ) VALUES ($1,'oauth',$2,$3,$4,$5,$6,$7,true,now())
     ON CONFLICT (owner_id) DO UPDATE SET
       connection_mode = 'oauth',
       account_id = EXCLUDED.account_id,
       account_name = COALESCE(EXCLUDED.account_name, public.razorpay_connections.account_name),
       merchant_key_id = EXCLUDED.merchant_key_id,
       merchant_key_secret_enc = NULL,
       access_token_enc = EXCLUDED.access_token_enc,
       refresh_token_enc = EXCLUDED.refresh_token_enc,
       token_expires_at = EXCLUDED.token_expires_at,
       is_connected = true,
       connected_at = COALESCE(public.razorpay_connections.connected_at, now()),
       updated_at = now()
     RETURNING *`,
    [
      ownerId,
      accountId,
      accountName,
      publicToken,
      encryptSecret(accessToken),
      encryptSecret(refreshToken),
      expiresAt?.toISOString() || null,
    ]
  );
  return rows[0];
}

export async function saveApiKeyConnection(ownerId, keyId, keySecret) {
  await validateMerchantKeys(keyId, keySecret);
  const { rows } = await pool.query(
    `INSERT INTO public.razorpay_connections (
       owner_id, connection_mode, merchant_key_id, merchant_key_secret_enc,
       account_id, account_name, access_token_enc, refresh_token_enc, token_expires_at,
       is_connected, connected_at
     ) VALUES ($1,'api_keys',$2,$3,NULL,NULL,NULL,NULL,NULL,true,now())
     ON CONFLICT (owner_id) DO UPDATE SET
       connection_mode = 'api_keys',
       merchant_key_id = EXCLUDED.merchant_key_id,
       merchant_key_secret_enc = EXCLUDED.merchant_key_secret_enc,
       account_id = NULL,
       account_name = NULL,
       access_token_enc = NULL,
       refresh_token_enc = NULL,
       token_expires_at = NULL,
       is_connected = true,
       connected_at = COALESCE(public.razorpay_connections.connected_at, now()),
       updated_at = now()
     RETURNING *`,
    [ownerId, keyId.trim(), encryptSecret(keySecret)]
  );
  return rows[0];
}

export async function disconnectConnection(ownerId) {
  await pool.query(
    `UPDATE public.razorpay_connections
       SET is_connected = false,
           connection_mode = 'oauth',
           merchant_key_id = NULL,
           merchant_key_secret_enc = NULL,
           access_token_enc = NULL,
           refresh_token_enc = NULL,
           token_expires_at = NULL,
           account_id = NULL,
           account_name = NULL,
           updated_at = now()
     WHERE owner_id = $1`,
    [ownerId]
  );
}

export async function completeOAuthCode(ownerId, code, redirectUri) {
  const tokenData = await exchangeOAuthCode(code, redirectUri);
  return saveOAuthConnection(ownerId, tokenData);
}

export async function getConnectedAccount(ownerId) {
  const conn = await getConnectionByOwner(ownerId);
  if (!isRazorpayConnectionActive(conn)) return null;
  if (conn.connection_mode === 'api_keys') return null;
  return conn.account_id;
}

export async function getValidAccessToken(ownerId) {
  const conn = await getConnectionByOwner(ownerId);
  if (!conn?.is_connected || conn.connection_mode === 'api_keys') {
    throw new Error('Razorpay OAuth is not connected');
  }

  const token = decryptSecret(conn.access_token_enc);
  const refresh = decryptSecret(conn.refresh_token_enc);
  const expiresSoon =
    conn.token_expires_at && new Date(conn.token_expires_at).getTime() <= Date.now() + 2 * 60 * 1000;

  if (token && !expiresSoon) return token;
  if (!refresh) return token;

  const refreshed = await refreshOAuthToken(refresh);
  const saved = await saveOAuthConnection(ownerId, {
    ...refreshed,
    merchant_id: conn.account_id,
    merchant_name: conn.account_name,
  });
  return decryptSecret(saved.access_token_enc);
}
