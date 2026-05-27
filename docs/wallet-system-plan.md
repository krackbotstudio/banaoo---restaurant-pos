# Online Order Wallet & Integration Management — Implementation Plan

> **Status:** Proposal / not yet implemented. Last updated 2026-05-26.
> **Scope:** Prepaid credit wallet that meters Swiggy / Zomato (and future) online-order syncs, plus the admin tools to manage packages, pricing, refunds, and analytics.

---

## ⚠️ Decisions — please pick before any code

This proposal carries six product/policy choices that change the implementation materially. Lock them in before opening the first PR.

| # | Decision | Default I'd ship if you said nothing | Lives in |
|---|---|---|---|
| 1 | **Wallet model** (replaces addons / coexists / new-services-only) | **B — Addon = access right, wallet = usage** | §1 |
| 2 | **Pricing of an online order** | **Per-platform flat** (e.g. swiggy = 1 credit, zomato = 1 credit), editable from admin | §9 q2 |
| 3 | **Credit peg** (₹ ↔ credit) | **₹1 = 1 credit** (so a 500-credit pack is ₹500) | §9 q3 |
| 4 | **Grace limit default** (how far below zero you allow the wallet to go) | **0** for trial accounts, configurable per-account for paying customers | §9 q4 |
| 5 | **Behaviour when balance hits 0 mid-order** | **Accept the order, debit into grace, alert the restaurant** | §9 q5 |
| 6 | **Refund on platform-side cancellation** | **Yes**, automatic via `wallet_credit('credit_refund', …)` | §9 q6 |

The rest of this file is written assuming those defaults. The schema and service layer work for any choice; only the copy and exact route behaviour change.

---

## Table of contents

