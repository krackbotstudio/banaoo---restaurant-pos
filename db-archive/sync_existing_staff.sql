-- Sync all existing staff members to public.users
INSERT INTO public.users (id, email, created_at)
SELECT id, system_email, created_at 
FROM public.staff_members 
WHERE system_email IS NOT NULL
ON CONFLICT (id) DO NOTHING;

-- Also ensure profiles exist for them
INSERT INTO public.profiles (user_id, full_name, role)
SELECT 
  id, 
  full_name, 
  CASE role
    WHEN 'manager'  THEN 'manager'
    WHEN 'chef'     THEN 'kitchen'
    WHEN 'waiter'   THEN 'service'
    WHEN 'cashier'  THEN 'service'
    ELSE                 'service'
  END
FROM public.staff_members
ON CONFLICT (user_id) DO NOTHING;
