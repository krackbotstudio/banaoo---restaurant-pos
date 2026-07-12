export function getRazorpayOAuthClientId() {
  return process.env.RAZORPAY_OAUTH_CLIENT_ID?.trim() || '';
}

export function getRazorpayOAuthClientSecret() {
  return process.env.RAZORPAY_OAUTH_CLIENT_SECRET?.trim() || '';
}

export function getRazorpayOAuthMode() {
  const mode = process.env.RAZORPAY_OAUTH_MODE?.trim().toLowerCase();
  return mode === 'live' ? 'live' : 'test';
}

export function isRazorpayOAuthConfigured() {
  return Boolean(getRazorpayOAuthClientId() && getRazorpayOAuthClientSecret());
}

export function assertRazorpayOAuthConfigured() {
  if (!isRazorpayOAuthConfigured()) {
    throw new Error(
      'Razorpay OAuth is not configured on this server. Add RAZORPAY_OAUTH_CLIENT_ID and RAZORPAY_OAUTH_CLIENT_SECRET from the Razorpay Partner Dashboard to server/.env, then restart the API server.'
    );
  }
}

export function validateRazorpayEnvironment() {
  const isProd = process.env.NODE_ENV === 'production';
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
  const mode = process.env.RAZORPAY_MODE?.trim() || process.env.RAZORPAY_OAUTH_MODE?.trim();

  if (isProd) {
    const missing = [];
    if (!keyId) missing.push('RAZORPAY_KEY_ID');
    if (!keySecret) missing.push('RAZORPAY_KEY_SECRET');
    if (!webhookSecret) missing.push('RAZORPAY_WEBHOOK_SECRET');
    if (!mode) missing.push('RAZORPAY_MODE/RAZORPAY_OAUTH_MODE');

    if (missing.length > 0) {
      throw new Error(
        `Critical Razorpay credentials missing for production: ${missing.join(', ')}. Please add them to your environment configuration.`
      );
    }
  }
}
