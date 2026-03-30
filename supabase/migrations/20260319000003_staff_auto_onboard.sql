-- ─────────────────────────────────────────────────────────────────────────────
-- Staff auto-onboarding on signup
--
-- When a new user signs up, check whether their email matches an existing
-- staff_members record (added by an owner). If it does:
--   1. Set their profile role to the appropriate mapped role
--   2. Auto-create staff_outlet_assignments so they can see their outlets
-- If it doesn't match, they are treated as a new owner (existing behaviour).
-- ─────────────────────────────────────────────────────────────────────────────

-- Map staff_members.role → profiles.role (which has a CHECK constraint)
-- chef/waiter/cashier/staff → 'service' or 'kitchen'
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_staff         RECORD;
  v_profile_role  TEXT := 'owner';
  v_outlet_link   RECORD;
BEGIN
  -- Try to find a matching staff_members record by the new user's email
  SELECT sm.id, sm.role, sm.owner_id
    INTO v_staff
    FROM public.staff_members sm
   WHERE lower(sm.email) = lower(NEW.email)
     AND sm.is_active = true
   LIMIT 1;

  IF FOUND THEN
    -- Map staff role to the allowed profile roles
    v_profile_role := CASE v_staff.role
      WHEN 'manager'  THEN 'manager'
      WHEN 'chef'     THEN 'kitchen'
      WHEN 'waiter'   THEN 'service'
      WHEN 'cashier'  THEN 'service'
      ELSE                 'service'
    END;
  END IF;

  -- Insert profile with the determined role
  INSERT INTO public.profiles (user_id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)),
    v_profile_role
  );

  -- If staff member found, auto-assign them to their outlets via staff_outlet_assignments
  IF FOUND THEN
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

-- Ensure trigger exists (re-create it in case it was dropped)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
