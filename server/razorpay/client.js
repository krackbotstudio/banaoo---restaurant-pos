import {
  assertRazorpayOAuthConfigured,
  getRazorpayOAuthClientId,
  getRazorpayOAuthClientSecret,
  getRazorpayOAuthMode,
} from './config.js';

const API_BASE = 'https://api.razorpay.com/v1';
const OAUTH_TOKEN_URL = 'https://auth.razorpay.com/token';

function partnerBasicAuth() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new Error('Razorpay partner credentials are not configured');
  }
  return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`;
}

async function rpFetch(path, { method = 'GET', authHeader, body, extraHeaders } = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(authHeader ? { Authorization: authHeader } : {}),
    ...(extraHeaders || {}),
  };
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(data?.error?.description || data?.error || `Razorpay HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function oauthTokenRequest(body) {
  assertRazorpayOAuthConfigured();
  const res = await fetch(OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(
      data?.error?.description || data?.error?.message || data?.error || `Razorpay OAuth HTTP ${res.status}`
    );
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export async function exchangeOAuthCode(code, redirectUri) {
  return oauthTokenRequest({
    client_id: getRazorpayOAuthClientId(),
    client_secret: getRazorpayOAuthClientSecret(),
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
    code,
    mode: getRazorpayOAuthMode(),
  });
}

export async function refreshOAuthToken(refreshToken) {
  return oauthTokenRequest({
    client_id: getRazorpayOAuthClientId(),
    client_secret: getRazorpayOAuthClientSecret(),
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    mode: getRazorpayOAuthMode(),
  });
}

function merchantBasicAuth(keyId, keySecret) {
  return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`;
}

export async function validateMerchantKeys(keyId, keySecret) {
  const trimmedId = keyId?.trim();
  const trimmedSecret = keySecret?.trim();
  if (!trimmedId || !trimmedSecret) {
    throw new Error('Razorpay Key ID and Key Secret are required');
  }
  if (!/^rzp_(test|live)_/i.test(trimmedId)) {
    throw new Error('Enter a valid Razorpay Key ID (starts with rzp_test_ or rzp_live_)');
  }
  await rpFetch('/orders?count=1', {
    authHeader: merchantBasicAuth(trimmedId, trimmedSecret),
  });
  return { keyId: trimmedId, keySecret: trimmedSecret };
}

export async function createOrderForMerchant({ keyId, keySecret, accountId, accessToken }, payload) {
  if (keyId && keySecret) {
    return rpFetch('/orders', {
      method: 'POST',
      authHeader: merchantBasicAuth(keyId, keySecret),
      body: payload,
    });
  }
  return rpFetch('/orders', {
    method: 'POST',
    authHeader: partnerBasicAuth(),
    extraHeaders: accountId ? { 'X-Razorpay-Account': accountId } : undefined,
    body: payload,
  });
}

export async function fetchPaymentForMerchant({ keyId, keySecret, accountId }, paymentId) {
  if (keyId && keySecret) {
    return rpFetch(`/payments/${paymentId}`, {
      authHeader: merchantBasicAuth(keyId, keySecret),
    });
  }
  return rpFetch(`/payments/${paymentId}`, {
    authHeader: partnerBasicAuth(),
    extraHeaders: accountId ? { 'X-Razorpay-Account': accountId } : undefined,
  });
}

export async function createOrderForAccount(accountId, payload) {
  return createOrderForMerchant({ accountId }, payload);
}

export async function createRefundForAccount(accountId, paymentId, payload) {
  return rpFetch(`/payments/${paymentId}/refund`, {
    method: 'POST',
    authHeader: partnerBasicAuth(),
    extraHeaders: accountId ? { 'X-Razorpay-Account': accountId } : undefined,
    body: payload,
  });
}
