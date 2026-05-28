# Tectangle Admin CMS

**Status:** Customer 360 is now live in CMS; advanced refund/campaign tooling remains future work  
**Last updated:** 2026-05-27  
**Owner:** Tectangle platform team

---

## Overview

The **Tectangle CMS** is a separate administration panel for Banaoo platform operators. It lives at `/cms/*` and uses **dedicated CMS credentials** (`admin_users` table), not the restaurant owner login at `/auth`.

Restaurant owners with `profiles.is_admin = true` (legacy) can still sign into the CMS with their existing email/password during migration. All `/api/admin/*` endpoints accept either a CMS session or a legacy owner admin Passport session.

| Concern | Restaurant POS | Tectangle CMS |
|--------|----------------|---------------|
| Login URL | `/auth` | `/cms/login` |
| Session key | `req.session.passport` (Passport) | `req.session.cmsAdmin` |
| UI shell | `AppLayout` + sidebar | `CmsLayout` + `CmsSidebar` |
| Primary users | Restaurant owners & staff | Tectangle operators |

---

## Architecture

```
Browser (/cms/*)
    │
    ├─ CmsAuthProvider  →  GET /api/cms/me
    ├─ CmsLogin         →  POST /api/cms/login
    └─ CmsProtectedRoute + CmsLayout
           ├─ Dashboard     →  GET /api/cms/dashboard
           └─ Customers     →  AccountsPanel → /api/admin/*
```

### Backend modules (`server/admin/`)

| File | Purpose |
|------|---------|
| `auth.js` | Login, logout, `/api/cms/me`; legacy `is_admin` fallback |
| `middleware.js` | `requireCmsAuth`, `requireAdminAccess`, `requireSuperAdmin` |
| `dashboard.js` | KPI stats + recent signups |
| `audit.js` | `logAdminAction()` → `admin_audit_log` |
| `routes.js` | Registers `/api/cms/*`; re-exports middleware |

### Frontend modules (`src/`)

| Path | Purpose |
|------|---------|
| `lib/cms-auth.tsx` | `CmsAuthProvider`, `useCmsAuth` |
| `components/cms/CmsLayout.tsx` | Shell with sidebar + `<Outlet />` |
| `components/cms/CmsSidebar.tsx` | Navigation |
| `components/cms/CmsProtectedRoute.tsx` | Redirect to `/cms/login` if no CMS session |
| `pages/cms/CmsLogin.tsx` | CMS sign-in page |
| `pages/cms/Dashboard.tsx` | KPI dashboard |
| `pages/cms/Customers.tsx` | Wraps `AccountsPanel` from `pages/admin/Accounts.tsx` |
| `pages/cms/CustomerDetail.tsx` | Customer 360 detail panel (overview, orders, payments, subscriptions, settings, audit) |
| `pages/cms/Subscriptions.tsx` | Subscriptions module scaffold |
| `pages/cms/Payments.tsx` | Payments module scaffold |
| `pages/cms/Marketing.tsx` | Marketing module scaffold |
| `pages/cms/Roles.tsx` | Roles & access module scaffold |

### Database

Migration: `supabase/migrations/20260527000001_admin_cms.sql`

- **`admin_users`** — CMS operator accounts (email, bcrypt hash, role, `is_active`)
- **`admin_audit_log`** — Immutable audit trail (login, account actions, etc.)
- RLS enabled, **no client policies** — server pool only

**Roles (Phase 1 schema, Phase 5 UI):**

| Role | Intended scope |
|------|----------------|
| `super_admin` | Full access |
| `support` | Customers, tickets |
| `billing` | Subscriptions, payments |
| `marketing` | Leads, campaigns |

---

## Route map

| URL | Page | Status |
|-----|------|--------|
| `/cms/login` | CMS login | ✅ Done |
| `/cms/dashboard` | KPI dashboard | ✅ Done |
| `/cms/customers` | Owner approval, affiliates, payouts, leads | ✅ Done (migrated from `/admin/accounts`) |
| `/cms/customers/:userId` | Customer 360 detail + controls (includes full Settings sections) | ✅ Live |
| `/cms/subscriptions` | Plan management | ✅ Functional list + status/plan actions |
| `/cms/payments` | Razorpay / refunds | ✅ Read-only payments list live; refund actions pending |
| `/cms/marketing` | Leads, affiliates, CSV export | ✅ Functional overview + leads + export |
| `/cms/roles` | CMS user management | ✅ Functional (create, role, activate/deactivate) |

**Legacy redirects:**

- `/admin/accounts` → `/cms/customers`
- `/admin/account` → `/cms/customers`

**Auth redirects:**

- OAuth callback (`AuthCallback`) sends `is_admin` owners → `/cms/dashboard`
- `/auth` auto-redirect when already logged in as admin → `/cms/dashboard`

---

## API reference (CMS-specific)

See also [`api.md`](api.md) §10–11 for shared `/api/admin/*` endpoints.

### `POST /api/cms/login`

