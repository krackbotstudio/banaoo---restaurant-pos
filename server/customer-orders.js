import pool from './db.js';
import crypto from 'crypto';
import { getMerchantAuth, isRazorpayConnectionActive, getCheckoutKeyId } from './razorpay/auth.js';
import { createOrderForMerchant, fetchPaymentForMerchant } from './razorpay/client.js';

function resolvePaymentSettings(outlet, profile, razorpayConn) {
  const online =
    outlet.online_payments_enabled ??
    profile?.online_payments_enabled ??
    true;
  const rzSettings =
    razorpayConn?.settings && typeof razorpayConn.settings === 'object'
      ? razorpayConn.settings
      : {};
  const rzOnlineEnabled = rzSettings.online_payments_enabled !== false;
  const allowCod = rzSettings.allow_cod !== false;
  const razorpayConnected = isRazorpayConnectionActive(razorpayConn);

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
    razorpay_connected: razorpayConnected,
    razorpay_account_id: razorpayConn?.account_id || razorpayConn?.merchant_key_id || null,
    allow_cod: allowCod,
    online_checkout_enabled: online !== false && rzOnlineEnabled && razorpayConnected,
  };
}

function razorpayConnFromRow(row) {
  return {
    is_connected: row.razorpay_connected,
    connection_mode: row.razorpay_connection_mode,
    account_id: row.razorpay_account_id,
    merchant_key_id: row.razorpay_merchant_key_id,
    merchant_key_secret_enc: row.razorpay_merchant_key_secret_enc,
    access_token_enc: row.razorpay_access_token_enc,
    settings: row.razorpay_settings,
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
                p.brand_name,
                rc.is_connected AS razorpay_connected, rc.account_id AS razorpay_account_id,
                rc.merchant_key_id AS razorpay_merchant_key_id, rc.connection_mode AS razorpay_connection_mode,
                rc.merchant_key_secret_enc AS razorpay_merchant_key_secret_enc,
                rc.access_token_enc AS razorpay_access_token_enc, rc.settings AS razorpay_settings
         FROM public.outlets o
         JOIN public.profiles p ON p.user_id = o.owner_id
         LEFT JOIN public.razorpay_connections rc ON rc.owner_id = o.owner_id
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
        },
        razorpayConnFromRow(o)
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
    const payMethod =
      payment_method === 'online' || payment_method === 'upi'
        ? 'online'
        : 'cod';

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows: outlets } = await client.query(
        `SELECT o.*, p.upi_vpa AS profile_upi_vpa, p.upi_display_name AS profile_upi_display_name,
                p.upi_qr_url AS profile_upi_qr_url, p.online_payments_enabled AS profile_online_payments_enabled,
                p.brand_name,
                rc.is_connected AS razorpay_connected, rc.account_id AS razorpay_account_id,
                rc.merchant_key_id AS razorpay_merchant_key_id, rc.connection_mode AS razorpay_connection_mode,
                rc.merchant_key_secret_enc AS razorpay_merchant_key_secret_enc,
                rc.access_token_enc AS razorpay_access_token_enc, rc.settings AS razorpay_settings
         FROM public.outlets o
         JOIN public.profiles p ON p.user_id = o.owner_id
         LEFT JOIN public.razorpay_connections rc ON rc.owner_id = o.owner_id
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
      }, razorpayConnFromRow(outlet));

      if (payMethod === 'online') {
        if (!settings.online_checkout_enabled) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Online payments are not enabled for this outlet' });
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
      const paymentStatus = payMethod === 'online' ? 'pending' : 'not_required';

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
          payment_method, payment_status, payment_gateway
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'pending','online',$15,$16,$17,$18,$19)
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
          payMethod === 'online' ? 'razorpay' : null,
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
      if (payMethod === 'online') {
        const { rows: payRows } = await client.query(
          `INSERT INTO public.order_payments (order_id, outlet_id, amount, method, status, gateway, currency, metadata)
           VALUES ($1,$2,$3,'online','pending','razorpay','INR',$4)
           RETURNING id`,
          [
            order.id,
            outlet_id,
            subtotal,
            JSON.stringify({
              owner_id: outlet.owner_id,
              outlet_id,
              outlet_name: outlet.name,
              order_id: order.id,
              order_number: order.order_number,
              customer_name: customer_name.trim(),
            }),
          ]
        );
        paymentId = payRows[0].id;
      }

      await client.query('COMMIT');

      const payload = {
        order_id: order.id,
        order_number: order.order_number,
        total: Number(order.total),
        payment_method: order.payment_method,
        payment_status: order.payment_status,
        payment_id: paymentId,
        requires_online_payment: payMethod === 'online',
      };

      if (payMethod === 'online') {
        const merchantAuth = await getMerchantAuth(outlet.owner_id);
        if (!merchantAuth) throw new Error('Razorpay account is not connected for this restaurant');
        const checkoutKeyId =
          merchantAuth.mode === 'api_keys'
            ? merchantAuth.keyId
            : getCheckoutKeyId(razorpayConnFromRow(outlet));
        if (!checkoutKeyId) throw new Error('Razorpay checkout key is not available for this restaurant');

        const rpOrder = await createOrderForMerchant(merchantAuth, {
          amount: Math.round(Number(order.total) * 100),
          currency: 'INR',
          receipt: order.order_number,
          notes: {
            owner_id: outlet.owner_id,
            restaurant_name: outlet.brand_name || outlet.name,
            outlet_id,
            outlet_name: outlet.name,
            order_id: order.id,
            order_number: order.order_number,
            customer_name: customer_name.trim(),
          },
        });

        await pool.query(
          `UPDATE public.order_payments
             SET status = 'created',
                 gateway_order_id = $2,
                 metadata = metadata || $3::jsonb
           WHERE id = $1`,
          [paymentId, rpOrder.id, JSON.stringify({ razorpay_order: rpOrder })]
        );
        await pool.query(
          `UPDATE public.orders SET payment_status = 'created' WHERE id = $1`,
          [order.id]
        );

        payload.payment_status = 'created';
        payload.razorpay = {
          order_id: rpOrder.id,
          amount: rpOrder.amount,
          currency: rpOrder.currency,
          key_id: checkoutKeyId,
        };
      }

      res.json(payload);
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
                op.upi_vpa, op.gateway, op.gateway_order_id, op.gateway_payment_id, op.currency,
                out.name AS outlet_name, out.upi_vpa AS outlet_upi_vpa, out.upi_display_name, out.upi_qr_url,
                out.online_payments_enabled AS outlet_online_payments_enabled,
                p.upi_vpa AS profile_upi_vpa, p.upi_display_name AS profile_upi_display_name,
                p.upi_qr_url AS profile_upi_qr_url, p.online_payments_enabled AS profile_online_payments_enabled,
                p.brand_name,
                rc.is_connected AS razorpay_connected, rc.account_id AS razorpay_account_id,
                rc.merchant_key_id AS razorpay_merchant_key_id, rc.connection_mode AS razorpay_connection_mode,
                rc.merchant_key_secret_enc AS razorpay_merchant_key_secret_enc,
                rc.access_token_enc AS razorpay_access_token_enc, rc.settings AS razorpay_settings
         FROM public.orders o
         JOIN public.outlets out ON out.id = o.outlet_id
         JOIN public.profiles p ON p.user_id = out.owner_id
         LEFT JOIN public.razorpay_connections rc ON rc.owner_id = out.owner_id
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
        },
        razorpayConnFromRow(row)
      );
      const checkoutKeyId = getCheckoutKeyId(razorpayConnFromRow(row));
      res.json({
        order_id: row.id,
        order_number: row.order_number,
        total: Number(row.total),
        payment_method: row.payment_method,
        payment_status: row.payment_status,
        payment_id: row.payment_id,
        payment_record_status: row.payment_record_status,
        gateway: row.gateway,
        gateway_order_id: row.gateway_order_id,
        gateway_payment_id: row.gateway_payment_id,
        currency: row.currency || 'INR',
        razorpay_key_id: row.payment_method === 'online' ? checkoutKeyId : null,
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

  app.post('/api/public/orders/:orderId/verify-online-payment', async (req, res) => {
    const { orderId } = req.params;
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: 'Missing payment verification fields' });
    }

    try {
      const { rows } = await pool.query(
        `SELECT o.id, o.payment_status, o.outlet_id, out.owner_id,
                op.id AS payment_id, op.gateway_order_id, op.status AS payment_record_status
         FROM public.orders o
         JOIN public.outlets out ON out.id = o.outlet_id
         LEFT JOIN public.order_payments op ON op.order_id = o.id
         WHERE o.id = $1 AND o.source = 'online' AND o.payment_method = 'online'
         LIMIT 1`,
        [orderId]
      );
      const row = rows[0];
      if (!row) return res.status(404).json({ error: 'Order not found' });
      if (!row.payment_id) return res.status(400).json({ error: 'No payment record found' });
      if (row.payment_status === 'paid') return res.json({ success: true, payment_status: 'paid' });

      const merchantAuth = await getMerchantAuth(row.owner_id);
      if (!merchantAuth) return res.status(400).json({ error: 'Razorpay is not connected for this restaurant' });
      const keySecret =
        merchantAuth.mode === 'api_keys'
          ? merchantAuth.keySecret
          : process.env.RAZORPAY_KEY_SECRET;
      if (!keySecret) return res.status(500).json({ error: 'Razorpay secret is not configured' });

      const expected = crypto
        .createHmac('sha256', keySecret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');
      if (expected !== razorpay_signature) {
        return res.status(400).json({ error: 'Payment signature verification failed' });
      }
      if (row.gateway_order_id && row.gateway_order_id !== razorpay_order_id) {
        return res.status(409).json({ error: 'Order ID mismatch for this payment attempt' });
      }

      const payment = await fetchPaymentForMerchant(merchantAuth, razorpay_payment_id);

      await pool.query(
        `UPDATE public.order_payments
           SET status = CASE WHEN $2 = 'captured' THEN 'paid' ELSE 'authorized' END,
               gateway_order_id = COALESCE(gateway_order_id, $1),
               gateway_payment_id = $3,
               gateway_signature = $4,
               authorized_at = CASE WHEN $2 IN ('authorized', 'captured') THEN now() ELSE authorized_at END,
               paid_at = CASE WHEN $2 = 'captured' THEN now() ELSE paid_at END,
               metadata = metadata || $5::jsonb
         WHERE id = $6`,
        [
          razorpay_order_id,
          payment.status || 'authorized',
          razorpay_payment_id,
          razorpay_signature,
          JSON.stringify({ verified_payment: payment }),
          row.payment_id,
        ]
      );

      const status = payment.status === 'captured' ? 'paid' : 'authorized';
      await pool.query(
        `UPDATE public.orders
           SET payment_status = $2,
               paid_at = CASE WHEN $2 = 'paid' THEN now() ELSE paid_at END
         WHERE id = $1`,
        [orderId, status]
      );

      return res.json({
        success: true,
        payment_status: status,
        payment_method: 'online',
      });
    } catch (err) {
      console.error('POST verify-online-payment:', err);
      return res.status(500).json({ error: err.message || 'Payment verification failed' });
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
