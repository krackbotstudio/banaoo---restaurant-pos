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

/** Customer completed Razorpay checkout — treat as paid for restaurant order fulfillment. */
export function orderPaymentStatusFromGateway(gatewayStatus) {
  const s = String(gatewayStatus || '').toLowerCase();
  if (s === 'captured' || s === 'paid') return 'paid';
  if (s === 'authorized') return 'paid';
  if (s === 'failed') return 'failed';
  return 'authorized';
}

function orderPaymentRecordStatusFromGateway(gatewayStatus) {
  const s = String(gatewayStatus || '').toLowerCase();
  if (s === 'captured' || s === 'paid') return 'paid';
  if (s === 'authorized') return 'authorized';
  if (s === 'failed') return 'failed';
  return 'pending';
}

export async function applyOnlinePaymentToOrder({
  orderId,
  outletId,
  amount,
  gatewayOrderId,
  gatewayPaymentId,
  gatewaySignature,
  gatewayStatus,
  metadata = {},
}) {
  const orderStatus = orderPaymentStatusFromGateway(gatewayStatus);
  const recordStatus = orderPaymentRecordStatusFromGateway(gatewayStatus);
  const isPaid = orderStatus === 'paid';

  await pool.query(
    `UPDATE public.orders
       SET payment_status = $2,
           payment_method = 'online',
           payment_gateway = COALESCE(payment_gateway, 'razorpay'),
           paid_at = CASE WHEN $2 = 'paid' AND paid_at IS NULL THEN now() ELSE paid_at END,
           updated_at = now()
     WHERE id = $1`,
    [orderId, orderStatus]
  );

  const { rows: existingPayments } = await pool.query(
    `SELECT id FROM public.order_payments WHERE order_id = $1 LIMIT 1`,
    [orderId]
  );

  if (existingPayments[0]) {
    await pool.query(
      `UPDATE public.order_payments
         SET status = $2,
             method = 'online',
             gateway = COALESCE(gateway, 'razorpay'),
             gateway_order_id = COALESCE(gateway_order_id, $3),
             gateway_payment_id = COALESCE($4, gateway_payment_id),
             gateway_signature = COALESCE($5, gateway_signature),
             authorized_at = CASE WHEN $2 IN ('authorized', 'paid') AND authorized_at IS NULL THEN now() ELSE authorized_at END,
             paid_at = CASE WHEN $2 = 'paid' AND paid_at IS NULL THEN now() ELSE paid_at END,
             metadata = COALESCE(metadata, '{}'::jsonb) || $6::jsonb,
             updated_at = now()
       WHERE id = $1`,
      [
        existingPayments[0].id,
        recordStatus,
        gatewayOrderId,
        gatewayPaymentId,
        gatewaySignature,
        JSON.stringify(metadata),
      ]
    );
  } else {
    await pool.query(
      `INSERT INTO public.order_payments (
         order_id, outlet_id, amount, method, status, gateway, currency,
         gateway_order_id, gateway_payment_id, gateway_signature,
         authorized_at, paid_at, metadata
       ) VALUES ($1,$2,$3,'online',$4,'razorpay','INR',$5,$6,$7,
         CASE WHEN $4 IN ('authorized', 'paid') THEN now() ELSE NULL END,
         CASE WHEN $4 = 'paid' THEN now() ELSE NULL END,
         $8)`,
      [
        orderId,
        outletId,
        amount,
        recordStatus,
        gatewayOrderId,
        gatewayPaymentId,
        gatewaySignature,
        JSON.stringify(metadata),
      ]
    );
  }

  return { payment_status: orderStatus, is_paid: isPaid };
}

