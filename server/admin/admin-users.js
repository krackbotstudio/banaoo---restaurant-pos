import bcrypt from 'bcryptjs';
import pool from '../db.js';
import { requireCmsAuth, requireSuperAdmin } from './middleware.js';
import { logAdminAction } from './audit.js';
import { CMS_ROLES } from './auth.js';

function sanitizeRole(role) {
  const normalized = String(role || '').trim();
  return CMS_ROLES.has(normalized) ? normalized : null;
}

export function registerCmsAdminUsersRoutes(app) {
  app.get('/api/cms/admin-users', requireCmsAuth, requireSuperAdmin, async (req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT id, email, full_name, role, is_active, last_login_at, created_at, updated_at
         FROM public.admin_users
         ORDER BY created_at DESC`
      );
      res.json({ admin_users: rows });
    } catch (err) {
      console.error('GET /api/cms/admin-users:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/cms/admin-users', requireCmsAuth, requireSuperAdmin, async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const fullName = String(req.body?.full_name || '').trim();
    const role = sanitizeRole(req.body?.role);

    if (!email || !password || !role) {
      return res.status(400).json({ error: 'email, password and valid role are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    try {
      const hash = await bcrypt.hash(password, 10);
      const { rows } = await pool.query(
        `INSERT INTO public.admin_users (email, password_hash, full_name, role, is_active)
         VALUES ($1, $2, $3, $4, true)
         RETURNING id, email, full_name, role, is_active, last_login_at, created_at, updated_at`,
        [email, hash, fullName, role]
      );

      await logAdminAction({
        adminId: req.cmsAdmin?.source === 'admin_users' ? req.cmsAdmin.id : null,
        adminEmail: req.cmsAdmin?.email ?? null,
        action: 'cms.admin_users.create',
        targetType: 'admin_user',
        targetId: rows[0].id,
        metadata: { email, role },
        req,
      });

      res.status(201).json({ admin_user: rows[0] });
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({ error: 'Admin user with this email already exists' });
      }
      console.error('POST /api/cms/admin-users:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.patch('/api/cms/admin-users/:id', requireCmsAuth, requireSuperAdmin, async (req, res) => {
    const { id } = req.params;
    const fullName = req.body?.full_name;
    const isActive = req.body?.is_active;
    const role = req.body?.role !== undefined ? sanitizeRole(req.body?.role) : undefined;

    if (req.cmsAdmin?.id === id && isActive === false) {
      return res.status(400).json({ error: 'You cannot deactivate your own account' });
    }
    if (req.body?.role !== undefined && !role) {
      return res.status(400).json({ error: 'Invalid role value' });
    }

    try {
      const { rows } = await pool.query(
        `UPDATE public.admin_users
         SET full_name = COALESCE($2, full_name),
             role = COALESCE($3, role),
             is_active = COALESCE($4, is_active),
             updated_at = now()
         WHERE id = $1
         RETURNING id, email, full_name, role, is_active, last_login_at, created_at, updated_at`,
        [
          id,
          fullName !== undefined ? String(fullName).trim() : null,
          role ?? null,
          typeof isActive === 'boolean' ? isActive : null,
        ]
      );

      if (!rows[0]) return res.status(404).json({ error: 'Admin user not found' });

      await logAdminAction({
        adminId: req.cmsAdmin?.source === 'admin_users' ? req.cmsAdmin.id : null,
        adminEmail: req.cmsAdmin?.email ?? null,
        action: 'cms.admin_users.update',
        targetType: 'admin_user',
        targetId: id,
        metadata: { full_name: fullName, role: role ?? null, is_active: isActive },
        req,
      });

      res.json({ admin_user: rows[0] });
    } catch (err) {
      console.error('PATCH /api/cms/admin-users/:id:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/cms/admin-users/:id/reset-password', requireCmsAuth, requireSuperAdmin, async (req, res) => {
    const { id } = req.params;
    const newPassword = String(req.body?.password || '');
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    try {
      const hash = await bcrypt.hash(newPassword, 10);
      const { rowCount } = await pool.query(
        `UPDATE public.admin_users
         SET password_hash = $2, updated_at = now()
         WHERE id = $1`,
        [id, hash]
      );
      if (!rowCount) return res.status(404).json({ error: 'Admin user not found' });

      await logAdminAction({
        adminId: req.cmsAdmin?.source === 'admin_users' ? req.cmsAdmin.id : null,
        adminEmail: req.cmsAdmin?.email ?? null,
        action: 'cms.admin_users.reset_password',
        targetType: 'admin_user',
        targetId: id,
        req,
      });

      res.json({ success: true });
    } catch (err) {
      console.error('POST /api/cms/admin-users/:id/reset-password:', err);
      res.status(500).json({ error: err.message });
    }
  });
}
