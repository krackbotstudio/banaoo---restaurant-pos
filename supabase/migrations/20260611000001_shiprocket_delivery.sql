-- Shiprocket delivery integration (server-only via pool; RLS with no policies)

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_pincode TEXT,
  ADD COLUMN IF NOT EXISTS delivery_city TEXT,
  ADD COLUMN IF NOT EXISTS delivery_state TEXT;

CREATE TABLE IF NOT EXISTS public.shiprocket_connections (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id             UUID NOT NULL UNIQUE REFERENCES public.outlets(id) ON DELETE CASCADE,
  api_email_enc         TEXT,
  api_password_enc      TEXT,
  access_token_enc      TEXT,
  token_expires_at      TIMESTAMPTZ,
  is_connected          BOOLEAN NOT NULL DEFAULT false,
  connected_at          TIMESTAMPTZ,
  settings              JSONB NOT NULL DEFAULT '{
    "auto_delivery_enabled": false,
    "prep_time_minutes": 15,
    "default_weight_kg": 0.5,
    "dimensions": {"length": 10, "width": 10, "height": 10},
    "pickup_address": {},
    "pickup_location_name": "Primary",
    "cod_enabled": true,
    "retry_max_attempts": 3,
    "retry_interval_seconds": 120,
    "webhook_secret": null
  }'::jsonb,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shiprocket_shipments (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id              UUID NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  outlet_id             UUID NOT NULL REFERENCES public.outlets(id) ON DELETE CASCADE,
  shiprocket_order_id     TEXT,
  shipment_id           TEXT,
  awb_code              TEXT,
  courier_name          TEXT,
  tracking_url          TEXT,
  status                TEXT NOT NULL DEFAULT 'not_booked'
    CHECK (status IN (
      'not_booked', 'booking', 'shipment_created', 'awaiting_rider',
      'rider_assigned', 'picked_up', 'out_for_delivery', 'delivered',
      'cancelled', 'booking_failed'
    )),
  estimated_pickup_at   TIMESTAMPTZ,
  estimated_delivery_at TIMESTAMPTZ,
  booking_scheduled_at  TIMESTAMPTZ,
  next_retry_at         TIMESTAMPTZ,
  booked_at             TIMESTAMPTZ,
  delivered_at          TIMESTAMPTZ,
  last_error            TEXT,
  retry_count           INTEGER NOT NULL DEFAULT 0,
  raw_create_response   JSONB,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shiprocket_tracking_events (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id           UUID NOT NULL REFERENCES public.shiprocket_shipments(id) ON DELETE CASCADE,
  event_code            TEXT,
  event_message         TEXT,
  occurred_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw                   JSONB,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shiprocket_audit_log (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id             UUID REFERENCES public.outlets(id) ON DELETE SET NULL,
  order_id              UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  action                TEXT NOT NULL,
  metadata              JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shiprocket_shipments_outlet ON public.shiprocket_shipments(outlet_id);
CREATE INDEX IF NOT EXISTS idx_shiprocket_shipments_status ON public.shiprocket_shipments(status);
CREATE INDEX IF NOT EXISTS idx_shiprocket_shipments_scheduled ON public.shiprocket_shipments(booking_scheduled_at)
  WHERE status IN ('booking', 'booking_failed');
CREATE INDEX IF NOT EXISTS idx_shiprocket_tracking_shipment ON public.shiprocket_tracking_events(shipment_id);
CREATE INDEX IF NOT EXISTS idx_shiprocket_audit_outlet ON public.shiprocket_audit_log(outlet_id, created_at DESC);

ALTER TABLE public.shiprocket_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shiprocket_shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shiprocket_tracking_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shiprocket_audit_log ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.shiprocket_connections IS 'Per-outlet Shiprocket API credentials (server access only)';
COMMENT ON TABLE public.shiprocket_shipments IS 'Shiprocket shipment state per Banaoo delivery order';
