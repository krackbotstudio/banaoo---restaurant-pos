import pool from '../db.js';
import { requireCmsAuth } from './middleware.js';

export function registerCmsPaymentsRoutes(app) {
  app.get('/api/cms/payments', requireCmsAuth, async (req, res) => {
    const status = String(req.query.status || 'all').toLowerCase();
    const search = String(req.query.search || '').trim().toLowerCase();
    const values = [];

    let where = `WHERE s.razorpay_payment_id IS NOT NULL`;
    if (status !== 'all') {
      values.push(status);
      where += ` AND s.status = $${values.length}`;
    }
    if (search) {
      values.push(`%${search}%`);
      where += ` AND (lower(u.email) LIKE $${values.length} OR lower(coalesce(p.full_name, '')) LIKE $${values.length} OR lower(coalesce(s.razorpay_payment_id, '')) LIKE $${values.length})`;
    }

    try {
      const { rows } = await pool.query(
        `SELECT s.id, s.user_id, s.plan_type, s.status, s.period_months,
                s.razorpay_order_id, s.razorpay_payment_id,
                s.current_period_start, s.current_period_end, s.created_at,
                u.email,
                p.full_name
         FROM public.subscriptions s
         JOIN public.users u ON u.id = s.user_id
         LEFT JOIN public.profiles p ON p.user_id = s.user_id
         ${where}
         ORDER BY s.created_at DESC
         LIMIT 300`,
        values
      );
      res.json({ payments: rows });
    } catch (err) {
      console.error('GET /api/cms/payments:', err);
      res.status(500).json({ error: err.message });
    }
  });
}
