# Database changes — 20 May 2026

Deploy these changes **before** or **with** the Customer UPI payments app release (web + API server).

| Item | Value |
|------|--------|
| **Date** | 20 May 2026 |
| **Migration file** | `supabase/migrations/20260521000001_customer_upi_payments.sql` |
| **Feature** | Customer UPI orders (no Razorpay for food orders) |

---

## Deploy commands

```bash
# From repo root — Supabase CLI linked to production project
supabase db push

# Or apply manually in Supabase Dashboard → SQL Editor
# Paste contents of: supabase/migrations/20260521000001_customer_upi_payments.sql
```

After migration, **restart the Node API server** (new routes in `server/customer-orders.js` use these columns).

---

## Summary of changes

| Object | Change |
|--------|--------|
| `public.profiles` | 4 new columns (UPI defaults) |
| `public.outlets` | 4 new columns (per-outlet UPI override) |
| `public.orders` | 3 new columns + 1 index |
| `public.order_payments` | **New table** + RLS + trigger + indexes |

---

## 1. `public.profiles` — account-wide UPI defaults

| Column | Type | Default | Notes |
|--------|------|---------|--------|
| `upi_vpa` | `text` | `NULL` | e.g. `name@paytm` |
| `upi_display_name` | `text` | `NULL` | Shown in UPI apps |
| `upi_qr_url` | `text` | `NULL` | Path/URL to uploaded QR image |
| `online_payments_enabled` | `boolean` | `true` | `NOT NULL` |

Used when outlet columns are `NULL` (inherit account default).

---

## 2. `public.outlets` — per-outlet overrides

| Column | Type | Default | Notes |
|--------|------|---------|--------|
| `upi_vpa` | `text` | `NULL` | Overrides profile when set |
| `upi_display_name` | `text` | `NULL` | |
| `upi_qr_url` | `text` | `NULL` | |
| `online_payments_enabled` | `boolean` | `NULL` | `NULL` = use profile setting |

---

## 3. `public.orders` — payment + table link

| Column | Type | Default | Notes |
|--------|------|---------|--------|
| `payment_method` | `text` | `NULL` | Check: `'cod'` \| `'upi'` |
| `payment_status` | `text` | `'not_required'` | `NOT NULL`. See values below |
| `table_id` | `uuid` | `NULL` | FK → `restaurant_tables(id)` `ON DELETE SET NULL` |

**`payment_status` values**

| Value | Meaning |
|-------|---------|
| `not_required` | Cash / pay at counter |
| `pending` | UPI order placed, not paid yet |
| `awaiting_confirmation` | Customer submitted UTR; owner must confirm |
| `paid` | Owner confirmed UPI — kitchen can show order |
| `failed` | Owner rejected payment |

**Index**

- `idx_orders_payment_status` on `(outlet_id, payment_status)`

**Existing rows:** `payment_status` defaults to `not_required` (kitchen behaviour unchanged).

---

## 4. `public.order_payments` — new table

| Column | Type | Notes |
|--------|------|--------|
| `id` | `uuid` PK | `gen_random_uuid()` |
| `order_id` | `uuid` NOT NULL | FK → `orders(id)` `ON DELETE CASCADE` |
| `outlet_id` | `uuid` NOT NULL | FK → `outlets(id)` `ON DELETE CASCADE` |
| `amount` | `numeric` NOT NULL | Default `0` |
| `method` | `text` NOT NULL | Default `'upi'`. Check: `'cod'` \| `'upi'` |
| `status` | `text` NOT NULL | Default `'pending'`. See below |
| `upi_vpa` | `text` | Snapshot at order time |
| `customer_reference` | `text` | UTR / transaction ref from customer |
| `notes` | `text` | Owner notes on confirm/reject |
| `submitted_at` | `timestamptz` | When customer submitted UTR |
| `confirmed_at` | `timestamptz` | When owner confirmed |
| `confirmed_by` | `uuid` | FK → `auth.users(id)` `ON DELETE SET NULL` |
| `created_at` | `timestamptz` | `now()` |
| `updated_at` | `timestamptz` | `now()` |

**`status` values:** `pending`, `awaiting_confirmation`, `paid`, `failed`, `cancelled`

**Indexes**

- `idx_order_payments_order_id` — **UNIQUE** on `order_id` (one payment row per order)
- `idx_order_payments_outlet_status` on `(outlet_id, status)`

**RLS:** enabled

| Policy | Operation | Who |
|--------|-----------|-----|
| `order_payments_owner_all` | ALL | Outlet `owner_id = auth.uid()` |
| `order_payments_staff_select` | SELECT | `is_staff_of_outlet(auth.uid(), outlet_id)` |

**No public INSERT policy** — customer UPI submit uses API server (`pool`), not direct Supabase client.