- **Auth:** none
- **Body:** `{ email, password }`
- **Success:** `{ admin: { id, email, full_name, role, source } }` + sets `req.session.cmsAdmin`
- **Errors:** `401` incorrect credentials

### `GET /api/cms/me`

- **Auth:** CMS session
- **Success:** `{ admin }`
- **Errors:** `401` not authenticated

### `POST /api/cms/logout`

- **Auth:** CMS session (optional)
- Clears `req.session.cmsAdmin`, logs `cms.logout`

### `GET /api/cms/dashboard`

- **Auth:** CMS session (`requireCmsAuth`)
- **Response:**
  ```json
  {
    "stats": {
      "total_owners": 0,
      "pending_approvals": 0,
      "active_subscriptions": 0,
      "pending_affiliates": 0,
      "mobile_app_leads": 0
    },
    "recent_signups": [{ "full_name", "email", "account_status", "created_at" }]
  }
  ```

### `GET /api/cms/subscriptions`

- **Auth:** CMS session
- **Query:** `?status=all|trialing|active|past_due|cancelled`, `?search=<email|name>`
- Returns recent subscription rows joined with owner email and profile name.

### `PATCH /api/cms/subscriptions/:id`

- **Auth:** CMS session + role `super_admin` or `billing`
- **Body (partial):** `{ status?, plan_type?, period_months?, expires_at? }`
- Updates subscription details and writes `cms.subscriptions.update` in `admin_audit_log`.

### `GET /api/cms/payments`

- **Auth:** CMS session
- **Query:** `?status=all|trialing|active|past_due|cancelled`, `?search=<email|name|payment_id>`
- Returns subscription-linked Razorpay payment history (read-only for now).

### `GET /api/cms/marketing/overview`

- **Auth:** CMS session
- Returns lead totals, 7-day lead count, affiliate counts by status, and top lead sources.

### `GET /api/cms/marketing/leads`

- **Auth:** CMS session
- **Query:** `?search=<email|phone>`, `?source=<source|all>`, `?limit=1..1000` (default 250)
- Returns mobile app download leads.

### `GET /api/cms/marketing/leads/export`

- **Auth:** CMS session
- **Query:** same filters as leads list
- Returns CSV attachment (`text/csv`) and logs `cms.marketing.leads_export`.

### `GET /api/cms/marketing/affiliates`

- **Auth:** CMS session
- **Query:** `?status=pending|approved|suspended|all` (default `pending`)
- Returns affiliate applications for marketing pipeline view.

### `GET /api/cms/customers/:userId/overview`

- **Auth:** CMS session
- Returns profile + usage metrics (outlets/staff) + latest subscription snapshot.

### `GET /api/cms/customers/:userId/orders`

- **Auth:** CMS session
- **Query:** `?limit=1..200` (default 50)
- Returns recent order history across all customer outlets.

### `GET /api/cms/customers/:userId/payments`

- **Auth:** CMS session
- Returns both subscription payment records and order payment records.

### `GET /api/cms/customers/:userId/subscriptions`

- **Auth:** CMS session
- Returns subscription history for the selected customer.

### `PATCH /api/cms/customers/:userId/profile`

- **Auth:** CMS session + role `super_admin` / `support` / `billing`
- **Body (partial):** `{ full_name?, phone?, business_type?, account_status?, onboarding_completed? }`
- Updates customer profile/admin status fields and writes audit entry.

### `PATCH /api/cms/customers/:userId/subscriptions/:subscriptionId`

- **Auth:** CMS session + role `super_admin` or `billing`
- **Body (partial):** `{ status?, plan_type?, period_months?, expires_at? }`
- Updates a specific customer subscription and writes audit entry.

### `GET /api/cms/customers/:userId/audit`

- **Auth:** CMS session
- Returns recent admin audit entries related to this customer.

### `GET /api/cms/admin-users`

- **Auth:** CMS session + `super_admin`
- Returns CMS admin users from `admin_users` with role and active status.

### `POST /api/cms/admin-users`

- **Auth:** CMS session + `super_admin`
- **Body:** `{ email, password, full_name?, role }`
- Creates a CMS admin user with bcrypt password hash.

### `PATCH /api/cms/admin-users/:id`

- **Auth:** CMS session + `super_admin`
- **Body (partial):** `{ full_name?, role?, is_active? }`
- Updates role/active/name. Prevents self-deactivation.

### `POST /api/cms/admin-users/:id/reset-password`

- **Auth:** CMS session + `super_admin`
- **Body:** `{ password }`
- Resets CMS admin password (min 8 chars).

### `/api/admin/*` (shared)

All existing admin endpoints use `requireAdminAccess`:

- CMS session (`req.session.cmsAdmin`), **or**
- Passport session with `profiles.is_admin = true`

Account approve/reject actions now write to `admin_audit_log`.

---

## Setup & deployment

### 1. Apply migrations (Supabase SQL Editor)

Run in order if not already applied:

1. `supabase/migrations/20260525000002_terms_acceptance.sql` — fixes owner signup (`terms_*` columns)
2. `supabase/migrations/20260527000001_admin_cms.sql` — CMS tables

