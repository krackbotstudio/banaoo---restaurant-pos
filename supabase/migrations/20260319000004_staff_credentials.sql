-- ─────────────────────────────────────────────────────────────────────────────
-- Staff system credentials (username + PIN-based login)
--
-- Adds username and system_email columns to staff_members so each staff
-- member gets a generated login like "ravi.a3f2" and system email
-- "ravi.a3f2@banaoo-staff.app" used for Supabase auth.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.staff_members
  ADD COLUMN IF NOT EXISTS username     TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS system_email TEXT UNIQUE;

-- Update handle_new_user trigger to detect staff accounts created
-- via the create-staff-user edge function (identified by staff_member_id in metadata)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_staff         RECORD;
  v_profile_role  TEXT := 'owner';
  v_outlet_link   RECORD;
  v_staff_id      UUID;
BEGIN
  -- Check if this is a staff auth account (has staff_member_id in metadata)
  v_staff_id := (NEW.raw_user_meta_data ->> 'staff_member_id')::UUID;

  IF v_staff_id IS NOT NULL THEN
    SELECT sm.id, sm.role, sm.owner_id
      INTO v_staff
      FROM public.staff_members sm
     WHERE sm.id = v_staff_id
       AND sm.is_active = true;

    IF FOUND THEN
      v_profile_role := CASE v_staff.role
        WHEN 'manager'  THEN 'manager'
        WHEN 'chef'     THEN 'kitchen'
        WHEN 'waiter'   THEN 'service'
        WHEN 'cashier'  THEN 'service'
        ELSE                 'service'
      END;
    END IF;
  ELSE
    -- Fall back: check if this is a staff email signup (old approach / email match)
    SELECT sm.id, sm.role, sm.owner_id
      INTO v_staff
      FROM public.staff_members sm
     WHERE lower(sm.email) = lower(NEW.email)
        OR lower(sm.system_email) = lower(NEW.email)
       AND sm.is_active = true
     LIMIT 1;

    IF FOUND THEN
      v_profile_role := CASE v_staff.role
        WHEN 'manager'  THEN 'manager'
        WHEN 'chef'     THEN 'kitchen'
        WHEN 'waiter'   THEN 'service'
        WHEN 'cashier'  THEN 'service'
        ELSE                 'service'
      END;
    END IF;
  END IF;

  -- Insert profile
  INSERT INTO public.profiles (user_id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)),
    v_profile_role
  );

  -- Auto-assign outlets from staff_outlet_links
  IF v_staff.id IS NOT NULL THEN
    FOR v_outlet_link IN
      SELECT outlet_id
        FROM public.staff_outlet_links
       WHERE staff_member_id = v_staff.id
    LOOP
      INSERT INTO public.staff_outlet_assignments (user_id, outlet_id)
      VALUES (NEW.id, v_outlet_link.outlet_id)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
