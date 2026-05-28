-- Staff members are owned by Passport accounts in public.users (not always in auth.users).
ALTER TABLE public.staff_members
  DROP CONSTRAINT IF EXISTS staff_members_owner_id_fkey;

ALTER TABLE public.staff_members
  ADD CONSTRAINT staff_members_owner_id_fkey
  FOREIGN KEY (owner_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- system_email stays globally unique (staff login). username unique per owner.
ALTER TABLE public.staff_members DROP CONSTRAINT IF EXISTS staff_members_username_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_members_owner_username
  ON public.staff_members (owner_id, lower(username))
  WHERE username IS NOT NULL;
