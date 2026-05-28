import pool from './db.js';
import { buildEntitlementsPayload } from './entitlements.js';

const STAFF_EMAIL_DOMAIN = 'banaoo-staff.app';
const ALLOWED_ROLES = new Set(['manager', 'chef', 'waiter', 'cashier', 'staff']);

function generateUsername(fullName) {
  const first =
    fullName.trim().split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9]/g, '') || 'user';
  return `${first}.${Math.random().toString(36).slice(2, 6)}`;
}

function friendlyDbError(err) {
  if (err.code === '23505') {
    return 'A staff login with that username already exists. Please try again.';
  }
  if (err.code === '23503') {
    return 'Your account could not be linked. Sign out, sign in again, then add staff.';
  }
  return err.message || 'Database error';
}

async function listStaffForOwner(ownerId) {
  const { rows } = await pool.query(
    `SELECT sm.*,
            COALESCE(
              json_agg(sol.outlet_id) FILTER (WHERE sol.outlet_id IS NOT NULL),
              '[]'
            ) AS outlet_ids
     FROM public.staff_members sm
     LEFT JOIN public.staff_outlet_links sol ON sol.staff_member_id = sm.id
     WHERE sm.owner_id = $1
     GROUP BY sm.id
     ORDER BY sm.created_at ASC`,
    [ownerId]
  );
  return rows.map((row) => ({
    ...row,
    outlet_ids: Array.isArray(row.outlet_ids)
      ? row.outlet_ids
      : typeof row.outlet_ids === 'string'
        ? JSON.parse(row.outlet_ids)
        : [],
  }));
}

async function syncOutletLinks(staffMemberId, outletIds) {
  await pool.query('DELETE FROM public.staff_outlet_links WHERE staff_member_id = $1', [
    staffMemberId,
  ]);
  if (!outletIds?.length) return;
  const values = [];
  const params = [];
  outletIds.forEach((outletId, i) => {
    values.push(`($1, $${i + 2})`);
    params.push(outletId);
  });
  await pool.query(
    `INSERT INTO public.staff_outlet_links (staff_member_id, outlet_id) VALUES ${values.join(', ')}`,
    [staffMemberId, ...params]
  );
}

