# Backend (`server/`)

A guide to the Node.js / Express service that powers `api.banaoo.in`. This document is a **map of the codebase + a mental model of how requests flow** — it complements [`api.md`](api.md) (the full endpoint reference) and [`techstack.md`](techstack.md) (the library inventory).

> All code paths in this file are relative to the repo root unless otherwise noted.

---

## 1. Folder map

```text
server/
├── index.js                # Express bootstrap + ~60 route handlers
├── db.js                   # Single shared pg.Pool (SSL auto-detect)
├── entitlements.js         # Plan + add-on math used by /api/subscription
├── customer-orders.js      # Public unauthenticated customer ordering + UPI payments
├── billing-mobile.js       # Mobile→browser checkout handoff (15-min JWT)
├── business-types.js       # business_type → default outlet operation_mode
├── legal.js                # CURRENT_TERMS_VERSION + extractClientIp()
├── email.js                # Brevo: subscription confirmation email
├── migration.sql           # Legacy: drops RLS + creates public.users from auth.users
├── run_migrations.js       # Applies migration.sql (one-shot)
├── package.json            # ESM, scripts: start (node), dev (nodemon)
├── Dockerfile              # node:20-alpine; copies APK into downloads/
├── downloads/              # Static APKs served from /api/mobile-app/apk + /downloads/*
├── scripts/
│   ├── apply-migration.js  # Apply supabase/migrations/*.sql (CLI)
│   └── grant-test-subscription.js   # Grant the QA account 10y Expand
├── test_db.js              # One-off SELECT NOW() smoke test
├── test-email.js           # One-off: send sample Brevo email
├── test-pexels.js          # One-off: hit Pexels search
└── check_*.js              # Various one-off schema/RLS/staff dumpers (kept for reference)
```

> Need the historical SQL dumps and the very oldest helpers? They live in [`../db-archive/`](../db-archive/) (see its `README.md`).

---

## 2. Request lifecycle

A typical authenticated request travels through this stack:

```
client ──► Traefik (Dokploy, terminates TLS)
        ─► nginx (frontend container, proxies /api & /auth)
        ─► Express (this service)
            ├─ cors (dynamic allowlist)
            ├─ express.json + urlencoded (10 MB cap)
            ├─ cookieParser
            ├─ express-session (connect-pg-simple, table public.session)
            ├─ passport.initialize + passport.session
            ├─ trust proxy: 1
            ├─ (multer only on /api/upload)
            └─ route handler → pg.Pool → response
```

`trust proxy: 1` is critical: without it `req.ip` would be wrong (Traefik adds `X-Forwarded-For`), `secure` cookies would not be sent on HTTPS, and the T&C audit IP would be useless.

### CORS allowlist

Built dynamically:

- `FRONTEND_URL` (comma-separated env var)
- `http://localhost:8080`, `http://localhost:5173`, `http://localhost:3000` and their `127.0.0.1` equivalents
- `origin: undefined` (mobile apps, curl) is allowed

`credentials: true`, allowed methods include `PATCH` + `OPTIONS`, allowed headers `Content-Type`, `Authorization`.

### Sessions

- Store: `connect-pg-simple` → Postgres `public.session` table, sharing the main pool.
- Cookie: 30-day `maxAge`, `secure` in production only, `sameSite: 'lax'` (works because nginx proxies `/auth/*` and `/api/*` onto the same domain as the frontend).
- Cookie name is the express-session default `connect.sid`.
- `POST /auth/clear-session` is a debug helper that destroys the session and clears the cookie.

---

## 3. Database access (`server/db.js`)

- Exports a **single** `pg.Pool` instantiated with `connectionString: process.env.DATABASE_URL`.
- The same pool is reused for the Express session store.
- `getSslConfig()` decides SSL automatically:
  - `DATABASE_SSL=false` → off
  - `DATABASE_SSL=true` → `{ rejectUnauthorized: false }`
  - Otherwise auto-detect: hostnames containing `localhost`, `traefik.me`, or `api.banaoo.in` get SSL off; in production with anything else SSL is on.
- **Schema is owned by Supabase migrations**, not the backend. The only DDL that runs at request time is the idempotent `CREATE TABLE IF NOT EXISTS public.mobile_app_leads` in `ensureMobileAppLeadsTable()` at boot.
- To apply a new schema change in production: use [`server/scripts/apply-migration.js`](../server/scripts/apply-migration.js) (see [`api.md`](api.md) §11.1).

