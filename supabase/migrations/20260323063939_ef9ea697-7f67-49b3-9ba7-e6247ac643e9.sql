
-- Drop the recursive admin policy
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;

-- Recreate it using the security definer function to avoid recursion
CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));
