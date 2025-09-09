/*
  # Fix infinite recursion in users table RLS policy

  1. Problem
    - Current RLS policy on users table creates infinite recursion
    - Policy tries to query users table from within users table policy
    - This causes circular reference during policy evaluation

  2. Solution
    - Drop all existing problematic policies on users table
    - Create simple, non-recursive policies
    - Use auth.uid() directly instead of complex joins
    - Add service role access for admin operations
*/

-- Drop all existing policies on users table to prevent conflicts
DROP POLICY IF EXISTS "users_select_admin_zo_ro_supervisor" ON users;
DROP POLICY IF EXISTS "users_select_own" ON users;
DROP POLICY IF EXISTS "users_update_own" ON users;
DROP POLICY IF EXISTS "users_anon_setup" ON users;
DROP POLICY IF EXISTS "users_service_role_all" ON users;

-- Ensure RLS is enabled
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create simple, non-recursive policy for users to view their own data
CREATE POLICY "users_select_own"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Create policy for users to update their own data
CREATE POLICY "users_update_own"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Allow service role full access (for admin operations)
CREATE POLICY "users_service_role_all"
  ON users
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow anonymous access during setup/initialization
CREATE POLICY "users_anon_setup"
  ON users
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);