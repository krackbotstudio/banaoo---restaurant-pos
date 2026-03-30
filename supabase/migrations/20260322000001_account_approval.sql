-- Account approval workflow
-- New restaurant owners start as 'pending' and must be approved by banaoo admin
-- before they can select a plan and access the app.

-- ── 1. Add columns to profiles ─────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS is_admin       boolean NOT NULL DEFAULT false;

-- Auto-approve all existing users (they were already using the system before
-- this approval feature was introduced).
UPDATE public.profiles SET account_status = 'approved' WHERE account_status = 'pending';

-- ── 2. RLS: allow admins to read ALL profiles ──────────────────────────────
-- (regular users can only see their own profile via the existing policy)
CREATE POLICY "Admins can read all profiles"
  ON public.profiles FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.is_admin = true
    )
  );

-- ── 3. RLS: allow admins to update any profile ─────────────────────────────
CREATE POLICY "Admins can update any profile"
  ON public.profiles FOR UPDATE
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.is_admin = true
    )
  );

-- ── 4. Index for fast pending-account queries ──────────────────────────────
CREATE INDEX IF NOT EXISTS idx_profiles_account_status
  ON public.profiles (account_status);

-- ── To make a user an admin, run in SQL editor: ───────────────────────────
-- UPDATE public.profiles SET is_admin = true WHERE user_id = '<uuid>';
