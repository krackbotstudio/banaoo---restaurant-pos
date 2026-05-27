# API Reference

A complete, grouped reference of every HTTP endpoint exposed by the banaoo platform. **This is the source of truth for "what can I call from the frontend / mobile / a third party?"** For *how* the server is structured, see [`backend.md`](backend.md). For *who calls what*, see [`frontend.md`](frontend.md) and [`mobile-app.md`](mobile-app.md).

> All endpoints are served by the Node/Express service unless otherwise stated. In production they're reached via nginx at `https://api.banaoo.in` (or the same domain as the frontend, depending on the deploy). In development Vite proxies `/api/*` and `/auth/*` to `http://localhost:5001`.

---

## How this reference is structured

- **Auth levels**
  - `none` — no session required (public endpoint).
  - `owner` — `requireAuth` or inline `if (!req.user)`. Any authenticated user. Where the route additionally blocks staff sessions (e.g. only owners can create outlets), that is called out.
  - `staff` — staff PIN session. Same `requireAuth` check; the route inspects `req.user.isStaff`.
  - `admin` — `isAdmin` middleware (i.e. `requireAuth` *and* `profiles.is_admin = true`).
- **Where defined** column points at the file holding the route handler.
- **Bodies and responses** are described in brief — read the handler for exact field names. Field validation rules are noted when non-obvious.

---

## 1. Authentication & sessions

Defined in `server/index.js` unless otherwise noted. See [`backend.md`](backend.md) §4 for the auth model.

### `POST /auth/register`

Create an owner account (email + password).

- **Auth**: `none`
- **Body**: `{ email, password, full_name, phone, terms_version }`
- **400** if `terms_version` is missing.
- Hashes password with bcrypt (rounds=10), inserts into `public.users` + `public.profiles` (role `owner`, status `pending`).
- Stamps T&C audit fields (`terms_accepted_at = NOW()`, `terms_version`, `terms_accepted_ip`, `terms_accepted_user_agent`).
- Logs the user in (session cookie set) and returns `{ user }` after `req.session.save()`.

### `POST /auth/login`

Email/password **or** staff PIN. Uses Passport's `local` strategy.

- **Auth**: `none`
- **Body**: `{ email, password }`
- For staff, the "password" is the literal `bn_<pin_code>` (e.g. `bn_4321`). The same endpoint handles owner + staff transparently.
- Returns `{ user, profile }` (synthesized profile for staff sessions).

### `POST /auth/google/prepare`

Stash T&C acceptance in the session **before** redirecting to Google OAuth (signup-tab only).

- **Auth**: `none`
- **Body**: `{ terms_version }`
- Writes `req.session.pending_terms = { version, ip, user_agent, accepted_at: NOW() }` and explicitly `req.session.save`s.
- Returns `{ ok: true }`.

### `GET /auth/google`

Start Google OAuth.

- **Auth**: `none`
- **Query**: `?redirect_uri=…` (optional). Must be a URI with a scheme. Base64url-encoded into the OAuth `state` and stashed in `req.session.oauth_redirect_uri`.
- Disabled if `GOOGLE_CLIENT_ID` is missing/placeholder.

### `GET /auth/google/callback`

Google OAuth callback. Creates or links the user, then redirects to `<redirect_uri>?auth=success` (defaults to `${FRONTEND_URL}`).

- **Auth**: `none`
- On signup, picks `terms_version` from `req.session.pending_terms` or falls back to `'oauth-implicit'`.

### `GET /auth/me`

Current session user + profile.

- **Auth**: `owner` / `staff` (401 otherwise)
- Returns `{ user, profile }`. Staff sessions get a synthetic profile (`role: 'service'`, `account_status: 'approved'`, `onboarding_completed: true`, `is_admin: false`).

### `GET /auth/supabase-token`

Mint a short-lived HS256 Supabase JWT so the browser client can satisfy RLS.

- **Auth**: `owner` / `staff`
- Returns `{ access_token }`. Signed with `SUPABASE_JWT_SECRET`, 24h expiry, `sub=user.id`, `role='authenticated'`.

### `PATCH /auth/password`

Change the current user's password.

- **Auth**: `owner` / `staff`
- **Body**: `{ current_password, new_password }`
- bcrypt-compares the current password, hashes and stores the new one.

