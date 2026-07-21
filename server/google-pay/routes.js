import pool from '../db.js';
import { buildEntitlementsPayload } from '../entitlements.js';

const VPA_RE = /^[\w.\-]{2,256}@[\w]{2,64}$/;
const MCC_RE = /^[0-9]{4}$/;

export function isValidGooglePayVpa(vpa) {
  return typeof vpa === 'string' && VPA_RE.test(vpa.trim());
}

export function isValidMcc(mcc) {
  return typeof mcc === 'string' && MCC_RE.test(mcc.trim());
}

export function normalizeGooglePayConnection(row) {
  if (!row) {
    return {
      is_configured: false,
      is_enabled: false,
      merchant_vpa: null,
      payee_name: null,
      mcc: null,
      connected_at: null,
      settings: { allow_cod: true },
    };
  }
  const settings =
    row.settings && typeof row.settings === 'object' ? row.settings : {};
  return {
    is_configured: !!row.is_configured,
    is_enabled: !!row.is_enabled,
    merchant_vpa: row.merchant_vpa || null,
    payee_name: row.payee_name || null,
    mcc: row.mcc || null,
    connected_at: row.connected_at || null,
    settings: {
      allow_cod: settings.allow_cod !== false,
    },
  };
}

export function isGooglePayReady(conn) {
  const n = normalizeGooglePayConnection(conn);
  return (
    n.is_enabled &&
    n.is_configured &&
    isValidGooglePayVpa(n.merchant_vpa || '') &&
    !!n.payee_name?.trim() &&
    isValidMcc(n.mcc || '')
  );
}

export async function getGooglePayConnection(ownerId) {
  const { rows } = await pool.query(
    `SELECT * FROM public.google_pay_connections WHERE owner_id = $1 LIMIT 1`,
    [ownerId]
  );
  return rows[0] ?? null;
}

export async function getOnlinePaymentProvider(ownerId) {
  const { rows } = await pool.query(
    `SELECT online_payment_provider FROM public.profiles WHERE user_id = $1 LIMIT 1`,
    [ownerId]
  );
  const provider = rows[0]?.online_payment_provider;
  if (provider === 'razorpay' || provider === 'google_pay') return provider;
  return null;
}

export async function setOnlinePaymentProvider(ownerId, provider) {
  if (provider !== null && provider !== 'razorpay' && provider !== 'google_pay') {
    const err = new Error('Invalid online_payment_provider');
    err.status = 400;
    throw err;
  }
  const { rows } = await pool.query(
    `UPDATE public.profiles
     SET online_payment_provider = $2
     WHERE user_id = $1
     RETURNING online_payment_provider`,
    [ownerId, provider]
  );
  if (!rows[0]) {
    const err = new Error('Profile not found');
    err.status = 404;
    throw err;
  }
  return rows[0].online_payment_provider;
}

async function hasGooglePayEntitlement(userId) {
  try {
    const ent = await buildEntitlementsPayload(userId);
    if (ent?.access_source || ent?.access?.is_complimentary_active) return true;
    return Boolean(ent?.effective_limits?.googlePayIndia);
  } catch {
    return false;
  }
}

export function buildGooglePayPaymentRequest({
  merchantVpa,
  payeeName,
  mcc,
  transactionRef,
  amount,
  currency = 'INR',
  referenceUrl,
}) {
  const am = Number(amount).toFixed(2);
  const supportedInstruments = [
    {
      supportedMethods: 'https://tez.google.com/pay',
      data: {
        pa: merchantVpa.trim(),
        pn: payeeName.trim().slice(0, 80),
        mc: mcc.trim(),
        tr: String(transactionRef).slice(0, 40),
        ...(referenceUrl ? { url: referenceUrl } : {}),
        tn: 'Banaoo order',
      },
    },
  ];
  const details = {
    total: {
      label: 'Total',
      amount: { currency, value: am },
    },
  };
  return { supportedInstruments, details, currency, amount: am };
}