1. [The single most important decision — wallet vs addon coexistence](#1-the-single-most-important-decision-please-pick-before-any-code)
2. [Architecture overview](#2-architecture-overview)
3. [Database schema](#3-database-schema)
4. [Backend module layout](#4-backend-module-layout)
5. [Frontend layout](#5-frontend-layout)
6. [Notifications & alerts](#6-notifications--alerts)
7. [Integration with existing entitlements](#7-integration-with-existing-entitlements)
8. [Phased rollout](#8-phased-rollout-so-this-doesnt-become-a-6-month-single-pr)
9. [Open questions](#9-open-questions--decisions-youll-need-to-make)
10. [What I haven't covered (and why)](#10-what-i-havent-covered-and-why)
11. [What to do next](#11-what-to-do-next)

---

## Existing assets you'd otherwise re-create

Audit done before writing this plan. Don't duplicate any of these:

| Asset | Already exists |
|---|---|
| `platform_integrations` table — `outlet_id`, `platform`, `credentials JSONB`, `settings JSONB`, `is_active`, `status`, `last_synced_at`, `webhook_url`, unique on `(outlet_id, platform)` | ✅ [`supabase/migrations/20260113164808_*.sql`](../supabase/migrations/20260113164808_45cd0b99-464a-4f98-b56c-1e75464dc39b.sql) |
| `platform_sync_logs` table — per-event log with request/response/error | ✅ Same migration |
| Order columns: `source`, `external_order_id`, `platform_data`, `customer_*`, `delivery_*` | ✅ Same migration |
| Swiggy/Zomato webhook handlers | ✅ Both Express (`server/index.js`) and Supabase Edge Functions (`supabase/functions/{swiggy,zomato}-webhook/`) — **but they don't yet verify HMAC signatures** (security gap to fix as part of Phase 2 below) |
| Razorpay order create + verify pattern | ✅ `POST /api/payments/create-order` → `verify-payment` |
| Boolean addon entitlement model | ✅ `subscription_addons` table — `swiggy_integration` / `zomato_integration` are ₹499/mo each |
| `<FeatureGate feature="swiggyIntegration">` UI primitive | ✅ [`src/components/FeatureGate.tsx`](../src/components/FeatureGate.tsx) |
| Admin panel scaffold | ✅ `src/pages/admin/Accounts.tsx`, gated by `isAdmin` middleware |
| Notifications system + chime + bell UI | ✅ `public.notifications` + `useNotifications` hook + `useNotificationSound` |
| Mobile billing handoff pattern (JWT → system browser) | ✅ `POST /api/billing/mobile-link` + `GET /api/billing/redeem` — see [`mobile-app.md`](mobile-app.md) §5 |

**This isn't a greenfield build. It's a wallet/credit ledger layered on top of an integration system that already works.**

---

## 1. The single most important decision (please pick before any code)

**How does the wallet relate to the existing boolean integration addons (`swiggy_integration` @ ₹499/mo, `zomato_integration` @ ₹499/mo)?**

Three viable models:

| Model | What it means | Pros | Cons |
|---|---|---|---|
| **A. Wallet replaces addons** | Drop the boolean ₹499/mo charge. Restaurants only pay per synced order. | Simplest UX. Best for low-volume restaurants. | You lose predictable recurring revenue. High-volume customers may pay less. |
| **B. Addon = access right, wallet = usage** *(recommended)* | Keep the ₹499/mo as "platform access fee" (covers your middleware account + base cost). Credits debited per order. | Mirrors how Twilio/SendGrid/Algolia bill. Stable MRR + usage upside. Easy to bundle (e.g. "Swiggy addon includes 500 credits free"). | Slightly more complex to explain. |
| **C. Wallet only for new services, addons stay** | Wallet powers WhatsApp/SMS/AI only. Order sync remains addon-based. | Lowest disruption. Existing customers untouched. | Defeats the stated goal of metering order sync. |

**Recommendation: B.** Rest of this document assumes B. Tell me if you want A or C and I'll adjust.

---

## 2. Architecture overview

```
┌─────────────────────────────────────────────────────────────────┐
│  Swiggy / Zomato webhook  →  /api/webhooks/{swiggy,zomato}      │
│       │                       (server/index.js — existing)      │
│       ↓                                                          │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  IntegrationService                                       │   │
│  │   - verifyHmac(provider, headers, body)        (NEW)      │   │
│  │   - dedupeByExternalOrderId(external_id)       (NEW)      │   │
│  └──────────────────────────────────────────────────────────┘   │
│       ↓                                                          │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  WalletService.charge({                                   │   │
│  │     wallet_id, service_type:'online_order', platform,     │   │
│  │     external_ref, idempotency_key                         │   │
│  │  })  —  transactional, FOR UPDATE, idempotent             │   │
│  └──────────────────────────────────────────────────────────┘   │
│       ↓                                                          │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  OrderService.createFromPlatform(...)                     │   │
│  │   (existing logic, moved into a module)                   │   │
│  └──────────────────────────────────────────────────────────┘   │
│       ↓                                                          │
│  Realtime → Kitchen Display, Orders page                         │
└─────────────────────────────────────────────────────────────────┘

   ┌──────────────────────────────────────────────────────────┐
   │  Recharge flow                                            │
   │  POST /api/wallet/create-recharge-order  →  Razorpay      │
   │  POST /api/wallet/verify-recharge        →  WalletService │
   │                                              .credit(...) │
   └──────────────────────────────────────────────────────────┘

   ┌──────────────────────────────────────────────────────────┐
   │  Cron / event-driven                                      │
   │   - Low-balance alert sweep (every 5–15 min)              │
   │   - Wallet expiry sweep (if you enable expiry)            │
   │   - Auto-recharge attempts (opt-in)                       │
   └──────────────────────────────────────────────────────────┘
```

The deliberate split:

- **`WalletService`** knows nothing about integrations. It just credits/debits/refunds against a `service_type`. That's what makes WhatsApp/SMS/AI credits a 1-line addition later.
- **`IntegrationService`** handles the platform-specific stuff (HMAC verification, payload mapping). It calls `WalletService.charge` and `OrderService.createFromPlatform`.

---

## 3. Database schema

Six new tables plus two `SECURITY DEFINER` Postgres functions for atomic debit/credit. Matched to your spec but adapted to Banaoo's conventions:

- `owner_id` instead of `restaurant_id` (we call them "owners" in the codebase).
- `bigint` milli-credits instead of `numeric` to avoid float drift.
- RLS on every table (consistent with the rest of `public.*`).
- All writes to wallets go through `SECURITY DEFINER` RPC functions; no direct `UPDATE` from the API.

### 3.1 `wallets` — one per owner (not per outlet)

```sql
CREATE TABLE public.wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  -- Stored as integer "milli-credits" so 1 credit = 1000. Lets us price
  -- sub-credit operations (e.g. 0.25 credits) without floats.
  balance_mc bigint NOT NULL DEFAULT 0 CHECK (balance_mc >= 0),
  -- Configurable; admin can override per-restaurant via admin panel.
  grace_limit_mc bigint NOT NULL DEFAULT 0,
  low_balance_threshold_mc bigint NOT NULL DEFAULT 50000, -- 50 credits
  auto_recharge_enabled boolean NOT NULL DEFAULT false,
  auto_recharge_package_id uuid REFERENCES public.wallet_packages(id),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads own wallet" ON public.wallets
  FOR SELECT USING (owner_id = auth.uid());
-- Writes go through SECURITY DEFINER functions (no direct UPDATE).
```

Why owner-level (not outlet-level): a Growth-plan restaurant can have multiple outlets, but billing is unified. If you want per-outlet metering later, add a `subwallets` concept rather than denormalising.

### 3.2 `wallet_transactions` — immutable ledger

```sql
CREATE TABLE public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES public.wallets(id) ON DELETE RESTRICT,
  type text NOT NULL CHECK (type IN (
    'credit_purchase',   -- restaurant recharged
    'credit_bonus',      -- admin gifted / promotional / referral
    'credit_refund',     -- refund to wallet from a debit
    'debit',             -- service consumption
    'adjustment'         -- admin manual +/- correction
  )),
  amount_mc bigint NOT NULL,            -- signed: + for credit, − for debit
  service_type text,                    -- 'online_order' | 'whatsapp' | 'sms' | 'ai_image' | …
  service_subtype text,                 -- platform: 'swiggy' / 'zomato' / 'magicpin' / '*'
  reference_table text,                 -- e.g. 'orders' | 'online_order_usage'
  reference_id uuid,                    -- FK-ish; not enforced because reference_table varies
  idempotency_key text UNIQUE,          -- prevents double-debit on webhook retries
  balance_after_mc bigint NOT NULL,     -- snapshot, makes statements + audits cheap
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb, -- razorpay_payment_id, admin_user_id, etc.
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_wallet_tx_wallet_created ON public.wallet_transactions (wallet_id, created_at DESC);
CREATE INDEX idx_wallet_tx_service ON public.wallet_transactions (service_type, service_subtype);
-- Immutable: no UPDATE/DELETE policy. Insert only via SECURITY DEFINER functions.
```

`idempotency_key` is the crucial bit. For an online order debit you'd use `online_order:<platform>:<external_order_id>`. Re-running the webhook is a no-op.

### 3.3 `online_order_usage` — denormalised lookup for analytics

```sql
CREATE TABLE public.online_order_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  outlet_id uuid NOT NULL REFERENCES public.outlets(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  integration_id uuid NOT NULL REFERENCES public.platform_integrations(id) ON DELETE CASCADE,
  platform text NOT NULL,                  -- swiggy | zomato | magicpin | …
  external_order_id text NOT NULL,
  -- The credits actually debited (lets you change pricing later without rewriting history).
  credits_used_mc bigint NOT NULL,
  -- Your COGS for this order — middleware fee you pay. Used for margin reporting.
  middleware_cost_paise integer,
  sync_status text NOT NULL CHECK (sync_status IN (
    'received','priced','debited','order_created','failed','refunded'
  )),
  wallet_transaction_id uuid REFERENCES public.wallet_transactions(id),
  raw_payload jsonb NOT NULL,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (platform, external_order_id)     -- hard dedupe
);
CREATE INDEX idx_online_order_usage_owner_created ON public.online_order_usage (owner_id, created_at DESC);
```

This is the audit row for *every* incoming online order, regardless of whether the debit succeeded.

### 3.4 `wallet_packages` — admin-managed SKUs

```sql
CREATE TABLE public.wallet_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,                          -- 'starter-100', 'growth-500', etc.
  name text NOT NULL,
  description text,
  price_paise integer NOT NULL CHECK (price_paise > 0),
  base_credits_mc bigint NOT NULL CHECK (base_credits_mc > 0),
  bonus_credits_mc bigint NOT NULL DEFAULT 0 CHECK (bonus_credits_mc >= 0),
  -- Some packages may be hidden (custom enterprise), promotional, time-limited.
  visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','hidden','promotional')),
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- Public read; admin write.
```

### 3.5 `service_pricing` — what each service costs in credits

```sql
CREATE TABLE public.service_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_type text NOT NULL,              -- 'online_order' | 'whatsapp' | 'sms' | …
  service_subtype text NOT NULL DEFAULT '*', -- platform: 'swiggy'/'zomato'/'*'
  cost_mc bigint NOT NULL CHECK (cost_mc >= 0),   -- in milli-credits
  middleware_cost_paise integer,           -- your COGS (for margin reporting only)
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_until timestamptz,
  created_by uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (service_type, service_subtype, effective_from)
);
```

Lets you change pricing without code deploys, keeps a history. A pricing-resolution function picks the row with `effective_from <= now() AND (effective_until IS NULL OR effective_until > now())`.

### 3.6 `low_balance_alerts` — debouncer for outbound alerts

```sql
CREATE TABLE public.low_balance_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL UNIQUE REFERENCES public.wallets(id) ON DELETE CASCADE,
  last_alert_sent_at timestamptz,
  last_alert_balance_mc bigint,
  alert_count integer NOT NULL DEFAULT 0
);
```

(One row per wallet; written by the alert cron.)

### 3.7 The transactional debit function

This is **the single most important piece** — wallet correctness depends on it.

```sql
CREATE OR REPLACE FUNCTION public.wallet_debit(
  p_wallet_id uuid,
  p_amount_mc bigint,
  p_service_type text,
  p_service_subtype text,
  p_reference_table text,
  p_reference_id uuid,
  p_idempotency_key text,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS public.wallet_transactions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_balance bigint;
  v_grace bigint;
  v_tx public.wallet_transactions;
  v_existing public.wallet_transactions;
BEGIN
  IF p_amount_mc <= 0 THEN
    RAISE EXCEPTION 'wallet_debit amount must be positive' USING ERRCODE='22023';
  END IF;

  -- Idempotency check (fast-path)
  SELECT * INTO v_existing FROM wallet_transactions
   WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN RETURN v_existing; END IF;

  -- Lock the wallet row
  SELECT balance_mc, grace_limit_mc INTO v_balance, v_grace
    FROM wallets WHERE id = p_wallet_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'wallet not found' USING ERRCODE='P0002'; END IF;

  -- Enforce balance (allow up to grace_limit)
  IF v_balance + v_grace < p_amount_mc THEN
    RAISE EXCEPTION 'insufficient wallet balance' USING ERRCODE='P0001';
  END IF;

  UPDATE wallets SET balance_mc = balance_mc - p_amount_mc, updated_at = now()
    WHERE id = p_wallet_id;

  INSERT INTO wallet_transactions
    (wallet_id, type, amount_mc, service_type, service_subtype,
     reference_table, reference_id, idempotency_key, balance_after_mc, metadata)
  VALUES
    (p_wallet_id, 'debit', -p_amount_mc, p_service_type, p_service_subtype,
     p_reference_table, p_reference_id, p_idempotency_key, v_balance - p_amount_mc, p_metadata)
  RETURNING * INTO v_tx;

  RETURN v_tx;
END;$$;
```

Symmetric `wallet_credit(…)` (no balance check, type one of `credit_purchase | credit_bonus | credit_refund | adjustment`).

Node calls these via a single `pool.connect()` + `BEGIN/COMMIT` so the order insertion and the debit are in the **same transaction**.

---

## 4. Backend module layout

New files under `server/`:

```text
server/
├── wallet/
│   ├── wallet-service.js          # charge(), credit(), refund(), getBalance(), getLedger()
│   ├── pricing-service.js         # resolveCost(serviceType, subtype, at?)
│   ├── package-service.js         # listPackages(), getPackage(id)
│   └── alert-service.js           # sweepLowBalance(), recordAlert()
├── integrations/
│   ├── integration-service.js     # ensureIntegration(), updateStatus(), getByOutlet()
│   ├── platform-swiggy.js         # verifyHmac(), mapOrder(), mapStatus()
│   ├── platform-zomato.js         # same shape, Zomato schema
│   └── platform-registry.js       # PLATFORM_HANDLERS map (single source of truth)
├── billing/
│   ├── recharge-service.js        # createRechargeOrder() + verifyRecharge()
│   └── (existing billing-mobile.js is unchanged)
└── jobs/
    ├── low-balance-sweep.js       # invoked by a cron or external scheduler
    └── auto-recharge-attempt.js
```

**Why the split into directories**: today everything lives in `server/index.js` (2200+ lines). Putting the wallet code in its own folder gives you a clean import boundary and matches what [`docs/backend.md`](backend.md) describes for `customer-orders.js` / `billing-mobile.js`. Each file exports a `registerXxxRoutes(app, { requireAuth, isAdmin })` so `index.js` stays a thin composition root.

### New API endpoints (also goes into [`docs/api.md`](api.md))

**Restaurant (owner)**

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/wallet` | Current balance + low-balance state + auto-recharge config |
| `GET` | `/api/wallet/transactions` | Ledger with pagination + filters |
| `GET` | `/api/wallet/usage/analytics` | Aggregations (daily/weekly, per-platform) |
| `GET` | `/api/wallet/packages` | Public package list |
| `POST` | `/api/wallet/recharge/create-order` | Razorpay order for a package |
| `POST` | `/api/wallet/recharge/verify` | Verify signature + credit wallet |
| `POST` | `/api/wallet/auto-recharge` | Enable/disable auto-recharge |
| `GET` | `/api/online-order-usage` | Per-order audit list (joins integrations + orders) |

**Admin**

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/admin/wallets` | Paginated wallets w/ filter by balance/status |
| `POST` | `/api/admin/wallets/:id/adjust` | Manual +/− with mandatory note |
| `POST` | `/api/admin/wallets/:id/bonus` | Promotional credits |
| `POST` | `/api/admin/wallets/:id/refund` | Refund a specific debit (looks up tx) |
| `GET/POST/PATCH/DELETE` | `/api/admin/wallet-packages` | CRUD |
| `GET/POST/PATCH` | `/api/admin/service-pricing` | CRUD (history preserved) |
| `GET` | `/api/admin/wallet-analytics` | Total credits consumed, COGS, margin, top restaurants |
| `GET` | `/api/admin/integration-health` | Failed sync rate, paused integrations |

**Webhooks (modified, not new)**

The existing `/api/webhooks/swiggy` and `/api/webhooks/zomato` get rewritten to:

1. Verify HMAC signature (new — currently missing; documented as a gap in [`docs/backend.md`](backend.md)).
2. Resolve `integration` → `wallet`.
3. Resolve cost via `pricing-service.resolveCost('online_order', platform)`.
4. Try `wallet_debit(...)`. If insufficient balance → mark `online_order_usage.sync_status='failed'`, emit alert, return **HTTP 402 Payment Required** to the platform so retries are clearly distinguishable from 5xx.
5. If debit OK → call existing `OrderService.createFromPlatform(...)` inside the same transaction.
6. Update `platform_sync_logs` (existing).

**Crucial:** wrap steps 4 and 5 in a single Postgres transaction. Either both happen or neither does. The order should not exist without the debit, and the debit should never happen without the order.

---

## 5. Frontend layout

### Owner-facing — new section in the existing app

Add a sidebar entry below "Integrations":

```text
/wallet              → Wallet dashboard (balance card, recharge CTA, analytics)
/wallet/transactions → Ledger (filterable, exportable to CSV)
/wallet/recharge     → Package picker → Razorpay (with mobile-app handoff like billing)
/wallet/auto-recharge → Settings card
```

### Reusable components to add

```text
src/components/wallet/
  WalletBalanceCard.tsx        # large card with gradient by status (green/amber/red)
  RemainingOrdersEstimate.tsx  # derived from current pricing + 7-day avg consumption
  UsageChart.tsx               # daily/weekly recharts area chart
  PlatformBreakdownChart.tsx   # bar/pie by platform
  TransactionTable.tsx
  LowBalanceBanner.tsx         # shown app-wide when balance < threshold
  PackagePicker.tsx
  AutoRechargeForm.tsx
```

### Hooks

```ts
// src/hooks/use-wallet.ts
useWallet()             // { balance, low, status, autoRecharge, refresh }
useWalletTransactions(filters)
useWalletAnalytics(range)
useRecharge()           // mirrors useSubscription pattern, including native-app handoff

// src/hooks/use-online-order-usage.ts
useOnlineOrderUsage(outletId?)
```

### Native-app handoff (mandatory)

Recharge **must** use the same mobile-handoff pattern as subscriptions — Razorpay checkout cannot run inside the WebView (Play/App Store rules; see [`docs/mobile-app.md`](mobile-app.md) §5).

Add a new `kind: 'wallet_recharge'` to `POST /api/billing/mobile-link` and `GET /api/billing/redeem` so the wallet recharge button on mobile pops the system browser.

### Status colors (per the spec)

| Wallet state | Color | Where |
|---|---|---|
| Healthy (≥ 2× threshold) | `bg-success/10 text-success` | Balance card |
| Low (≤ threshold) | `bg-warning/10 text-warning` | Card + top-of-page banner |
| Empty / suspended | `bg-destructive/10 text-destructive` | Card + sidebar pill + integrations page |

The existing `--success` / `--warning` / `--destructive` HSL tokens in [`src/index.css`](../src/index.css) already cover this.

### Admin

Add `src/pages/admin/Wallets.tsx`, `WalletPackages.tsx`, `ServicePricing.tsx`, `WalletAnalytics.tsx`. Reuse `<StatCard>`, `<DataTable>`-style patterns from `admin/Accounts.tsx`.

---

## 6. Notifications & alerts

Use the **existing `public.notifications` table** + `useNotifications` hook. Don't build a parallel system.

Triggers:

| Event | Insert into `notifications` | Future channel |
|---|---|---|
| Balance crosses `low_balance_threshold_mc` (going down) | `title: "Wallet low"`, `type: 'warning'`, `action_url: '/wallet/recharge'` | WhatsApp / Email — same payload, different transport |
| `wallet_debit` raises `insufficient wallet balance` | `title: "Order sync paused"`, `type: 'error'`, `action_url: '/wallet/recharge'` | High-priority push |
| Recharge success | `title: "Wallet recharged"`, `type: 'success'` | Email receipt |
| Integration auto-paused (failed debits) | `title: "<Platform> paused"`, `type: 'error'`, `action_url: '/integrations'` | – |
| Abnormal spike (e.g. 3× daily 7-day avg) | `title: "Unusual usage detected"`, `type: 'warning'` | – |

Debouncing for low-balance lives in `low_balance_alerts` (don't re-alert if `last_alert_balance_mc` is within ~5% of current). The low-balance sweep is a cron job — host this on Dokploy's cron or on a Supabase scheduled function (Edge) every 10 minutes.

---

## 7. Integration with existing entitlements

Update `src/lib/entitlements.ts` and `useFeatureGating` to read the wallet state in addition to the addon. The frontend gate becomes:

```tsx
<FeatureGate feature="swiggyIntegration">
  <WalletGuard service="online_order" platform="swiggy">
    {/* the Swiggy panel content */}
  </WalletGuard>
</FeatureGate>
```

- `<FeatureGate>` = "do you have the addon entitlement?" (Model B above — keep this as the access right).
- `<WalletGuard>` = "do you have enough credits to sync at least 1 more order?"

`WalletGuard` displays a clean low-balance state with a CTA to `/wallet/recharge` and (for staff users) a read-only "ask owner to recharge" message.

---

## 8. Phased rollout (so this doesn't become a 6-month single PR)

| Phase | What ships | Why |
|---|---|---|
| **0. Decision + spec sign-off** | Pick Model A/B/C; finalize pricing | Cheap to change here, expensive later. |
| **1. Schema + ledger (no UI)** | Migrations + `wallet-service.js` + `pricing-service.js` + RPC functions + admin seed packages. **No UI yet.** Wallets auto-created on first need. | Ledger correctness is the foundation. Test in isolation with a script. |
| **2. Webhook debit (shadow mode)** | Rewrite webhooks to call `wallet_debit`. Run in **shadow** — log the debit attempt but don't actually deduct. Compare predicted vs actual via a daily report. | Validates pricing model against real traffic before charging anyone. |
| **3. Recharge flow** | `POST /api/wallet/recharge/*`, package picker UI, mobile handoff, transaction list, basic balance card. Webhook still in shadow. | Restaurants can fund their wallets in advance of go-live. |
| **4. Switch debit live** | Flip webhooks out of shadow. Insufficient-balance behavior gated by per-wallet `grace_limit_mc` (admins can give specific customers a 7-day grace at launch). | The actual cutover. |
| **5. Admin panel** | Wallets list, manual adjustments, refunds, package CRUD, pricing CRUD, analytics. | Many admin actions are needed only after live traffic exposes edge cases. |
| **6. Auto-recharge + alerts** | Cron jobs for low-balance sweep + auto-recharge attempts. | Polish — most customers won't need it for the first month. |
| **7. Future services** | Add `service_type='whatsapp'` etc. to the same ledger. **Zero new tables.** | Validates the architecture. |

Budget ~2–3 weeks of focused work for phases 1–4 (the wallet/recharge MVP) and another 1–2 weeks for 5–7.

---

## 9. Open questions / decisions you'll need to make

1. **Wallet model**: A vs B vs C (see §1).
2. **Pricing of an online order**: per-order flat? Per-order percentage of order value? Per-platform? **Recommendation: per-platform flat** (`swiggy=1 credit`, `zomato=1 credit`, `magicpin=0.5 credit`), changeable from admin.
3. **Credit peg**: ₹1 per credit? ₹0.50? This determines package pricing. Admin can edit packages but the peg shapes how customers think about credits.
4. **Grace limit default**: 0 (hard cutoff), 10 credits, 50? Affects how aggressive the experience feels at launch.
5. **What happens when balance hits 0 with an order arriving?**
   - **(a) Hard reject** with HTTP 402, log the attempt, alert the restaurant. Order is **lost**. ← simpler, riskier for restaurants.
   - **(b) Accept the order**, debit balance into negative up to grace, alert the restaurant. ← restaurant-friendly, default in B model.
   - **(c) Accept the order**, don't debit, mark `online_order_usage.sync_status='unbilled'`, admin reconciles later. ← messy but real-world common.
   - **Recommendation: (b) with grace_limit defaulting to 0 for trial accounts, configurable per-account** for paying customers.
6. **Refund policy**: when an order is cancelled (by Swiggy or restaurant), do we refund the credit? **Recommendation: yes**, via `wallet_credit('credit_refund', …)` with `reference_id` pointing at the original debit's tx id. Configurable per-platform.
7. **Wallet expiry**: do credits expire? Most SaaS doesn't. The schema supports it (`wallet_packages` could carry a `credits_expire_after_days`) but leave it off at launch.
8. **HMAC verification on webhooks**: This is currently missing and is independently a security gap. Bundle the fix into Phase 2 — both webhooks need to verify `x-swiggy-signature` / Zomato's equivalent against a per-integration secret stored in `platform_integrations.credentials`.

---

## 10. What I haven't covered (and why)

- **Stripe abstraction**: you asked for a multi-gateway abstraction. India-only Razorpay is fine for v1; making the recharge service swap a `PaymentGateway` interface later is one afternoon's work. Don't over-engineer this in Phase 3.
- **AI-based balance forecasting**: bonus item, skip until you have ≥ 3 months of usage data per restaurant. Until then a 7-day rolling average is "good enough."
- **Referral bonus credits**: you already have an affiliate system (`public.affiliates`, `affiliate_payouts`). Hook a referral bonus into `wallet_credit('credit_bonus', metadata: {referral_id: ...})` — it's one webhook from the affiliate signup flow, no new tables.
- **Detailed UI mockups**: those should come after §1 decisions land. We can sketch wireframes once the model is locked.

---

## 11. What to do next

Smallest defensible first steps once decisions §1–§6 are locked:

1. **Answer the 6 decisions** at the top of this doc (paste choices into a CHANGELOG entry).
2. Write **Phase 1 only**: the migration (6 tables + 2 RPC functions), the `server/wallet/` service layer, and a `server/scripts/seed-wallet-packages.js` so admin doesn't have to type SQL. No UI. No webhook changes yet. That's ~600 lines of new code + 1 migration.
3. Test the ledger with a runner script that simulates 1000 concurrent debits to prove the `FOR UPDATE` lock works.
4. Only then touch the webhooks (Phase 2 — shadow mode), and Phase 3+ flow from there.

This way the riskiest piece (the ledger) is correct and well-tested before a single rupee changes hands.

---

## Appendix — companion changes outside this plan

When this lands, the following docs need updating in the same PR(s):

- [`docs/api.md`](api.md) — add the wallet/admin/recharge endpoint groups.
- [`docs/backend.md`](backend.md) — add §16 (wallet) describing `WalletService` + `IntegrationService` and remove the "no HMAC verification" gap.
- [`docs/frontend.md`](frontend.md) — add the wallet page tree under §4 (routing) and a wallet hooks/components row under §7/§8.
- [`docs/CHANGELOG.md`](CHANGELOG.md) — entry per phase.
- [`docs/techstack.md`](techstack.md) — no change unless we add Stripe.
