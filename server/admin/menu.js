import pool from '../db.js';
import { requireCmsAuth } from './middleware.js';
import { logAdminAction } from './audit.js';
import { extractMenuItemsFromImage } from '../menu-extract.js';

const MENU_ROLES = new Set(['super_admin', 'support']);

function canEditMenu(admin) {
  return admin && MENU_ROLES.has(admin.role);
}

async function getOutletById(outletId) {
  const { rows } = await pool.query(
    `SELECT id, name, owner_id, is_active FROM public.outlets WHERE id = $1 LIMIT 1`,
    [outletId]
  );
  return rows[0] ?? null;
}

const ITEM_PATCH_COLUMNS = {
  category_id: (v) => (v === '' || v === undefined ? null : v),
  name: (v) => (v != null ? String(v).trim() : null),
  description: (v) => (v != null ? (String(v).trim() || null) : null),
  base_price: (v) => (v != null ? Number(v) : null),
  image_url: (v) => v ?? null,
  is_veg: (v) => v,
  is_available: (v) => v,
  prep_time_mins: (v) => (v != null ? Number(v) : null),
  is_special: (v) => !!v,
  special_label: (v) => v,
  offer_label: (v) => v ?? null,
  offer_price: (v) => (v != null && v !== '' ? Number(v) : null),
  gst_category: (v) => v ?? null,
  schedule_enabled: (v) => !!v,
  availability_schedule: (v) => (v ? JSON.stringify(v) : null),
};

function buildItemPatchSql(body) {
  const sets = [];
  const values = [];
  let paramIdx = 2;
  for (const [col, transform] of Object.entries(ITEM_PATCH_COLUMNS)) {
    if (body[col] === undefined) continue;
    paramIdx += 1;
    if (col === 'availability_schedule') {
      sets.push(`${col} = $${paramIdx}::jsonb`);
    } else {
      sets.push(`${col} = $${paramIdx}`);
    }
    values.push(transform(body[col]));
  }
  if (sets.length === 0) return null;
  sets.push('updated_at = now()');
  return { sets: sets.join(', '), values };
}

async function syncItemVariants(menuItemId, variants) {
  await pool.query(`DELETE FROM public.menu_variants WHERE menu_item_id = $1`, [menuItemId]);
  for (const v of variants) {
    const name = String(v?.name || '').trim();
    if (!name) continue;
    await pool.query(
      `INSERT INTO public.menu_variants (menu_item_id, name, price_adjustment, is_default)
       VALUES ($1, $2, $3, $4)`,
      [
        menuItemId,
        name,
        Number(v.price_adjustment) || 0,
        !!v.is_default,
      ]
    );
  }
}

async function assertVariantOnOutlet(variantId, outletId) {
  const { rows } = await pool.query(
    `SELECT v.id FROM public.menu_variants v
     JOIN public.menu_items i ON i.id = v.menu_item_id
     WHERE v.id = $1 AND i.outlet_id = $2
     LIMIT 1`,
    [variantId, outletId]
  );
  return rows[0] ?? null;
}

function normalizeImportItem(raw) {
  const name = String(raw?.name || '').trim();
  const price = Number(raw?.price ?? raw?.base_price);
  if (!name || !Number.isFinite(price) || price < 0) return null;
  const variants = (Array.isArray(raw?.variants) ? raw.variants : [])
    .map((variant) => {
      const variantName = String(variant?.name || '').trim();
      const absolutePrice = Number(variant?.price ?? variant?.base_price);
      if (!variantName || !Number.isFinite(absolutePrice) || absolutePrice < 0) return null;
      return {
        name: variantName,
        price_adjustment: Number((absolutePrice - price).toFixed(2)),
        is_default: variant?.is_default === true,
      };
    })
    .filter(Boolean);

  if (variants.length > 0) {
    const selectedDefault = Math.max(
      0,
      variants.findIndex((variant) => variant.is_default)
    );
    variants.forEach((variant, index) => {
      variant.is_default = index === selectedDefault;
    });
  }

  return {
    name,
    description: raw.description ? String(raw.description).trim() : null,
    base_price: price,
    is_veg: raw.is_veg === false ? false : raw.is_veg === true ? true : true,
    category: raw.category ? String(raw.category).trim() : null,
    variants,
  };
}

