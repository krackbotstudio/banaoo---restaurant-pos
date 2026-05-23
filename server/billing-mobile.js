import jwt from 'jsonwebtoken';
import pool from './db.js';

const TTL_SEC = 15 * 60;

function billingSecret() {
  const secret = process.env.BILLING_CHECKOUT_SECRET || process.env.SUPABASE_JWT_SECRET;
  if (!secret) throw new Error('BILLING_CHECKOUT_SECRET or SUPABASE_JWT_SECRET is required');
  return secret;
}

export function createBillingCheckoutToken(userId, payload) {
  return jwt.sign(
    {
      sub: userId,
      purpose: 'mobile_billing',
      ...payload,
    },
    billingSecret(),
    { expiresIn: TTL_SEC }
  );
}

export function verifyBillingCheckoutToken(token) {
  const decoded = jwt.verify(token, billingSecret());
  if (decoded.purpose !== 'mobile_billing') {
    throw new Error('Invalid billing token');
  }
  return decoded;
}

function publicWebBase(req) {
  const fromEnv = process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(',')[0].trim()
    : '';
  if (fromEnv) return fromEnv.replace(/\/+$/, '');
  const host = req.get('host');
  return `${req.protocol}://${host}`.replace(/\/+$/, '');
}

function publicApiBase(req) {
  const web = publicWebBase(req);
  return web;
}

export function registerBillingMobileRoutes(app, { requireAuth }) {
  /** Create a one-time link for mobile app users to pay in the system browser. */
  app.post('/api/billing/mobile-link', requireAuth, async (req, res) => {
    try {
      const { kind } = req.body || {};

      if (kind === 'settings') {
        const target = req.body.target === 'addons' ? 'addons' : 'subscription';
        const payload = { kind: 'settings', target };
        const token = createBillingCheckoutToken(req.user.id, payload);
        const apiBase = publicApiBase(req);
        const url = `${apiBase}/api/billing/redeem?token=${encodeURIComponent(token)}`;
        return res.json({ url });
      }

      if (kind !== 'subscription' && kind !== 'addon') {
        return res.status(400).json({ error: 'kind must be subscription, addon, or settings' });
      }

      let payload;
      if (kind === 'subscription') {
        const { plan_type, period_months } = req.body;
        if (!['starter', 'professional'].includes(plan_type)) {
          return res.status(400).json({ error: 'Invalid plan_type' });
        }
        const months = Number(period_months) || 1;
        if (![1, 3, 6, 12].includes(months)) {
          return res.status(400).json({ error: 'Invalid period_months' });
        }
        payload = { kind, plan_type, period_months: months };
      } else {
        const { addon_type, quantity, period_months } = req.body;
        const allowedAddons = [
          'extra_outlet',
          'extra_staff',
          'swiggy_integration',
          'zomato_integration',
          'customer_ordering',
          'inventory_management',
        ];
        if (!allowedAddons.includes(addon_type)) {
          return res.status(400).json({ error: 'Invalid addon_type' });
        }
        const months = Number(period_months) || 1;
        if (![1, 3, 6, 12].includes(months)) {
          return res.status(400).json({ error: 'Invalid period_months' });
        }
        payload = {
          kind,
          addon_type,
          quantity: Math.max(1, Number(quantity) || 1),
          period_months: months,
        };
      }

      const token = createBillingCheckoutToken(req.user.id, payload);
      const apiBase = publicApiBase(req);
      const url = `${apiBase}/api/billing/redeem?token=${encodeURIComponent(token)}`;
      res.json({ url });
    } catch (err) {
      console.error('POST /api/billing/mobile-link:', err);
      res.status(500).json({ error: err.message });
    }
  });

  /** Exchange billing token for session cookie, then open checkout in browser. */
  app.get('/api/billing/redeem', async (req, res) => {
    const token = String(req.query.token || '');
    if (!token) {
      return res.redirect(`${publicWebBase(req)}/auth`);
    }
    try {
      const decoded = verifyBillingCheckoutToken(token);
      const { rows } = await pool.query('SELECT * FROM public.users WHERE id = $1', [decoded.sub]);
      if (rows.length === 0) {
        return res.redirect(`${publicWebBase(req)}/auth?error=billing`);
      }
      const user = rows[0];
      req.login(user, (loginErr) => {
        if (loginErr) {
          console.error('billing redeem login:', loginErr);
          return res.redirect(`${publicWebBase(req)}/auth?error=billing`);
        }
        req.session.save((saveErr) => {
          if (saveErr) {
            console.error('billing redeem session:', saveErr);
            return res.redirect(`${publicWebBase(req)}/auth?error=billing`);
          }
          const web = publicWebBase(req);
          let dest;
          if (decoded.kind === 'settings') {
            dest =
              decoded.target === 'addons'
                ? `${web}/addons?from=mobile`
                : `${web}/settings?tab=subscription&from=mobile`;
          } else {
            dest = `${web}/billing/checkout?token=${encodeURIComponent(token)}&from=mobile`;
          }
          res.redirect(dest);
        });
      });
    } catch (err) {
      console.error('GET /api/billing/redeem:', err);
      res.redirect(`${publicWebBase(req)}/auth?error=billing_expired`);
    }
  });

  /** Return checkout intent for authenticated user (token must match session). */
  app.get('/api/billing/checkout-intent', requireAuth, async (req, res) => {
    const token = String(req.query.token || '');
    if (!token) return res.status(400).json({ error: 'token required' });
    try {
      const decoded = verifyBillingCheckoutToken(token);
      if (decoded.sub !== req.user.id) {
        return res.status(403).json({ error: 'Token does not match signed-in user' });
      }
      res.json({
        kind: decoded.kind,
        plan_type: decoded.plan_type,
        period_months: decoded.period_months,
        addon_type: decoded.addon_type,
        quantity: decoded.quantity,
        from_mobile: true,
      });
    } catch (err) {
      res.status(400).json({ error: 'Invalid or expired billing link' });
    }
  });
}
