import pool from '../db.js';
import {
  createAdhocOrder,
  cancelOrder,
  trackShipment,
  checkHyperlocalServiceability,
  assignAwb,
} from './client.js';
import { getConnection, withValidToken } from './auth.js';
import { mergeSettings, mapShiprocketStatus, deliveryStatusForOrder } from './status-mapper.js';
import { logShiprocketAction } from './audit.js';
import {
  extractCouriers,
  pickQuickCourier,
  courierIdFrom,
  QUICK_SHIPPING_METHOD,
  FOOD_ORDER_TYPE,
  extractRiderDetails,
} from './hyperlocal.js';

async function resolveQuickCoords(client, order, outletId, settings) {
  const deliveryLat = Number(order.delivery_latitude);
  const deliveryLng = Number(order.delivery_longitude);
  if (!Number.isFinite(deliveryLat) || !Number.isFinite(deliveryLng)) {
    throw new Error(
      'Delivery order missing map pin. Customer must set delivery location on checkout.'
    );
  }

  const { rows } = await client.query(
    `SELECT latitude, longitude FROM public.outlets WHERE id = $1`,
    [outletId]
  );
  const outlet = rows[0];
  const pickup = settings.pickup_address || {};
  const pickupLat = Number(pickup.latitude ?? outlet?.latitude);
  const pickupLng = Number(pickup.longitude ?? outlet?.longitude);
  if (!Number.isFinite(pickupLat) || !Number.isFinite(pickupLng)) {
    throw new Error(
      'Restaurant pickup GPS is not set. Open Outlets → your outlet → set location on the map.'
    );
  }

  const pickupPincode = pickup.pincode?.trim();
  const deliveryPincode = order.delivery_pincode?.trim();
  if (!pickupPincode || !deliveryPincode) {
    throw new Error('Pickup and delivery pincodes are required for Shiprocket Quick.');
  }

  return {
    deliveryLat,
    deliveryLng,
    pickupLat,
    pickupLng,
    pickupPincode,
    deliveryPincode,
  };
}

function buildQuickHyperlocalPayload(order, items, settings, coords) {
  const pickup = settings.pickup_address || {};
  const isCod =
    settings.cod_enabled &&
    (order.payment_method === 'cod' || order.payment_status !== 'paid');

  const pincode = order.delivery_pincode?.trim();
  const city = order.delivery_city?.trim();
  const state = order.delivery_state?.trim();
  const address = order.delivery_address?.trim();
  if (!pincode || !city || !state) {
    throw new Error('Delivery order missing pincode, city, or state');
  }
  if (!address) {
    throw new Error('Delivery order missing shipping address details.');
  }

  const dims = settings.dimensions || {};
  const weight = Math.min(Math.max(Number(settings.default_weight_kg) || 0.5, 0.5), 5);
  const phone = (order.customer_phone || pickup.phone || '9999999999')
    .replace(/\D/g, '')
    .slice(-10);

  return {
    order_id: order.order_number,
    order_date: new Date(order.created_at).toISOString().slice(0, 19).replace('T', ' '),
    pickup_location: settings.pickup_location_name || 'Primary',
    order_type: settings.order_type_category || FOOD_ORDER_TYPE,
    checkout_shipping_method: settings.checkout_shipping_method || QUICK_SHIPPING_METHOD,
    comment: 'Restaurant food delivery — Shiprocket Quick 2-wheeler',
    billing_customer_name: order.customer_name || 'Customer',
    billing_last_name: '',
    billing_address: order.delivery_address || '',
    billing_city: city,
    billing_pincode: pincode,
    billing_state: state,
    billing_country: 'India',
    billing_email: 'customer@banaoo.in',
    billing_phone: phone,
    shipping_is_billing: true,
    latitude: coords.deliveryLat,
    longitude: coords.deliveryLng,
    order_items: items.map((it) => ({
      name: it.item_name,
      sku: it.menu_item_id || it.id,
      units: it.quantity,
      selling_price: Number(it.unit_price) || 0,
      discount: 0,
      tax: 0,
      hsn: '',
    })),
    payment_method: isCod ? 'COD' : 'Prepaid',
    sub_total: Number(order.subtotal ?? order.total) || 0,
    length: Number(dims.length) || 20,
    breadth: Number(dims.width) || 20,
    height: Number(dims.height) || 10,
    weight,
  };
}

