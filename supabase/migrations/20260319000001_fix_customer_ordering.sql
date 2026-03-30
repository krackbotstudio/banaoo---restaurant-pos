-- Fix customer ordering app issues

-- 1. Make created_by nullable in orders so customer-placed orders don't need owner_id
ALTER TABLE public.orders ALTER COLUMN created_by DROP NOT NULL;

-- 2. Ensure anyone can view active outlets (for customer ordering app)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'outlets'
      AND policyname = 'outlets_public_active_select'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "outlets_public_active_select"
        ON public.outlets FOR SELECT
        USING (is_active = true)
    $p$;
  END IF;
END $$;

-- 3. Ensure anyone can view profiles for branding (used by ordering app)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'profiles_public_branding_select'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "profiles_public_branding_select"
        ON public.profiles FOR SELECT
        USING (true)
    $p$;
  END IF;
END $$;
