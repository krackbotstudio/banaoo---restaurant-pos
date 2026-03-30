-- Add page_permissions to staff_members for module-level access control
ALTER TABLE public.staff_members
  ADD COLUMN IF NOT EXISTS page_permissions TEXT[] DEFAULT NULL;

-- Allow a staff member to read their own record by matching their auth email.
-- This lets the sidebar/app look up which pages they're allowed to access.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'staff_members'
      AND policyname = 'staff_can_read_own_record'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "staff_can_read_own_record"
        ON public.staff_members FOR SELECT
        USING (email = (auth.jwt() ->> 'email'))
    $p$;
  END IF;
END $$;