export async function scheduleShipmentBooking(orderId, outletId) {
  const conn = await getConnection(outletId);
  if (!conn?.is_connected) return null;
  const settings = mergeSettings(conn.settings);
  if (!settings.auto_delivery_enabled) return null;

  const prepMs = (Number(settings.prep_time_minutes) || 15) * 60 * 1000;
  const scheduledAt = new Date(Date.now() + prepMs);

  const { rows } = await pool.query(
    `INSERT INTO public.shiprocket_shipments (order_id, outlet_id, status, booking_scheduled_at)
     VALUES ($1, $2, 'booking', $3)
     ON CONFLICT (order_id) DO UPDATE SET
       status = CASE
         WHEN shiprocket_shipments.status IN ('delivered', 'cancelled') THEN shiprocket_shipments.status
         ELSE 'booking'
       END,
       booking_scheduled_at = EXCLUDED.booking_scheduled_at,
       updated_at = now()
     RETURNING *`,
    [orderId, outletId, scheduledAt.toISOString()]
  );
  return rows[0];
}

export async function bookShipment(shipmentRow) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: locked } = await client.query(
      `SELECT s.* FROM public.shiprocket_shipments s
       WHERE s.id = $1
       FOR UPDATE`,
      [shipmentRow.id]
    );
    const ship = locked[0];
    if (!ship || ['delivered', 'cancelled', 'shipment_created', 'awaiting_rider', 'rider_assigned', 'picked_up', 'out_for_delivery'].includes(ship.status)) {
      await client.query('COMMIT');
      return ship;
    }

    const { rows: orders } = await client.query(
      `SELECT * FROM public.orders WHERE id = $1`,
      [ship.order_id]
    );
    const order = orders[0];
    if (!order || order.order_type !== 'delivery') {
      await client.query('COMMIT');
      return ship;
    }

    const { rows: items } = await client.query(
      `SELECT id, menu_item_id, item_name, quantity, unit_price FROM public.order_items WHERE order_id = $1`,
      [ship.order_id]
    );

    const conn = await getConnection(ship.outlet_id);
    const settings = mergeSettings(conn?.settings);
    const coords = await resolveQuickCoords(client, order, ship.outlet_id, settings);
    const payload = buildQuickHyperlocalPayload(order, items, settings, coords);
    const isCod = payload.payment_method === 'COD';

    console.log('[shiprocket] preCheck coordinates & params:', {
      pickup_postcode: coords.pickupPincode,
      delivery_postcode: coords.deliveryPincode,
      cod: isCod,
      weight: payload.weight,
      lat_from: coords.pickupLat,
      long_from: coords.pickupLng,
      lat_to: coords.deliveryLat,
      long_to: coords.deliveryLng,
    });

    const preCheck = await withValidToken(ship.outlet_id, (token) =>
      checkHyperlocalServiceability(token, {
        pickup_postcode: coords.pickupPincode,
        delivery_postcode: coords.deliveryPincode,
        cod: isCod,
        weight: payload.weight,
        lat_from: coords.pickupLat,
        long_from: coords.pickupLng,
        lat_to: coords.deliveryLat,
        long_to: coords.deliveryLng,
      })
    );

    console.log('[shiprocket] preCheck serviceability response:', JSON.stringify(preCheck, null, 2));

    const preCouriers = extractCouriers(preCheck);
    if (!preCouriers.length) {
      throw new Error(
        'Shiprocket Quick is not available for this route. Check city service area and GPS pins.'
      );
    }

    const response = await withValidToken(ship.outlet_id, (token) =>
      createAdhocOrder(token, payload)
    );

    console.log('[shiprocket] createAdhocOrder raw response:', JSON.stringify(response, null, 2));

    const srOrderId = response.order_id ?? response.shipment_id ?? response.data?.order_id ?? response.data?.shipment_id;
    const shipmentId = response.shipment_id ?? response.order_id ?? response.data?.shipment_id ?? response.data?.order_id;
    if (!srOrderId || !shipmentId) {
      const errMsg = response.message || response.error || (typeof response.errors === 'string' ? response.errors : null);
      throw new Error(errMsg || 'Shiprocket did not return order/shipment id for Quick booking');
    }

    const serviceability = await withValidToken(ship.outlet_id, (token) =>
      checkHyperlocalServiceability(token, {
        pickup_postcode: coords.pickupPincode,
        delivery_postcode: coords.deliveryPincode,
        order_id: srOrderId,
        cod: isCod,
        weight: payload.weight,
        lat_from: coords.pickupLat,
        long_from: coords.pickupLng,
        lat_to: coords.deliveryLat,
        long_to: coords.deliveryLng,
      })
    );
    const couriers = extractCouriers(serviceability);
    console.log('[shiprocket] preCouriers list:', preCouriers);
    console.log('[shiprocket] serviceability couriers list:', couriers);
    const selectedCourier = pickQuickCourier(couriers.length ? couriers : preCouriers);
    console.log('[shiprocket] selectedCourier:', selectedCourier);
    const courierId = courierIdFrom(selectedCourier);
    console.log('[shiprocket] courierId resolved:', courierId);
    if (!courierId) {
      const debugInfo = {
        has_couriers: couriers.length,
        has_preCouriers: preCouriers.length,
        selected_courier_keys: selectedCourier ? Object.keys(selectedCourier) : null,
        selected_courier_val: selectedCourier ? selectedCourier : null,
      };
      throw new Error(`No Shiprocket Quick 2-wheeler courier available for this order. Debug info: ${JSON.stringify(debugInfo)}`);
    }

    let assignRes = null;
    try {
      assignRes = await withValidToken(ship.outlet_id, (token) =>
        assignAwb(token, {
          shipment_id: shipmentId,
          courier_id: courierId,
        })
      );
    } catch (assignErr) {
      throw new Error(
        assignErr.message || 'Failed to assign Shiprocket Quick rider'
      );
    }

    const awb =
      assignRes?.awb_code ||
      assignRes?.response?.data?.awb_code ||
      assignRes?.data?.awb_code ||
      response.awb_code ||
      response.awb ||
      response.data?.awb_code ||
      response.data?.awb ||
      null;
    const courierName =
      assignRes?.courier_name ||
      selectedCourier?.courier_name ||
      response.courier_name ||
      'Shiprocket Quick';

    await client.query(
      `UPDATE public.shiprocket_shipments SET
         shiprocket_order_id = $2,
         shipment_id = $3,
         awb_code = $4,
         courier_name = $5,
         tracking_url = $6,
         status = 'awaiting_rider',
         booked_at = now(),
         last_error = NULL,
         raw_create_response = $7,
         updated_at = now()
       WHERE id = $1`,
      [
        ship.id,
        String(srOrderId),
        String(shipmentId),
        awb,
        courierName,
        awb ? `https://shiprocket.co/tracking/${awb}` : null,
        JSON.stringify({ create: response, assign: assignRes, courier_id: courierId }),
      ]
    );

    await client.query(
      `UPDATE public.orders SET delivery_status = $2 WHERE id = $1`,
      [ship.order_id, deliveryStatusForOrder('awaiting_rider')]
    );

    await client.query(
      `INSERT INTO public.shiprocket_tracking_events (shipment_id, event_code, event_message, raw)
       VALUES ($1, 'created', 'Shipment created in Shiprocket', $2)`,
      [ship.id, JSON.stringify(response)]
    );

    await client.query('COMMIT');

    await logShiprocketAction({
      outletId: ship.outlet_id,
      orderId: ship.order_id,
      action: 'shipment.create',
      metadata: {
        shipment_id: shipmentId,
        awb,
        mode: 'quick_hyperlocal',
        courier_id: courierId,
      },
    });

    return { ...ship, status: 'awaiting_rider', shipment_id: shipmentId };
  } catch (err) {
    await client.query('ROLLBACK');

    const conn = await getConnection(shipmentRow.outlet_id);
    const settings = mergeSettings(conn?.settings);
    const retryCount = (shipmentRow.retry_count || 0) + 1;
    const maxRetries = Number(settings.retry_max_attempts) || 3;
    const retryInterval = (Number(settings.retry_interval_seconds) || 120) * 1000;
    const nextRetry =
      retryCount < maxRetries ? new Date(Date.now() + retryInterval) : null;

    await pool.query(
      `UPDATE public.shiprocket_shipments SET
         status = 'booking_failed',
         last_error = $2,
         retry_count = $3,
         next_retry_at = $4,
         updated_at = now()
       WHERE id = $1`,
      [shipmentRow.id, err.message, retryCount, nextRetry?.toISOString() ?? null]
    );

    await pool.query(
      `UPDATE public.orders SET delivery_status = 'failed' WHERE id = $1`,
      [shipmentRow.order_id]
    );

    await logShiprocketAction({
      outletId: shipmentRow.outlet_id,
      orderId: shipmentRow.order_id,
      action: 'shipment.failed',
      metadata: { error: err.message, retry_count: retryCount },
    });

    throw err;
  } finally {
    client.release();
  }
}

