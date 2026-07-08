const BASE = 'https://apiv2.shiprocket.in';

async function srFetch(path, { method = 'GET', token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
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
    const msg =
      data?.message ||
      data?.error ||
      (typeof data?.errors === 'string' ? data.errors : null) ||
      `Shiprocket HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

const API_USER_HINT =
  'Use a dedicated API user from Shiprocket → Settings → API (not your main Shiprocket login). ' +
  'The API email must be different from your registered account email.';

export function formatShiprocketConnectError(err) {
  const msg = String(err?.message || err || '');
  if (/invalid email and password/i.test(msg) || err?.status === 401 || err?.status === 403) {
    return `${msg}. ${API_USER_HINT}`;
  }
  return msg || 'Failed to connect Shiprocket';
}

export async function loginShiprocket(email, password) {
  const data = await srFetch('/v1/external/auth/login', {
    method: 'POST',
    body: { email: email.trim(), password },
  });
  if (!data.token) {
    const err = new Error(data?.message || data?.error || 'Shiprocket login did not return a token');
    err.data = data;
    throw err;
  }
  return {
    token: data.token,
    expiresAt: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000),
  };
}

export async function createAdhocOrder(token, payload) {
  return srFetch('/v1/external/orders/create/adhoc', {
    method: 'POST',
    token,
    body: payload,
  });
}

export async function checkHyperlocalServiceability(token, params) {
  const q = new URLSearchParams();
  q.set('pickup_postcode', String(params.pickup_postcode));
  q.set('delivery_postcode', String(params.delivery_postcode));
  q.set('is_new_hyperlocal', '1');
  q.set('lat_from', String(params.lat_from));
  q.set('long_from', String(params.long_from));
  q.set('lat_to', String(params.lat_to));
  q.set('long_to', String(params.long_to));
  if (params.order_id != null) q.set('order_id', String(params.order_id));
  if (params.cod != null) q.set('cod', params.cod ? '1' : '0');
  if (params.weight != null) q.set('weight', String(params.weight));
  return srFetch(`/v1/external/courier/serviceability/?${q.toString()}`, { token });
}

export async function assignAwb(token, { shipment_id, courier_id }) {
  const ids = (Array.isArray(shipment_id) ? shipment_id : [shipment_id])
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id));
  return srFetch('/v1/external/courier/assign/awb', {
    method: 'POST',
    token,
    body: { shipment_id: ids, courier_id: Number(courier_id) },
  });
}

export async function trackShipment(token, shipmentId) {
  return srFetch(`/v1/external/courier/track/shipment/${shipmentId}`, { token });
}

export async function cancelOrder(token, orderIds) {
  return srFetch('/v1/external/orders/cancel', {
    method: 'POST',
    token,
    body: { ids: orderIds },
  });
}