### `POST /auth/logout`

End the session. `req.logout()`.

- **Auth**: `owner` / `staff`

### `POST /auth/clear-session`

Debug helper. Destroys the current session and clears the `connect.sid` cookie.

- **Auth**: `none`

---

## 2. Profile & onboarding

### `PUT /api/profile`

Update fields on the current owner's `public.profiles` row.

- **Auth**: `owner` / `staff`
- **Body**: any subset of `{ full_name, phone, business_type, brand_name, ordering_slug, logo_url, brand_color, app_theme, upi_vpa, upi_qr_url, online_payments_enabled, gst_number, gst_categories, … }`
- Dynamic `SET` clause; only provided fields are updated.

### `POST /api/onboarding/complete`

Idempotent finalization of new-user onboarding.

- **Auth**: `owner` / `staff`
- **Body**: `{ business_type, brand_name, ordering_slug, phone?, city? }`
- Updates the user's profile (brand, type, slug, onboarding flag).
- If the user has **no outlets**, creates one with the brand name and the `operation_mode` derived from `business_type` (see `server/business-types.js`).
- If the user has a placeholder outlet named "My Restaurant", **renames it in place** instead of creating a duplicate.

### `POST /api/onboarding/skip`

Mark `onboarding_completed = true` without saving business details. Used by the "Skip for now" path.

- **Auth**: `owner` / `staff`

---

## 3. Outlets

### `GET /api/outlets`

List outlets visible to the current user.

- **Auth**: `owner` / `staff`
- For owners → all outlets where `owner_id = req.user.id`.
- For staff → outlets via `staff_outlet_assignments` (or `staff_outlet_links`).

### `POST /api/outlets`

Create a new outlet.

- **Auth**: `owner` (staff sessions blocked with 403)
- **Body**: `{ name, address?, gst_number?, operation_mode?, … }`
- Calls `assertWithinOutletLimit(userId)` — returns 403 with `code: 'OUTLET_LIMIT'` when at cap.
- If `operation_mode` is omitted, the DB trigger `enforce_cloud_kitchen_self_service` may still rewrite it for cloud-kitchen owners.

### `DELETE /api/outlets/:id`

Delete an outlet (`owner_id`-scoped). Staff sessions blocked.

- **Auth**: `owner`

---

## 4. Subscriptions, entitlements & payments

All Razorpay endpoints validate `period_months ∈ {3, 6, 12}` via `assertValidBillingPeriod`. See [`backend.md`](backend.md) §5–§6.

### `GET /api/subscription`

Full entitlements payload (with noisy debug logging).

- **Auth**: `owner` / `staff`
- Returns `{ subscription, addons, effective_limits, usage, has_active_subscription }`.

### `GET /api/entitlements`

Same payload, quiet version (used by `useSubscription` on refetch).

- **Auth**: `owner` / `staff`

### `POST /api/payments/create-order`

Create a Razorpay Order for a subscription.

- **Auth**: `owner` / `staff`
- **Body**: `{ plan_type: 'starter' | 'professional', period_months: 3 | 6 | 12 }`
- Returns `{ order_id, amount, amount_rupees, currency: 'INR', key_id }`. Amount discounted 5/10/20% for 3/6/12 months.

### `POST /api/payments/verify-payment`

Verify Razorpay signature, persist subscription, send Brevo confirmation email.

- **Auth**: `owner` / `staff`
- **Body**: `{ razorpay_order_id, razorpay_payment_id, razorpay_signature, plan_type, period_months }`
- HMAC-SHA256(`${order}|${payment}`) with `RAZORPAY_KEY_SECRET` must equal `signature`.
- `INSERT ... ON CONFLICT (razorpay_order_id) DO UPDATE` with `status='active'`, `expires_at = NOW() + months`.
- Brevo email is fire-and-forget; missing API key logs a warning instead of failing.
- Returns `{ success, expires_at }`.

### `POST /api/payments/create-addon-order`

Create a Razorpay Order for an add-on.

- **Auth**: `owner` / `staff`
- **Body**: `{ addon_type, quantity, period_months }`. `addon_type ∈ {extra_outlet, extra_staff, swiggy_integration, zomato_integration, customer_ordering, inventory_management}`. `quantity` is normalized to 1–50 for stackable types, else 1.
- Returns the same shape as `create-order`.

