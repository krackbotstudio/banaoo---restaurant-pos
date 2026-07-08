import crypto from 'crypto';
import pool from './db.js';
import { calcAddonAmount } from './entitlements.js';

const PLAN_LABELS = {
  starter: 'Launcher',
  professional: 'Growth',
  enterprise: 'Expand',
};

const ADDON_LABELS = {
  extra_outlet: 'Extra outlet',
  extra_staff: 'Extra staff seat',
  swiggy_integration: 'Swiggy integration',
  zomato_integration: 'Zomato integration',
  customer_ordering: 'Customer ordering',
  inventory_management: 'Inventory management',
  whatsapp_integration: 'WhatsApp integration',
  shiprocket_delivery: 'Shiprocket delivery',
  razorpay_payments: 'Razorpay payments',
};

const BASE_PRICES = { starter: 499, professional: 699 };
const DISCOUNTS = { 3: 0.05, 6: 0.1, 12: 0.2 };

function calcPlanAmount(planType, months) {
  const base = BASE_PRICES[planType];
  if (!base || !months) return 0;
  const discount = DISCOUNTS[months] ?? 0;
  return Math.round(base * months * (1 - discount));
}

function normalizePaymentMethods(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function invoiceId(prefix, row) {
  const tail = (row.razorpay_payment_id || row.id || '').toString().slice(-8);
  return `INV-${prefix}-${tail}`.toUpperCase();
}

export function registerBillingRoutes(app, { requireAuth }) {
  app.get('/api/billing/overview', requireAuth, async (req, res) => {
    try {
      const userId = req.user.id;

      const { rows: profileRows } = await pool.query(
        `SELECT p.billing_auto_pay, p.billing_email, p.billing_payment_methods, u.email
         FROM public.profiles p
         JOIN public.users u ON u.id = p.user_id
         WHERE p.user_id = $1`,
        [userId]
      );
      const profile = profileRows[0] || {};

      const { rows: subRows } = await pool.query(
        `SELECT id, plan_type, status, period_months, razorpay_order_id, razorpay_payment_id,
                created_at, expires_at, current_period_start
         FROM public.subscriptions
         WHERE user_id = $1 AND razorpay_payment_id IS NOT NULL
         ORDER BY created_at DESC
         LIMIT 50`,
        [userId]
      );

      const { rows: addonRows } = await pool.query(
        `SELECT id, addon_type, quantity, status, period_months, razorpay_order_id, razorpay_payment_id,
                created_at, expires_at
         FROM public.subscription_addons
         WHERE user_id = $1 AND razorpay_payment_id IS NOT NULL
         ORDER BY created_at DESC
         LIMIT 50`,
        [userId]
      );

      const { rows: activeAddonRows } = await pool.query(
        `SELECT id, addon_type, quantity, status, period_months, expires_at, created_at
         FROM public.subscription_addons
         WHERE user_id = $1
         ORDER BY created_at DESC`,
        [userId]
      );

      const invoices = [
        ...subRows.map((row) => ({
          id: row.id,
          invoice_number: invoiceId('SUB', row),
          kind: 'subscription',
          description: `${PLAN_LABELS[row.plan_type] || row.plan_type} plan · ${row.period_months || '—'} mo`,
          amount_rupees: calcPlanAmount(row.plan_type, row.period_months),
          status: row.status,
          period_months: row.period_months,
          razorpay_order_id: row.razorpay_order_id,
          razorpay_payment_id: row.razorpay_payment_id,
          paid_at: row.created_at,
          expires_at: row.expires_at,
        })),
        ...addonRows.map((row) => ({
          id: row.id,
          invoice_number: invoiceId('ADD', row),
          kind: 'addon',
          description: `${ADDON_LABELS[row.addon_type] || row.addon_type}${row.quantity > 1 ? ` ×${row.quantity}` : ''} · ${row.period_months || '—'} mo`,
          amount_rupees: calcAddonAmount(row.addon_type, row.quantity, row.period_months),
          status: row.status,
          period_months: row.period_months,
          razorpay_order_id: row.razorpay_order_id,
          razorpay_payment_id: row.razorpay_payment_id,
          paid_at: row.created_at,
          expires_at: row.expires_at,
        })),
      ].sort((a, b) => new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime());

      const active_addons = activeAddonRows.map((row) => ({
        id: row.id,
        addon_type: row.addon_type,
        label: ADDON_LABELS[row.addon_type] || row.addon_type,
        quantity: row.quantity,
        status: row.status,
        period_months: row.period_months,
        expires_at: row.expires_at,
        created_at: row.created_at,
        is_active: row.status === 'active' && (!row.expires_at || new Date(row.expires_at) > new Date()),
      }));

      res.json({
        settings: {
          billing_auto_pay: !!profile.billing_auto_pay,
          billing_email: profile.billing_email || profile.email || req.user.email || null,
          payment_methods: normalizePaymentMethods(profile.billing_payment_methods),
        },
        invoices,
        active_addons,
      });
    } catch (err) {
      console.error('GET /api/billing/overview:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.patch('/api/billing/settings', requireAuth, async (req, res) => {
    if (req.user.isStaff) {
      return res.status(403).json({ error: 'Only account owners can manage billing settings' });
    }
    const { billing_auto_pay, billing_email } = req.body || {};
    try {
      const fields = [];
      const values = [];
      let idx = 1;
      if (billing_auto_pay !== undefined) {
        fields.push(`billing_auto_pay = $${idx++}`);
        values.push(!!billing_auto_pay);
      }
      if (billing_email !== undefined) {
        fields.push(`billing_email = $${idx++}`);
        values.push(billing_email?.trim() || null);
      }
      if (fields.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }
      values.push(req.user.id);
      const { rows } = await pool.query(
        `UPDATE public.profiles SET ${fields.join(', ')} WHERE user_id = $${idx} RETURNING billing_auto_pay, billing_email, billing_payment_methods`,
        values
      );
      res.json({
        settings: {
          billing_auto_pay: !!rows[0]?.billing_auto_pay,
          billing_email: rows[0]?.billing_email,
          payment_methods: normalizePaymentMethods(rows[0]?.billing_payment_methods),
        },
      });
    } catch (err) {
      console.error('PATCH /api/billing/settings:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/billing/payment-methods', requireAuth, async (req, res) => {
    if (req.user.isStaff) {
      return res.status(403).json({ error: 'Only account owners can manage payment methods' });
    }
    const { type, brand, last4, exp_month, exp_year, vpa, is_default } = req.body || {};
    const methodType = type === 'upi' ? 'upi' : 'card';
    if (methodType === 'card' && (!last4 || String(last4).length !== 4)) {
      return res.status(400).json({ error: 'Card requires last 4 digits' });
    }
    if (methodType === 'upi' && !vpa?.trim()) {
      return res.status(400).json({ error: 'UPI ID is required' });
    }
    try {
      const { rows } = await pool.query(
        'SELECT billing_payment_methods FROM public.profiles WHERE user_id = $1',
        [req.user.id]
      );
      const methods = normalizePaymentMethods(rows[0]?.billing_payment_methods);
      const entry = {
        id: crypto.randomUUID(),
        type: methodType,
        brand: brand?.trim() || (methodType === 'upi' ? 'UPI' : 'Card'),
        last4: methodType === 'card' ? String(last4).slice(-4) : null,
        vpa: methodType === 'upi' ? vpa.trim() : null,
        exp_month: exp_month ? Number(exp_month) : null,
        exp_year: exp_year ? Number(exp_year) : null,
        is_default: !!is_default || methods.length === 0,
        created_at: new Date().toISOString(),
      };
      let next = [...methods, entry];
      if (entry.is_default) {
        next = next.map((m) => ({ ...m, is_default: m.id === entry.id }));
      }
      await pool.query(
        'UPDATE public.profiles SET billing_payment_methods = $1::jsonb WHERE user_id = $2',
        [JSON.stringify(next), req.user.id]
      );
      res.json({ payment_methods: next });
    } catch (err) {
      console.error('POST /api/billing/payment-methods:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/billing/payment-methods/:id', requireAuth, async (req, res) => {
    if (req.user.isStaff) {
      return res.status(403).json({ error: 'Only account owners can manage payment methods' });
    }
    try {
      const { rows } = await pool.query(
        'SELECT billing_payment_methods FROM public.profiles WHERE user_id = $1',
        [req.user.id]
      );
      let methods = normalizePaymentMethods(rows[0]?.billing_payment_methods);
      const removed = methods.find((m) => m.id === req.params.id);
      methods = methods.filter((m) => m.id !== req.params.id);
      if (removed?.is_default && methods.length > 0) {
        methods[0] = { ...methods[0], is_default: true };
      }
      await pool.query(
        'UPDATE public.profiles SET billing_payment_methods = $1::jsonb WHERE user_id = $2',
        [JSON.stringify(methods), req.user.id]
      );
      res.json({ payment_methods: methods });
    } catch (err) {
      console.error('DELETE /api/billing/payment-methods:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/billing/payment-methods/:id/default', requireAuth, async (req, res) => {
    if (req.user.isStaff) {
      return res.status(403).json({ error: 'Only account owners can manage payment methods' });
    }
    try {
      const { rows } = await pool.query(
        'SELECT billing_payment_methods FROM public.profiles WHERE user_id = $1',
        [req.user.id]
      );
      const methods = normalizePaymentMethods(rows[0]?.billing_payment_methods);
      if (!methods.some((m) => m.id === req.params.id)) {
        return res.status(404).json({ error: 'Payment method not found' });
      }
      const next = methods.map((m) => ({ ...m, is_default: m.id === req.params.id }));
      await pool.query(
        'UPDATE public.profiles SET billing_payment_methods = $1::jsonb WHERE user_id = $2',
        [JSON.stringify(next), req.user.id]
      );
      res.json({ payment_methods: next });
    } catch (err) {
      console.error('POST /api/billing/payment-methods/default:', err);
      res.status(500).json({ error: err.message });
    }
  });
}