export async function retryShipmentBooking(orderId, outletId) {
  const { rows } = await pool.query(
    `UPDATE public.shiprocket_shipments SET
       status = 'booking',
       booking_scheduled_at = now(),
       next_retry_at = NULL,
       updated_at = now()
     WHERE order_id = $1 AND outlet_id = $2
     RETURNING *`,
    [orderId, outletId]
  );
  if (!rows[0]) throw new Error('Shipment not found');
  return bookShipment(rows[0]);
}

const SHIPPED_STATUSES = [
  'shipment_created',
  'awaiting_rider',
  'rider_assigned',
  'picked_up',
  'out_for_delivery',
  'delivered',
];

export async function confirmAndShipOrder(orderId, outletId) {
  const conn = await getConnection(outletId);
  if (!conn?.is_connected) {
    throw new Error('Connect Shiprocket in Settings → Delivery before shipping orders.');
  }

  const { rows: orderRows } = await pool.query(
    `SELECT * FROM public.orders WHERE id = $1 AND outlet_id = $2`,
    [orderId, outletId]
  );
  const order = orderRows[0];
  if (!order) throw new Error('Order not found');
  if (order.order_type !== 'delivery') {
    throw new Error('Only delivery orders can be shipped with Shiprocket.');
  }
  if (['swiggy', 'zomato'].includes(order.source)) {
    throw new Error('Aggregator orders use platform delivery.');
  }
  if (['paid', 'cancelled'].includes(order.status)) {
    throw new Error('Cannot ship a paid or cancelled order.');
  }

  if (['pending', 'preparing'].includes(order.status)) {
    await pool.query(`UPDATE public.orders SET status = 'ready', updated_at = now() WHERE id = $1`, [
      orderId,
    ]);
    await pool.query(
      `UPDATE public.order_items SET status = 'ready'
       WHERE order_id = $1 AND status IN ('pending', 'preparing')`,
      [orderId]
    );
  }

  const { rows: existing } = await pool.query(
    `SELECT * FROM public.shiprocket_shipments WHERE order_id = $1 LIMIT 1`,
    [orderId]
  );
  let ship = existing[0];
  if (ship && SHIPPED_STATUSES.includes(ship.status)) {
    return { shipment: ship, order_status: 'ready', already_booked: true };
  }

  if (!ship) {
    const { rows } = await pool.query(
      `INSERT INTO public.shiprocket_shipments (order_id, outlet_id, status, booking_scheduled_at)
       VALUES ($1, $2, 'booking', now())
       ON CONFLICT (order_id) DO UPDATE SET
         status = CASE
           WHEN shiprocket_shipments.status IN ('delivered', 'cancelled') THEN shiprocket_shipments.status
           ELSE 'booking'
         END,
         booking_scheduled_at = now(),
         updated_at = now()
       RETURNING *`,
      [orderId, outletId]
    );
    ship = rows[0];
  } else {
    const { rows } = await pool.query(
      `UPDATE public.shiprocket_shipments SET
         status = 'booking',
         booking_scheduled_at = now(),
         last_error = NULL,
         updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [ship.id]
    );
    ship = rows[0];
  }

  const booked = await bookShipment(ship);
  return { shipment: booked, order_status: 'ready', already_booked: false };
}

export async function cancelShipment(orderId, outletId) {
  const { rows } = await pool.query(
    `SELECT * FROM public.shiprocket_shipments WHERE order_id = $1 AND outlet_id = $2`,
    [orderId, outletId]
  );
  const ship = rows[0];
  if (!ship) throw new Error('Shipment not found');

  if (ship.shiprocket_order_id) {
    try {
      await withValidToken(outletId, (token) =>
        cancelOrder(token, [Number(ship.shiprocket_order_id)])
      );
    } catch (err) {
      console.warn('[shiprocket] cancel API:', err.message);
    }
  }

  await pool.query(
    `UPDATE public.shiprocket_shipments SET status = 'cancelled', updated_at = now() WHERE id = $1`,
    [ship.id]
  );
  await pool.query(`UPDATE public.orders SET delivery_status = 'cancelled' WHERE id = $1`, [orderId]);

  await logShiprocketAction({
    outletId,
    orderId,
    action: 'shipment.cancel',
    metadata: { shipment_id: ship.shipment_id },
  });

  return { success: true };
}

export async function triggerRiderAssignedNotification(
  outletId,
  orderId,
  orderNumber,
  customerPhone,
  rider,
  trackingUrl
) {
  try {
    const { rows: outletRows } = await pool.query(
      `SELECT owner_id FROM public.outlets WHERE id = $1`,
      [outletId]
    );
    const ownerId = outletRows[0]?.owner_id;
    if (ownerId) {
      const title = `Rider Assigned - Order #${orderNumber}`;
      const message = `Rider ${rider.rider_name || 'assigned'} (${rider.rider_phone || 'no phone'}) is heading to the outlet. Vehicle: ${rider.rider_vehicle || 'N/A'}`;
      await pool.query(
        `INSERT INTO public.notifications (user_id, type, title, message, action_url)
         VALUES ($1, 'delivery', $2, $3, '/orders')`,
        [ownerId, title, message]
      );
    }

    if (customerPhone) {
      console.log(
        `[SMS Notification] To: ${customerPhone} | Message: Rider ${
          rider.rider_name || ''
        } (${rider.rider_phone || ''}) is assigned to your order #${orderNumber}. Track live: ${trackingUrl}`
      );
    }
  } catch (err) {
    console.error('[shiprocket] notification trigger failed:', err.message);
  }
}