### `POST /api/payments/verify-addon-payment`

Verify the add-on signature, upsert `subscription_addons`, return new entitlements.

- **Auth**: `owner` / `staff`
- Returns `buildEntitlementsPayload(userId)`.

### `POST /api/payments/cancel-subscription`

Mark the active subscription `status='cancelled'`. Prepaid model — no gateway-side action.

- **Auth**: `owner` / `staff`

---

## 5. Affiliates

### `GET /api/affiliate/me`

Logged-in user's affiliate row (`affiliates JOIN users JOIN profiles`).

- **Auth**: `owner` / `staff`
- Returns the row or `null` if the user is not an affiliate.

### `POST /api/affiliate/apply`

Apply to become an affiliate.

- **Auth**: `owner` / `staff`
- Generates a referral code, inserts a row with `status='pending'`.

---

## 6. Mobile-bridge / native-app

### `POST /api/billing/mobile-link`

*(Defined in `server/billing-mobile.js`.)*

Mint a 15-minute JWT so the WebView can hand off Razorpay checkout to the system browser.

- **Auth**: `owner` / `staff`
- **Body**:
  - `{ kind: 'subscription', plan_type, period_months }`, or
  - `{ kind: 'addon', addon_type, quantity, period_months }`, or
  - `{ kind: 'settings', target: 'subscription' | 'addons' }`
- All values validated: `plan_type ∈ {starter, professional}`, `addon_type` in the six allowed types, `period_months ∈ {3, 6, 12}`.
- JWT signed with `BILLING_CHECKOUT_SECRET` (fallback `SUPABASE_JWT_SECRET`), `aud='banaoo-mobile-billing'`, `sub=user.id`.
- Returns `{ url: '<publicWebBase>/api/billing/redeem?token=...' }`.

### `GET /api/billing/redeem`

Browser-side redeem of the mobile billing JWT. Establishes a fresh browser session and redirects.

- **Auth**: `none` (JWT in URL is the credential)
- **Query**: `?token=<JWT>`
- Verifies JWT, calls `req.login(user)` (creating a new session cookie), saves the session, then redirects:
  - `kind: 'subscription'` → `/billing/checkout?token=...&from=mobile`
  - `kind: 'addon'` → `/billing/checkout?token=...&from=mobile`
  - `kind: 'settings'` with `target: 'subscription'` → `/settings?tab=subscription&from=mobile`
  - `kind: 'settings'` with `target: 'addons'` → `/addons?from=mobile`

### `GET /api/billing/checkout-intent`

Decoded JWT payload for the React checkout page (so it can pre-fill plan/period/quantity).

- **Auth**: `owner` / `staff`
- **Query**: `?token=<JWT>`
- Enforces `decoded.sub === req.user.id` (mismatch → 403).
- Returns the decoded payload, e.g. `{ kind, plan_type, period_months, from_mobile: true }`.

### `GET /api/mobile-app/apk`

Stream the Android APK with a versioned filename.

- **Auth**: `none`
- Filename derived from `mobile/app.json`'s `version` (e.g. `banaoo-app-V.0.018.apk`).
- Searches `server/downloads/`, then `public/downloads/`, then `mobile/android/app/build/outputs/apk/release/`.
- `Cache-Control: public, max-age=300`.

### `GET /api/mobile-app/update-policy`

RN app reads `{ minVersion, forceUpdate, message }` from env vars.

- **Auth**: `none`
- `MOBILE_MIN_VERSION` / `MOBILE_FORCE_UPDATE` / `MOBILE_FORCE_UPDATE_MESSAGE`.
- `Cache-Control: no-store`.

### `POST /api/mobile-app/download-request`

Landing-page "send me the app" form. Captures the lead and returns the APK URL.

- **Auth**: `none`
- **Body**: `{ email, phone, source? }`
- Validates `email` and Indian phone format (`/^[+]?91[6-9]\d{9}$|^[6-9]\d{9}$/`).
- Ensures `public.mobile_app_leads` exists (auto-creates), inserts the lead with UA + IP, returns `{ success, downloadUrl }` even if the lead capture step fails.

---

## 7. Uploads & AI utilities

### `POST /api/upload`

Single-file upload via multer.

