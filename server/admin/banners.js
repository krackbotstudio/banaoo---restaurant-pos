import pool from '../db.js';
import { requireCmsAuth } from './middleware.js';
import { logAdminAction } from './audit.js';

const KINDS = new Set(['news', 'offer', 'commercial']);
const THEMES = new Set(['warm', 'cool', 'offer', 'violet']);
const CTA_ACTIONS = new Set(['open_tour', 'link']);

function withMigrationHint(err) {
  // When the table doesn't exist (migration not applied), show a direct hint.
  const message = err?.message ? String(err.message) : 'Unknown database error';
  if (err?.code === '42P01' && /dashboard_banners/i.test(message)) {
    return `${message} — run the migration for dashboard banners (supabase/migrations/20260530000001_dashboard_banners.sql)`;
  }
  return message;
}

function canManageBanners(admin) {
  return admin?.role === 'super_admin' || admin?.role === 'marketing';
}

function normalizeBanner(row) {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    description: row.description,
    cta_label: row.cta_label,
    href: row.href,
    cta_action: row.cta_action,
    theme: row.theme,
    sort_order: row.sort_order,
    is_active: row.is_active,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function validateBannerBody(body, { partial } = { partial: false }) {
  const errors = [];
  if (!partial || body.kind !== undefined) {
    if (!KINDS.has(body.kind)) errors.push('Invalid kind');
  }
  if (!partial || body.theme !== undefined) {
    if (!THEMES.has(body.theme)) errors.push('Invalid theme');
  }
  if (!partial || body.title !== undefined) {
    if (!String(body.title || '').trim()) errors.push('Title is required');
  }
  if (!partial || body.description !== undefined) {
    if (!String(body.description || '').trim()) errors.push('Description is required');
  }
  if (body.cta_action !== undefined && body.cta_action !== null && !CTA_ACTIONS.has(body.cta_action)) {
    errors.push('Invalid cta_action');
  }
  return errors;
}

export function registerCmsBannerRoutes(app) {
  app.get('/api/cms/banners', requireCmsAuth, async (req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT * FROM public.dashboard_banners ORDER BY sort_order ASC, created_at ASC`
      );
      res.json({ banners: rows.map(normalizeBanner) });
    } catch (err) {
      console.error('GET /api/cms/banners:', err);
      res.status(500).json({ error: withMigrationHint(err) });
    }
  });

  app.post('/api/cms/banners', requireCmsAuth, async (req, res) => {
    if (!canManageBanners(req.cmsAdmin)) {
      return res.status(403).json({ error: 'Marketing or super admin required' });
    }
    const body = req.body || {};
    const errors = validateBannerBody(body);
    if (errors.length) return res.status(400).json({ error: errors.join(', ') });

    const ctaAction = body.cta_action || (body.href ? 'link' : null);
    try {
      const { rows } = await pool.query(
        `INSERT INTO public.dashboard_banners (
          kind, title, description, cta_label, href, cta_action, theme, sort_order, is_active, starts_at, ends_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        RETURNING *`,
        [
          body.kind,
          String(body.title).trim(),
          String(body.description).trim(),
          body.cta_label?.trim() || null,
          body.href?.trim() || null,
          ctaAction,
          body.theme || 'warm',
          Number.isFinite(Number(body.sort_order)) ? Number(body.sort_order) : 0,
          body.is_active !== false,
          body.starts_at || null,
          body.ends_at || null,
        ]
      );
      await logAdminAction({
        adminId: req.cmsAdmin?.source === 'admin_users' ? req.cmsAdmin.id : null,
        adminEmail: req.cmsAdmin?.email ?? null,
        action: 'cms.banners.create',
        targetType: 'dashboard_banner',
        targetId: rows[0].id,
        metadata: { title: rows[0].title },
        req,
      });
      res.status(201).json({ banner: normalizeBanner(rows[0]) });
    } catch (err) {
      console.error('POST /api/cms/banners:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.patch('/api/cms/banners/:id', requireCmsAuth, async (req, res) => {
    if (!canManageBanners(req.cmsAdmin)) {
      return res.status(403).json({ error: 'Marketing or super admin required' });
    }
    const body = req.body || {};
    const errors = validateBannerBody(body, { partial: true });
    if (errors.length) return res.status(400).json({ error: errors.join(', ') });

    const fields = [];
    const values = [];
    let idx = 1;
    const setField = (col, val) => {
      fields.push(`${col} = $${idx++}`);
      values.push(val);
    };

    if (body.kind !== undefined) setField('kind', body.kind);
    if (body.title !== undefined) setField('title', String(body.title).trim());
    if (body.description !== undefined) setField('description', String(body.description).trim());
    if (body.cta_label !== undefined) setField('cta_label', body.cta_label?.trim() || null);
    if (body.href !== undefined) setField('href', body.href?.trim() || null);
    if (body.cta_action !== undefined) setField('cta_action', body.cta_action);
    if (body.theme !== undefined) setField('theme', body.theme);
    if (body.sort_order !== undefined) setField('sort_order', Number(body.sort_order) || 0);
    if (body.is_active !== undefined) setField('is_active', !!body.is_active);
    if (body.starts_at !== undefined) setField('starts_at', body.starts_at || null);
    if (body.ends_at !== undefined) setField('ends_at', body.ends_at || null);

    if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });

    setField('updated_at', new Date().toISOString());
    values.push(req.params.id);

    try {
      const { rows } = await pool.query(
        `UPDATE public.dashboard_banners SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
        values
      );
      if (!rows[0]) return res.status(404).json({ error: 'Banner not found' });
      await logAdminAction({
        adminId: req.cmsAdmin?.source === 'admin_users' ? req.cmsAdmin.id : null,
        adminEmail: req.cmsAdmin?.email ?? null,
        action: 'cms.banners.update',
        targetType: 'dashboard_banner',
        targetId: rows[0].id,
        metadata: body,
        req,
      });
      res.json({ banner: normalizeBanner(rows[0]) });
    } catch (err) {
      console.error('PATCH /api/cms/banners/:id:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/cms/banners/:id', requireCmsAuth, async (req, res) => {
    if (!canManageBanners(req.cmsAdmin)) {
      return res.status(403).json({ error: 'Marketing or super admin required' });
    }
    try {
      const { rows } = await pool.query(
        'DELETE FROM public.dashboard_banners WHERE id = $1 RETURNING id, title',
        [req.params.id]
      );
      if (!rows[0]) return res.status(404).json({ error: 'Banner not found' });
      await logAdminAction({
        adminId: req.cmsAdmin?.source === 'admin_users' ? req.cmsAdmin.id : null,
        adminEmail: req.cmsAdmin?.email ?? null,
        action: 'cms.banners.delete',
        targetType: 'dashboard_banner',
        targetId: rows[0].id,
        metadata: { title: rows[0].title },
        req,
      });
      res.json({ ok: true });
    } catch (err) {
      console.error('DELETE /api/cms/banners/:id:', err);
      res.status(500).json({ error: err.message });
    }
  });
}

/** Active banners for restaurant dashboard (authenticated owners/staff). */
export function registerDashboardBannerPublicRoutes(app, { requireAuth }) {
  app.get('/api/dashboard/banners', requireAuth, async (req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT id, kind, title, description, cta_label, href, cta_action, theme, sort_order
         FROM public.dashboard_banners
         WHERE is_active = true
           AND (starts_at IS NULL OR starts_at <= CURRENT_DATE)
           AND (ends_at IS NULL OR ends_at >= CURRENT_DATE)
         ORDER BY sort_order ASC, created_at ASC`
      );
      res.json({
        banners: rows.map((row) => ({
          id: row.id,
          kind: row.kind,
          title: row.title,
          description: row.description,
          ctaLabel: row.cta_label,
          href: row.href,
          ctaAction: row.cta_action,
          theme: row.theme,
        })),
      });
    } catch (err) {
      console.error('GET /api/dashboard/banners:', err);
      res.status(500).json({ error: withMigrationHint(err) });
    }
  });
}