```bash
node server/scripts/apply-migration.js supabase/migrations/20260525000002_terms_acceptance.sql
```

---

## 4. Authentication

There are **three** ways to authenticate:

### 4.1 Owner email/password

1. `POST /auth/register` accepts email, password, fullName, phone, and `terms_version`. `terms_version` is **required** (400 otherwise).
2. Password is hashed with `bcryptjs` (salt rounds = 10) and stored in `public.users`.
3. A row in `public.profiles` is created with:
   - `role: 'owner'`
   - `account_status: 'pending'` (admin must approve)
   - T&C audit columns: `terms_accepted_at = NOW()`, `terms_version`, `terms_accepted_ip` (from `extractClientIp(req)` in `legal.js`), `terms_accepted_user_agent`.
4. `POST /auth/login` runs Passport's `local` strategy, which itself supports two cases (see below).

### 4.2 Staff PIN

There is no separate staff endpoint — the same `POST /auth/login` handles both. The LocalStrategy in `server/index.js`:

1. Looks up the user in `public.users` by email. If found and has `password_hash`, runs `bcrypt.compare`.
2. If not found, falls back to `public.staff_members WHERE LOWER(system_email) = $1 AND is_active = true` and compares against the literal string `bn_<pin_code>` (e.g. PIN `4321` → password `bn_4321`).
3. If found in `users` *without* a `password_hash` (e.g. Google-only or staff sync), still falls through to step 2.

When step 2 or 3 succeeds, the user object carries `isStaff: true` and `deserializeUser` synthesizes a profile-shaped object so the React `ProtectedRoute` keeps working.

### 4.3 Google OAuth (with T&C handoff)

Configured only when `GOOGLE_CLIENT_ID` is set and not the literal `'PLACEHOLDER_GOOGLE_CLIENT_ID'`.

Signup flow (must capture T&C acceptance):

1. Client ticks the T&C checkbox in `pages/Auth.tsx`.
2. Client `POST`s `/auth/google/prepare` with `{ terms_version }`. The handler stashes `req.session.pending_terms = { version, ip, user_agent, accepted_at }` and explicitly `req.session.save`s before responding.
3. Client redirects to `GET /auth/google?redirect_uri=<origin>/auth/callback`. The redirect URI is base64url-encoded into the OAuth `state` and also stashed in `req.session.oauth_redirect_uri` so deep links survive.
4. `GET /auth/google/callback` decodes `state` → calls Passport's GoogleStrategy callback.
5. Strategy callback (`passReqToCallback: true`) reads `req.session.pending_terms`:
   - **New user**: inserts `public.users` + `public.profiles` with the audit fields.
   - **Existing user without `google_id`**: links accounts, `COALESCE`s missing audit fields.
   - If the client never called `/auth/google/prepare` (i.e. a login-tab Google click), the audit version falls back to the marker string `'oauth-implicit'`.
6. On success, redirects to `<redirect_uri>?auth=success`.

### 4.4 Session helpers

- `GET /auth/me` → `{ user, profile }`. Staff sessions get a synthesized profile.
- `GET /auth/supabase-token` → mints an HS256 Supabase JWT (24h, `sub = userId`, `role = 'authenticated'`) so the browser Supabase client satisfies RLS as `auth.uid() = sub`. The minting key is `SUPABASE_JWT_SECRET`.
- `PATCH /auth/password` → change password (still works for users with a `password_hash`).
- `POST /auth/logout` → `req.logout()`.

### 4.5 Inline middleware

Defined in `server/index.js` itself (there is no `server/middleware/` folder):

- `requireAuth(req, res, next)` → 401 unless `req.user`.
- `isAdmin(req, res, next)` → 403 unless `req.user.is_admin`. `is_admin` is loaded into the user object in `deserializeUser` by joining `users` with `profiles.is_admin`.

---

## 5. Authorization & feature gating (`server/entitlements.js`)

This is the single source of truth for *what a paying user is allowed to do*. The web client treats `/api/subscription`'s response as authoritative.

### 5.1 Plans (`PLAN_LIMITS`)

| Internal ID | Display | Outlets | Staff | Notable flags |
|---|---|---|---|---|
| `starter` | Launcher | 1 | 1 | KDS, analytics, tables. No mobile app, no integrations, no customer ordering, no inventory, no AI menu import. 3 QR menus. |
| `professional` | Growth | 1 | 2 | Above + mobile app + customer ordering. |
| `enterprise` | Expand | ∞ | ∞ | All add-on features baked in. ∞ QR menus. |

