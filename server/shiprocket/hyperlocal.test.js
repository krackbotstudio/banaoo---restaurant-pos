import test from 'node:test';
import assert from 'node:assert/strict';
import { extractCouriers, pickQuickCourier, courierIdFrom } from './hyperlocal.js';

test('extractCouriers reads available_courier_companies', () => {
  const list = extractCouriers({
    data: {
      available_courier_companies: [{ courier_company_id: 10, courier_name: 'Shiprocket Quick' }],
    },
  });
  assert.equal(list.length, 1);
  assert.equal(list[0].courier_company_id, 10);
});

test('pickQuickCourier prefers quick/hyperlocal names', () => {
  const picked = pickQuickCourier([
    { courier_company_id: 1, courier_name: 'Delhivery Surface' },
    { courier_company_id: 2, courier_name: 'Shiprocket Quick 2 Wheeler' },
  ]);
  assert.equal(picked.courier_company_id, 2);
});

test('courierIdFrom resolves company id', () => {
  assert.equal(courierIdFrom({ courier_company_id: '42' }), 42);
  assert.equal(courierIdFrom({}), null);
});
