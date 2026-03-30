-- Create public.users table for Passport.js Auth
CREATE TABLE IF NOT EXISTS public.users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  google_id TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- DATA MIGRATION: Move existing users from Supabase Auth to our public table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
    INSERT INTO public.users (id, email, created_at)
    SELECT id, email, created_at FROM auth.users
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- Automation: Drop ALL policies and disable RLS on ALL tables in the public schema.
-- This is necessary because moving to Passport.js/Express means we manage auth in the backend code,
-- and RLS policies frequently depend on columns we need to alter (like user_id/owner_id).
DO $$ 
DECLARE 
    r RECORD;
BEGIN 
    -- 1. Drop all policies in the public schema
    FOR r IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
    END LOOP;

    -- 2. Disable RLS on all tables in the public schema
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', r.tablename);
    END LOOP;
END $$;

-- Now we can safely update columns without policy conflicts

-- Update profiles table
ALTER TABLE public.profiles 
  DROP CONSTRAINT IF EXISTS profiles_user_id_fkey,
  ALTER COLUMN user_id TYPE UUID;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Update outlets table
ALTER TABLE public.outlets
  DROP CONSTRAINT IF EXISTS outlets_owner_id_fkey,
  ALTER COLUMN owner_id TYPE UUID;

ALTER TABLE public.outlets
  ADD CONSTRAINT outlets_owner_id_fkey
  FOREIGN KEY (owner_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Update staff_outlet_assignments table
ALTER TABLE public.staff_outlet_assignments
  DROP CONSTRAINT IF EXISTS staff_outlet_assignments_user_id_fkey,
  ALTER COLUMN user_id TYPE UUID;

ALTER TABLE public.staff_outlet_assignments
  ADD CONSTRAINT staff_outlet_assignments_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Add a session store table for connect-pg-simple
CREATE TABLE IF NOT EXISTS "session" (
  "sid" varchar NOT NULL COLLATE "default",
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL,
  CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
) WITH (OIDS=FALSE);

CREATE INDEX IF NOT EXISTS "IX_session_expire" ON "session" ("expire");
