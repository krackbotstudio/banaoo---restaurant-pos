-- =====================================================================
-- 2026-05-26 — April schema back-fill
--
-- These columns shipped to production via the April 2026 mobile-app phase
-- but never had a corresponding file under supabase/migrations/. The
-- production state was captured in db-archive/19-april.sql.
--
-- This migration recreates those columns idempotently so that:
--   * production (where they already exist) is a no-op
--   * fresh databases bootstrapped from supabase/migrations/ end up in
--     the same shape as production
--
-- Columns added:
--   public.order_items.status     TEXT NOT NULL DEFAULT 'pending'
--   public.order_items.batch_id   UUID NOT NULL DEFAULT gen_random_uuid()
--   public.order_items.gst_rate   NUMERIC(5,2) NOT NULL DEFAULT 0
--   public.menu_items.gst_category TEXT NULL
--   public.outlets.gst_number     TEXT NULL
--   public.outlets.gst_categories JSONB NULL
-- =====================================================================

-- order_items ---------------------------------------------------------

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS batch_id uuid NOT NULL DEFAULT gen_random_uuid();

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS gst_rate numeric(5,2) NOT NULL DEFAULT 0;

-- Helpful indexes for the most common per-item filters used by the
-- kitchen display and per-batch print routing.
CREATE INDEX IF NOT EXISTS idx_order_items_status
  ON public.order_items (status);

CREATE INDEX IF NOT EXISTS idx_order_items_batch_id
  ON public.order_items (batch_id);

-- menu_items ----------------------------------------------------------

ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS gst_category text NULL;

-- outlets -------------------------------------------------------------

ALTER TABLE public.outlets
  ADD COLUMN IF NOT EXISTS gst_number text NULL;

ALTER TABLE public.outlets
  ADD COLUMN IF NOT EXISTS gst_categories jsonb NULL;
