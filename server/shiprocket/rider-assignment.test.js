import test from 'node:test';
import assert from 'node:assert/strict';
import { extractRiderDetails } from './hyperlocal.js';
import { mapShiprocketStatus } from './status-mapper.js';

test('extractRiderDetails handles happy path for courier_agent_details', () => {
  const payload = {
    tracking_data: {
      courier_agent_details: {
        name: 'John Doe',
        phone: '9876543210',
        vehicle_number: 'KA-01-EF-1234',
        id: 12345,
      },
    },
  };
  const result = extractRiderDetails(payload);
  assert.equal(result.rider_name, 'John Doe');
  assert.equal(result.rider_phone, '9876543210');
  assert.equal(result.rider_vehicle, 'KA-01-EF-1234');
  assert.equal(result.rider_id, '12345');
});

test('extractRiderDetails handles happy path for courier_agent direct', () => {
  const payload = {
    courier_agent: {
      courier_name: 'Jane Doe',
      courier_phone: '9876543211',
      vehicle_no: 'DL-01-AB-5678',
      rider_id: 67890,
    },
  };
  const result = extractRiderDetails(payload);
  assert.equal(result.rider_name, 'Jane Doe');
  assert.equal(result.rider_phone, '9876543211');
  assert.equal(result.rider_vehicle, 'DL-01-AB-5678');
  assert.equal(result.rider_id, '67890');
});

test('extractRiderDetails handles missing or null rider details', () => {
  const result = extractRiderDetails(null);
  assert.equal(result.rider_name, null);
  assert.equal(result.rider_phone, null);
  assert.equal(result.rider_vehicle, null);
  assert.equal(result.rider_id, null);
});

test('mapShiprocketStatus maps all rider assigned variations', () => {
  assert.equal(mapShiprocketStatus('RIDER ASSIGNED'), 'rider_assigned');
  assert.equal(mapShiprocketStatus('RIDER_ASSIGNED'), 'rider_assigned');
  assert.equal(mapShiprocketStatus('RIDER ALLOCATED'), 'rider_assigned');
  assert.equal(mapShiprocketStatus('COURIER ASSIGNED'), 'rider_assigned');
  assert.equal(mapShiprocketStatus('AGENT ASSIGNED'), 'rider_assigned');
});
