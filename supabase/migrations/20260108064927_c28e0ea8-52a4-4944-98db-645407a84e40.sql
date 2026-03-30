-- First, create a security definer function to check staff assignments without recursion
CREATE OR REPLACE FUNCTION public.is_staff_of_outlet(_user_id uuid, _outlet_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_outlet_assignments
    WHERE user_id = _user_id AND outlet_id = _outlet_id
  )
$$;

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Staff can view assigned outlets" ON public.outlets;
DROP POLICY IF EXISTS "Owners can manage their outlets" ON public.outlets;

-- Recreate owner policy (simple, no recursion risk)
CREATE POLICY "Owners can manage their outlets" 
ON public.outlets 
FOR ALL 
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

-- Recreate staff view policy using the security definer function
CREATE POLICY "Staff can view assigned outlets" 
ON public.outlets 
FOR SELECT 
USING (
  auth.uid() = owner_id 
  OR 
  public.is_staff_of_outlet(auth.uid(), id)
);