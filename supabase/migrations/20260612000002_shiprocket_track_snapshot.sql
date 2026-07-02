-- Cached Shiprocket track API snapshot for customer map polling

ALTER TABLE public.shiprocket_shipments
  ADD COLUMN IF NOT EXISTS last_track_snapshot JSONB;
