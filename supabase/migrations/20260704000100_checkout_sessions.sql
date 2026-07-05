-- Create checkout_sessions table to hold temporary order payloads during payment validation
CREATE TABLE IF NOT EXISTS public.checkout_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id UUID NOT NULL REFERENCES public.outlets(id) ON DELETE CASCADE,
  gateway_order_id TEXT UNIQUE NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.checkout_sessions ENABLE ROW LEVEL SECURITY;

-- Add RLS policy (admin/owners can query their outlet sessions, public can insert/select by session id)
DROP POLICY IF EXISTS "checkout_sessions_public_insert" ON public.checkout_sessions;
CREATE POLICY "checkout_sessions_public_insert"
  ON public.checkout_sessions FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "checkout_sessions_public_select" ON public.checkout_sessions;
CREATE POLICY "checkout_sessions_public_select"
  ON public.checkout_sessions FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "checkout_sessions_owner_all" ON public.checkout_sessions;
CREATE POLICY "checkout_sessions_owner_all"
  ON public.checkout_sessions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.outlets o
      WHERE o.id = checkout_sessions.outlet_id AND o.owner_id = auth.uid()
    )
  );
