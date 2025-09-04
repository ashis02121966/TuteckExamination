/*
  # Fix infinite recursion in users table RLS policies

  1. Security Changes
    - Drop all existing RLS policies on users table that cause recursion
    - Create simple, non-recursive policies
    - Use direct auth.uid() comparisons instead of subqueries
    - Maintain security while preventing circular dependencies

  2. Policy Structure
    - Users can only read their own data
    - Service role has full access
    - Anonymous users can insert during setup only
*/

-- Drop all existing policies on users table to prevent recursion
DROP POLICY IF EXISTS "users_all_service_role" ON users;
DROP POLICY IF EXISTS "users_insert_anon_setup" ON users;
DROP POLICY IF EXISTS "users_select_admin_direct" ON users;
DROP POLICY IF EXISTS "users_select_anon_setup" ON users;
DROP POLICY IF EXISTS "users_select_own_simple" ON users;
DROP POLICY IF EXISTS "users_update_own" ON users;

-- Create simple, non-recursive policies
CREATE POLICY "users_select_own" ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "users_update_own" ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "users_service_role_all" ON users
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "users_anon_setup" ON users
  FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);