export function registerCustomerOrderRoutes(app, { requireAuth }) {
  /** Public outlet card for customer ordering links (bypasses Supabase RLS). */
  app.get('/api/public/outlets/:outletId', async (req, res) => {
    const { outletId } = req.params;
    try {
      const { rows } = await pool.query(
        `SELECT o.id, o.name, o.address, o.phone, o.opening_time, o.closing_time,
                o.latitude, o.longitude,
                p.logo_url, p.brand_color, p.brand_name
         FROM public.outlets o
         JOIN public.profiles p ON p.user_id = o.owner_id
         WHERE o.id = $1 AND o.is_active = true`,
        [outletId]
      );
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Outlet not found or unavailable' });
      }
      const o = rows[0];
      res.json({
        id: o.id,
        name: o.name,
        address: o.address,
        phone: o.phone,
        opening_time: o.opening_time,
        closing_time: o.closing_time,
        latitude: o.latitude != null ? Number(o.latitude) : null,
        longitude: o.longitude != null ? Number(o.longitude) : null,
        branding: {
          logo_url: o.logo_url,
          brand_color: o.brand_color,
          brand_name: o.brand_name,
        },
      });
    } catch (err) {
      console.error('GET public outlet:', err);
      res.status(500).json({ error: err.message });
    }
  });

  /** Public menu for customer ordering (categories + available items). */
  app.get('/api/public/outlets/:outletId/menu', async (req, res) => {
    const { outletId } = req.params;
    try {
      const { rows: outlets } = await pool.query(
        `SELECT id FROM public.outlets WHERE id = $1 AND is_active = true`,
        [outletId]
      );
      if (outlets.length === 0) {
        return res.status(404).json({ error: 'Outlet not found or unavailable' });
      }

      const [{ rows: categories }, { rows: items }] = await Promise.all([
        pool.query(
          `SELECT id, name, sort_order
           FROM public.menu_categories
           WHERE outlet_id = $1 AND is_active = true
           ORDER BY sort_order ASC NULLS LAST, name ASC`,
          [outletId]
        ),
        pool.query(
          `SELECT id, name, description, base_price, image_url, is_veg, is_available,
                  category_id, prep_time_mins, is_special, special_label, offer_label, offer_price,
                  schedule_enabled, availability_schedule
           FROM public.menu_items
           WHERE outlet_id = $1 AND is_available = true
           ORDER BY name ASC`,
          [outletId]
        ),
      ]);

      res.json({
        categories,
        items: items.map((it) => ({
          ...it,
          base_price: Number(it.base_price),
          offer_price: it.offer_price != null ? Number(it.offer_price) : null,
        })),
      });
    } catch (err) {
      console.error('GET public menu:', err);
      res.status(500).json({ error: err.message });
    }
  });

  /** Public brand + outlets by ordering slug. */
  app.get('/api/public/brands/:slug', async (req, res) => {
    const slug = req.params.slug?.trim();
    if (!slug) return res.status(400).json({ error: 'Slug required' });
    try {
      const { rows: profiles } = await pool.query(
        `SELECT user_id, brand_name, full_name, ordering_slug, business_type, logo_url, brand_color
         FROM public.profiles
         WHERE ordering_slug = $1
         LIMIT 1`,
        [slug]
      );
      if (profiles.length === 0) {
        return res.status(404).json({ error: 'Brand not found' });
      }
      const brand = profiles[0];
      const { rows: outlets } = await pool.query(
        `SELECT id, name, address, phone, opening_time, closing_time, latitude, longitude
         FROM public.outlets
         WHERE owner_id = $1 AND is_active = true
         ORDER BY created_at ASC NULLS LAST, name ASC`,
        [brand.user_id]
      );
      res.json({
        brand,
        outlets: outlets.map((o) => ({
          ...o,
          latitude: o.latitude != null ? Number(o.latitude) : null,
          longitude: o.longitude != null ? Number(o.longitude) : null,
        })),
      });
    } catch (err) {
      console.error('GET public brand:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/public/outlets/:outletId/payment-settings', async (req, res) => {
    const { outletId } = req.params;
    try {
      const { rows: outlets } = await pool.query(
        `SELECT o.id, o.name, o.is_active, o.upi_vpa, o.upi_display_name, o.upi_qr_url, o.online_payments_enabled,
                o.owner_id,
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

      let razorpayRow = null;
      try {
        const { rows: rz } = await pool.query(
          `SELECT is_connected AS razorpay_connected, account_id AS razorpay_account_id,
                  merchant_key_id AS razorpay_merchant_key_id, connection_mode AS razorpay_connection_mode,
                  merchant_key_secret_enc AS razorpay_merchant_key_secret_enc,
                  access_token_enc AS razorpay_access_token_enc, settings AS razorpay_settings
           FROM public.razorpay_connections
           WHERE owner_id = $1
           LIMIT 1`,
          [o.owner_id]
        );
        razorpayRow = rz[0] || null;
      } catch (rzErr) {
        console.warn('payment-settings razorpay lookup:', rzErr.message);
      }

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
        razorpayRow ? razorpayConnFromRow(razorpayRow) : null
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

      let razorpayRow = null;
      try {
        const { rows: rz } = await client.query(
          `SELECT is_connected AS razorpay_connected, account_id AS razorpay_account_id,
                  merchant_key_id AS razorpay_merchant_key_id, connection_mode AS razorpay_connection_mode,
                  merchant_key_secret_enc AS razorpay_merchant_key_secret_enc,
                  access_token_enc AS razorpay_access_token_enc, settings AS razorpay_settings
           FROM public.razorpay_connections
           WHERE owner_id = $1
           LIMIT 1`,
          [outlet.owner_id]
        );
        razorpayRow = rz[0] || null;
      } catch (rzErr) {
        console.warn('customer-orders razorpay lookup:', rzErr.message);
      }

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
      }, razorpayRow ? razorpayConnFromRow(razorpayRow) : null);

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

      if (payMethod === 'online') {
        const merchantAuth = await getMerchantAuth(outlet.owner_id);
        if (!merchantAuth) throw new Error('Razorpay account is not connected for this restaurant');
        const checkoutKeyId =
          merchantAuth.mode === 'api_keys'
            ? merchantAuth.keyId
            : getCheckoutKeyId(razorpayRow ? razorpayConnFromRow(razorpayRow) : null);
        if (!checkoutKeyId) throw new Error('Razorpay checkout key is not available for this restaurant');

        const sessionId = crypto.randomUUID();

        const rpOrder = await createOrderForMerchant(merchantAuth, {
          amount: Math.round(Number(subtotal) * 100),
          currency: 'INR',
          receipt: orderNumber,
          notes: {
            owner_id: outlet.owner_id,
            restaurant_name: outlet.brand_name || outlet.name,
            outlet_id,
            outlet_name: outlet.name,
            order_id: sessionId,
            order_number: orderNumber,
            customer_name: customer_name.trim(),
          },
        });

        await client.query(
          `INSERT INTO public.checkout_sessions (id, outlet_id, gateway_order_id, payload)
           VALUES ($1, $2, $3, $4)`,
          [
            sessionId,
            outlet_id,
            rpOrder.id,
            JSON.stringify({
              body: req.body,
              order_number: orderNumber,
              subtotal,
              total: subtotal,
              resolved_table_number: resolvedTableNumber,
            }),
          ]
        );

        await client.query('COMMIT');

        return res.json({
          order_id: sessionId,
          order_number: orderNumber,
          total: Number(subtotal),
          payment_method: 'online',
          payment_status: 'created',
          payment_id: null,
          requires_online_payment: true,
          razorpay: {
            order_id: rpOrder.id,
            amount: rpOrder.amount,
            currency: rpOrder.currency,
            key_id: checkoutKeyId,
          },
        });
      }

      // COD flow
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
          'not_required',
          null,
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

      await client.query('COMMIT');

      res.json({
        order_id: order.id,
        order_number: order.order_number,
        total: Number(order.total),
        payment_method: order.payment_method,
        payment_status: order.payment_status,
        payment_id: null,
        requires_online_payment: false,
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
      if (rows.length === 0) {
        const { rows: sessionRows } = await pool.query(
          `SELECT cs.id, cs.outlet_id, cs.gateway_order_id, cs.payload,
                  out.name AS outlet_name, out.upi_vpa AS outlet_upi_vpa, out.upi_display_name, out.upi_qr_url,
                  out.online_payments_enabled AS outlet_online_payments_enabled,
                  p.upi_vpa AS profile_upi_vpa, p.upi_display_name AS profile_upi_display_name,
                  p.upi_qr_url AS profile_upi_qr_url, p.online_payments_enabled AS profile_online_payments_enabled,
                  p.brand_name,
                  rc.is_connected AS razorpay_connected, rc.account_id AS razorpay_account_id,
                  rc.merchant_key_id AS razorpay_merchant_key_id, rc.connection_mode AS razorpay_connection_mode,
                  rc.merchant_key_secret_enc AS razorpay_merchant_key_secret_enc,
                  rc.access_token_enc AS razorpay_access_token_enc, rc.settings AS razorpay_settings
           FROM public.checkout_sessions cs
           JOIN public.outlets out ON out.id = cs.outlet_id
           JOIN public.profiles p ON p.user_id = out.owner_id
           LEFT JOIN public.razorpay_connections rc ON rc.owner_id = out.owner_id
           WHERE cs.id = $1`,
          [orderId]
        );
        if (sessionRows.length === 0) {
          return res.status(404).json({ error: 'Order not found' });
        }
        const sRow = sessionRows[0];
        const sPayload = sRow.payload;
        const settings = resolvePaymentSettings(
          {
            upi_vpa: sRow.outlet_upi_vpa,
            upi_display_name: sRow.upi_display_name,
            upi_qr_url: sRow.upi_qr_url,
            online_payments_enabled: sRow.outlet_online_payments_enabled,
            name: sRow.outlet_name,
          },
          {
            upi_vpa: sRow.profile_upi_vpa,
            upi_display_name: sRow.profile_upi_display_name,
            upi_qr_url: sRow.profile_upi_qr_url,
            online_payments_enabled: sRow.profile_online_payments_enabled,
            brand_name: sRow.brand_name,
          },
          razorpayConnFromRow(sRow)
        );
        const checkoutKeyId = getCheckoutKeyId(razorpayConnFromRow(sRow));
        return res.json({
          order_id: sRow.id,
          order_number: sPayload.order_number,
          total: Number(sPayload.total),
          payment_method: 'online',
          payment_status: 'created',
          payment_id: null,
          payment_record_status: 'created',
          gateway: 'razorpay',
          gateway_order_id: sRow.gateway_order_id,
          gateway_payment_id: null,
          currency: 'INR',
          razorpay_key_id: checkoutKeyId,
          customer_reference: null,
          upi_vpa: settings.upi_vpa,
          ...settings,
        });
      }
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
      // 1. Check if order already exists in database
      const { rows: orderRows } = await pool.query(
        `SELECT o.id, o.payment_status, o.outlet_id, out.owner_id,
                op.id AS payment_id, op.gateway_order_id, op.status AS payment_record_status
         FROM public.orders o
         JOIN public.outlets out ON out.id = o.outlet_id
         LEFT JOIN public.order_payments op ON op.order_id = o.id
         WHERE o.id = $1 AND o.source = 'online' AND o.payment_method = 'online'
         LIMIT 1`,
        [orderId]
      );

      let ownerId = null;
      let existingOrder = orderRows[0];

      if (existingOrder) {
        ownerId = existingOrder.owner_id;
      } else {
        // Query checkout session
        const { rows: sessionRows } = await pool.query(
          `SELECT cs.outlet_id, out.owner_id
           FROM public.checkout_sessions cs
           JOIN public.outlets out ON out.id = cs.outlet_id
           WHERE cs.id = $1`,
          [orderId]
        );
        if (sessionRows.length === 0) {
          return res.status(404).json({ error: 'Order or payment session not found' });
        }
        ownerId = sessionRows[0].owner_id;
      }

      const merchantAuth = await getMerchantAuth(ownerId);
      if (!merchantAuth) return res.status(400).json({ error: 'Razorpay is not connected for this restaurant' });
      const keySecret =
        merchantAuth.mode === 'api_keys'
          ? merchantAuth.keySecret
          : process.env.RAZORPAY_KEY_SECRET;
      if (!keySecret) return res.status(500).json({ error: 'Razorpay secret is not configured' });

      // Verify Razorpay signature
      const expected = crypto
        .createHmac('sha256', keySecret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');
      if (expected !== razorpay_signature) {
        return res.status(400).json({ error: 'Payment signature verification failed' });
      }

      const payment = await fetchPaymentForMerchant(merchantAuth, razorpay_payment_id);
      const gatewayStatus = payment.status || 'authorized';

      if (!existingOrder) {
        const createdOrder = await createOrderFromSession(
          orderId,
          razorpay_payment_id,
          razorpay_signature,
          gatewayStatus
        );
        return res.json({
          success: true,
          payment_status: createdOrder.payment_status,
          payment_method: 'online',
        });
      }

      const { rows: orderMeta } = await pool.query(
        `SELECT o.outlet_id, o.total FROM public.orders o WHERE o.id = $1`,
        [orderId]
      );
      const meta = orderMeta[0];
      const applied = await applyOnlinePaymentToOrder({
        orderId,
        outletId: meta?.outlet_id || existingOrder.outlet_id,
        amount: meta?.total,
        gatewayOrderId: razorpay_order_id,
        gatewayPaymentId: razorpay_payment_id,
        gatewaySignature: razorpay_signature,
        gatewayStatus,
        metadata: { verified_payment: payment },
      });

      return res.json({
        success: true,
        payment_status: applied.payment_status,
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

export async function createOrderFromSession(sessionId, gatewayPaymentId, gatewaySignature, gatewayStatus) {
  const orderPaymentStatus = orderPaymentStatusFromGateway(gatewayStatus);

  const { rows: existing } = await pool.query(
    'SELECT id, order_number, total, payment_method, payment_status, outlet_id FROM public.orders WHERE id = $1 LIMIT 1',
    [sessionId]
  );
  if (existing.length > 0) {
    const row = existing[0];
    if (row.payment_status !== 'paid') {
      const { rows: sess } = await pool.query(
        'SELECT gateway_order_id FROM public.checkout_sessions WHERE id = $1 LIMIT 1',
        [sessionId]
      );
      await applyOnlinePaymentToOrder({
        orderId: row.id,
        outletId: row.outlet_id,
        amount: row.total,
        gatewayOrderId: sess[0]?.gateway_order_id || null,
        gatewayPaymentId,
        gatewaySignature,
        gatewayStatus,
        metadata: { source: 'createOrderFromSession_existing' },
      });
    }
    const { rows: refreshed } = await pool.query(
      'SELECT id, order_number, total, payment_method, payment_status FROM public.orders WHERE id = $1',
      [sessionId]
    );
    return refreshed[0] || row;
  }
  const { rows: sessionRows } = await pool.query(
    'SELECT * FROM public.checkout_sessions WHERE id = $1 LIMIT 1',
    [sessionId]
  );
  const session = sessionRows[0];
  if (!session) {
    throw new Error('Checkout session not found or expired');
  }

  const { body, order_number, subtotal, total, resolved_table_number } = session.payload;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Fetch outlet owner
    const { rows: outletRows } = await client.query(
      'SELECT owner_id, name FROM public.outlets WHERE id = $1 LIMIT 1',
      [session.outlet_id]
    );
    const outlet = outletRows[0];
    if (!outlet) {
      throw new Error('Outlet not found');
    }

    // Create the order
    const deliveryLat = body.order_type === 'delivery' ? Number(body.delivery_latitude) : null;
    const deliveryLng = body.order_type === 'delivery' ? Number(body.delivery_longitude) : null;

    const { rows: orderRows } = await client.query(
      `INSERT INTO public.orders (
        id, outlet_id, order_number, order_type, table_number, table_id, delivery_address,
        delivery_pincode, delivery_city, delivery_state,
        delivery_latitude, delivery_longitude,
        subtotal, total, notes, status, source, customer_name, customer_phone,
        payment_method, payment_status, payment_gateway
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'pending','online',$16,$17,'online',$18,'razorpay')
      RETURNING id, order_number, total, payment_method, payment_status`,
      [
        sessionId,
        session.outlet_id,
        order_number,
        body.order_type,
        resolved_table_number,
        body.order_type === 'dine_in' ? body.table_id || null : null,
        body.order_type === 'delivery' ? body.delivery_address.trim() : null,
        body.order_type === 'delivery' ? body.delivery_pincode.trim() : null,
        body.order_type === 'delivery' ? body.delivery_city.trim() : null,
        body.order_type === 'delivery' ? body.delivery_state.trim() : null,
        deliveryLat,
        deliveryLng,
        subtotal,
        total,
        body.notes?.trim() || null,
        body.customer_name.trim(),
        body.customer_phone?.trim() || null,
        orderPaymentStatus,
      ]
    );
    const order = orderRows[0];

    // Insert order items
    for (const it of body.items) {
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

    await client.query(
      `INSERT INTO public.order_payments (
        order_id, outlet_id, amount, method, status, gateway, currency,
        gateway_order_id, gateway_payment_id, gateway_signature, authorized_at, paid_at, metadata
      ) VALUES ($1,$2,$3,'online',$4,'razorpay','INR',$5,$6,$7,
        CASE WHEN $4 IN ('authorized', 'paid') THEN now() ELSE null END,
        CASE WHEN $4 = 'paid' THEN now() ELSE null END,
        $8
      )`,
      [
        order.id,
        session.outlet_id,
        subtotal,
        orderPaymentRecordStatusFromGateway(gatewayStatus),
        session.gateway_order_id,
        gatewayPaymentId,
        gatewaySignature,
        JSON.stringify({
          owner_id: outlet.owner_id,
          outlet_id: session.outlet_id,
          outlet_name: outlet.name,
          order_id: order.id,
          order_number: order.order_number,
          customer_name: body.customer_name.trim(),
        }),
      ]
    );

    if (orderPaymentStatus === 'paid') {
      await client.query(`UPDATE public.orders SET paid_at = now() WHERE id = $1`, [order.id]);
    }

    // Delete the checkout session
    await client.query(
      'DELETE FROM public.checkout_sessions WHERE id = $1',
      [sessionId]
    );

    await client.query('COMMIT');
    return order;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
