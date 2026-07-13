/** Map Shiprocket / webhook status strings to Banaoo shipment status */
const SR_TO_BANAOO = {
  NEW: 'shipment_created',
  AWB_ASSIGNED: 'awaiting_rider',
  'RIDER ASSIGNED': 'rider_assigned',
  'RIDER_ASSIGNED': 'rider_assigned',
  'RIDER ALLOCATED': 'rider_assigned',
  'COURIER ASSIGNED': 'rider_assigned',
  'AGENT ASSIGNED': 'rider_assigned',
  'PICKUP SCHEDULED': 'awaiting_rider',
  'PICKUP GENERATED': 'awaiting_rider',
  'PICKUP QUEUED': 'awaiting_rider',
  'PICKUP ERROR': 'booking_failed',
  'PICKUP EXCEPTION': 'booking_failed',
  'OUT FOR PICKUP': 'awaiting_rider',
  PICKED_UP: 'picked_up',
  'IN TRANSIT': 'out_for_delivery',
  'OUT FOR DELIVERY': 'out_for_delivery',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
  CANCELED: 'cancelled',
  RTO: 'cancelled',
  LOST: 'cancelled',
};

export const CUSTOMER_STATUS_LABELS = {
  not_booked: 'Order accepted',
  booking: 'Preparing your food',
  shipment_created: 'Finding rider',
  awaiting_rider: 'Finding rider',
  rider_assigned: 'Rider assigned',
  picked_up: 'Food picked up',
  out_for_delivery: 'On the way',
  delivered: 'Delivered',
  booking_failed: 'Delivery booking failed',
  cancelled: 'Cancelled',
};

export function mapShiprocketStatus(raw) {
  if (!raw) return null;
  const key = String(raw).trim().toUpperCase();
  return SR_TO_BANAOO[key] || SR_TO_BANAOO[raw] || null;
}

export function deliveryStatusForOrder(shipmentStatus) {
  if (!shipmentStatus) return null;
  const map = {
    not_booked: 'pending',
    booking: 'pending',
    shipment_created: 'assigned',
    awaiting_rider: 'assigned',
    rider_assigned: 'assigned',
    picked_up: 'picked_up',
    out_for_delivery: 'out_for_delivery',
    delivered: 'delivered',
    cancelled: 'cancelled',
    booking_failed: 'failed',
  };
  return map[shipmentStatus] || null;
}

export const DEFAULT_SETTINGS = {
  auto_delivery_enabled: false,
  prep_time_minutes: 15,
  default_weight_kg: 0.5,
  dimensions: { length: 20, width: 20, height: 10 },
  pickup_address: {},
  pickup_location_name: 'Primary',
  cod_enabled: true,
  retry_max_attempts: 3,
  retry_interval_seconds: 120,
  webhook_secret: null,
  /** Fixed: restaurant food = Shiprocket Quick hyperlocal 2-wheeler */
  delivery_mode: 'quick_hyperlocal',
  checkout_shipping_method: 'SR_QUICK',
  vehicle_mode: '2_wheeler',
  order_type_category: 'Food',
};

export function mergeSettings(raw) {
  return { ...DEFAULT_SETTINGS, ...(raw && typeof raw === 'object' ? raw : {}) };
}
