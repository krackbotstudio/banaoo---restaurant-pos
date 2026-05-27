-- Lead capture table for Android APK download requests from landing page
CREATE TABLE IF NOT EXISTS public.mobile_app_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'landing_unknown',
  user_agent TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mobile_app_leads_created_at
  ON public.mobile_app_leads (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mobile_app_leads_email
  ON public.mobile_app_leads (email);
