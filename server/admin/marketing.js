import pool from '../db.js';
import { requireCmsAuth } from './middleware.js';
import { logAdminAction } from './audit.js';

function escapeCsv(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

export function registerCmsMarketingRoutes(app) {
  app.get('/api/cms/marketing/overview', requireCmsAuth, async (req, res) => {
    try {
      const [leadsTotal, leadsWeek, affiliatesRes, sourcesRes] = await Promise.all([
        pool
          .query(`SELECT COUNT(*)::int AS count FROM public.mobile_app_leads`)
          .catch(() => ({ rows: [{ count: 0 }] })),
        pool
          .query(
            `SELECT COUNT(*)::int AS count FROM public.mobile_app_leads
             WHERE created_at >= now() - interval '7 days'`
          )
          .catch(() => ({ rows: [{ count: 0 }] })),
        pool.query(
          `SELECT status, COUNT(*)::int AS count
           FROM public.affiliates
           GROUP BY status`
        ),
        pool
          .query(
            `SELECT source, COUNT(*)::int AS count
             FROM public.mobile_app_leads
             GROUP BY source
             ORDER BY count DESC
             LIMIT 10`
          )
          .catch(() => ({ rows: [] })),
      ]);

      const affiliateCounts = { pending: 0, approved: 0, suspended: 0 };
      for (const row of affiliatesRes.rows) {
        if (row.status in affiliateCounts) {
          affiliateCounts[row.status] = row.count;
        }
      }

      res.json({
        stats: {
          total_leads: leadsTotal.rows[0]?.count ?? 0,
          leads_last_7_days: leadsWeek.rows[0]?.count ?? 0,
          affiliates_pending: affiliateCounts.pending,
          affiliates_approved: affiliateCounts.approved,
          affiliates_suspended: affiliateCounts.suspended,
        },
        lead_sources: sourcesRes.rows,
      });
    } catch (err) {
      console.error('GET /api/cms/marketing/overview:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/cms/marketing/leads', requireCmsAuth, async (req, res) => {
    const search = String(req.query.search || '').trim().toLowerCase();
    const source = String(req.query.source || 'all').trim();
    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 1000) : 250;
    const values = [limit];

    let where = '';
    if (source && source !== 'all') {
      values.push(source);
      where += ` WHERE source = $${values.length}`;
    }
    if (search) {
      values.push(`%${search}%`);
      where += where
        ? ` AND (lower(email) LIKE $${values.length} OR lower(phone) LIKE $${values.length})`
        : ` WHERE (lower(email) LIKE $${values.length} OR lower(phone) LIKE $${values.length})`;
    }

    try {
      const { rows } = await pool.query(
        `SELECT id, email, phone, source, user_agent, ip_address, created_at
         FROM public.mobile_app_leads
         ${where}
         ORDER BY created_at DESC
         LIMIT $1`,
        values
      );
      res.json({ leads: rows });
    } catch (err) {
      if (err.code === '42P01') {
        return res.json({ leads: [] });
      }
      console.error('GET /api/cms/marketing/leads:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/cms/marketing/leads/export', requireCmsAuth, async (req, res) => {
    const search = String(req.query.search || '').trim().toLowerCase();
    const source = String(req.query.source || 'all').trim();
    const values = [];

    let where = '';
    if (source && source !== 'all') {
      values.push(source);
      where += ` WHERE source = $${values.length}`;
    }
    if (search) {
      values.push(`%${search}%`);
      where += where
        ? ` AND (lower(email) LIKE $${values.length} OR lower(phone) LIKE $${values.length})`
        : ` WHERE (lower(email) LIKE $${values.length} OR lower(phone) LIKE $${values.length})`;
    }

    try {
      const { rows } = await pool.query(
        `SELECT created_at, email, phone, source, ip_address, user_agent
         FROM public.mobile_app_leads
         ${where}
         ORDER BY created_at DESC
         LIMIT 5000`,
        values
      );

      const header = 'created_at,email,phone,source,ip_address,user_agent';
      const body = rows
        .map((r) =>
          [r.created_at, r.email, r.phone, r.source, r.ip_address, r.user_agent]
            .map(escapeCsv)
            .join(',')
        )
        .join('\n');
      const csv = `${header}\n${body}`;

      await logAdminAction({
        adminId: req.cmsAdmin?.source === 'admin_users' ? req.cmsAdmin.id : null,
        adminEmail: req.cmsAdmin?.email ?? null,
        action: 'cms.marketing.leads_export',
        metadata: { rows: rows.length, source, search: search || null },
        req,
      });

      const filename = `mobile-app-leads-${new Date().toISOString().slice(0, 10)}.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(csv);
    } catch (err) {
      if (err.code === '42P01') {
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        return res.send('created_at,email,phone,source,ip_address,user_agent\n');
      }
      console.error('GET /api/cms/marketing/leads/export:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/cms/marketing/affiliates', requireCmsAuth, async (req, res) => {
    const status = String(req.query.status || 'pending').toLowerCase();
    const values = [];
    let where = '';
    if (status !== 'all') {
      values.push(status);
      where = `WHERE a.status = $1`;
    }

    try {
      const { rows } = await pool.query(
        `SELECT a.id, a.referral_code, a.status, a.created_at, a.approved_at,
                u.email, p.full_name
         FROM public.affiliates a
         JOIN public.users u ON u.id = a.user_id
         LEFT JOIN public.profiles p ON p.user_id = a.user_id
         ${where}
         ORDER BY a.created_at DESC
         LIMIT 100`,
        values
      );
      res.json({ affiliates: rows });
    } catch (err) {
      console.error('GET /api/cms/marketing/affiliates:', err);
      res.status(500).json({ error: err.message });
    }
  });
}
