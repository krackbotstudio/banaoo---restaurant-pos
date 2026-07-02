import pool from './db.js';

function resolvePaymentSettings(outlet, profile) {
  const online =
    outlet.online_payments_enabled ??
    profile?.online_payments_enabled ??
    true;
  return {
    upi_vpa: (outlet.upi_vpa?.trim() || profile?.upi_vpa?.trim() || null) ?? null,
    upi_display_name:
      outlet.upi_display_name?.trim() ||
      profile?.upi_display_name?.trim() ||
      profile?.brand_name?.trim() ||
      outlet.name?.trim() ||
      null,
    upi_qr_url: outlet.upi_qr_url?.trim() || profile?.upi_qr_url?.trim() || null,
    online_payments_enabled: online !== false,
  };
}

export function registerCustomerOrderRoutes(app, { requireAuth }) {
  app.get('/api/public/outlets/:outletId/payment-settings', async (req, res) => {
    const { outletId } = req.params;
    try {
      const { rows: outlets } = await pool.query(
        `SELECT o.id, o.name, o.is_active, o.upi_vpa, o.upi_display_name, o.upi_qr_url, o.online_payments_enabled,
                p.upi_vpa AS profile_upi_vpa, p.upi_display_name AS profile_upi_display_name,
                p.upi_qr_url AS profile_upi_qr_url, p.online_payments_enabled AS profile_online_payments_enabled,
                p.brand_name
         FROM public.outlets o
         JOIN public.profiles p ON p.user_id = o.owner_id
         WHERE o.id = $1 AND o.is_active = true`,
        [outletId]
      );
      if (outlets.length === 0) return res.status(404).json({ error: 'Outlet not found' });
      const o = outlets[0];
      const settings = resolvePaymentSettings(
        {
          upi_vpa: o.upi_vpa,
          upi_display_name: o.upi_display_name,
          upi_qr_url: o.upi_qr_url,
          online_payments_enabled: o.online_payments_enabled,
          name: o.name,
        },
        {
          upi_vpa: o.profile_upi_vpa,
          upi_display_name: o.profile_upi_display_name,
          upi_qr_url: o.profile_upi_qr_url,
          online_payments_enabled: o.profile_online_payments_enabled,
          brand_name: o.brand_name,
        }
      );
      res.json(settings);
    } catch (err) {
      console.error('GET payment-settings:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/public/customer-orders', async (req, res) => {
    const {
      outlet_id,
      order_type,
      table_id,
      table_number,
      delivery_address,
      delivery_pincode,
      delivery_city,
      delivery_state,
      delivery_latitude,
      delivery_longitude,
      customer_name,
      customer_phone,
      notes,
      payment_method,
      items,
    } = req.body;

    if (!outlet_id || !order_type || !customer_name?.trim() || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Invalid order payload' });
    }
    if (!['dine_in', 'takeaway', 'delivery'].includes(order_type)) {
      return res.status(400).json({ error: 'Invalid order type' });
    }
    if (order_type === 'dine_in' && !table_id && !table_number?.trim()) {
      return res.status(400).json({ error: 'Table is required for dine-in' });
    }
    if (order_type === 'delivery' && !delivery_address?.trim()) {
      return res.status(400).json({ error: 'Delivery address is required' });
    }
    if (order_type === 'delivery') {
      if (!req.body.delivery_pincode?.trim() || !req.body.delivery_city?.trim() || !req.body.delivery_state?.trim()) {
        return res.status(400).json({ error: 'Delivery pincode, city, and state are required' });
      }
      const lat = Number(req.body.delivery_latitude);
      const lng = Number(req.body.delivery_longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return res.status(400).json({ error: 'Delivery location pin is required on the map' });
      }
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return res.status(400).json({ error: 'Invalid delivery coordinates' });
      }
    }
    const payMethod = payment_method === 'upi' ? 'upi' : 'cod';

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows: outlets } = await client.query(
        `SELECT o.*, p.upi_vpa AS profile_upi_vpa, p.upi_display_name AS profile_upi_display_name,
                p.upi_qr_url AS profile_upi_qr_url, p.online_payments_enabled AS profile_online_payments_enabled,
                p.brand_name
         FROM public.outlets o
         JOIN public.profiles p ON p.user_id = o.owner_id
         WHERE o.id = $1 AND o.is_active = true`,
        [outlet_id]
      );
      if (outlets.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Outlet not found' });
      }
      const outlet = outlets[0];

      let resolvedTableNumber = table_number?.trim() || null;
      if (order_type === 'dine_in' && table_id) {
        const { rows: tbl } = await client.query(
          `SELECT id, table_number, status FROM public.restaurant_tables
           WHERE id = $1 AND outlet_id = $2`,
          [table_id, outlet_id]
        );
        if (tbl.length === 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Invalid table' });
        }
        if (tbl[0].status !== 'available') {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Table is not available' });
        }
        const { rows: busy } = await client.query(
          `SELECT id FROM public.orders
           WHERE outlet_id = $1 AND order_type = 'dine_in' AND table_number = $2
             AND status IN ('pending', 'preparing', 'ready', 'completed')
           LIMIT 1`,
          [outlet_id, tbl[0].table_number]
        );
        if (busy.length > 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Table already has an active order' });
        }
        resolvedTableNumber = tbl[0].table_number;
      }

      const settings = resolvePaymentSettings(outlet, {
        upi_vpa: outlet.profile_upi_vpa,
        upi_display_name: outlet.profile_upi_display_name,
        upi_qr_url: outlet.profile_upi_qr_url,
        online_payments_enabled: outlet.profile_online_payments_enabled,
        brand_name: outlet.brand_name,
      });

      if (payMethod === 'upi') {
        if (!settings.online_payments_enabled) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Online payments are disabled for this outlet' });
        }
        if (!settings.upi_vpa) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'UPI is not configured for this restaurant' });
        }
      }

      const menuIds = items.map((it) => it.menu_item_id).filter(Boolean);
      if (menuIds.length > 0) {
        const { rows: menuRows } = await client.query(
          `SELECT id FROM public.menu_items
           WHERE outlet_id = $1 AND id = ANY($2::uuid[]) AND is_available = true`,
          [outlet_id, menuIds]
        );
        const validIds = new Set(menuRows.map((r) => r.id));
        const staleLines = items.filter(
          (it) => it.menu_item_id && !validIds.has(it.menu_item_id)
        );
        if (staleLines.length > 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            error:
              'Some items in your cart are no longer available. Please refresh the menu and try again.',
            stale_items: staleLines.map((it) => it.item_name || it.menu_item_id),
          });
        }
      }

      const subtotal = items.reduce(
        (sum, it) => sum + Number(it.unit_price) * Number(it.quantity),
        0
      );
      const orderNumber = `ONL-${Date.now().toString(36).toUpperCase()}`;
      const paymentStatus = payMethod === 'upi' ? 'pending' : 'not_required';

      const deliveryLat =
        order_type === 'delivery' ? Number(delivery_latitude) : null;
      const deliveryLng =
        order_type === 'delivery' ? Number(delivery_longitude) : null;

      const { rows: orderRows } = await client.query(
        `INSERT INTO public.orders (
          outlet_id, order_number, order_type, table_number, table_id, delivery_address,
          delivery_pincode, delivery_city, delivery_state,
          delivery_latitude, delivery_longitude,
          subtotal, total, notes, status, source, customer_name, customer_phone,
          payment_method, payment_status
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'pending','online',$15,$16,$17,$18)
        RETURNING id, order_number, total, payment_method, payment_status`,
        [
          outlet_id,
          orderNumber,
          order_type,
          order_type === 'dine_in' ? resolvedTableNumber : null,
          order_type === 'dine_in' ? table_id || null : null,
          order_type === 'delivery' ? delivery_address.trim() : null,
          order_type === 'delivery' ? delivery_pincode.trim() : null,
          order_type === 'delivery' ? delivery_city.trim() : null,
          order_type === 'delivery' ? delivery_state.trim() : null,
          deliveryLat,
          deliveryLng,
          subtotal,
          subtotal,
          notes?.trim() || null,
          customer_name.trim(),
          customer_phone?.trim() || null,
          payMethod,
          paymentStatus,
        ]
      );
      const order = orderRows[0];

      for (const it of items) {
        await client.query(
          `INSERT INTO public.order_items (order_id, menu_item_id, item_name, quantity, unit_price, total_price, notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [
            order.id,
            it.menu_item_id,
            it.item_name,
            it.quantity,
            it.unit_price,
            it.unit_price * it.quantity,
            it.notes || null,
          ]
        );
      }

      let paymentId = null;
      if (payMethod === 'upi') {
        const { rows: payRows } = await client.query(
          `INSERT INTO public.order_payments (order_id, outlet_id, amount, method, status, upi_vpa)
           VALUES ($1,$2,$3,'upi','pending',$4)
           RETURNING id`,
          [order.id, outlet_id, subtotal, settings.upi_vpa]
        );
        paymentId = payRows[0].id;
      }

      await client.query('COMMIT');

      res.json({
        order_id: order.id,
        order_number: order.order_number,
        total: Number(order.total),
        payment_method: order.payment_method,
        payment_status: order.payment_status,
        payment_id: paymentId,
        requires_upi: payMethod === 'upi',
      });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('POST customer-orders:', err);
      res.status(500).json({ error: err.message });
    } finally {
      client.release();
    }
  });

  app.get('/api/public/orders/:orderId/payment', async (req, res) => {
    const { orderId } = req.params;
    try {
      const { rows } = await pool.query(
        `SELECT o.id, o.order_number, o.total, o.payment_method, o.payment_status, o.outlet_id,
                op.id AS payment_id, op.status AS payment_record_status, op.customer_reference,
                op.upi_vpa,
                out.name AS outlet_name, out.upi_vpa AS outlet_upi_vpa, out.upi_display_name, out.upi_qr_url,
                out.online_payments_enabled AS outlet_online_payments_enabled,
                p.upi_vpa AS profile_upi_vpa, p.upi_display_name AS profile_upi_display_name,
                p.upi_qr_url AS profile_upi_qr_url, p.online_payments_enabled AS profile_online_payments_enabled,
                p.brand_name
         FROM public.orders o
         JOIN public.outlets out ON out.id = o.outlet_id
         JOIN public.profiles p ON p.user_id = out.owner_id
         LEFT JOIN public.order_payments op ON op.order_id = o.id
         WHERE o.id = $1 AND o.source = 'online'`,
        [orderId]
      );
      if (rows.length === 0) return res.status(404).json({ error: 'Order not found' });
      const row = rows[0];
      const settings = resolvePaymentSettings(
        {
          upi_vpa: row.outlet_upi_vpa,
          upi_display_name: row.upi_display_name,
          upi_qr_url: row.upi_qr_url,
          online_payments_enabled: row.outlet_online_payments_enabled,
          name: row.outlet_name,
        },
        {
          upi_vpa: row.profile_upi_vpa,
          upi_display_name: row.profile_upi_display_name,
          upi_qr_url: row.profile_upi_qr_url,
          online_payments_enabled: row.profile_online_payments_enabled,
          brand_name: row.brand_name,
        }
      );
      res.json({
        order_id: row.id,
        order_number: row.order_number,
        total: Number(row.total),
        payment_method: row.payment_method,
        payment_status: row.payment_status,
        payment_id: row.payment_id,
        payment_record_status: row.payment_record_status,
        customer_reference: row.customer_reference,
        upi_vpa: row.upi_vpa || settings.upi_vpa,
        ...settings,
      });
    } catch (err) {
      console.error('GET order payment:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/public/orders/:orderId/submit-upi', async (req, res) => {
    const { orderId } = req.params;
    const { utr } = req.body;
    const ref = String(utr || '').trim();
    if (!ref || ref.length < 6) {
      return res.status(400).json({ error: 'Enter a valid UTR / transaction reference (min 6 characters)' });
    }
    try {
      const { rows } = await pool.query(
        `SELECT o.id, o.payment_status, op.id AS payment_id
         FROM public.orders o
         LEFT JOIN public.order_payments op ON op.order_id = o.id
         WHERE o.id = $1 AND o.source = 'online' AND o.payment_method = 'upi'`,
        [orderId]
      );
      if (rows.length === 0) return res.status(404).json({ error: 'Order not found' });
      const row = rows[0];
      if (row.payment_status === 'paid') {
        return res.json({ success: true, payment_status: 'paid' });
      }
      if (!row.payment_id) return res.status(400).json({ error: 'No payment record' });

      await pool.query(
        `UPDATE public.order_payments
         SET customer_reference = $1, status = 'awaiting_confirmation', submitted_at = now()
         WHERE id = $2`,
        [ref, row.payment_id]
      );
      await pool.query(
        `UPDATE public.orders SET payment_status = 'awaiting_confirmation' WHERE id = $1`,
        [orderId]
      );
      res.json({ success: true, payment_status: 'awaiting_confirmation' });
    } catch (err) {
      console.error('POST submit-upi:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/order-payments', requireAuth, async (req, res) => {
    const { outlet_id, status } = req.query;
    if (!outlet_id) return res.status(400).json({ error: 'outlet_id required' });
    try {
      const { rows: access } = await pool.query(
        `SELECT 1 FROM public.outlets WHERE id = $1 AND owner_id = $2`,
        [outlet_id, req.user.id]
      );
      if (access.length === 0) return res.status(403).json({ error: 'Access denied' });

      let query = `
        SELECT op.*, o.order_number, o.customer_name, o.customer_phone, o.order_type, o.table_number,
               o.total AS order_total, o.payment_status AS order_payment_status, o.created_at AS order_created_at
        FROM public.order_payments op
        JOIN public.orders o ON o.id = op.order_id
        WHERE op.outlet_id = $1`;
      const params = [outlet_id];
      if (status) {
        params.push(status);
        query += ` AND op.status = $${params.length}`;
      }
      query += ` ORDER BY op.created_at DESC LIMIT 100`;

      const { rows } = await pool.query(query, params);
      res.json({ payments: rows });
    } catch (err) {
      console.error('GET order-payments:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.patch('/api/order-payments/:paymentId', requireAuth, async (req, res) => {
    const { paymentId } = req.params;
    const { action, notes } = req.body;
    if (!['confirm', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'action must be confirm or reject' });
    }
    try {
      const { rows } = await pool.query(
        `SELECT op.*, o.id AS order_id FROM public.order_payments op
         JOIN public.orders o ON o.id = op.order_id
         JOIN public.outlets out ON out.id = op.outlet_id
         WHERE op.id = $1 AND out.owner_id = $2`,
        [paymentId, req.user.id]
      );
      if (rows.length === 0) return res.status(404).json({ error: 'Payment not found' });

      const payment = rows[0];
      if (action === 'confirm') {
        await pool.query(
          `UPDATE public.order_payments
           SET status = 'paid', confirmed_at = now(), confirmed_by = $1, notes = COALESCE($2, notes)
           WHERE id = $3`,
          [req.user.id, notes || null, paymentId]
        );
        await pool.query(
          `UPDATE public.orders SET payment_status = 'paid' WHERE id = $1`,
          [payment.order_id]
        );
      } else {
        await pool.query(
          `UPDATE public.order_payments
           SET status = 'failed', notes = COALESCE($1, notes)
           WHERE id = $2`,
          [notes || 'Payment rejected by restaurant', paymentId]
        );
        await pool.query(
          `UPDATE public.orders SET payment_status = 'failed' WHERE id = $1`,
          [payment.order_id]
        );
      }
      res.json({ success: true });
    } catch (err) {
      console.error('PATCH order-payments:', err);
      res.status(500).json({ error: err.message });
    }
  });
}
