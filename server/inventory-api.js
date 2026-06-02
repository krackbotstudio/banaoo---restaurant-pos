import pool from './db.js';
import { buildEntitlementsPayload } from './entitlements.js';

/** Cached optional columns — probed once at server startup. */
let schemaCache = {
  hasCategory: false,
  hasUnitCost: false,
  hasMovements: false,
};
let schemaProbePromise = null;

export function warmInventorySchema() {
  if (schemaProbePromise) return schemaProbePromise;
  schemaProbePromise = (async () => {
    try {
      const { rows: colRows } = await pool.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'inventory_items'`
      );
      const columns = new Set(colRows.map((r) => r.column_name));

      const { rows: tableRows } = await pool.query(
        `SELECT 1 FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = 'inventory_movements'
         LIMIT 1`
      );

      schemaCache = {
        hasCategory: columns.has('category'),
        hasUnitCost: columns.has('unit_cost'),
        hasMovements: tableRows.length > 0,
      };
    } catch (err) {
      console.warn('[inventory] schema probe failed, using base columns:', err.message);
    }
  })();
  return schemaProbePromise;
}

async function getInventorySchema() {
  if (schemaProbePromise) await schemaProbePromise;
  return schemaCache;
}

function itemSelectSql(schema) {
  const parts = [
    'id',
    'outlet_id',
    'name',
    'sku',
    'unit',
    'quantity',
    'low_stock_threshold',
    'notes',
  ];
  if (schema.hasCategory) parts.push('category');
  if (schema.hasUnitCost) parts.push('unit_cost');
  parts.push('created_at', 'updated_at');
  return parts.join(', ');
}

async function assertInventoryFeature(ownerId) {
  const entitlements = await buildEntitlementsPayload(ownerId);
  if (entitlements?.access_source || entitlements?.access?.is_complimentary_active) {
    return { ok: true };
  }
  if (!entitlements?.effective_limits?.inventoryManagement) {
    return {
      ok: false,
      status: 403,
      error: 'Inventory management is not enabled on your plan. Add the Inventory add-on or upgrade.',
    };
  }
  return { ok: true };
}

async function resolveInventoryAccess(user, outletId) {
  const { rows: outlets } = await pool.query(
    'SELECT id, owner_id FROM public.outlets WHERE id = $1',
    [outletId]
  );
  if (!outlets.length) return { ok: false, status: 404, error: 'Outlet not found' };
  const outlet = outlets[0];

  if (user.isStaff) {
    const { rows: staffRows } = await pool.query(
      'SELECT owner_id, page_permissions FROM public.staff_members WHERE id = $1 AND is_active = true',
      [user.id]
    );
    if (!staffRows.length) return { ok: false, status: 403, error: 'Staff account not found' };
    const staff = staffRows[0];
    const perms = Array.isArray(staff.page_permissions) ? staff.page_permissions : [];
    if (!perms.includes('inventory')) {
      return { ok: false, status: 403, error: 'You do not have inventory permission' };
    }
    const { rows: assign } = await pool.query(
      'SELECT 1 FROM public.staff_outlet_assignments WHERE user_id = $1 AND outlet_id = $2 LIMIT 1',
      [user.id, outletId]
    );
    if (!assign.length) return { ok: false, status: 403, error: 'No access to this outlet' };
    return { ok: true, ownerId: staff.owner_id, outletId };
  }

  if (outlet.owner_id !== user.id) {
    return { ok: false, status: 403, error: 'Not your outlet' };
  }
  return { ok: true, ownerId: user.id, outletId };
}

function mapItem(row) {
  return {
    id: row.id,
    outlet_id: row.outlet_id,
    name: row.name,
    sku: row.sku,
    unit: row.unit,
    quantity: Number(row.quantity),
    low_stock_threshold: Number(row.low_stock_threshold),
    notes: row.notes,
    category: row.category ?? null,
    unit_cost: row.unit_cost != null ? Number(row.unit_cost) : null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function buildSummary(items) {
  const totalItems = items.length;
  let lowStock = 0;
  let outOfStock = 0;
  let stockValue = 0;
  for (const item of items) {
    if (item.quantity <= 0) outOfStock++;
    else if (item.quantity <= item.low_stock_threshold) lowStock++;
    if (item.unit_cost != null) stockValue += item.quantity * item.unit_cost;
  }
  return { totalItems, lowStock, outOfStock, stockValue };
}

export function registerInventoryRoutes(app, { requireAuth }) {
  app.get('/api/outlets/:outletId/inventory', requireAuth, async (req, res) => {
    const { outletId } = req.params;
    try {
      const access = await resolveInventoryAccess(req.user, outletId);
      if (!access.ok) return res.status(access.status).json({ error: access.error });

      const feature = await assertInventoryFeature(access.ownerId);
      if (!feature.ok) return res.status(feature.status).json({ error: feature.error });

      const schema = await getInventorySchema();
      const { rows } = await pool.query(
        `SELECT ${itemSelectSql(schema)}
         FROM public.inventory_items
         WHERE outlet_id = $1
         ORDER BY name ASC`,
        [outletId]
      );
      const items = rows.map(mapItem);
      res.json({ items, summary: buildSummary(items) });
    } catch (err) {
      console.error('GET /api/outlets/:outletId/inventory:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/outlets/:outletId/inventory/movements', requireAuth, async (req, res) => {
    const { outletId } = req.params;
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    try {
      const access = await resolveInventoryAccess(req.user, outletId);
      if (!access.ok) return res.status(access.status).json({ error: access.error });

      const feature = await assertInventoryFeature(access.ownerId);
      if (!feature.ok) return res.status(feature.status).json({ error: feature.error });

      const schema = await getInventorySchema();
      if (!schema.hasMovements) return res.json({ movements: [] });

      const { rows } = await pool.query(
        `SELECT m.id, m.inventory_item_id, m.delta, m.reason, m.notes, m.created_at,
                i.name AS item_name
         FROM public.inventory_movements m
         JOIN public.inventory_items i ON i.id = m.inventory_item_id
         WHERE i.outlet_id = $1
         ORDER BY m.created_at DESC
         LIMIT $2`,
        [outletId, limit]
      );
      res.json({
        movements: rows.map((r) => ({
          ...r,
          delta: Number(r.delta),
        })),
      });
    } catch (err) {
      if (err.code === '42P01') return res.json({ movements: [] });
      console.error('GET inventory movements:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/outlets/:outletId/inventory', requireAuth, async (req, res) => {
    const { outletId } = req.params;
    const { name, sku, unit, quantity, low_stock_threshold, notes, category, unit_cost } =
      req.body || {};
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });

    try {
      const access = await resolveInventoryAccess(req.user, outletId);
      if (!access.ok) return res.status(access.status).json({ error: access.error });

      const feature = await assertInventoryFeature(access.ownerId);
      if (!feature.ok) return res.status(feature.status).json({ error: feature.error });

      const schema = await getInventorySchema();
      const qty = Math.max(0, Number(quantity) || 0);
      const threshold = Math.max(0, Number(low_stock_threshold) || 0);
      const cost =
        schema.hasUnitCost && unit_cost != null && unit_cost !== ''
          ? Math.max(0, Number(unit_cost))
          : null;

      const insertCols = [
        'outlet_id',
        'owner_id',
        'name',
        'sku',
        'unit',
        'quantity',
        'low_stock_threshold',
        'notes',
      ];
      const values = [
        outletId,
        access.ownerId,
        name.trim(),
        sku?.trim() || null,
        (unit || 'pcs').trim(),
        qty,
        threshold,
        notes?.trim() || null,
      ];

      if (schema.hasCategory) {
        insertCols.push('category');
        values.push(category?.trim() || null);
      }
      if (schema.hasUnitCost) {
        insertCols.push('unit_cost');
        values.push(cost);
      }

      const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
      const { rows } = await pool.query(
        `INSERT INTO public.inventory_items (${insertCols.join(', ')})
         VALUES (${placeholders})
         RETURNING ${itemSelectSql(schema)}`,
        values
      );
      res.status(201).json({ item: mapItem(rows[0]) });
    } catch (err) {
      console.error('POST inventory item:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.patch('/api/inventory/:itemId', requireAuth, async (req, res) => {
    const { itemId } = req.params;
    const body = req.body || {};
    try {
      const { rows: existing } = await pool.query(
        `SELECT outlet_id FROM public.inventory_items WHERE id = $1`,
        [itemId]
      );
      if (!existing.length) return res.status(404).json({ error: 'Item not found' });

      const access = await resolveInventoryAccess(req.user, existing[0].outlet_id);
      if (!access.ok) return res.status(access.status).json({ error: access.error });

      const feature = await assertInventoryFeature(access.ownerId);
      if (!feature.ok) return res.status(feature.status).json({ error: feature.error });

      const schema = await getInventorySchema();
      const sets = [
        'name = COALESCE($2, name)',
        'sku = COALESCE($3, sku)',
        'unit = COALESCE($4, unit)',
        'quantity = COALESCE($5, quantity)',
        'low_stock_threshold = COALESCE($6, low_stock_threshold)',
        'notes = COALESCE($7, notes)',
      ];
      const params = [
        itemId,
        body.name?.trim() || null,
        body.sku !== undefined ? body.sku?.trim() || null : null,
        body.unit?.trim() || null,
        body.quantity != null ? Math.max(0, Number(body.quantity)) : null,
        body.low_stock_threshold != null ? Math.max(0, Number(body.low_stock_threshold)) : null,
        body.notes !== undefined ? body.notes?.trim() || null : null,
      ];

      if (schema.hasCategory) {
        sets.push(`category = COALESCE($${params.length + 1}, category)`);
        params.push(body.category !== undefined ? body.category?.trim() || null : null);
      }
      if (schema.hasUnitCost) {
        sets.push(`unit_cost = COALESCE($${params.length + 1}, unit_cost)`);
        params.push(
          body.unit_cost !== undefined
            ? body.unit_cost != null && body.unit_cost !== ''
              ? Math.max(0, Number(body.unit_cost))
              : null
            : null
        );
      }

      sets.push('updated_at = now()');

      const { rows } = await pool.query(
        `UPDATE public.inventory_items SET ${sets.join(', ')}
         WHERE id = $1
         RETURNING ${itemSelectSql(schema)}`,
        params
      );
      res.json({ item: mapItem(rows[0]) });
    } catch (err) {
      console.error('PATCH inventory item:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/inventory/:itemId', requireAuth, async (req, res) => {
    const { itemId } = req.params;
    try {
      const { rows: existing } = await pool.query(
        'SELECT outlet_id FROM public.inventory_items WHERE id = $1',
        [itemId]
      );
      if (!existing.length) return res.status(404).json({ error: 'Item not found' });

      const access = await resolveInventoryAccess(req.user, existing[0].outlet_id);
      if (!access.ok) return res.status(access.status).json({ error: access.error });

      const feature = await assertInventoryFeature(access.ownerId);
      if (!feature.ok) return res.status(feature.status).json({ error: feature.error });

      await pool.query('DELETE FROM public.inventory_items WHERE id = $1', [itemId]);
      res.json({ success: true });
    } catch (err) {
      console.error('DELETE inventory item:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/inventory/:itemId/adjust', requireAuth, async (req, res) => {
    const { itemId } = req.params;
    const { delta, reason, notes } = req.body || {};
    const change = Number(delta);
    if (!Number.isFinite(change) || change === 0) {
      return res.status(400).json({ error: 'Delta must be a non-zero number' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows: existing } = await client.query(
        `SELECT id, outlet_id, quantity FROM public.inventory_items WHERE id = $1 FOR UPDATE`,
        [itemId]
      );
      if (!existing.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Item not found' });
      }

      const access = await resolveInventoryAccess(req.user, existing[0].outlet_id);
      if (!access.ok) {
        await client.query('ROLLBACK');
        return res.status(access.status).json({ error: access.error });
      }

      const feature = await assertInventoryFeature(access.ownerId);
      if (!feature.ok) {
        await client.query('ROLLBACK');
        return res.status(feature.status).json({ error: feature.error });
      }

      const schema = await getInventorySchema();
      const newQty = Math.max(0, Number(existing[0].quantity) + change);
      const { rows } = await client.query(
        `UPDATE public.inventory_items SET quantity = $2, updated_at = now()
         WHERE id = $1
         RETURNING ${itemSelectSql(schema)}`,
        [itemId, newQty]
      );

      if (schema.hasMovements) {
        try {
          await client.query(
            `INSERT INTO public.inventory_movements (inventory_item_id, delta, reason, notes, created_by)
             VALUES ($1, $2, $3, $4, $5)`,
            [
              itemId,
              change,
              reason?.trim() || (change > 0 ? 'stock_in' : 'stock_out'),
              notes?.trim() || null,
              req.user.id,
            ]
          );
        } catch (moveErr) {
          if (moveErr.code !== '42P01') throw moveErr;
        }
      }

      await client.query('COMMIT');
      res.json({ item: mapItem(rows[0]) });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('POST inventory adjust:', err);
      res.status(500).json({ error: err.message });
    } finally {
      client.release();
    }
  });
}
