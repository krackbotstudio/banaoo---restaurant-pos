-- ─────────────────────────────────────────────────────────────────────────────
-- Terms of Service & Privacy Policy acceptance tracking
--
-- Adds columns to public.profiles so we can prove that each owner accepted
-- the ToS + Privacy + Refund policies on signup. Stores the accepted
-- document version (so we can ask for re-acceptance after a material
-- change) plus the IP and user-agent for the legal record.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS terms_accepted_at        timestamptz,
  ADD COLUMN IF NOT EXISTS terms_version            text,
  ADD COLUMN IF NOT EXISTS terms_accepted_ip        text,
  ADD COLUMN IF NOT EXISTS terms_accepted_user_agent text;

-- Backfill existing owners with an implicit-acceptance marker so we don't
-- lock anyone out on their next login. They've already been using the app
-- under the prior terms; this just records that fact.
UPDATE public.profiles
   SET terms_accepted_at = COALESCE(terms_accepted_at, now()),
       terms_version     = COALESCE(terms_version, 'legacy-implicit')
 WHERE terms_accepted_at IS NULL;

-- Index for admin queries that filter / sort by acceptance state.
CREATE INDEX IF NOT EXISTS idx_profiles_terms_accepted_at
  ON public.profiles (terms_accepted_at);

COMMENT ON COLUMN public.profiles.terms_accepted_at IS
  'Timestamp the owner accepted the ToS + Privacy + Refund policies at signup. NULL for owners predating this column.';
COMMENT ON COLUMN public.profiles.terms_version IS
  'Version string of the legal documents the owner accepted (see src/lib/legal.ts CURRENT_TERMS_VERSION).';
