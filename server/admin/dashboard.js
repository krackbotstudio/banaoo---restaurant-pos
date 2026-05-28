import pool from '../db.js';
import { requireCmsAuth } from './middleware.js';

export function registerCmsDashboardRoutes(app) {
  app.get('/api/cms/dashboard', requireCmsAuth, async (req, res) => {
    try {
      const [
        ownersRes,
        pendingRes,
        subsRes,
        affiliatesPendingRes,
        leadsRes,
        recentOwnersRes,
      ] = await Promise.all([
        pool.query(
          `SELECT COUNT(*)::int AS count FROM public.profiles WHERE role = 'owner'`
        ),
        pool.query(
          `SELECT COUNT(*)::int AS count FROM public.profiles
           WHERE role = 'owner' AND account_status = 'pending'`
        ),
        pool.query(
          `SELECT COUNT(*)::int AS count FROM public.subscriptions
           WHERE status IN ('active', 'trialing')`
        ),
        pool.query(
          `SELECT COUNT(*)::int AS count FROM public.affiliates WHERE status = 'pending'`
        ),
        pool.query(
          `SELECT COUNT(*)::int AS count FROM public.mobile_app_leads`
        ).catch(() => ({ rows: [{ count: 0 }] })),
        pool.query(
          `SELECT p.full_name, p.account_status, p.created_at, u.email
           FROM public.profiles p
           JOIN public.users u ON u.id = p.user_id
           WHERE p.role = 'owner'
           ORDER BY p.created_at DESC
           LIMIT 8`
        ),
      ]);

      res.json({
        stats: {
          total_owners: ownersRes.rows[0]?.count ?? 0,
          pending_approvals: pendingRes.rows[0]?.count ?? 0,
          active_subscriptions: subsRes.rows[0]?.count ?? 0,
          pending_affiliates: affiliatesPendingRes.rows[0]?.count ?? 0,
          mobile_app_leads: leadsRes.rows[0]?.count ?? 0,
        },
        recent_signups: recentOwnersRes.rows,
      });
    } catch (err) {
      console.error('GET /api/cms/dashboard:', err);
      res.status(500).json({ error: err.message });
    }
  });
}
