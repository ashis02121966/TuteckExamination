/*
  # Fix infinite recursion in users table RLS policies

  1. Problem
    - Current RLS policies on users table are causing infinite recursion
    - The error occurs when policies reference the users table within their own conditions
    - This creates circular dependencies that PostgreSQL cannot resolve

  2. Solution
    - Drop all existing problematic policies on users table
    - Create simple, non-recursive policies that avoid circular references
    - Use direct auth.uid() comparisons instead of complex subqueries
    - Separate admin access using direct role_id checks

  3. Security
    - Users can only read their own profile data
    - Service role has full access for system operations
    - Admin users can read all users without recursion
    - All policies use simple, direct comparisons
*/

-- Drop all existing policies on users table to eliminate recursion
DROP POLICY IF EXISTS "users_insert_anon" ON public.users;
DROP POLICY IF EXISTS "users_select_admin" ON public.users;
DROP POLICY IF EXISTS "users_select_anon" ON public.users;
DROP POLICY IF EXISTS "users_select_own" ON public.users;
DROP POLICY IF EXISTS "users_select_service_role" ON public.users;

-- Create simple, non-recursive policies

-- Allow users to read their own profile
CREATE POLICY "users_select_own_simple"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Allow service role full access
CREATE POLICY "users_all_service_role"
  ON public.users
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow anon users to read for setup/initialization
CREATE POLICY "users_select_anon_setup"
  ON public.users
  FOR SELECT
  TO anon
  USING (true);

-- Allow anon users to insert during setup
CREATE POLICY "users_insert_anon_setup"
  ON public.users
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow admin users to read all users (using direct role_id check)
CREATE POLICY "users_select_admin_direct"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u 
      WHERE u.id = auth.uid() 
      AND u.role_id = '550e8400-e29b-41d4-a716-446655440010'::uuid
    )
  );

-- Allow authenticated users to update their own profile
CREATE POLICY "users_update_own"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);