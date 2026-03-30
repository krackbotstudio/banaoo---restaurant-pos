-- Drop the problematic policies and recreate them properly
DROP POLICY IF EXISTS "Staff can view assigned outlets" ON public.outlets;
DROP POLICY IF EXISTS "Owners can manage their outlets" ON public.outlets;

-- Recreate owner policy (simple, no recursion risk)
CREATE POLICY "Owners can manage their outlets" 
ON public.outlets 
FOR ALL 
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

-- Recreate staff view policy using a subquery that avoids recursion
CREATE POLICY "Staff can view assigned outlets" 
ON public.outlets 
FOR SELECT 
USING (
  auth.uid() = owner_id 
  OR 
  id IN (
    SELECT outlet_id FROM public.staff_outlet_assignments WHERE user_id = auth.uid()
  )
);