/** @typedef {{ id: string, email: string, role: string, source: 'admin_users'|'legacy_profile', full_name?: string, user_id?: string }} CmsAdmin */

/**
 * Returns the CMS admin attached to the session, if any.
 * @param {import('express').Request} req
 * @returns {CmsAdmin|null}
 */
export function getCmsAdmin(req) {
  return req.session?.cmsAdmin ?? null;
}

/**
 * CMS route guard — requires an active CMS session.
 */
export function requireCmsAuth(req, res, next) {
  const admin = getCmsAdmin(req);
  if (!admin) {
    return res.status(401).json({ error: 'CMS authentication required' });
  }
  req.cmsAdmin = admin;
  return next();
}

/**
 * Allows CMS session OR legacy owner profile with is_admin (Passport session).
 * Used by existing /api/admin/* routes during migration.
 */
export function requireAdminAccess(req, res, next) {
  const cmsAdmin = getCmsAdmin(req);
  if (cmsAdmin) {
    req.cmsAdmin = cmsAdmin;
    return next();
  }
  if (req.user?.is_admin) {
    req.cmsAdmin = {
      id: req.user.id,
      email: req.user.email,
      role: 'super_admin',
      source: 'legacy_profile',
      full_name: req.user.full_name || '',
      user_id: req.user.id,
    };
    return next();
  }
  return res.status(403).json({ error: 'Admin access required' });
}

/** Super-admin only (CMS or legacy). */
export function requireSuperAdmin(req, res, next) {
  const admin = req.cmsAdmin || getCmsAdmin(req);
  if (!admin) {
    if (req.user?.is_admin) {
      req.cmsAdmin = {
        id: req.user.id,
        email: req.user.email,
        role: 'super_admin',
        source: 'legacy_profile',
        user_id: req.user.id,
      };
      return next();
    }
    return res.status(403).json({ error: 'Super admin access required' });
  }
  if (admin.role !== 'super_admin') {
    return res.status(403).json({ error: 'Super admin access required' });
  }
  req.cmsAdmin = admin;
  return next();
}