export async function syncShipmentTracking(shipmentRow) {
  if (!shipmentRow.shipment_id) return shipmentRow;
  const data = await withValidToken(shipmentRow.outlet_id, (token) =>
    trackShipment(token, shipmentRow.shipment_id)
  );

  const trackData = data?.tracking_data || {};
  const activities = trackData.shipment_track_activities || data?.data || [];
  const latest = Array.isArray(activities) ? activities[activities.length - 1] : null;
  const rawStatus =
    latest?.['sr-status'] ||
    latest?.status ||
    trackData?.shipment_track?.[0]?.current_status ||
    data?.current_status;
  const mapped = mapShiprocketStatus(rawStatus) || shipmentRow.status;

  const rider = extractRiderDetails(data);

  const snapshot = {
    activities: (Array.isArray(activities) ? activities : []).map((a) => ({
      activity: a.activity || a['sr-status-label'] || a['sr-status'] || '',
      location: a.location || '',
      date: a.date || '',
    })),
    current_status: rawStatus || null,
    courier_agent: data?.courier_agent_details || trackData?.courier_agent_details || null,
    fetched_at: new Date().toISOString(),
  };

  const trackUrl =
    shipmentRow.tracking_url ||
    (shipmentRow.awb_code ? `https://shiprocket.co/tracking/${shipmentRow.awb_code}` : null);

  // Check if anything has changed (Avoid unnecessary database writes)
  const isStatusChanged = mapped !== shipmentRow.status;
  const isRiderChanged =
    rider.rider_name !== shipmentRow.rider_name ||
    rider.rider_phone !== shipmentRow.rider_phone ||
    rider.rider_vehicle !== shipmentRow.rider_vehicle ||
    rider.rider_id !== shipmentRow.rider_id;
  const isSnapshotChanged =
    JSON.stringify(snapshot.activities) !==
    JSON.stringify(shipmentRow.last_track_snapshot?.activities || []);

  if (!isStatusChanged && !isRiderChanged && !isSnapshotChanged) {
    return shipmentRow;
  }

  // Handle first-time rider assignment
  let riderAssignedAt = shipmentRow.rider_assigned_at;
  let triggerNotification = false;
  if (mapped === 'rider_assigned' && shipmentRow.status !== 'rider_assigned') {
    if (!riderAssignedAt) {
      riderAssignedAt = new Date().toISOString();
      triggerNotification = true;
    }
  }

  await pool.query(
    `UPDATE public.shiprocket_shipments SET
       last_track_snapshot = $2,
       tracking_url = COALESCE(tracking_url, $3),
       status = $4,
       rider_name = $5,
       rider_phone = $6,
       rider_vehicle = $7,
       rider_id = $8,
       rider_assigned_at = $9,
       updated_at = now(),
       delivered_at = CASE WHEN $4 = 'delivered' THEN now() ELSE delivered_at END
     WHERE id = $1`,
    [
      shipmentRow.id,
      JSON.stringify(snapshot),
      trackUrl,
      mapped,
      rider.rider_name,
      rider.rider_phone,
      rider.rider_vehicle,
      rider.rider_id,
      riderAssignedAt,
    ]
  );

  if (isStatusChanged) {
    await pool.query(
      `UPDATE public.orders SET delivery_status = $2 WHERE id = $1`,
      [shipmentRow.order_id, deliveryStatusForOrder(mapped)]
    );
    await pool.query(
      `INSERT INTO public.shiprocket_tracking_events (shipment_id, event_code, event_message, raw)
       VALUES ($1, $2, $3, $4)`,
      [
        shipmentRow.id,
        rawStatus || mapped,
        latest?.activity || 'Status update',
        JSON.stringify(data),
      ]
    );
  }

  if (triggerNotification) {
    // Fetch order details for notifications
    const { rows: orderRows } = await pool.query(
      `SELECT order_number, customer_phone FROM public.orders WHERE id = $1`,
      [shipmentRow.order_id]
    );
    const order = orderRows[0];
    if (order) {
      await triggerRiderAssignedNotification(
        shipmentRow.outlet_id,
        shipmentRow.order_id,
        order.order_number,
        order.customer_phone,
        rider,
        trackUrl
      );
    }
  }

  return {
    ...shipmentRow,
    status: mapped,
    last_track_snapshot: snapshot,
    tracking_url: trackUrl,
    rider_name: rider.rider_name,
    rider_phone: rider.rider_phone,
    rider_vehicle: rider.rider_vehicle,
    rider_id: rider.rider_id,
    rider_assigned_at: riderAssignedAt,
  };
}

