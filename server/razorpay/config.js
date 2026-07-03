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
