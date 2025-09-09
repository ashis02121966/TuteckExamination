/*
  # Fix infinite recursion in RLS policies

  1. Security
    - Drop all existing problematic RLS policies on users table
    - Create simple, non-recursive policies
    - Ensure no circular dependencies in policy logic

  2. Changes
    - Remove policies that query users table from within users table policies
    - Use direct auth.uid() comparisons instead of complex joins
    - Add service role access for admin operations
*/

-- Disable RLS temporarily to avoid issues during policy recreation
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies on users table
DROP POLICY IF EXISTS "users_anon_setup" ON users;
DROP POLICY IF EXISTS "users_select_own" ON users;
DROP POLICY IF EXISTS "users_service_role_all" ON users;
DROP POLICY IF EXISTS "users_update_own" ON users;
DROP POLICY IF EXISTS "users_admin_access" ON users;
DROP POLICY IF EXISTS "users_select_admin" ON users;

-- Re-enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create simple, non-recursive policies
CREATE POLICY "users_anon_setup"
  ON users
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "users_service_role_all"
  ON users
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "users_select_own"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "users_update_own"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Ensure roles table has proper policies to avoid similar issues
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "roles_select_all" ON roles;
DROP POLICY IF EXISTS "roles_all_admin" ON roles;
DROP POLICY IF EXISTS "roles_all_service_role" ON roles;
DROP POLICY IF EXISTS "roles_insert_anon" ON roles;

CREATE POLICY "roles_select_all"
  ON roles
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "roles_service_role_all"
  ON roles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "roles_insert_anon"
  ON roles
  FOR INSERT
  TO anon
  WITH CHECK (true);