Without an active subscription, `DEFAULT_LIMITS` is returned (every flag `false`, every count `0`).

### 5.2 Add-ons (`ADDON_MONTHLY_PRICES`, INR/month)

| Type | Price | Behavior |
|---|---|---|
| `extra_outlet` | ₹250 | Stackable 1–50, additive to plan's outlet count. |
| `extra_staff` | ₹150 | Stackable 1–50, additive to plan's staff count. |
| `swiggy_integration` | ₹499 | Boolean. Turning either Swiggy *or* Zomato on flips `platformIntegrations` true. |
| `zomato_integration` | ₹499 | Boolean. Same as above. |
| `customer_ordering` | ₹299 | Boolean. |
| `inventory_management` | ₹399 | Boolean. |

Multi-month discount table: **3 mo → 5%, 6 mo → 10%, 12 mo → 20%.** Identical to `src/lib/plans.ts` on the frontend.

### 5.3 Helpers

- `isSubscriptionActive(sub)` — true iff `status IN ('active', 'trialing')` AND `expires_at` (or `trial_ends_at`) is in the future. A `past_due` row is fetched but considered inactive.
- `fetchActiveSubscription(userId)` — picks the most recent row in `('active', 'trialing', 'past_due')`.
- `fetchActiveAddons(userId)` — sums `quantity` per `addon_type` from `public.subscription_addons` where `status='active'` and not expired. Catches `42P01` (table doesn't exist) and degrades gracefully.
- `fetchUsage(userId)` — counts `outlets` and `staff_members` where `owner_id = userId`.
- `computeEffectiveLimits(plan, addons)` — layers add-ons on top of the plan; extra-outlet/staff add to counts, boolean add-ons OR in.
- `buildEntitlementsPayload(userId)` — the *only* function the API uses to assemble `/api/subscription` and `/api/entitlements`. Returns:
  ```ts
  {
    subscription,       // raw row or null
    addons,             // grouped { extra_outlets, extra_staff, swiggy, zomato, customer_ordering, inventory }
    effective_limits,   // merged limits with Infinity → null
    usage,              // { outlets, staff }
    has_active_subscription
  }
  ```
- `assertWithinOutletLimit(userId)` — throws `Error` with `code: 'OUTLET_LIMIT'`, `status: 403` when the user is at or above their cap. Used by `POST /api/outlets`.

### 5.4 Trials

There's no server-side trial logic — `verify-payment` writes `trial_ends_at: null`. Trial subscriptions exist only when set manually (`server/scripts/grant-test-subscription.js`) or by an admin migration.

---

## 6. Razorpay integration

There is **no Razorpay SDK**. The server speaks directly to `https://api.razorpay.com/v1/orders` with Basic Auth (`base64(KEY_ID:KEY_SECRET)`). Razorpay webhooks are **not** handled here — payment confirmation flows entirely through the client-side verify call.

### 6.1 Subscriptions

```
POST /api/payments/create-order
  ↓ assertValidBillingPeriod(period_months ∈ {3,6,12})
  ↓ calcAmount(plan_type, period_months)   // 5/10/20% discount applied
  ↓ Razorpay POST /v1/orders
returns { order_id, amount, amount_rupees, currency: 'INR', key_id }

(client runs Razorpay checkout)

POST /api/payments/verify-payment
  ↓ HMAC-SHA256(order_id + '|' + payment_id, key_secret) === signature
  ↓ INSERT INTO public.subscriptions (...) ON CONFLICT (razorpay_order_id) DO UPDATE
  ↓ status='active', expires_at = NOW() + months
  ↓ sendSubscriptionConfirmation(...)  ← fire-and-forget Brevo email
returns { success, expires_at }
```

### 6.2 Add-ons

Same shape, prefixed `add-on`:

- `POST /api/payments/create-addon-order` — validates `addon_type` (six allowed) + `period_months` + `normalizeAddonQuantity(qty)` (1–50 for stackable types, else 1).
- `POST /api/payments/verify-addon-payment` — HMAC check → `INSERT INTO public.subscription_addons (...) ON CONFLICT (razorpay_order_id) DO UPDATE` → returns the new entitlements payload.

### 6.3 Cancellation

`POST /api/payments/cancel-subscription` only marks the row `status='cancelled', cancelled_at = NOW()`. Since the platform is prepaid (no auto-renew), there is nothing to cancel gateway-side.

---

## 7. Mobile + native-app endpoints

The React Native WebView shell uses a small set of dedicated endpoints. See [`mobile-app.md`](mobile-app.md) §5 for the protocol layer.

| Endpoint | Purpose |
|---|---|
| `POST /api/billing/mobile-link` | Mint a one-time JWT (15 min) so the in-app WebView can hand off Razorpay checkout to the system browser. Kinds: `subscription`, `addon`, `settings` (sub-target `subscription` or `addons`). |
| `GET /api/billing/redeem` | Verify the JWT, call `req.login(user)` to establish a *fresh* browser session, redirect to `/billing/checkout` / `/settings?tab=subscription` / `/addons`. |
| `GET /api/billing/checkout-intent` | Once the browser is signed in, the React checkout page reads the decoded JWT payload (plan, period, addon, qty, `from_mobile: true`). |
| `GET /api/mobile-app/apk` | Streams the Android APK with a versioned filename derived from `mobile/app.json`. Searches `server/downloads/` → `public/downloads/` → `mobile/android/app/build/outputs/apk/release/`. |
| `GET /api/mobile-app/update-policy` | RN app reads `{ minVersion, forceUpdate, message }` from env vars (`MOBILE_*`). |
| `POST /api/mobile-app/download-request` | Landing-page "email me the APK" form; logs into `public.mobile_app_leads`. |

OAuth deep linking: `GET /auth/google?redirect_uri=banaooapp://…` — the redirect URI is base64url-encoded into the OAuth `state`.

---

## 8. Customer ordering (`server/customer-orders.js`)

Public unauthenticated endpoints used by the customer-facing ordering pages (`/r/:outletId`, `/order/:slug`) — see [`frontend.md`](frontend.md) §6. Registered into the app via `registerCustomerOrderRoutes(app, { requireAuth })`.

- **`GET /api/public/outlets/:outletId/payment-settings`** — UPI settings resolved outlet → profile → brand fallback. Only returns when `outlets.is_active = true`.
- **`POST /api/public/customer-orders`** — creates `orders` + `order_items` (+ `order_payments` if `payment_method='upi'`). Full validation (order type, dine-in table availability + no concurrent active order, UPI configured), server-computed subtotal, server-generated `ONL-<base36>` order number, transactional (`BEGIN/COMMIT/ROLLBACK`).
- **`GET /api/public/orders/:orderId/payment`** — order + payment state for the customer's payment screen.
- **`POST /api/public/orders/:orderId/submit-upi`** — customer submits UTR (min 6 chars). Sets `order_payments.status='awaiting_confirmation'`, `customer_reference`, `submitted_at`; flips `orders.payment_status='awaiting_confirmation'`. Idempotent when already paid.
- **`GET /api/order-payments`** *(owner-scoped)* — list of UPI payments for outlets this owner owns.
- **`PATCH /api/order-payments/:paymentId`** *(owner-scoped)* — confirm or reject a UPI payment; flips `orders.payment_status`.

The reason there is **no public INSERT RLS policy on `order_payments`** is because customer UTR submissions must go through this Node endpoint (which uses the pg pool directly, not the service-role key).

---

## 9. AI & external services

All credentials are env-var loaded; no provider SDKs are persisted as module singletons. Every call uses `fetch`.

### Brevo (email)

- `server/email.js` exports `sendSubscriptionConfirmation({ email, customerName, planType, periodMonths, amount, startDate, expiresAt })`.
- POSTs `https://api.brevo.com/v3/smtp/email` with header `api-key: BREVO_API_KEY`.
- Sender: `krackbotstudio@gmail.com` ("banaoo.in").
- Called fire-and-forget after `verify-payment` succeeds. Missing key logs a warning instead of failing the request.

### OpenAI

Three endpoints use it:

| Route | Model | Purpose |
|---|---|---|
| `POST /api/extract-menu` | `gpt-4o` | OCR a base64 image into a JSON array of `{ name, description, price, is_veg, category }`. Strips ```json fences. |
| `POST /api/voice-order` | `gpt-4o-mini` | Extracts a structured order from a transcript + menu list. POS mode adds `order_type` + `table_number`. Multi-language (Hindi/Telugu/Tamil/Kannada/English mixed). **No auth** — used by customers and POS staff. |
| `POST /api/support-chat` | `gpt-4o-mini` | Streaming SSE chat (`Content-Type: text/event-stream`). Streams upstream chunks via `response.body.getReader()`. **No auth**. |

### Image generation

`POST /api/generate-menu-image` is a cascading fallback:

1. **Cache**: `menu_item_images` table (`search_term, image_url, thumb_url, source`). If ≥ 5 cached hits exist, shuffle and return up to 8.
2. **TheMealDB** (no key) — `https://www.themealdb.com/api/json/v1/1/search.php?s=...`.
3. **Wikipedia REST** — `https://en.wikipedia.org/api/rest_v1/page/summary/...` with `User-Agent: banaoo-restaurant-app/1.0`.
4. **Pexels** — `https://api.pexels.com/v1/search?...` with `Authorization: PEXELS_API_KEY`.

### What's not used

- No SMS provider (no Twilio/MSG91/Fast2SMS).
- No queue/job system (Bull, Sidekiq, Celery, etc.).
- No structured logger (no Pino/Winston).

---

## 10. Uploads & static files

- **Multer** disk storage in `./uploads/` (relative to `process.cwd()`, which in Docker is `/app/uploads` — a mounted volume per `docker-compose.yml`). Filename `<timestamp>-<rand>.<ext>`, 5 MB cap, no MIME filter.
- **`POST /api/upload`** — single file (`upload.single('file')`), `req.isAuthenticated()` gate. Returns `{ url: '/uploads/<filename>' }` (relative URL works under any deploy domain).
- **Static serving**: `app.use('/uploads', express.static(...))` — any uploaded file is publicly accessible (no per-user ACL).
- **`POST /api/extract-menu`** does *not* use multer — it accepts `imageBase64` + `mimeType` as JSON (which is why `express.json({ limit: '10mb' })` is raised to 10 MB).
- **Downloads**: `resolveDownloadsDir()` looks in `server/downloads/`, then `public/downloads/`, and serves whichever exists at `/downloads/*`.

---

## 11. Admin endpoints

All gated by `isAdmin`. Defined in `server/index.js`. See [`api.md`](api.md) §10 for full request/response shapes.

- `GET /api/admin/accounts` — owner profiles + T&C audit + `users.email` join. Optional `?status=approved|pending|rejected|all`.
- `POST /api/admin/accounts/action` — `{ target_user_id, action: 'approve'|'reject' }`. Updates `profiles.account_status` and inserts a `public.notifications` row (`approve` routes to `/select-plan`).
- `GET /api/admin/affiliates` + `POST /api/admin/affiliates/action` — manage affiliate program members.
- `GET /api/admin/affiliate-payouts` + `POST /api/admin/affiliate-payouts/action` — manage payout requests through `requested → processing → completed/failed`.
- `GET /api/admin/mobile-app-leads` — paginated (`?limit=`, 1–1000, default 250) listing of APK download requests.

There are no admin routes for impersonation or manual subscription edits — use `server/scripts/grant-test-subscription.js` for ad-hoc grants.

---

## 12. Error handling, validation, logging

- **Logging**: `console.log` / `console.error` only. No structured logger.
- **Validation**: ad-hoc, in-route — regex for phone/email, allowlists for `order_type`, `payment_method`, `addon_type`, `plan_type`, `period_months`. No `zod`/`joi`/`express-validator`.
- **Per-route error handling**: every async route is wrapped in `try/catch` and ends with `res.status(500).json({ error: err.message })`.
- **Global error middleware**: registered at the bottom of `server/index.js` immediately before `ensureMobileAppLeadsTable()`. It runs only when a route does **not** catch an error itself (or explicitly calls `next(err)`), and classifies common cases:
  | Error shape | Response |
  |---|---|
  | `Error('Not allowed by CORS')` (from the CORS origin callback) | **403** `{ error: 'Origin not allowed', request_id }` |
  | `MulterError` with `code: 'LIMIT_FILE_SIZE'` | **413** with the multer message |
  | Other `MulterError` | **400** |
  | `entity.too.large` (body-parser) | **413** |
  | `entity.parse.failed` (body-parser) | **400** |
  | Anything with a numeric `err.status` | that status |
  | Else | **500** `{ error: 'Internal server error', request_id }` |
  Every response includes a short `request_id` that is also written to `console.error`, so a user-reported error can be cross-referenced with the server log. In **dev** the original error message and a short stack snippet are echoed back; in `production` the message is locked to `'Internal server error'` to avoid leaking implementation details.
- **404 handler**: registered just above the error handler. Returns `{ error: 'Not found', path, method }` instead of Express's default HTML page.
- **Idempotency**: handled at the DB layer via `ON CONFLICT (razorpay_order_id) WHERE razorpay_order_id IS NOT NULL DO UPDATE`.
- **Transactions**: only `server/customer-orders.js` uses `pool.connect()` + `BEGIN/COMMIT/ROLLBACK`. Everything else issues individual `pool.query` calls.
- **Rate limiting**: none in-process. Whatever rate limiting exists must come from Traefik/nginx.

---

## 13. Environment variables

| Var | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string. |
| `DATABASE_SSL` | no | `true` / `false` to force SSL; otherwise auto-detected (see §3). |
| `SESSION_SECRET` | yes | Cookie signing secret. |
| `FRONTEND_URL` | yes (prod) | Comma-separated CORS allowlist. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | optional | Disables Google login when missing. |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | yes (billing) | Razorpay Orders API. |
| `SUPABASE_JWT_SECRET` | yes | HS256 secret used both to mint browser JWTs and (as fallback) sign billing JWTs. |
| `BILLING_CHECKOUT_SECRET` | optional | Dedicated secret for billing-link JWTs; falls back to `SUPABASE_JWT_SECRET`. |
| `OPENAI_API_KEY` | required for AI features |  |
| `PEXELS_API_KEY` | optional | Image fallback. Missing key just disables Pexels. |
| `BREVO_API_KEY` | optional | Missing key logs a warning; transactional emails are simply skipped. |
| `MOBILE_MIN_VERSION` / `MOBILE_FORCE_UPDATE` / `MOBILE_FORCE_UPDATE_MESSAGE` | optional | Reads by `/api/mobile-app/update-policy`. |
| `PORT` | optional | Default 5000. |
| `NODE_ENV` | yes (prod) | Affects SSL auto-detect and cookie `secure`. |

---

## 14. Running locally

```powershell
# 1. Provision the DB (Supabase CLI or hosted)
# 2. Apply migrations
node server/scripts/apply-migration.js supabase/migrations/<all *.sql>

# 3. Backend
cd server
npm install
npm run dev          # nodemon on :5001 (proxied by vite at /api and /auth)

# 4. Frontend (in a separate shell)
npm run dev          # vite on :8080
```

The Vite proxy in `vite.config.ts` forwards `/api/*` and `/auth/*` to `localhost:5001`, with a *bypass* rule so the React routes `/auth` and `/auth/callback` are served by Vite instead of being forwarded.

---

## 15. Operational scripts

`server/scripts/`:

- **`apply-migration.js`** — `node server/scripts/apply-migration.js <file.sql> [<file2.sql> ...]`. Each file in its own transaction. Requires `DATABASE_URL`.
- **`grant-test-subscription.js`** — Grants `krackbotstudio@gmail.com` a 10-year Expand subscription by applying `supabase/migrations/20260515000002_grant_test_account_enterprise.sql`. Prints before/after state.

Top-level smoke / diagnostic scripts in `server/` (not in `scripts/` but used the same way):

- `run_migrations.js` — applies `server/migration.sql` (legacy bootstrap that drops all RLS and creates `public.users` from `auth.users`).
- `test_db.js` — `SELECT NOW()`.
- `test-email.js` — sends a sample Brevo confirmation.
- `test-pexels.js` — verifies `PEXELS_API_KEY` against `pexels.com/v1/search`.
- `check_admins.js`, `check_rls.js`, `check_schema.js`, `check_staff_schema.js`, `check_multiple_schemas.js`, `check_notifications.js`, `get_def.js` — one-off DB introspection helpers.

For older one-off scripts and the April 2026 SQL snapshots, see [`../db-archive/`](../db-archive/).

---

## 16. Where to read next

- **Every endpoint, request/response shape, auth requirement**: [`api.md`](api.md)
- **What the frontend expects from each endpoint**: [`frontend.md`](frontend.md) §6 (key flows)
- **How the mobile app talks to the backend**: [`mobile-app.md`](mobile-app.md) §5 (bridge protocol) + §6 (deep links / billing handoff)
- **What ships when**: [`CHANGELOG.md`](CHANGELOG.md)