**Trigger**

- `update_order_payments_updated_at` → `public.update_updated_at_column()`

---

## Full migration SQL

File: [`migrations/20260521000001_customer_upi_payments.sql`](./migrations/20260521000001_customer_upi_payments.sql)

```sql
-- Customer UPI payments (not Razorpay) + outlet/profile payment settings

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS upi_vpa text,
  ADD COLUMN IF NOT EXISTS upi_display_name text,
  ADD COLUMN IF NOT EXISTS upi_qr_url text,
  ADD COLUMN IF NOT EXISTS online_payments_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE public.outlets
  ADD COLUMN IF NOT EXISTS upi_vpa text,
  ADD COLUMN IF NOT EXISTS upi_display_name text,
  ADD COLUMN IF NOT EXISTS upi_qr_url text,
  ADD COLUMN IF NOT EXISTS online_payments_enabled boolean;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_method text CHECK (payment_method IS NULL OR payment_method IN ('cod', 'upi')),
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'not_required'
    CHECK (payment_status IN ('not_required', 'pending', 'awaiting_confirmation', 'paid', 'failed')),
  ADD COLUMN IF NOT EXISTS table_id uuid REFERENCES public.restaurant_tables(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders (outlet_id, payment_status);

CREATE TABLE IF NOT EXISTS public.order_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  outlet_id uuid NOT NULL REFERENCES public.outlets(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  method text NOT NULL DEFAULT 'upi' CHECK (method IN ('cod', 'upi')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'awaiting_confirmation', 'paid', 'failed', 'cancelled')),
  upi_vpa text,
  customer_reference text,
  notes text,
  submitted_at timestamptz,
  confirmed_at timestamptz,
  confirmed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_order_payments_order_id ON public.order_payments (order_id);
CREATE INDEX IF NOT EXISTS idx_order_payments_outlet_status ON public.order_payments (outlet_id, status);

ALTER TABLE public.order_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "order_payments_owner_all" ON public.order_payments;
CREATE POLICY "order_payments_owner_all"
  ON public.order_payments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.outlets o
      WHERE o.id = order_payments.outlet_id AND o.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.outlets o
      WHERE o.id = order_payments.outlet_id AND o.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "order_payments_staff_select" ON public.order_payments;
CREATE POLICY "order_payments_staff_select"
  ON public.order_payments FOR SELECT
  USING (public.is_staff_of_outlet(auth.uid(), outlet_id));

DROP TRIGGER IF EXISTS update_order_payments_updated_at ON public.order_payments;
CREATE TRIGGER update_order_payments_updated_at
  BEFORE UPDATE ON public.order_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
```

---

## Post-deploy checks

Run in SQL Editor (or `psql`):

```sql
-- Columns exist
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('profiles', 'outlets', 'orders', 'order_payments')
  AND column_name IN (
    'upi_vpa', 'upi_display_name', 'upi_qr_url', 'online_payments_enabled',
    'payment_method', 'payment_status', 'table_id'
  )
ORDER BY table_name, column_name;

-- Table + RLS
SELECT relname, relrowsecurity
FROM pg_class
WHERE relname = 'order_payments';
```

**App smoke test**

1. Settings → Branding: set UPI ID, upload QR, save.
2. Customer order with **UPI now** → pay screen shows QR.
3. Submit UTR → **Payments** page shows awaiting confirmation.
4. Confirm → order appears on **Kitchen**.

---

## Not in this migration

- **Razorpay** tables/flows unchanged (subscriptions/add-ons only).
- **QR image files** stored on API disk (`/uploads/...`), not in Postgres.
- Regenerate TypeScript types after deploy if you use Supabase codegen:

  ```bash
  supabase gen types typescript --project-id <your-project-id> > src/integrations/supabase/types.ts
  ```

---

## Rollback (emergency only)

Only if no production UPI orders exist yet:

```sql
DROP TRIGGER IF EXISTS update_order_payments_updated_at ON public.order_payments;
DROP TABLE IF EXISTS public.order_payments;
DROP INDEX IF EXISTS idx_orders_payment_status;
ALTER TABLE public.orders
  DROP COLUMN IF EXISTS table_id,
  DROP COLUMN IF EXISTS payment_status,
  DROP COLUMN IF EXISTS payment_method;
ALTER TABLE public.outlets
  DROP COLUMN IF EXISTS online_payments_enabled,
  DROP COLUMN IF EXISTS upi_qr_url,
  DROP COLUMN IF EXISTS upi_display_name,
  DROP COLUMN IF EXISTS upi_vpa;
ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS online_payments_enabled,
  DROP COLUMN IF EXISTS upi_qr_url,
  DROP COLUMN IF EXISTS upi_display_name,
  DROP COLUMN IF EXISTS upi_vpa;
```
