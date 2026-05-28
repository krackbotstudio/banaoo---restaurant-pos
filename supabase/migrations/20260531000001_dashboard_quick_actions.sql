-- Owner-customizable dashboard quick action shortcuts (array of action ids, max 6)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS dashboard_quick_actions jsonb;

COMMENT ON COLUMN public.profiles.dashboard_quick_actions IS
  'Ordered array of quick action ids shown on /dashboard, e.g. ["new-order","orders","kitchen"].';
