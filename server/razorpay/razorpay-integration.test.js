import { test } from 'node:test';
import assert from 'node:assert';
import crypto from 'crypto';
import { validateRazorpayEnvironment } from './config.js';
import { extractCouriers } from '../shiprocket/hyperlocal.js'; // baseline validation helper

// 1. Test Startup Environment checks
test('validateRazorpayEnvironment does not throw in dev/test', () => {
  const originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'test';
  
  // Should not throw even if keys are missing
  assert.doesNotThrow(() => {
    validateRazorpayEnvironment();
  });

  process.env.NODE_ENV = originalEnv;
});

test('validateRazorpayEnvironment throws error in production if keys are missing', () => {
  const originalEnv = process.env.NODE_ENV;
  const originalKey = process.env.RAZORPAY_KEY_ID;
  
  process.env.NODE_ENV = 'production';
  delete process.env.RAZORPAY_KEY_ID;

  assert.throws(() => {
    validateRazorpayEnvironment();
  }, /Critical Razorpay credentials missing for production/);

  process.env.NODE_ENV = originalEnv;
  process.env.RAZORPAY_KEY_ID = originalKey;
});

// 2. Test signature verification logic
function verifyRazorpaySignature(rawBody, signature, secret) {
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return expected === signature;
}

test('verifyRazorpaySignature returns true for correct signature', () => {
  const payload = 'order_123|pay_123';
  const secret = 'my_secret';
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex');

  assert.strictEqual(verifyRazorpaySignature(payload, sig, secret), true);
});

test('verifyRazorpaySignature returns false for mismatching secret or signature', () => {
  const payload = 'order_123|pay_123';
  const sig = 'wrongsignature123';

  assert.strictEqual(verifyRazorpaySignature(payload, sig, 'my_secret'), false);
});

// 3. Test state finality mapping rules
const PRECEDENCE = {
  created: 1,
  pending: 1,
  authorized: 2,
  failed: 2,
  paid: 3,
  refunded: 4,
  partially_refunded: 4,
  cancelled: 4
};

function shouldSkipStateUpdate(current, incoming) {
  const currentVal = PRECEDENCE[current] || 0;
  const incomingVal = PRECEDENCE[incoming] || 0;
  return currentVal >= 3 && incomingVal < 3;
}

test('shouldSkipStateUpdate prevents regressions from paid back to authorized/failed', () => {
  assert.strictEqual(shouldSkipStateUpdate('paid', 'authorized'), true);
  assert.strictEqual(shouldSkipStateUpdate('paid', 'failed'), true);
  assert.strictEqual(shouldSkipStateUpdate('refunded', 'paid'), false);
  assert.strictEqual(shouldSkipStateUpdate('authorized', 'paid'), false);
  assert.strictEqual(shouldSkipStateUpdate('pending', 'authorized'), false);
});
