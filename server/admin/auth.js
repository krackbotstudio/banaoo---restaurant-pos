import bcrypt from 'bcryptjs';
import pool from '../db.js';
import { logAdminAction } from './audit.js';

const CMS_ROLES = new Set(['super_admin', 'support', 'billing', 'marketing']);

function toPublicAdmin(row, source) {
  return {
    id: row.id,
    email: row.email,
    full_name: row.full_name || '',
    role: row.role || 'super_admin',
    source,
    user_id: source === 'legacy_profile' ? row.id : undefined,
  };
}

async function findAdminUserByEmail(emailLower) {
  try {
    const { rows } = await pool.query(
      `SELECT id, email, password_hash, full_name, role, is_active
       FROM public.admin_users
       WHERE lower(email) = $1 AND is_active = true
       LIMIT 1`,
      [emailLower]
    );
    return rows[0] ?? null;
  } catch (err) {
    if (err.code === '42P01') return null;
    throw err;
  }
}

async function findLegacyAdminByEmail(emailLower, password) {
  const { rows } = await pool.query(
    `SELECT u.id, u.email, u.password_hash, p.full_name, p.is_admin
     FROM public.users u
     JOIN public.profiles p ON p.user_id = u.id
     WHERE lower(u.email) = $1 AND p.is_admin = true
     LIMIT 1`,
    [emailLower]
  );
  const user = rows[0];
  if (!user?.password_hash) return null;
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return null;
  return user;
}

export async function authenticateCmsLogin(email, password) {
  const emailLower = String(email || '').trim().toLowerCase();
  if (!emailLower || !password) {
    return { error: 'Email and password are required' };
  }

  const adminUser = await findAdminUserByEmail(emailLower);
  if (adminUser) {
    const ok = await bcrypt.compare(password, adminUser.password_hash);
    if (!ok) return { error: 'Incorrect email or password' };
    await pool.query(
      'UPDATE public.admin_users SET last_login_at = now(), updated_at = now() WHERE id = $1',
      [adminUser.id]
    );
    return { admin: toPublicAdmin(adminUser, 'admin_users') };
  }

  const legacy = await findLegacyAdminByEmail(emailLower, password);
  if (legacy) {
    return {
      admin: toPublicAdmin(
        { ...legacy, role: 'super_admin' },
        'legacy_profile'
      ),
    };
  }

  return { error: 'Incorrect email or password' };
}

export function registerCmsAuthRoutes(app) {
  app.post('/api/cms/login', async (req, res) => {
    const { email, password } = req.body || {};
    try {
      const result = await authenticateCmsLogin(email, password);
      if (result.error) {
        return res.status(401).json({ error: result.error });
      }

      req.session.cmsAdmin = result.admin;
      req.session.save(async (saveErr) => {
        if (saveErr) {
          console.error('CMS session save error:', saveErr);
          return res.status(500).json({ error: 'Failed to save session' });
        }
        await logAdminAction({
          adminId: result.admin.source === 'admin_users' ? result.admin.id : null,
          adminEmail: result.admin.email,
          action: 'cms.login',
          metadata: { source: result.admin.source, role: result.admin.role },
          req,
        });
        res.json({ admin: result.admin });
      });
    } catch (err) {
      console.error('POST /api/cms/login:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/cms/me', (req, res) => {
    let admin = req.session?.cmsAdmin;
    if (!admin && req.isAuthenticated?.() && req.user?.is_admin) {
      admin = toPublicAdmin(
        {
          id: req.user.id,
          email: req.user.email,
          full_name: req.user.full_name || '',
          role: 'super_admin',
        },
        'legacy_profile'
      );
      req.session.cmsAdmin = admin;
    }
    if (!admin) return res.status(401).json({ error: 'Not authenticated' });
    res.json({ admin });
  });

  app.post('/api/cms/logout', (req, res) => {
    const admin = req.session?.cmsAdmin;
    if (admin) {
      void logAdminAction({
        adminId: admin.source === 'admin_users' ? admin.id : null,
        adminEmail: admin.email,
        action: 'cms.logout',
        req,
      });
    }
    delete req.session.cmsAdmin;
    req.session.save((err) => {
      if (err) return res.status(500).json({ error: 'Failed to logout' });
      res.json({ success: true });
    });
  });
}

export { CMS_ROLES };