- **Auth**: `owner` / `staff` (uses `req.isAuthenticated()` gate, not the `requireAuth` middleware)
- **Body**: `multipart/form-data` with a `file` field (max 5 MB).
- Returns `{ url: '/uploads/<filename>' }` (relative URL).

### `POST /api/extract-menu`

OpenAI `gpt-4o` menu OCR on a base64 image.

- **Auth**: `owner` / `staff`
- **Body**: `{ imageBase64, mimeType }` (JSON, not multipart — that's why `express.json` is raised to 10 MB).
- Returns a JSON array of `{ name, description, price, is_veg, category }`.

### `POST /api/generate-menu-image`

Cascading image search: cache → TheMealDB → Wikipedia → Pexels.

- **Auth**: `owner` / `staff`
- **Body**: `{ query }`
- Caches successful results in `public.menu_item_images`.
- Returns up to 8 images, shuffled.

### `POST /api/voice-order`

OpenAI `gpt-4o-mini` transcript → structured order.

- **Auth**: `none` (explicitly commented "used by customers and POS staff")
- **Body**: `{ transcript, menu_items, mode?: 'pos' }`
- POS mode adds `order_type` + `table_number` to the response. Multi-language (Hindi / Telugu / Tamil / Kannada / English mixed).

### `POST /api/support-chat`

Streaming OpenAI `gpt-4o-mini` support assistant (Server-Sent Events).

- **Auth**: `none`
- **Body**: `{ messages: [{ role, content }, …] }`
- Sets `Content-Type: text/event-stream`. Streams upstream SSE chunks via `response.body.getReader()`.

---

## 8. Customer / public ordering

Defined in `server/customer-orders.js` (registered into the app via `registerCustomerOrderRoutes`). See [`backend.md`](backend.md) §8 for the design.

### `GET /api/public/outlets/:outletId/payment-settings`

UPI settings (outlet → profile → brand fallback). Only returns when the outlet is active.

- **Auth**: `none`
- Returns `{ upi_vpa, upi_qr_url, online_payments_enabled, payee_name }`.
- **404** if the outlet doesn't exist or is inactive.

### `POST /api/public/customer-orders`

Create a public diner order + items (+ optional UPI payment row).

- **Auth**: `none`
- **Body**: `{ outlet_id, order_type, table_number?, customer_name, customer_phone, items: [{ menu_item_id, quantity, notes? }], payment_method: 'cod' | 'upi' }`
- Validation:
  - `order_type ∈ {dine_in, takeaway, delivery}`.
  - For `dine_in`: `table_number` must be present, the table must be available, and there must be no concurrent active order on the same table.
  - `payment_method='upi'` requires UPI configured on outlet or profile.
- Server computes subtotal/total from menu prices and generates an `ONL-<base36>` order number.
- Wrapped in `BEGIN/COMMIT/ROLLBACK`. Returns `{ order_id, order_number }`.

### `GET /api/public/orders/:orderId/payment`

Fetch order + payment state for the customer's payment screen.

- **Auth**: `none`
- Returns `{ order, payment, upi_settings }`.

### `POST /api/public/orders/:orderId/submit-upi`

Customer submits UTR/reference (min 6 chars).

- **Auth**: `none`
- **Body**: `{ utr }`
- Sets `order_payments.status='awaiting_confirmation'`, `customer_reference=utr`, `submitted_at=NOW()`, and flips `orders.payment_status='awaiting_confirmation'`.
- Idempotent when already paid.

### `GET /api/order-payments`

Owner-side listing of UPI payments for one of their outlets.

- **Auth**: `owner`
- **Query**: `?outlet_id=<uuid>` (must belong to `req.user.id`).
- Returns a list of `order_payments` joined with `orders`.

### `PATCH /api/order-payments/:paymentId`

Owner confirms or rejects a UPI payment.

- **Auth**: `owner`
- **Body**: `{ status: 'confirmed' | 'rejected', notes? }`
- Flips `orders.payment_status` and stamps `confirmed_at` / `rejected_at`.

### `POST /api/webhooks/swiggy`

*(Defined in `server/index.js`.)*

Receive a Swiggy order webhook.

- **Auth**: `none` (verified via `?outlet_id=...` + `platform_integrations.platform='swiggy', is_active=true`)
- Creates `orders` (source `swiggy`, `order_type='delivery'`, `status='pending'`, `delivery_status='assigned'`), maps each Swiggy item by `ILIKE '%name%'` against `menu_items`, inserts `order_items`, and writes start/finish rows to `platform_sync_logs`.
- Falls back to the placeholder `menu_item_id='00000000-...-000000000000'` when no match.

### `POST /api/webhooks/zomato`

Mirror of the Swiggy webhook for Zomato. Same protection model.

- **Auth**: `none` (verified via `?outlet_id=` + `platform_integrations.platform='zomato'`)

---

## 9. Static files

### `GET /uploads/*`

Files written by `POST /api/upload`. `express.static(<server>/uploads)`. **No per-user ACL** — anything uploaded is publicly accessible.

- **Auth**: `none`

### `GET /downloads/*`

`resolveDownloadsDir()` looks in `server/downloads/` then `public/downloads/`; whichever exists is served. This is where `banaoo-latest.apk` lives.

- **Auth**: `none`

---

## 10. Admin

All require `admin` (i.e. `requireAuth` + `profiles.is_admin = true`). See [`backend.md`](backend.md) §11.

### `GET /api/admin/accounts`

List owner profiles + T&C audit + `users.email`.

- **Auth**: `admin`
- **Query**: `?status=approved|pending|rejected|all` (default `all`).
- Returns rows including `terms_accepted_at`, `terms_version`, `terms_accepted_ip`, `terms_accepted_user_agent`.

### `POST /api/admin/accounts/action`

Approve or reject an owner account.

- **Auth**: `admin`
- **Body**: `{ target_user_id, action: 'approve' | 'reject' }`
- Updates `profiles.account_status` and inserts a `public.notifications` row. Approval's notification routes the user to `/select-plan`.

### `GET /api/admin/affiliates`

List affiliates joined to `users` + `profiles`.

- **Auth**: `admin`
- **Query**: `?status=pending|approved|suspended|all`.

### `POST /api/admin/affiliates/action`

Approve or suspend an affiliate.

- **Auth**: `admin`
- **Body**: `{ affiliate_id, action: 'approve' | 'suspend' }`
- Stamps `approved_at = NOW()` on approve.

### `GET /api/admin/affiliate-payouts`

List affiliate payout requests.

- **Auth**: `admin`
- **Query**: `?status=requested|processing|completed|failed|all`.
- Ordered by `requested_at DESC`.

### `POST /api/admin/affiliate-payouts/action`

Move a payout through its lifecycle.

- **Auth**: `admin`
- **Body**: `{ payout_id, status: 'requested'|'processing'|'completed'|'failed', transaction_id?, notes? }`
- Stamps `processed_at` when status becomes `completed`. Uses `COALESCE` so partial updates don't clear existing fields.

### `GET /api/admin/mobile-app-leads`

Recent leads from the APK download form.

- **Auth**: `admin`
- **Query**: `?limit=N` (clamped 1–1000, default 250).
- Ordered by `created_at DESC`.

---

## 11. Vercel serverless function

### `GET /api/manifest`

Dynamic Web App Manifest JSON. Lets each restaurant install as a branded PWA.

- **Auth**: `none`
- **Defined in**: `api/manifest.ts` (Vercel serverless)
- **Query**:
  - `name` — restaurant name (default `"Order Food"`)
  - `start_url` — ordering path (default `"/"`)
  - `color` — brand hex (default `#f97316`)
- Returns a Web App Manifest with `name`, `short_name` (truncated to 12), `description: "Order food from <name>"`, `start_url`, `scope: start_url`, `display: "standalone"`, `theme_color: color`, `icons: [{ src: "/logo.png", sizes: "512x512" }]`.

---

## 12. Endpoints summary (quick scan)

For a one-screen list, group everything by area:

### Auth (10)

`POST /auth/register` · `POST /auth/login` · `POST /auth/google/prepare` · `GET /auth/google` · `GET /auth/google/callback` · `POST /auth/clear-session` · `GET /auth/me` · `GET /auth/supabase-token` · `PATCH /auth/password` · `POST /auth/logout`

### Profile & onboarding (3)

`PUT /api/profile` · `POST /api/onboarding/complete` · `POST /api/onboarding/skip`

### Outlets (3)

`GET /api/outlets` · `POST /api/outlets` · `DELETE /api/outlets/:id`

### Subscriptions & payments (7)

`GET /api/subscription` · `GET /api/entitlements` · `POST /api/payments/create-order` · `POST /api/payments/verify-payment` · `POST /api/payments/create-addon-order` · `POST /api/payments/verify-addon-payment` · `POST /api/payments/cancel-subscription`

### Affiliates (2)

`GET /api/affiliate/me` · `POST /api/affiliate/apply`

### Mobile-bridge / native-app (6)

`POST /api/billing/mobile-link` · `GET /api/billing/redeem` · `GET /api/billing/checkout-intent` · `GET /api/mobile-app/apk` · `GET /api/mobile-app/update-policy` · `POST /api/mobile-app/download-request`

### Uploads & AI (5)

`POST /api/upload` · `POST /api/extract-menu` · `POST /api/generate-menu-image` · `POST /api/voice-order` · `POST /api/support-chat`

### Public ordering & webhooks (8)

`GET /api/public/outlets/:outletId/payment-settings` · `POST /api/public/customer-orders` · `GET /api/public/orders/:orderId/payment` · `POST /api/public/orders/:orderId/submit-upi` · `GET /api/order-payments` · `PATCH /api/order-payments/:paymentId` · `POST /api/webhooks/swiggy` · `POST /api/webhooks/zomato`

### Admin (7)

`GET /api/admin/accounts` · `POST /api/admin/accounts/action` · `GET /api/admin/affiliates` · `POST /api/admin/affiliates/action` · `GET /api/admin/affiliate-payouts` · `POST /api/admin/affiliate-payouts/action` · `GET /api/admin/mobile-app-leads`

### Static (2) + Vercel (1)

`GET /uploads/*` · `GET /downloads/*` · `GET /api/manifest`

**Total: ~54 active endpoints** (excluding the `GET /uploads/*` and `GET /downloads/*` wildcards which match any file).

---

## 13. Beyond Express

Surfaces handled outside this server:

- **Supabase Edge Functions** (Deno) — `create-staff-user`, `customer-lookup`, `place-customer-order`, `create-razorpay-order`, `verify-razorpay-payment`, plus assorted admin functions. Most are dormant in favour of the Express equivalents; consult `supabase/functions/<name>/index.ts` and the `Database` types when you do need to call one.
- **Supabase RPC** — only `generate_order_number` is called from app code (`supabase.rpc(...)` in `src/pages/NewOrder.tsx` and inside the Swiggy/Zomato webhook handlers).
- **Supabase Realtime** — used by the kitchen display, notifications, and customer-order updates. See `frontend.md` §3.
- **Razorpay** — Orders API is consumed via `fetch` from `server/index.js`; checkout SDK is loaded from `https://checkout.razorpay.com/v1/checkout.js`. There is **no `/api/webhooks/razorpay`** — verification is done client-side via `verify-payment` after the checkout returns.

---

## 14. Conventions

- **Currency**: amounts are stored in **paise** (smallest unit, integer) inside Razorpay payloads and `subscriptions.amount_paid`; the frontend converts to rupees for display.
- **Order numbers**: customer-side orders use `ONL-<base36>`. POS orders use the Supabase RPC `generate_order_number(outlet_id)` which produces `<outlet-prefix>-<yyyymmdd>-<seq>`.
- **Timestamps**: every `created_at` / `updated_at` is `timestamptz`. T&C audit columns and Razorpay paid-at columns are also `timestamptz`.
- **JSON responses**: 200/201 → `{ ... }` with the resource or operation result. 4xx/5xx → `{ error: <message> }`. There is no global error envelope.
- **CSRF**: not implemented — the API is cookie-authed with `sameSite: 'lax'` and is intended to be reached only from the official frontends and the mobile WebView.
- **Rate limiting**: not enforced in-process. Apply at Traefik / nginx if needed.

---

## 15. Where to read next

- **How requests are processed and authed**: [`backend.md`](backend.md)
- **Which frontend page or hook calls each endpoint**: [`frontend.md`](frontend.md)
- **Which mobile bridge handler triggers which endpoint**: [`mobile-app.md`](mobile-app.md)
- **Libraries used**: [`techstack.md`](techstack.md)
