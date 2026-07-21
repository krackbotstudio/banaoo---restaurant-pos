import assert from 'assert';
import {
  buildGooglePayPaymentRequest,
  isGooglePayReady,
  isValidGooglePayVpa,
  isValidMcc,
  normalizeGooglePayConnection,
} from './routes.js';
import { resolvePaymentSettings } from '../customer-orders.js';
import {
  ADDON_MONTHLY_PRICES,
  aggregateAddonsFromRows,
  computeEffectiveLimits,
} from '../entitlements.js';

assert.strictEqual(isValidGooglePayVpa('shop@okaxis'), true);
assert.strictEqual(isValidGooglePayVpa('bad'), false);
assert.strictEqual(isValidMcc('5812'), true);
assert.strictEqual(isValidMcc('58'), false);

assert.strictEqual(isGooglePayReady(null), false);
assert.strictEqual(
  isGooglePayReady({
    is_enabled: true,
    is_configured: true,
    merchant_vpa: 'shop@okaxis',
    payee_name: 'Nite Bliss',
    mcc: '5812',
    settings: {},
  }),
  true
);
assert.strictEqual(
  isGooglePayReady({
    is_enabled: true,
    is_configured: true,
    merchant_vpa: 'bad-vpa',
    payee_name: 'Nite Bliss',
    mcc: '5812',
    settings: {},
  }),
  false
);

const req = buildGooglePayPaymentRequest({
  merchantVpa: 'shop@okaxis',
  payeeName: 'Nite Bliss',
  mcc: '5812',
  transactionRef: 'GPTEST123',
  amount: 199.5,
});
assert.strictEqual(req.supportedInstruments[0].supportedMethods, 'https://tez.google.com/pay');
assert.strictEqual(req.supportedInstruments[0].data.pa, 'shop@okaxis');
assert.strictEqual(req.supportedInstruments[0].data.tr, 'GPTEST123');
assert.strictEqual(req.supportedInstruments[0].data.mc, '5812');
assert.strictEqual(req.amount, '199.50');
assert.strictEqual(req.details.total.amount.value, '199.50');

const normalized = normalizeGooglePayConnection({
  is_enabled: true,
  is_configured: true,
  merchant_vpa: 'shop@okaxis',
  payee_name: 'Test',
  mcc: '5812',
  settings: { allow_cod: false },
});
assert.strictEqual(normalized.settings.allow_cod, false);

const gpayConn = {
  is_enabled: true,
  is_configured: true,
  merchant_vpa: 'shop@okaxis',
  payee_name: 'GPay Merchant',
  mcc: '5812',
  settings: { allow_cod: true },
};
const razorpayConn = {
  is_connected: true,
  connection_mode: 'api_keys',
  merchant_key_id: 'rzp_test_x',
  merchant_key_secret_enc: 'enc',
  settings: { online_payments_enabled: true, allow_cod: true },
};

const gpayOnly = resolvePaymentSettings(
  { online_payments_enabled: true, name: 'Outlet' },
  { brand_name: 'Brand' },
  null,
  gpayConn,
  'google_pay'
);
assert.strictEqual(gpayOnly.online_payment_provider, 'google_pay');
assert.strictEqual(gpayOnly.online_checkout_enabled, true);
assert.strictEqual(gpayOnly.upi_vpa, 'shop@okaxis');
assert.strictEqual(gpayOnly.upi_display_name, 'GPay Merchant');
assert.strictEqual(gpayOnly.google_pay_ready, true);

const razorpaySelected = resolvePaymentSettings(
  { online_payments_enabled: true, name: 'Outlet' },
  null,
  razorpayConn,
  gpayConn,
  'razorpay'
);
assert.strictEqual(razorpaySelected.online_payment_provider, 'razorpay');
assert.strictEqual(razorpaySelected.online_checkout_enabled, true);
assert.notStrictEqual(razorpaySelected.upi_vpa, 'shop@okaxis');

const gpayNotReady = resolvePaymentSettings(
  { online_payments_enabled: true },
  null,
  null,
  { ...gpayConn, merchant_vpa: '' },
  'google_pay'
);
assert.strictEqual(gpayNotReady.online_checkout_enabled, false);
assert.strictEqual(gpayNotReady.google_pay_ready, false);

const legacyFallback = resolvePaymentSettings(
  { online_payments_enabled: true },
  null,
  null,
  gpayConn,
  null
);
assert.strictEqual(legacyFallback.online_payment_provider, 'google_pay');
assert.strictEqual(legacyFallback.online_checkout_enabled, true);

assert.strictEqual(ADDON_MONTHLY_PRICES.google_pay_india, 0);
const addons = aggregateAddonsFromRows([
  { addon_type: 'google_pay_india', quantity: 1 },
  { addon_type: 'razorpay_payments', quantity: 1 },
]);
assert.strictEqual(addons.google_pay_india, true);
assert.strictEqual(addons.razorpay, true);
const limits = computeEffectiveLimits('growth', addons, true);
assert.strictEqual(limits.googlePayIndia, true);
assert.strictEqual(limits.razorpayPayments, true);
const noAddon = computeEffectiveLimits('growth', aggregateAddonsFromRows([]), true);
assert.strictEqual(noAddon.googlePayIndia, false);

console.log('google-pay routes unit checks passed');