export function registerStaffRoutes(app, { requireAuth }) {
  const requireOwner = (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (req.user.isStaff) return res.status(403).json({ error: 'Only owners can manage staff' });
    next();
  };

  app.get('/api/staff-members', requireAuth, requireOwner, async (req, res) => {
    try {
      const staff = await listStaffForOwner(req.user.id);
      res.json({ staff });
    } catch (err) {
      console.error('GET /api/staff-members:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/staff-members', requireAuth, requireOwner, async (req, res) => {
    const ownerId = req.user.id;
    const {
      full_name,
      phone,
      email,
      role,
      notes,
      pin_code,
      page_permissions,
      outlet_ids,
    } = req.body || {};

    if (!full_name?.trim()) {
      return res.status(400).json({ error: 'Full name is required' });
    }
    if (!ALLOWED_ROLES.has(String(role || 'staff'))) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    const pin = String(pin_code || '').trim();
    if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      return res.status(400).json({ error: 'PIN must be exactly 4 digits' });
    }

    try {
      const ownerRow = await pool.query('SELECT id FROM public.users WHERE id = $1 LIMIT 1', [
        ownerId,
      ]);
      if (!ownerRow.rows[0]) {
        return res.status(400).json({
          error: 'Owner account not found. Sign out and sign in again, then retry.',
        });
      }

      const { rows: countRows } = await pool.query(
        'SELECT COUNT(*)::int AS count FROM public.staff_members WHERE owner_id = $1',
        [ownerId]
      );
      const payload = await buildEntitlementsPayload(ownerId);
      const maxStaff = payload.effective_limits.staffAccounts;
      if (maxStaff != null && countRows.rows[0].count >= maxStaff) {
        return res.status(403).json({
          error: 'Staff limit reached. Purchase an extra staff add-on or upgrade your plan.',
          code: 'STAFF_LIMIT',
        });
      }

      let inserted = null;
      let username = null;
      let systemEmail = null;

      for (let attempt = 0; attempt < 6; attempt++) {
        username = generateUsername(full_name);
        systemEmail = `${username}@${STAFF_EMAIL_DOMAIN}`;
        try {
          const { rows } = await pool.query(
            `INSERT INTO public.staff_members (
               owner_id, full_name, phone, email, role, notes, pin_code,
               username, system_email, page_permissions, is_active
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true)
             RETURNING *`,
            [
              ownerId,
              full_name.trim(),
              phone?.trim() || null,
              email?.trim() || null,
              role || 'staff',
              notes?.trim() || null,
              pin,
              username,
              systemEmail,
              Array.isArray(page_permissions) ? page_permissions : null,
            ]
          );
          inserted = rows[0];
          break;
        } catch (err) {
          if (err.code === '23505' && attempt < 5) continue;
          throw err;
        }
      }

      if (!inserted) {
        return res.status(500).json({ error: 'Could not create staff member' });
      }

      const outletList = Array.isArray(outlet_ids) ? outlet_ids : [];
      await syncOutletLinks(inserted.id, outletList);

      const staff = await listStaffForOwner(ownerId);
      res.status(201).json({
        staff_member: inserted,
        credentials: { username, pin },
        staff,
      });
    } catch (err) {
      console.error('POST /api/staff-members:', err);
      if (err.code === 'OUTLET_LIMIT') {
        return res.status(403).json({ error: err.message, code: err.code });
      }
      res.status(500).json({ error: friendlyDbError(err) });
    }
  });

  app.patch('/api/staff-members/:id', requireAuth, requireOwner, async (req, res) => {
    const ownerId = req.user.id;
    const { id } = req.params;
    const body = req.body || {};

    try {
      const { rows: existing } = await pool.query(
        'SELECT * FROM public.staff_members WHERE id = $1 AND owner_id = $2',
        [id, ownerId]
      );
      if (!existing[0]) return res.status(404).json({ error: 'Staff member not found' });

      const pin = body.pin_code !== undefined ? String(body.pin_code).trim() : undefined;
      if (pin !== undefined && pin !== '' && (pin.length !== 4 || !/^\d{4}$/.test(pin))) {
        return res.status(400).json({ error: 'PIN must be exactly 4 digits' });
      }

      if (body.role !== undefined && !ALLOWED_ROLES.has(String(body.role))) {
        return res.status(400).json({ error: 'Invalid role' });
      }

      const { rows } = await pool.query(
        `UPDATE public.staff_members
         SET full_name = COALESCE($3, full_name),
             phone = COALESCE($4, phone),
             email = COALESCE($5, email),
             role = COALESCE($6, role),
             notes = COALESCE($7, notes),
             pin_code = CASE WHEN $8::text IS NOT NULL AND $8::text <> '' THEN $8 ELSE pin_code END,
             page_permissions = COALESCE($9, page_permissions),
             is_active = COALESCE($10, is_active),
             updated_at = now()
         WHERE id = $1 AND owner_id = $2
         RETURNING *`,
        [
          id,
          ownerId,
          body.full_name?.trim() ?? null,
          body.phone !== undefined ? body.phone?.trim() || null : null,
          body.email !== undefined ? body.email?.trim() || null : null,
          body.role ?? null,
          body.notes !== undefined ? body.notes?.trim() || null : null,
          pin ?? null,
          Array.isArray(body.page_permissions) ? body.page_permissions : null,
          typeof body.is_active === 'boolean' ? body.is_active : null,
        ]
      );

      if (Array.isArray(body.outlet_ids)) {
        await syncOutletLinks(id, body.outlet_ids);
      }

      res.json({ staff_member: rows[0] });
    } catch (err) {
      console.error('PATCH /api/staff-members/:id:', err);
      res.status(500).json({ error: friendlyDbError(err) });
    }
  });

  app.delete('/api/staff-members/:id', requireAuth, requireOwner, async (req, res) => {
    try {
      const { rowCount } = await pool.query(
        'DELETE FROM public.staff_members WHERE id = $1 AND owner_id = $2',
        [req.params.id, req.user.id]
      );
      if (!rowCount) return res.status(404).json({ error: 'Staff member not found' });
      res.json({ success: true });
    } catch (err) {
      console.error('DELETE /api/staff-members/:id:', err);
      res.status(500).json({ error: err.message });
    }
  });
}

