-- ─────────────────────────────────────────────────────────────────────────────
-- Admin CMS — dedicated staff accounts & audit trail
--
-- Tectangle operators use the CMS at /cms (separate from restaurant owner auth).
-- Legacy profiles.is_admin owners remain supported during migration.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.admin_users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  full_name     text NOT NULL DEFAULT '',
  role          text NOT NULL DEFAULT 'super_admin'
                CHECK (role IN ('super_admin', 'support', 'billing', 'marketing')),
  is_active     boolean NOT NULL DEFAULT true,
  last_login_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_users_email ON public.admin_users (lower(email));
CREATE INDEX IF NOT EXISTS idx_admin_users_active ON public.admin_users (is_active) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id      uuid REFERENCES public.admin_users(id) ON DELETE SET NULL,
  admin_email   text,
  action        text NOT NULL,
  target_type   text,
  target_id     text,
  metadata      jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address    text,
  user_agent    text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created
  ON public.admin_audit_log (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin
  ON public.admin_audit_log (admin_id, created_at DESC);

COMMENT ON TABLE public.admin_users IS
  'Tectangle CMS operators — separate from restaurant owner accounts in public.users.';

COMMENT ON TABLE public.admin_audit_log IS
  'Immutable audit trail for CMS actions (approvals, subscription overrides, etc.).';

-- RLS: CMS tables are server-only (Express uses service pool). Deny anon/authenticated.
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- No policies = no direct client access via Supabase JS (server bypasses RLS with pool).
