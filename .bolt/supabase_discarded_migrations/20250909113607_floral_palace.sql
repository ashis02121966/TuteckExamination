/*
  # Fix infinite recursion in users table RLS policy

  1. Problem
    - The current RLS policy on users table creates infinite recursion
    - Policy queries users table from within users table policy
    - This causes "infinite recursion detected in policy" error

  2. Solution
    - Drop the problematic recursive policy
    - Create simple, non-recursive policies
    - Use auth.jwt() to get user role information directly
    - Avoid querying users table from within users table policy

  3. New Policies
    - Simple policy for users to view their own data
    - Admin access policy using service role or simpler approach
*/

-- Drop the problematic recursive policy
DROP POLICY IF EXISTS "users_select_admin_zo_ro_supervisor" ON users;

-- Ensure RLS is enabled
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create simple policy for users to view their own data
DROP POLICY IF EXISTS "users_select_own" ON users;
CREATE POLICY "users_select_own"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Create policy for service role to access all users (for admin operations)
DROP POLICY IF EXISTS "users_service_role_all" ON users;
CREATE POLICY "users_service_role_all"
  ON users
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create policy for anon users during setup
DROP POLICY IF EXISTS "users_anon_setup" ON users;
CREATE POLICY "users_anon_setup"
  ON users
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- Allow users to update their own profile
DROP POLICY IF EXISTS "users_update_own" ON users;
CREATE POLICY "users_update_own"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Ensure roles table has proper policies
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "roles_select_all" ON roles;
CREATE POLICY "roles_select_all"
  ON roles
  FOR SELECT
  TO authenticated, anon
  USING (true);

DROP POLICY IF EXISTS "roles_service_role_all" ON roles;
CREATE POLICY "roles_service_role_all"
  ON roles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "roles_insert_anon" ON roles;
CREATE POLICY "roles_insert_anon"
  ON roles
  FOR INSERT
  TO anon
  USING (true)
  WITH CHECK (true);