export async function getShipmentDetails(orderId) {
  const { rows } = await pool.query(
    `SELECT s.*, o.order_number, o.customer_name, o.delivery_address
     FROM public.shiprocket_shipments s
     JOIN public.orders o ON o.id = s.order_id
     WHERE s.order_id = $1
     LIMIT 1`,
    [orderId]
  );
  if (!rows[0]) return null;

  const { rows: events } = await pool.query(
    `SELECT event_code, event_message, occurred_at
     FROM public.shiprocket_tracking_events
     WHERE shipment_id = $1
     ORDER BY occurred_at ASC`,
    [rows[0].id]
  );

  return { shipment: rows[0], events };
}

export async function onOrderStatusChange(orderId, oldStatus, newStatus) {
  if (oldStatus === newStatus) return;

  const { rows } = await pool.query(
    `SELECT o.*, out.owner_id FROM public.orders o
     JOIN public.outlets out ON out.id = o.outlet_id
     WHERE o.id = $1`,
    [orderId]
  );
  const order = rows[0];
  if (!order) return;
  if (order.order_type !== 'delivery') return;
  if (['swiggy', 'zomato'].includes(order.source)) return;

  if (newStatus === 'preparing') {
    return scheduleShipmentBooking(orderId, order.outlet_id);
  }

  if (newStatus === 'ready') {
    try {
      const { rows: shipments } = await pool.query(
        `SELECT * FROM public.shiprocket_shipments WHERE order_id = $1 LIMIT 1`,
        [orderId]
      );
      let ship = shipments[0];
      if (!ship) {
        ship = await scheduleShipmentBooking(orderId, order.outlet_id);
      }
      if (ship && ['booking', 'booking_failed'].includes(ship.status)) {
        await pool.query(
          `UPDATE public.shiprocket_shipments SET
             status = 'booking',
             booking_scheduled_at = now(),
             updated_at = now()
           WHERE id = $1`,
          [ship.id]
        );
        // Call bookShipment asynchronously so it doesn't block the status patch response
        void bookShipment({ ...ship, status: 'booking', booking_scheduled_at: new Date().toISOString() })
          .catch(err => console.error('[shiprocket] auto-book on ready failed:', orderId, err.message));
      }
    } catch (err) {
      console.warn('[shiprocket] failed to auto-book on ready status:', err.message);
    }
  }
}