export function registerCmsMenuRoutes(app) {
  app.get('/api/cms/customers/:userId/outlets', requireCmsAuth, async (req, res) => {
    const { userId } = req.params;
    try {
      const { rows } = await pool.query(
        `SELECT id, name, address, phone, is_active, operation_mode, created_at, updated_at
         FROM public.outlets
         WHERE owner_id = $1
         ORDER BY is_active DESC, name ASC`,
        [userId]
      );
      res.json({ outlets: rows });
    } catch (err) {
      console.error('GET /api/cms/customers/:userId/outlets:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/cms/outlets/:outletId/menu', requireCmsAuth, async (req, res) => {
    const { outletId } = req.params;
    try {
      const outlet = await getOutletById(outletId);
      if (!outlet) return res.status(404).json({ error: 'Outlet not found' });

      const [catRes, itemRes] = await Promise.all([
        pool.query(
          `SELECT id, name, sort_order, is_active, created_at
           FROM public.menu_categories
           WHERE outlet_id = $1
           ORDER BY sort_order ASC, name ASC`,
          [outletId]
        ),
        pool.query(
          `SELECT id, category_id, name, description, base_price, image_url, is_veg, is_available,
                  prep_time_mins, is_special, special_label, offer_label, offer_price,
                  gst_category, schedule_enabled, availability_schedule, created_at, updated_at
           FROM public.menu_items
           WHERE outlet_id = $1
           ORDER BY name ASC`,
          [outletId]
        ),
      ]);

      const itemIds = itemRes.rows.map((r) => r.id);
      let variants = [];
      if (itemIds.length) {
        try {
          const vRes = await pool.query(
            `SELECT id, menu_item_id, name, price_adjustment, is_default, created_at
             FROM public.menu_variants
             WHERE menu_item_id = ANY($1::uuid[])
             ORDER BY is_default DESC, name ASC`,
            [itemIds]
          );
          variants = vRes.rows;
        } catch (vErr) {
          if (vErr.code !== '42P01') throw vErr;
        }
      }

      res.json({
        outlet,
        categories: catRes.rows,
        items: itemRes.rows,
        variants,
      });
    } catch (err) {
      if (err.code === '42703') {
        const { rows: items } = await pool.query(
          `SELECT id, category_id, name, description, base_price, image_url, is_veg, is_available,
                  prep_time_mins, created_at, updated_at
           FROM public.menu_items WHERE outlet_id = $1 ORDER BY name ASC`,
          [outletId]
        );
        const { rows: categories } = await pool.query(
          `SELECT id, name, sort_order, is_active, created_at
           FROM public.menu_categories WHERE outlet_id = $1 ORDER BY sort_order ASC, name ASC`,
          [outletId]
        );
        const outlet = await getOutletById(outletId);
        return res.json({ outlet, categories, items, variants: [] });
      }
      console.error('GET /api/cms/outlets/:outletId/menu:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/cms/outlets/:outletId/menu/categories', requireCmsAuth, async (req, res) => {
    if (!canEditMenu(req.cmsAdmin)) {
      return res.status(403).json({ error: 'Not enough permissions' });
    }
    const { outletId } = req.params;
    const { name, sort_order, is_active } = req.body || {};
    if (!name?.trim()) return res.status(400).json({ error: 'Category name is required' });

    try {
      const outlet = await getOutletById(outletId);
      if (!outlet) return res.status(404).json({ error: 'Outlet not found' });

      const { rows } = await pool.query(
        `INSERT INTO public.menu_categories (outlet_id, name, sort_order, is_active)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [outletId, name.trim(), Number(sort_order) || 0, is_active !== false]
      );

      await logAdminAction({
        adminId: req.cmsAdmin?.source === 'admin_users' ? req.cmsAdmin.id : null,
        adminEmail: req.cmsAdmin?.email ?? null,
        action: 'cms.menu.category.create',
        targetType: 'outlet',
        targetId: outletId,
        metadata: { owner_id: outlet.owner_id, category_id: rows[0].id, name: rows[0].name },
        req,
      });

      res.status(201).json({ category: rows[0] });
    } catch (err) {
      console.error('POST menu/categories:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.patch('/api/cms/outlets/:outletId/menu/categories/:categoryId', requireCmsAuth, async (req, res) => {
    if (!canEditMenu(req.cmsAdmin)) {
      return res.status(403).json({ error: 'Not enough permissions' });
    }
    const { outletId, categoryId } = req.params;
    const { name, sort_order, is_active } = req.body || {};

    try {
      const { rows } = await pool.query(
        `UPDATE public.menu_categories
         SET name = COALESCE($3, name),
             sort_order = COALESCE($4, sort_order),
             is_active = COALESCE($5, is_active)
         WHERE id = $2 AND outlet_id = $1
         RETURNING *`,
        [outletId, categoryId, name?.trim() || null, sort_order ?? null, is_active ?? null]
      );
      if (!rows[0]) return res.status(404).json({ error: 'Category not found' });

      await logAdminAction({
        adminId: req.cmsAdmin?.source === 'admin_users' ? req.cmsAdmin.id : null,
        adminEmail: req.cmsAdmin?.email ?? null,
        action: 'cms.menu.category.update',
        targetType: 'outlet',
        targetId: outletId,
        metadata: { category_id: categoryId },
        req,
      });

      res.json({ category: rows[0] });
    } catch (err) {
      console.error('PATCH menu/categories:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/cms/outlets/:outletId/menu/categories/:categoryId', requireCmsAuth, async (req, res) => {
    if (!canEditMenu(req.cmsAdmin)) {
      return res.status(403).json({ error: 'Not enough permissions' });
    }
    const { outletId, categoryId } = req.params;

    try {
      await pool.query(
        `UPDATE public.menu_items SET category_id = NULL WHERE outlet_id = $1 AND category_id = $2`,
        [outletId, categoryId]
      );
      const { rowCount } = await pool.query(
        `DELETE FROM public.menu_categories WHERE id = $1 AND outlet_id = $2`,
        [categoryId, outletId]
      );
      if (!rowCount) return res.status(404).json({ error: 'Category not found' });

      await logAdminAction({
        adminId: req.cmsAdmin?.source === 'admin_users' ? req.cmsAdmin.id : null,
        adminEmail: req.cmsAdmin?.email ?? null,
        action: 'cms.menu.category.delete',
        targetType: 'outlet',
        targetId: outletId,
        metadata: { category_id: categoryId },
        req,
      });

      res.json({ success: true });
    } catch (err) {
      console.error('DELETE menu/categories:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/cms/outlets/:outletId/menu/items', requireCmsAuth, async (req, res) => {
    if (!canEditMenu(req.cmsAdmin)) {
      return res.status(403).json({ error: 'Not enough permissions' });
    }
    const { outletId } = req.params;
    const body = req.body || {};
    if (!body.name?.trim()) return res.status(400).json({ error: 'Item name is required' });
    const price = Number(body.base_price);
    if (!Number.isFinite(price) || price < 0) {
      return res.status(400).json({ error: 'Valid base_price is required' });
    }

    try {
      const outlet = await getOutletById(outletId);
      if (!outlet) return res.status(404).json({ error: 'Outlet not found' });

      const scheduleJson = body.availability_schedule
        ? JSON.stringify(body.availability_schedule)
        : null;

      let rows;
      try {
        const ins = await pool.query(
          `INSERT INTO public.menu_items (
             outlet_id, category_id, name, description, base_price, image_url,
             is_veg, is_available, prep_time_mins, is_special, special_label,
             offer_label, offer_price, gst_category, schedule_enabled, availability_schedule
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb)
           RETURNING *`,
          [
            outletId,
            body.category_id || null,
            body.name.trim(),
            body.description?.trim() || null,
            price,
            body.image_url || null,
            body.is_veg !== false,
            body.is_available !== false,
            body.prep_time_mins ?? 15,
            !!body.is_special,
            body.special_label || "Today's Special",
            body.offer_label || null,
            body.offer_price != null ? Number(body.offer_price) : null,
            body.gst_category || null,
            !!body.schedule_enabled,
            scheduleJson,
          ]
        );
        rows = ins.rows;
      } catch (insErr) {
        if (insErr.code !== '42703') throw insErr;
        const ins = await pool.query(
          `INSERT INTO public.menu_items (
             outlet_id, category_id, name, description, base_price, image_url,
             is_veg, is_available, prep_time_mins, is_special, special_label,
             offer_label, offer_price, gst_category
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
           RETURNING *`,
          [
            outletId,
            body.category_id || null,
            body.name.trim(),
            body.description?.trim() || null,
            price,
            body.image_url || null,
            body.is_veg !== false,
            body.is_available !== false,
            body.prep_time_mins ?? 15,
            !!body.is_special,
            body.special_label || "Today's Special",
            body.offer_label || null,
            body.offer_price != null ? Number(body.offer_price) : null,
            body.gst_category || null,
          ]
        );
        rows = ins.rows;
      }

      await logAdminAction({
        adminId: req.cmsAdmin?.source === 'admin_users' ? req.cmsAdmin.id : null,
        adminEmail: req.cmsAdmin?.email ?? null,
        action: 'cms.menu.item.create',
        targetType: 'outlet',
        targetId: outletId,
        metadata: { owner_id: outlet.owner_id, item_id: item.id, name: item.name },
        req,
      });

      const item = rows[0];
      if (Array.isArray(body.variants) && body.variants.length) {
        await syncItemVariants(item.id, body.variants);
      }

      res.status(201).json({ item });
    } catch (err) {
      console.error('POST menu/items:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.patch('/api/cms/outlets/:outletId/menu/items/:itemId', requireCmsAuth, async (req, res) => {
    if (!canEditMenu(req.cmsAdmin)) {
      return res.status(403).json({ error: 'Not enough permissions' });
    }
    const { outletId, itemId } = req.params;
    const body = req.body || {};

    try {
      const patch = buildItemPatchSql(body);
      if (!patch) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      const params = [outletId, itemId, ...patch.values];
      let rows;
      try {
        const result = await pool.query(
          `UPDATE public.menu_items SET ${patch.sets}
           WHERE id = $2 AND outlet_id = $1
           RETURNING *`,
          params
        );
        rows = result.rows;
      } catch (updErr) {
        if (updErr.code !== '42703') throw updErr;
        const fallbackBody = { ...body };
        delete fallbackBody.schedule_enabled;
        delete fallbackBody.availability_schedule;
        const fb = buildItemPatchSql(fallbackBody);
        if (!fb) return res.status(400).json({ error: 'No fields to update' });
        const result = await pool.query(
          `UPDATE public.menu_items SET ${fb.sets}
           WHERE id = $2 AND outlet_id = $1
           RETURNING *`,
          [outletId, itemId, ...fb.values]
        );
        rows = result.rows;
      }

      if (!rows[0]) return res.status(404).json({ error: 'Item not found' });

      if (Array.isArray(body.variants)) {
        await syncItemVariants(itemId, body.variants);
      }

      await logAdminAction({
        adminId: req.cmsAdmin?.source === 'admin_users' ? req.cmsAdmin.id : null,
        adminEmail: req.cmsAdmin?.email ?? null,
        action: 'cms.menu.item.update',
        targetType: 'outlet',
        targetId: outletId,
        metadata: { item_id: itemId },
        req,
      });

      res.json({ item: rows[0] });
    } catch (err) {
      console.error('PATCH menu/items:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/cms/outlets/:outletId/menu/items/:itemId', requireCmsAuth, async (req, res) => {
    if (!canEditMenu(req.cmsAdmin)) {
      return res.status(403).json({ error: 'Not enough permissions' });
    }
    const { outletId, itemId } = req.params;

    try {
      const del = await pool.query(
        `DELETE FROM public.menu_items WHERE id = $1 AND outlet_id = $2`,
        [itemId, outletId]
      );
      if (del.rowCount) {
        await logAdminAction({
          adminId: req.cmsAdmin?.source === 'admin_users' ? req.cmsAdmin.id : null,
          adminEmail: req.cmsAdmin?.email ?? null,
          action: 'cms.menu.item.delete',
          targetType: 'outlet',
          targetId: outletId,
          metadata: { item_id: itemId },
          req,
        });
        return res.json({ success: true, hidden: false });
      }

      const hide = await pool.query(
        `UPDATE public.menu_items SET is_available = false, updated_at = now()
         WHERE id = $1 AND outlet_id = $2`,
        [itemId, outletId]
      );
      if (!hide.rowCount) return res.status(404).json({ error: 'Item not found' });

      res.json({
        success: true,
        hidden: true,
        message: 'Item used in past orders — marked unavailable instead of deleted',
      });
    } catch (err) {
      if (err.code === '23503') {
        try {
          await pool.query(
            `UPDATE public.menu_items SET is_available = false, updated_at = now()
             WHERE id = $1 AND outlet_id = $2`,
            [itemId, outletId]
          );
          return res.json({
            success: true,
            hidden: true,
            message: 'Item used in past orders — marked unavailable instead of deleted',
          });
        } catch (hideErr) {
          console.error('DELETE menu/items hide:', hideErr);
        }
      }
      console.error('DELETE menu/items:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/cms/outlets/:outletId/menu/items/bulk-delete', requireCmsAuth, async (req, res) => {
    if (!canEditMenu(req.cmsAdmin)) {
      return res.status(403).json({ error: 'Not enough permissions' });
    }
    const { outletId } = req.params;
    const itemIds = [
      ...new Set(
        (Array.isArray(req.body?.item_ids) ? req.body.item_ids : [])
          .map((id) => String(id || '').trim())
          .filter(Boolean)
      ),
    ];
    if (itemIds.length === 0) {
      return res.status(400).json({ error: 'item_ids array is required' });
    }

    try {
      const { rows: ownedItems } = await pool.query(
        `SELECT id FROM public.menu_items
         WHERE outlet_id = $1 AND id = ANY($2::uuid[])`,
        [outletId, itemIds]
      );
      if (ownedItems.length === 0) {
        return res.status(404).json({ error: 'No matching menu items found' });
      }

      let deleted = 0;
      let hidden = 0;
      for (const { id } of ownedItems) {
        try {
          const result = await pool.query(
            `DELETE FROM public.menu_items WHERE id = $1 AND outlet_id = $2`,
            [id, outletId]
          );
          deleted += result.rowCount;
        } catch (err) {
          if (err.code !== '23503') throw err;
          const result = await pool.query(
            `UPDATE public.menu_items
             SET is_available = false, updated_at = now()
             WHERE id = $1 AND outlet_id = $2`,
            [id, outletId]
          );
          hidden += result.rowCount;
        }
      }

      await logAdminAction({
        adminId: req.cmsAdmin?.source === 'admin_users' ? req.cmsAdmin.id : null,
        adminEmail: req.cmsAdmin?.email ?? null,
        action: 'cms.menu.items.bulk_delete',
        targetType: 'outlet',
        targetId: outletId,
        metadata: { requested: itemIds.length, deleted, hidden, item_ids: itemIds },
        req,
      });

      res.json({ success: true, deleted, hidden, processed: deleted + hidden });
    } catch (err) {
      console.error('POST menu/items/bulk-delete:', err);
      res.status(err.code === '22P02' ? 400 : 500).json({
        error: err.code === '22P02' ? 'Invalid menu item ID' : err.message,
      });
    }
  });

  app.patch('/api/cms/outlets/:outletId/menu/items/bulk', requireCmsAuth, async (req, res) => {
    if (!canEditMenu(req.cmsAdmin)) {
      return res.status(403).json({ error: 'Not enough permissions' });
    }
    const { outletId } = req.params;
    const { item_ids: itemIds, patch } = req.body || {};

    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      return res.status(400).json({ error: 'item_ids array is required' });
    }
    if (!patch || typeof patch !== 'object') {
      return res.status(400).json({ error: 'patch object is required' });
    }

    const built = buildItemPatchSql(patch);
    if (!built) return res.status(400).json({ error: 'No valid patch fields' });

    try {
      const params = [outletId, itemIds, ...built.values];
      const result = await pool.query(
        `UPDATE public.menu_items SET ${built.sets}
         WHERE outlet_id = $1 AND id = ANY($2::uuid[])
         RETURNING id`,
        params
      );

      await logAdminAction({
        adminId: req.cmsAdmin?.source === 'admin_users' ? req.cmsAdmin.id : null,
        adminEmail: req.cmsAdmin?.email ?? null,
        action: 'cms.menu.items.bulk_update',
        targetType: 'outlet',
        targetId: outletId,
        metadata: { count: result.rowCount, item_ids: itemIds },
        req,
      });

      res.json({ updated: result.rowCount });
    } catch (err) {
      console.error('PATCH menu/items/bulk:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/cms/outlets/:outletId/menu/extract', requireCmsAuth, async (req, res) => {
    if (!canEditMenu(req.cmsAdmin)) {
      return res.status(403).json({ error: 'Not enough permissions' });
    }
    const { outletId } = req.params;
    const { imageBase64, mimeType } = req.body || {};

    try {
      const outlet = await getOutletById(outletId);
      if (!outlet) return res.status(404).json({ error: 'Outlet not found' });

      const items = await extractMenuItemsFromImage(imageBase64, mimeType);
      res.json({ items });
    } catch (err) {
      console.error('POST menu/extract:', err);
      const status = err.message === 'AI API key not configured' ? 500 : 500;
      res.status(status).json({
        error: err.message || 'Failed to extract menu',
        details: err.details,
        raw: err.raw,
      });
    }
  });

  app.post('/api/cms/outlets/:outletId/menu/import', requireCmsAuth, async (req, res) => {
    if (!canEditMenu(req.cmsAdmin)) {
      return res.status(403).json({ error: 'Not enough permissions' });
    }
    const { outletId } = req.params;
    const { items: rawItems } = req.body || {};

    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      return res.status(400).json({ error: 'items array is required' });
    }

    try {
      const outlet = await getOutletById(outletId);
      if (!outlet) return res.status(404).json({ error: 'Outlet not found' });

      const normalized = rawItems.map(normalizeImportItem).filter(Boolean);
      if (normalized.length === 0) {
        return res.status(400).json({ error: 'No valid items to import' });
      }

      const { rows: existingCats } = await pool.query(
        `SELECT id, name FROM public.menu_categories WHERE outlet_id = $1`,
        [outletId]
      );
      const categoryMap = {};
      for (const c of existingCats) {
        categoryMap[c.name.toLowerCase()] = c.id;
      }

      for (const catName of [...new Set(normalized.map((i) => i.category).filter(Boolean))]) {
        const key = catName.toLowerCase();
        if (categoryMap[key]) continue;
        const { rows } = await pool.query(
          `INSERT INTO public.menu_categories (outlet_id, name) VALUES ($1, $2) RETURNING id, name`,
          [outletId, catName]
        );
        categoryMap[key] = rows[0].id;
      }

      const inserted = [];
      for (const item of normalized) {
        const categoryId = item.category
          ? categoryMap[item.category.toLowerCase()] || null
          : null;
        const { rows } = await pool.query(
          `INSERT INTO public.menu_items (
             outlet_id, category_id, name, description, base_price, is_veg, is_available
           ) VALUES ($1,$2,$3,$4,$5,$6,true)
           RETURNING id, name, base_price`,
          [outletId, categoryId, item.name, item.description, item.base_price, item.is_veg]
        );
        if (item.variants.length > 0) {
          await syncItemVariants(rows[0].id, item.variants);
        }
        inserted.push(rows[0]);
      }

      await logAdminAction({
        adminId: req.cmsAdmin?.source === 'admin_users' ? req.cmsAdmin.id : null,
        adminEmail: req.cmsAdmin?.email ?? null,
        action: 'cms.menu.import',
        targetType: 'outlet',
        targetId: outletId,
        metadata: { owner_id: outlet.owner_id, count: inserted.length },
        req,
      });

      res.status(201).json({ imported: inserted.length, items: inserted });
    } catch (err) {
      console.error('POST menu/import:', err);
      res.status(500).json({ error: err.message });
    }
  });
}