Or via script:

```bash
node server/scripts/apply-migration.js supabase/migrations/20260527000001_admin_cms.sql
```

### 2. Seed first CMS admin

```bash
node server/scripts/seed-cms-admin.js admin@tectangle.com 'YourSecurePassword' "Admin Name"
```

Creates a `super_admin` row in `admin_users`.

### 3. Restart Express

After backend changes:

```bash
npm run dev:server
# or your production restart process
```

### 4. Verify

1. Open `/cms/login`
2. Sign in with seeded credentials
3. Dashboard loads KPIs
4. **Customers** → approve/reject a pending owner
5. Check `admin_audit_log` for `cms.login` and account action entries

---

## Implementation phases

### Phase 0 — Foundation ✅

- [x] DB migration (`admin_users`, `admin_audit_log`)
- [x] CMS auth API (`/api/cms/login|me|logout`)
- [x] `requireAdminAccess` middleware on `/api/admin/*`
- [x] Audit logging helper
- [x] Seed script

### Phase 1 — Shell + customers ✅ (this release)

- [x] `CmsAuthProvider`, layout, sidebar, protected route
- [x] Login, dashboard, customers pages
- [x] Wire routes in `App.tsx`
- [x] Legacy `/admin/*` redirects
- [x] `robots.txt` disallow `/cms/`
- [x] Admin OAuth redirect → CMS
- [x] Customer 360 detail page (`/cms/customers/:userId`)
- [x] Customer-specific CMS APIs (overview/orders/payments/subscriptions/settings/audit)

### Phase 2 — Subscriptions 🚧

- [x] Section page scaffold in CMS UI
- [x] Subscription list + filter + search in CMS UI
- [x] `/api/cms/subscriptions/*` endpoints
- [x] Manual status/plan updates with audit logging
- [ ] Trial extension flow with reason capture
- [ ] Safe plan-switch flow with proration checks
- See product plan naming in [`CHANGELOG.md`](CHANGELOG.md)

### Phase 3 — Payments 🚧

- [x] Section page scaffold in CMS UI
- [x] `/api/cms/payments` read-only endpoint
- [x] CMS payment list page with search and status filters
- [ ] Razorpay refund triggers + operator note
- [ ] Invoice export / reconciliation CSV

### Phase 5 — Roles 🚧

- [x] Section page scaffold in CMS UI
- [x] `/api/cms/admin-users/*` endpoints + `requireSuperAdmin`
- [x] CMS UI to create admin users, change role, activate/deactivate
- [ ] Add password reset action in UI (API is ready)
- [ ] Add delete/archive strategy and role-based guardrails

### Phase 6 — Marketing 🚧

- [x] Section page scaffold in CMS UI
- [x] Marketing overview KPIs
- [x] Mobile app leads list with search/source filters
- [x] CSV export with audit logging
- [x] Affiliate pipeline quick view
- [ ] Landing content/campaign management APIs and UI

---

## Security notes

- CMS login is **separate** from Supabase owner auth — reduces blast radius if owner JWT is compromised.
- `admin_users` and `admin_audit_log` have RLS with no policies — not readable via Supabase anon/authenticated clients.
- Use strong passwords for seeded admins; rotate after first login once Phase 5 ships.
- `robots.txt` blocks `/cms/` from crawlers.
- Internal test account override (`INTERNAL_FULL_ACCESS_EMAILS` in `server/entitlements.js`) is **entitlements only** — it does not grant CMS access.

---

## Change log (this doc)

| Date | Change |
|------|--------|
| 2026-05-27 | Initial Phase 0–1 implementation: backend module, frontend shell, customers migration, docs |
| 2026-05-27 | Added dedicated CMS module pages for Subscriptions, Payments, Marketing, and Roles (UI scaffolds). |
| 2026-05-27 | Implemented Roles module APIs (`/api/cms/admin-users/*`) and connected super-admin user management UI. |
| 2026-05-27 | Implemented Subscriptions module APIs (`/api/cms/subscriptions/*`) and connected list + update actions in CMS UI. |
| 2026-05-27 | Implemented Payments read-only API (`/api/cms/payments`) and connected payments timeline UI in CMS. |
| 2026-05-27 | Implemented Marketing APIs (`/api/cms/marketing/*`) with leads table, CSV export, and affiliate pipeline view. |
| 2026-05-27 | Added Customer 360 (`/cms/customers/:userId`) with CMS APIs for overview, orders, payments, subscriptions, profile updates, and audit timeline. |
| 2026-05-27 | Expanded Customer 360 Settings to include Profile, Outlets, Branding, Subscription, Notifications, Security, and Printers sections. |

---

## Related docs

- [`api.md`](api.md) — full HTTP reference
- [`backend.md`](backend.md) — Express server map
- [`frontend.md`](frontend.md) — web app routes
- [`CHANGELOG.md`](CHANGELOG.md) — team changelog
- [`wallet-system-plan.md`](wallet-system-plan.md) — future billing/wallet admin (Phase 3+ overlap)
