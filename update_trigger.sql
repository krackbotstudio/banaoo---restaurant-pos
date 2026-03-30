CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_staff         RECORD;
  v_profile_role  TEXT := 'owner';
  v_outlet_link   RECORD;
  v_staff_id      UUID;
BEGIN
  -- 1. SYNC TO PUBLIC.USERS
  -- Ensure the user exists in our public users table for Passport.js compatibility
  INSERT INTO public.users (id, email, created_at)
  VALUES (NEW.id, NEW.email, NEW.created_at)
  ON CONFLICT (id) DO NOTHING;

  -- 2. IDENTIFY STAFF
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
    -- Fallback for old approach
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

  -- 3. INSERT PROFILE
  INSERT INTO public.profiles (user_id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)),
    v_profile_role
  ) ON CONFLICT (user_id) DO NOTHING;

  -- 4. AUTO-ASSIGN OUTLETS
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
