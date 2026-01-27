```sql
-- Fix the RLS policy on the roles table to use the correct admin role ID.
-- The 'Administrator' role has the ID '550e8400-e29b-41d4-a716-446655440001'.
-- The existing policy 'roles_all_admin' was incorrectly referencing '550e8400-e29b-41d4-a716-446655440010'.

-- Drop the existing policy to recreate it with the correct UUID
DROP POLICY IF EXISTS roles_all_admin ON public.roles;

-- Recreate the policy with the correct admin role ID for ALL operations
CREATE POLICY roles_all_admin ON public.roles
    FOR ALL
    TO authenticated
    USING (EXISTS ( SELECT 1
            FROM users
            WHERE ((users.id = auth.uid()) AND (users.role_id = '550e8400-e29b-41d4-a716-446655440001'::uuid))))
    WITH CHECK (EXISTS ( SELECT 1
            FROM users
            WHERE ((users.id = auth.uid()) AND (users.role_id = '550e8400-e29b-41d4-a716-446655440001'::uuid))));

-- Ensure the policy is enabled
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
```