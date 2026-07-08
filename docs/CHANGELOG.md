# Banaoo — Team changelog & backend handoff

**Purpose:** Single living document for frontend, backend, mobile, and ops. Update this file whenever we ship or plan a change (add a dated entry under [Change log](#change-log)).

**Last updated:** 2026-05-28

---

## How to maintain this file

1. Add a new **Change log** subsection with date + short title.
2. List **Frontend**, **Backend**, **Mobile**, **DB**, and **Deploy** bullets.
3. Move completed backend TODOs to **Done**; add new items under **Backend team TODO**.
4. Do not edit the attached Cursor plan files — only this file.
5. **Public docs:** For user-visible changes, update `src/content/docs/articles/*.md` and bump `lastUpdated` in `src/content/docs/registry.ts` (see `.cursor/rules/public-docs.mdc`).

---

## Public documentation (`/docs`)

- **URL:** `/docs` and `/docs/:slug` on the marketing site
- **Source:** `src/content/docs/` (manifest + markdown articles)
- **Release checklist:** `[ ]` Public docs updated when shipping owner-facing features

---

## Plan naming (current product)

| Internal `plan_type` (DB) | Display name | Monthly price |
|---------------------------|--------------|---------------|
| `starter` | Launcher | ₹499 |
| `professional` | Growth | ₹699 |
| `enterprise` | Expand | Custom |

Add-ons (Razorpay checkout): extra outlet **₹250/mo**, extra staff **₹150/mo**, customer ordering **₹299/mo**, inventory **₹399/mo**, Swiggy **₹499/mo**, Zomato **₹499/mo**, WhatsApp **₹349/mo**, Shiprocket delivery **free** (add-on).

---

## Change log

### 2026-05-28 — Shiprocket delivery & outlet ordering links

**Summary:** Per-outlet Shiprocket auto-booking for native delivery orders; ordering links/QR moved to outlet detail pages; public docs added.

| Area | Changes |
|------|---------|
| **Backend** | `server/shiprocket/*` — connect, book, webhook, jobs, dashboard stats; migration `20260611000001_shiprocket_delivery.sql`. |
| **Backend** | Free `shiprocket_delivery` add-on (`calcAddonAmount` supports ₹0). |
| **Frontend** | Settings → Delivery → Shiprocket; order delivery panel; dashboard cards; checkout pincode/city/state; customer timeline. |
| **Frontend** | Ordering link + QR on **Outlets → [outlet]**; brand link on **Settings → Branding**. |
| **Docs** | `docs/shiprocket.md`, `/docs/shiprocket-delivery`, updated outlets/orders/FAQ articles. |

### 2026-05-27 — Notification reliability hardening

**Summary:** Strengthened in-app notifications so order/new-order/cancel signals and app-update alerts are more reliable across environments.

| Area | Changes |
|------|---------|
| **Backend** | New `server/notifications-bootstrap.js` auto-provisions `notifications` table/indexes, realtime publication link, and `orders` trigger (`notify_on_order_change`) on startup. |
| **Backend** | `GET /api/mobile-app/update-policy` now writes a deduped `app_update` notification (max once per 24h per user) when force update is enabled and user is authenticated. |
| **Frontend** | `useNotifications()` realtime subscription now uses user-scoped channels and listens to `INSERT`, `UPDATE`, and `DELETE` events for better unread/read sync. |
| **Frontend** | `NotificationCenter` adds dedicated icon/color handling for `app_update` notifications. |

### 2026-05-27 — Tectangle Admin CMS modules (Phase 2–6)

**Summary:** Expanded CMS beyond dashboard/customers with functional Subscriptions, Payments, Marketing, and Roles modules backed by new `/api/cms/*` endpoints.

| Area | Changes |
|------|---------|
| **Backend** | `server/admin/subscriptions.js`, `payments.js`, `marketing.js`, `admin-users.js` — list/update subscriptions, read payments, marketing overview/leads/export/affiliates, CMS admin user CRUD. |
| **Backend** | `server/admin/customers.js` — customer 360 APIs (`overview`, `orders`, `payments`, `subscriptions`, `profile update`, `subscription update`, `audit`). |
| **Frontend** | `src/pages/cms/Subscriptions.tsx`, `Payments.tsx`, `Marketing.tsx`, `Roles.tsx`, `CustomerDetail.tsx` — live data tables, filters, CSV export, super-admin staff management, and per-customer control panel. |
| **Docs** | `docs/admin-cms.md`, `docs/api.md`, `docs/frontend.md` updated with customer-detail route and CMS API expansion. |

### 2026-05-27 — Tectangle Admin CMS (Phase 0–1)

**Summary:** Introduced a dedicated platform admin panel at `/cms` with separate login, dashboard KPIs, and migrated customer management from the legacy `/admin/accounts` POS route.

| Area | Changes |
|------|---------|
| **DB** | `supabase/migrations/20260527000001_admin_cms.sql` — `admin_users`, `admin_audit_log`, RLS (server-only). |
| **Backend** | New `server/admin/` module: CMS auth (`/api/cms/login`, `/me`, `/logout`), dashboard stats, audit logging, `requireAdminAccess` on all `/api/admin/*`. Seed script `server/scripts/seed-cms-admin.js`. |
| **Frontend** | `CmsAuthProvider`, `CmsLayout`, `CmsSidebar`, `CmsProtectedRoute`; pages under `src/pages/cms/` (login, dashboard, customers). `AccountsPanel` extracted in `pages/admin/Accounts.tsx`. Routes in `App.tsx`; `/admin/*` → `/cms/customers`. Admin OAuth redirect → `/cms/dashboard`. |
| **SEO** | `public/robots.txt` — `Disallow: /cms/` |
| **Docs** | New [`docs/admin-cms.md`](admin-cms.md); updated `docs/README.md`, `docs/api.md`, `docs/frontend.md`. |
| **Deploy** | Apply CMS migration in Supabase; run seed script; restart Express. |

### 2026-05-26 — Backend error handler + April schema back-fill

**Summary:** Closed two long-standing gaps surfaced while writing the new dev docs — the backend now has a real top-level error handler, and the April-2026 GST/batch columns finally have a checked-in migration so a fresh Supabase database matches production.

| Area | Changes |
|------|---------|
| **Backend** | `server/index.js`: added a JSON **404 handler** and a **centralised error middleware** registered immediately before the listen call. Classifies CORS rejections (→ 403), `MulterError` (→ 413/400), body-parser overflow (→ 413), malformed JSON (→ 400), `err.status` shapes, and falls back to 500 `Internal server error`. Every response carries a short `request_id` that is also logged to `console.error`, so a user-reported failure can be cross-referenced. In dev the original message + an 8-line stack snippet are surfaced; in production both are hidden. See [`docs/backend.md`](backend.md) §12 for the table. |
| **DB** | New idempotent migration `supabase/migrations/20260526000001_april_schema_backfill.sql` adds the six columns that shipped in April 2026 but never had a migration file: `order_items.{status, batch_id, gst_rate}`, `menu_items.gst_category`, `outlets.{gst_number, gst_categories}`. All use `ADD COLUMN IF NOT EXISTS` and matching defaults from `db-archive/19-april.sql`, so production is a no-op and fresh databases land in the same shape. Also adds two helper indexes on `order_items(status)` and `order_items(batch_id)` for kitchen-display and batch-print routing. |
| **Docs** | `docs/backend.md` §12 rewritten to describe the new error and 404 handlers. |
| **Deploy** | Run the new migration on production once. Recommended path: `node server/scripts/apply-migration.js supabase/migrations/20260526000001_april_schema_backfill.sql`. No code releases blocked by this — the new error handler is additive (existing per-route `try/catch` still catches first). |

### 2026-05-20 — Public documentation site

**Summary:** Customer-facing docs at `/docs` with footer and navbar links; Cursor rule to keep articles in sync with product changes.

| Area | Changes |
|------|---------|
| **Frontend** | `src/pages/Docs.tsx`, `DocsArticle.tsx`, `src/components/docs/*`, `src/content/docs/articles/*.md`, routes in `App.tsx`, Footer + Navbar links, `@tailwindcss/typography` for prose |
| **Deps** | `react-markdown`, `remark-gfm` |
| **Docs process** | `.cursor/rules/public-docs.mdc`, `src/content/docs/README.md` |

**Deploy:** Ship web to `banaoo.in` so `/docs` is live.

### 2026-05-19 — Android package `com.banaoo` (Play Store)

**Summary:** Application ID changed from `com.banaoo.pos` → **`com.banaoo`** before first Play upload. Run `expo prebuild --clean` after changing `app.json`.

**AAB (local Gradle):** `mobile/play-store/releases/banaoo-app-V.0.08.aab` · package **`com.banaoo`** · version **0.0.8** (versionCode 10). Rebuild: `npm run build:aab:local` from `mobile/`.

---

### 2026-05-19 — Mobile APK **0.0.8** (versionCode 10)

**Summary:** Release APK with updated app icon from `mobile/assets`, menu schedule, paper width presets, LAN printers.

| Item | Value |
|------|--------|
| Version | **0.0.8** (`versionCode` **10**) |
| APK | `public/downloads/banaoo-app-V.0.08.apk`, `banaoo-latest.apk` |
| Build | `mobile/scripts/build-release-apk.ps1` (local Gradle) |
| Icons | `npm run icons:generate` from `mobile/assets/icon.png` |

---

### 2026-05-19 — Menu item availability schedule (days & times)

**Summary:** Menu items can auto hide/show by day and time (e.g. breakfast-only). Manual **Available** toggle still disables completely.

#### Database

| Migration | What |
|-----------|------|
| `20260519000004_menu_item_availability_schedule.sql` | `schedule_enabled`, `availability_schedule` JSONB, `menu_item_is_orderable()` + updated customer RLS |

#### Frontend

- `src/lib/menu-availability.ts` — effective availability + schedule formatting
- `src/components/menu/AvailabilityScheduleSection.tsx` — UI in Add/Edit item dialogs
- `Menu.tsx`, `NewOrder.tsx`, `customer/MenuPage.tsx`, `mobile/src/services/menu.ts`

---

### 2026-05-19 — Paper width presets, calibration print & layout profiles

**Summary:** Thermal receipts now use **mm + column count** (not just 58/80). Presets: 40, 58, 76, 80, 90 mm and custom. **Calibration print** shows ruler lines to tune columns. USB port assign **suggests** layout from VID:PID (user still calibrates).

#### Frontend (PWA)

- `src/lib/paper-width.ts`, `src/lib/printer-profiles.ts` — layout resolution + USB profile hints
- `src/components/settings/PaperLayoutControls.tsx` — preset/custom mm/columns, ± narrower/wider, calibration button
- `PrinterSettings.tsx` — wired test/calibration prints; profile toast on kitchen/billing port assign
- `serial-printer.ts`, `print-kitchen.ts`, `print-billing.ts`, `Orders.tsx` — ESC/POS uses `PrintLayout`
- `native-print-bridge.ts` — optional `paperWidthMm` / `paperColumns` on native payloads

#### Mobile

- `mobile/src/printer/paper-width.ts`, `PaperLayoutSection.tsx` — same presets in Native Printer Settings
- `escpos.ts` — `buildCalibrationSlip`; all slips use column layout
- `PwaShellScreen.tsx` — honors `paperWidthMm` from PWA bridge

---

### 2026-05-19 — Header add-ons button & Inventory add-on

**Summary:** **Add-ons** button (Package icon) in the top app header for owners. **Inventory Management** sold as add-on (₹399/mo); `/inventory` page with stock tracking per outlet.

#### Database

| Migration | What |
|-----------|------|
| `20260519000003_inventory_management_addon.sql` | Creates `subscription_addons` (if missing), `inventory_management` type, `inventory_items` table — **run this single file in SQL Editor** |

#### Frontend

- `AppLayout.tsx` — header Add-ons link
- `AppSidebar.tsx` — Inventory nav (gated)
- `src/pages/Inventory.tsx` — stock list, low-stock alerts, +/- adjustments

### 2026-05-19 — Subscription entitlements & add-ons store

**Summary:** Plan limits are enforced with purchased add-ons stacked on base plan caps. New **Add-ons** page (`/addons`) with Razorpay checkout. Launcher blocks customer ordering link until Growth or add-on; Swiggy/Zomato gated per integration add-on.

#### Database

| Migration | What |
|-----------|------|
| `supabase/migrations/20260519000002_subscription_addons.sql` | `subscription_addons` table (addon_type, quantity, status, expires_at, Razorpay ids) |

#### Backend

- `server/entitlements.js` — `buildEntitlementsPayload`, outlet limit check
- `GET /api/subscription` — returns `{ subscription, addons, effective_limits, usage, has_active_subscription }`
- `GET /api/entitlements` — same payload
- `POST /api/outlets` — 403 when outlet cap reached
- `POST /api/payments/create-addon-order`, `verify-addon-payment`

#### Frontend

- `src/lib/plans.ts` — `ADDON_CATALOG`, per-feature limits (`customerOrdering`, `swiggyIntegration`, `zomatoIntegration`)
- `src/lib/entitlements.ts`, `use-subscription.ts`, `use-feature-gating.ts`
- `src/pages/Addons.tsx`, route `/addons`
- Gates: `OutletDetail` (customer ordering), `Integrations` (Swiggy/Zomato), `Settings` outlets, `Staff` seats

**Deploy:** Run migration `20260519000002_subscription_addons.sql` on production DB before enabling add-on checkout.

### 2026-05-18 — Self service mode (outlet setting + counter print flow)

**Summary:** Outlets can enable **Self service (billing counter)** mode. Counter staff place orders in New Order; the app prints **kitchen bill** + **customer token**. Online/aggregator orders (`zomato`, `swiggy`, etc.) show a platform banner on kitchen slips; in self-service mode, new online orders auto-print to the kitchen printer when auto-print is on.

#### Database

| Migration | What |
|-----------|------|
| `supabase/migrations/20260519000001_outlet_operation_mode.sql` | `outlets.operation_mode` — `standard` \| `self_service` |

#### Frontend (done)

| Area | Files |
|------|--------|
| Types / helpers | `src/lib/outlet-operation.ts` |
| Outlet context | `src/lib/outlet-context.tsx` |
| Outlet settings UI | `src/pages/OutletDetail.tsx` |
| Slips | `src/lib/serial-printer.ts` — `source` banner, `buildCustomerTokenSlip` |
| Print paths | `src/lib/print-kitchen.ts`, `src/lib/print-customer-token.ts`, `src/lib/print-self-service.ts` |
| Native bridge | `src/lib/native-print-bridge.ts` — `customer_token` role |
| New order | `src/pages/NewOrder.tsx` — skip table step, print kitchen + token |
| Success dialog | `src/components/order/OrderSuccessDialog.tsx` |
| Kitchen | `src/pages/Kitchen.tsx` — auto-print online orders in self-service mode |

#### Mobile (done)

| Area | Files |
|------|--------|
| ESC/POS | `mobile/src/printer/escpos.ts` |
| Print service | `mobile/src/printer/printer-service.ts` — `printCustomerTokenSlip` |
| WebView bridge | `mobile/src/screens/PwaShellScreen.tsx` |

**Enable:** Outlet detail → Edit → Operation mode → **Self service (billing counter)**. Apply migration on production DB before saving.

**New Order UI (self-service):** Skips Dine In / Takeaway step; top bar shows **Self Service** (no Change back button); step labels are Step 1 · Menu / Step 2 · Review.

---

### 2026-05-18 — Analytics: 6M / 1Y ranges + CSV export

**Summary:** Analytics page now supports **6‑month** and **1‑year** ranges in addition to 7D / 30D / 90D, and adds a one-click **CSV export** dropdown (Summary, Orders, Order items). Long ranges (>90 days) auto-aggregate the trend chart into **weekly buckets** so the line chart stays readable.

#### Frontend (done)

| Area | Files | What changed |
|------|--------|--------------|
| Analytics page | `src/pages/Analytics.tsx` | New 6M / 1Y range buttons; CSV export dropdown (summary / orders / items); weekly bucketing for >90d; chunked `order_items` fetch to avoid Supabase `IN()` size limits; soft cap of 20,000 orders per fetch |

**Behavior notes:**
- CSV files include a UTF‑8 BOM so Excel / Google Sheets opens them correctly.
- Files are named `banaoo_<kind>_<outlet>_<days>d.csv`.
- Export is client-side from the data already loaded — no extra DB roundtrip.
- Plan gating: Analytics itself is included on Launcher / Growth / Expand. CSV export is currently not gated (same plans as Analytics). If we want it to be a paid tier feature, add `analyticsExport` to `PlanLimits` in `src/lib/plans.ts` and check via `useFeatureGating().canAccess("analyticsExport")` before showing the Export dropdown.

---

### 2026-05-18 — Internal test account: full Expand (enterprise) access

**Summary:** Granted **krackbotstudio@gmail.com** a long-lived **enterprise** subscription and ensured the account is **approved**, so the team can test all product features without payment.

#### Database / ops (done)

| Area | Files | What changed |
|------|--------|--------------|
| Migration | `supabase/migrations/20260515000002_grant_test_account_enterprise.sql` | **New** — idempotent grant: `plan_type = enterprise`, `status = active`, `expires_at` +10 years, cancels prior active/trialing rows |
| Runner script | `server/scripts/grant-test-subscription.js` | **New** — applies migration via `DATABASE_URL`; prints before/after |

**Production (applied):** User `079d2230-b438-4b6c-8625-1950a796420a` — was `professional` (Growth) until 2026-04-27 → now `enterprise` (Expand) active until **2036-05-18**. `account_status` remains `approved`.

**After deploy / grant:** User should **log out and back in** (or hard refresh) so `/api/subscription` returns the new plan.

**Re-run on another environment:**

```bash
node server/scripts/grant-test-subscription.js
```

Or run the SQL in Supabase SQL editor / `supabase db push` if migrations are applied that way.

---

### 2026-05-18 — Printers: Bluetooth, Wi‑Fi/LAN, USB (PWA + APK)

**Summary:** Unified printer settings for kitchen and billing across web PWA and Android APK. Wi‑Fi/LAN (TCP port 9100) silent print on **Android APK only**; desktop PWA keeps Web Serial (USB/Bluetooth) and browser print dialog; network fields on web are saved for APK use with a clear “use Android app” message on print.

#### Frontend (done)

| Area | Files | What changed |
|------|--------|--------------|
| Shared types | `src/lib/printer-types.ts` | **New** — `PrinterTransport`, labels, default port 9100 |
| Settings hook | `src/lib/use-printer-settings.ts` | `transport`, `networkHost`, `networkPort`, settings version 2 |
| Printers tab | `src/components/settings/PrinterSettings.tsx` | Connection grid (Bluetooth / USB / Network / Browser), LAN IP/port, port panel for USB/BT |
| Settings page | `src/pages/Settings.tsx` | PWA: full `PrinterSettings`; APK shell: native printer card |
| Billing print | `src/lib/print-billing.ts` | **New** — native bridge → serial → network guidance on web |
| Kitchen print | `src/lib/print-kitchen.ts` | Blocks silent network print on web with APK guidance |

#### Mobile (done)

| Area | Files | What changed |
|------|--------|--------------|
| TCP adapter | `mobile/src/printer/network-tcp-adapter.ts` | **New** — ESC/POS over TCP :9100, connection test |
| Print service | `mobile/src/printer/printer-service.ts` | Network path, validation, `testKitchenPrint` / `testBillingPrint` |
| Native UI | `mobile/src/screens/NativePrinterScreen.tsx` | Wi‑Fi/LAN segment, IP/port, test print buttons |
| Permissions | `mobile/app.json` | `INTERNET`, `ACCESS_NETWORK_STATE` |
| Dependency | `mobile/package.json` | `react-native-tcp-socket@6.2.0` |

**Deploy note:** Rebuild Android APK (`expo prebuild` / `expo run:android`) after pulling so `react-native-tcp-socket` is linked.

---

### 2026-05-18 — Pricing: Launcher / Growth / Expand

**Summary:** New public pricing table, Settings checkout aligned, Razorpay amounts ₹499/₹699, feature gating updated. Internal DB plan IDs unchanged (`starter` / `professional` / `enterprise`).

#### Frontend (done)

| Area | Files | What changed |
|------|--------|--------------|
| Plan catalog | `src/lib/plans.ts` | **New** — prices, comparison matrix, `PLAN_LIMITS`, `calcPlanTotal`, display names |
| Pricing UI | `src/components/landing/PricingComparison.tsx` | **New** — desktop table + mobile cards, CTAs |
| Landing | `src/pages/Landing.tsx` | `#pricing` section with `PricingComparison` |
| Pricing page | `src/pages/Pricing.tsx` | **New** — standalone `/pricing` (fixes FeatureGate 404) |
| Routing | `src/App.tsx` | Route `GET /pricing` |
| Navbar | `src/components/landing/Navbar.tsx` | Pricing link: `/#pricing` on home, `/pricing` elsewhere |
| Settings | `src/pages/Settings.tsx` | Cards renamed Launcher / Growth / Expand; prices via `calcPlanTotal`; feature bullets updated |
| Feature gating | `src/hooks/use-feature-gating.ts` | Limits from `plans.ts`; Launcher/Growth = 1 outlet, 5 staff; analytics/KDS/table on; Growth + mobile app |
| Subscriptions UX | `src/hooks/use-subscription.ts` | Razorpay modal labels: Launcher / Growth / Expand |
| Affiliate copy | `src/pages/Affiliate.tsx` | Example commission uses ₹699 Growth plan |

#### Backend / server (done in repo)

| Area | Files | What changed |
|------|--------|--------------|
| Payments API | `server/index.js` | `BASE_PRICES`: `starter: 499`, `professional: 699` |
| Payments API | `server/index.js` | Support-chat system prompt — new plan names and prices |
| Edge function | `supabase/functions/create-razorpay-order/index.ts` | Same `BASE_PRICES` |
| Edge function | `supabase/functions/support-chat/index.ts` | Pricing prompt updated |
| Email | `server/email.js` | `PLAN_DETAILS` — Launcher / Growth / Expand features |

#### Mobile (done)

| Area | Files | What changed |
|------|--------|--------------|
| App version | `mobile/app.json`, `mobile/android/app/build.gradle` | **0.0.7**, `versionCode` **9** |
| APK name | `mobile/android/app/build.gradle`, `mobile/scripts/build-release-apk.ps1` | Release APK: `banaoo-app-V.0.07.apk` |
| Downloads | `public/downloads/banaoo-app-V.0.07.apk`, `banaoo-latest.apk` | Copied on release build |
| Landing download | `src/pages/Landing.tsx`, `server/index.js` | Download filename + APK candidate paths |
| App icon | `mobile/assets/icon.png`, `adaptive-icon.png` | User-updated; `expo prebuild` regenerated Android mipmaps |

---

### 2026-05-18 — Prior session (reference)

Kitchen sound, simplified kitchen UI, 3-step New Order flow, auto kitchen print, New Order cart layout fix, service worker fetch handler removed, Supabase realtime migration for kitchen orders (`supabase/migrations/20260518000001_orders_realtime_replica_identity.sql`).

---

## Backend team TODO

Use this as the deployment and follow-up checklist. Check items off in PRs or ops tickets.

### P0 — Deploy what is already in code

- [ ] **Deploy Node server** (`server/index.js`) to production so `/api/payments/create-order` charges **₹499 / ₹699** (not legacy ₹999 / ₹2,499).
- [ ] **Redeploy frontend** static build so Landing `/#pricing`, `/pricing`, and Settings show Launcher / Growth / Expand.
- [ ] **Deploy Supabase edge functions** (if production uses them for payments):
  - `create-razorpay-order` (updated prices)
  - `support-chat` (updated pricing prompt)
- [ ] **Verify Razorpay live keys** on server: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`.
- [ ] **Smoke test checkout:** Starter → Launcher ₹499 for 1 month; Professional → Growth ₹699; confirm `subscriptions.plan_type` still `starter` / `professional`.
- [ ] **Copy APK into production artifact:** ensure `public/downloads/banaoo-latest.apk` is included in Docker/nginx image (`server/Dockerfile` copies `banaoo-latest.apk` → `server/downloads/`).

### P1 — Database (recommended, not yet migrated)

No migration was required for display-name-only change. Optional improvements:

- [ ] **Add `display_name` column** on `subscriptions` (or a `plans` reference table) if reporting/UI should not map `starter` → Launcher in app code only.
- [ ] **Document grandfathering:** existing active rows keep old amounts until renewal; confirm product policy (no automatic repricing vs migrate on next payment).
- [ ] **Add-on billing schema** (not implemented in app yet):
  - Table e.g. `subscription_addons` (`user_id`, `type`: `extra_outlet` | `extra_staff`, `quantity`, `monthly_amount`, `status`)
  - Or columns on `subscriptions`: `extra_outlets_count`, `extra_staff_count`
- [ ] **Entitlements in DB** (optional): persist `mobile_app_access`, outlet/staff limits server-side for API enforcement (today enforced in frontend `use-feature-gating.ts` only).
- [ ] **Apply pending migrations** on production Supabase if not applied:
  - `20260518000001_orders_realtime_replica_identity.sql` (kitchen realtime)
  - `20260515000002_grant_test_account_enterprise.sql` (only if test account grant not already applied via script)

### P1 — Server / API follow-ups

- [ ] **Single source of truth for prices:** import shared constants or env `PLAN_PRICE_STARTER=499`, `PLAN_PRICE_PROFESSIONAL=699` instead of duplicating in `server/index.js` + edge function (frontend already has `src/lib/plans.ts`).
- [ ] **Add-on checkout APIs:** `POST /api/payments/add-addon` (outlet ₹300, staff ₹150) + webhook/verify flow.
- [ ] **Enforce Growth mobile app:** gate APK download or native features by `plan_type === 'professional' | 'enterprise'` in `server/index.js` (`/api/mobile-app/download-request`, `/api/mobile-app/apk`).
- [ ] **Admin reporting:** update any internal dashboards/scripts that still say Starter ₹999 / Professional ₹2,499.
- [ ] **If using Razorpay Subscription IDs** (`create-razorpay-subscription`): create/update Dashboard plans for ₹499 and ₹699; set `RAZORPAY_STARTER_PLAN_ID` / `RAZORPAY_PROFESSIONAL_PLAN_ID`. Current primary flow is **one-time orders** via `create-order` (amount computed in code).

### P2 — Ops & comms

- [ ] Email templates / Brevo: confirm `server/email.js` copy matches production template if overridden elsewhere.
- [ ] Notify existing subscribers of new public pricing (if applicable).
- [ ] Play Store: when publishing mobile **0.0.7**, bump listing screenshots/description if they mention old plan names.

---

## Backend team TODO — Done

- [x] Update `BASE_PRICES` in `server/index.js` (499 / 699)
- [x] Update `create-razorpay-order` edge function prices
- [x] Update support-chat pricing prompts (server + edge)
- [x] Update transactional email plan names in `server/email.js`
- [x] Grant **krackbotstudio@gmail.com** enterprise test subscription (production DB, May 2026)

---

## File index (quick reference)

### Frontend

```
src/lib/plans.ts
src/lib/printer-types.ts
src/lib/use-printer-settings.ts
src/lib/print-billing.ts
src/lib/print-kitchen.ts
src/components/landing/PricingComparison.tsx
src/components/settings/PrinterSettings.tsx
src/pages/Pricing.tsx
src/pages/Landing.tsx          # #pricing section
src/pages/Settings.tsx         # subscription + printers tab
src/hooks/use-feature-gating.ts
src/hooks/use-subscription.ts
src/components/landing/Navbar.tsx
src/App.tsx
src/components/FeatureGate.tsx # links to /pricing
```

### Backend / infra

```
server/index.js                # payments, APK download, support-chat prompt
server/email.js
server/scripts/grant-test-subscription.js
server/Dockerfile              # copies banaoo-latest.apk
supabase/functions/create-razorpay-order/index.ts
supabase/functions/support-chat/index.ts
public/downloads/banaoo-latest.apk
public/downloads/banaoo-app-V.0.07.apk
```

### Mobile

```
mobile/app.json
mobile/package.json            # react-native-tcp-socket
mobile/android/app/build.gradle
mobile/scripts/build-release-apk.ps1
mobile/src/printer/network-tcp-adapter.ts
mobile/src/printer/printer-service.ts
mobile/src/screens/NativePrinterScreen.tsx
mobile/assets/icon.png
mobile/assets/adaptive-icon.png
```

### Database

```
supabase/migrations/20260113070635_*.sql   # subscriptions.plan_type IN ('starter','professional','enterprise')
supabase/migrations/20260515000002_grant_test_account_enterprise.sql
supabase/migrations/20260518000001_orders_realtime_replica_identity.sql
```

---

## Template for next entry

```markdown
### YYYY-MM-DD — Short title

**Summary:** One line.

#### Frontend (done / pending)
- ...

#### Backend (done / pending)
- ...

#### Backend team TODO (new items)
- [ ] ...
```
