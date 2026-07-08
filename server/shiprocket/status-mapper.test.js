import test from 'node:test';
import assert from 'node:assert/strict';
import { mapShiprocketStatus, deliveryStatusForOrder, CUSTOMER_STATUS_LABELS } from './status-mapper.js';

test('mapShiprocketStatus maps known codes', () => {
  assert.equal(mapShiprocketStatus('DELIVERED'), 'delivered');
  assert.equal(mapShiprocketStatus('OUT FOR DELIVERY'), 'out_for_delivery');
  assert.equal(mapShiprocketStatus('unknown'), null);
});

test('deliveryStatusForOrder maps shipment to order field', () => {
  assert.equal(deliveryStatusForOrder('picked_up'), 'picked_up');
  assert.equal(deliveryStatusForOrder('booking_failed'), 'failed');
});

test('customer labels cover all shipment statuses', () => {
  const keys = [
    'not_booked',
    'booking',
    'shipment_created',
    'awaiting_rider',
    'rider_assigned',
    'picked_up',
    'out_for_delivery',
    'delivered',
    'booking_failed',
    'cancelled',
  ];
  for (const k of keys) {
    assert.ok(CUSTOMER_STATUS_LABELS[k], `missing label for ${k}`);
  }
});