export function registerGooglePayRoutes(app, { requireAuth }) {
  app.get('/api/google-pay', requireAuth, async (req, res) => {
    if (req.user.isStaff) return res.status(403).json({ error: 'Owners only' });
    try {
      const entitled = await hasGooglePayEntitlement(req.user.id);
      const conn = await getGooglePayConnection(req.user.id);
      const provider = await getOnlinePaymentProvider(req.user.id);
      res.json({
        entitled,
        online_payment_provider: provider,
        google_pay: normalizeGooglePayConnection(conn),
        ready: isGooglePayReady(conn),
      });
    } catch (err) {
      console.error('GET /api/google-pay:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/google-pay', requireAuth, async (req, res) => {
    if (req.user.isStaff) return res.status(403).json({ error: 'Owners only' });
    if (!(await hasGooglePayEntitlement(req.user.id))) {
      return res.status(403).json({ error: 'Google Pay India add-on is not active' });
    }

    const body = req.body || {};
    const merchantVpa =
      body.merchant_vpa !== undefined ? String(body.merchant_vpa || '').trim() : undefined;
    const payeeName =
      body.payee_name !== undefined ? String(body.payee_name || '').trim() : undefined;
    const mcc = body.mcc !== undefined ? String(body.mcc || '').trim() : undefined;
    const isEnabled = body.is_enabled !== undefined ? !!body.is_enabled : undefined;
    const allowCod =
      body.allow_cod !== undefined
        ? !!body.allow_cod
        : body.settings?.allow_cod !== undefined
          ? !!body.settings.allow_cod
          : undefined;

    if (merchantVpa !== undefined && merchantVpa && !isValidGooglePayVpa(merchantVpa)) {
      return res.status(400).json({ error: 'Invalid merchant VPA' });
    }
    if (mcc !== undefined && mcc && !isValidMcc(mcc)) {
      return res.status(400).json({ error: 'MCC must be a 4-digit code' });
    }

    try {
      const existing = await getGooglePayConnection(req.user.id);
      const nextVpa =
        merchantVpa !== undefined ? merchantVpa || null : existing?.merchant_vpa || null;
      const nextName =
        payeeName !== undefined ? payeeName || null : existing?.payee_name || null;
      const nextMcc = mcc !== undefined ? mcc || null : existing?.mcc || null;
      const configured =
        isValidGooglePayVpa(nextVpa || '') &&
        !!String(nextName || '').trim() &&
        isValidMcc(nextMcc || '');
      const nextEnabled =
        isEnabled !== undefined ? isEnabled && configured : !!existing?.is_enabled && configured;

      const prevSettings =
        existing?.settings && typeof existing.settings === 'object' ? existing.settings : {};
      const nextSettings = {
        ...prevSettings,
        allow_cod: allowCod !== undefined ? allowCod : prevSettings.allow_cod !== false,
      };

      const { rows } = await pool.query(
        `INSERT INTO public.google_pay_connections (
           owner_id, merchant_vpa, payee_name, mcc, is_enabled, is_configured, settings,
           connected_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, CASE WHEN $5 THEN now() ELSE NULL END, now())
         ON CONFLICT (owner_id) DO UPDATE SET
           merchant_vpa = EXCLUDED.merchant_vpa,
           payee_name = EXCLUDED.payee_name,
           mcc = EXCLUDED.mcc,
           is_enabled = EXCLUDED.is_enabled,
           is_configured = EXCLUDED.is_configured,
           settings = EXCLUDED.settings,
           connected_at = CASE
             WHEN EXCLUDED.is_enabled AND NOT google_pay_connections.is_enabled THEN now()
             WHEN EXCLUDED.is_enabled THEN COALESCE(google_pay_connections.connected_at, now())
             ELSE google_pay_connections.connected_at
           END,
           updated_at = now()
         RETURNING *`,
        [
          req.user.id,
          nextVpa,
          nextName,
          nextMcc,
          nextEnabled,
          configured,
          JSON.stringify(nextSettings),
        ]
      );

      if (nextEnabled) {
        await setOnlinePaymentProvider(req.user.id, 'google_pay');
      }

      const provider = await getOnlinePaymentProvider(req.user.id);
      res.json({
        entitled: true,
        online_payment_provider: provider,
        google_pay: normalizeGooglePayConnection(rows[0]),
        ready: isGooglePayReady(rows[0]),
      });
    } catch (err) {
      console.error('PUT /api/google-pay:', err);
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  app.patch('/api/online-payment-provider', requireAuth, async (req, res) => {
    if (req.user.isStaff) return res.status(403).json({ error: 'Owners only' });
    const provider = req.body?.provider ?? null;
    if (provider !== null && provider !== 'razorpay' && provider !== 'google_pay') {
      return res.status(400).json({ error: 'provider must be razorpay, google_pay, or null' });
    }

    try {
      if (provider === 'google_pay') {
        if (!(await hasGooglePayEntitlement(req.user.id))) {
          return res.status(403).json({ error: 'Google Pay India add-on is not active' });
        }
        const conn = await getGooglePayConnection(req.user.id);
        if (!isGooglePayReady(conn)) {
          return res.status(400).json({
            error: 'Configure and enable Google Pay (VPA, payee name, MCC) before selecting it',
          });
        }
      }
      if (provider === 'razorpay') {
        const ent = await buildEntitlementsPayload(req.user.id);
        const entitled =
          ent?.access_source ||
          ent?.access?.is_complimentary_active ||
          Boolean(ent?.effective_limits?.razorpayPayments);
        if (!entitled) {
          return res.status(403).json({ error: 'Razorpay payments are not available on this account' });
        }
      }

      const saved = await setOnlinePaymentProvider(req.user.id, provider);
      res.json({ online_payment_provider: saved });
    } catch (err) {
      console.error('PATCH /api/online-payment-provider:', err);
      res.status(err.status || 500).json({ error: err.message });
    }
  });
}
