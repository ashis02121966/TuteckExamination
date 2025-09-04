/*
  # Fix RLS policy for roles table admin access

  1. Security Updates
    - Drop incorrect admin policy with wrong role ID
    - Create new admin policy with correct role ID (550e8400-e29b-41d4-a716-446655440001)
    - Ensure administrators can manage roles and menu access

  2. Policy Changes
    - roles_all_admin: Updated to use correct admin role ID
    - Allows full CRUD operations on roles table for administrators
*/

-- Drop the existing incorrect policy
DROP POLICY IF EXISTS "roles_all_admin" ON roles;

-- Create the correct admin policy with the right role ID
CREATE POLICY "roles_all_admin" ON roles
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role_id = '550e8400-e29b-41d4-a716-446655440001'::uuid
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role_id = '550e8400-e29b-41d4-a716-446655440001'::uuid
    )
  );

-- Ensure the policy is properly applied
COMMENT ON POLICY "roles_all_admin" ON roles IS 'Allow administrators to manage all roles and menu access';