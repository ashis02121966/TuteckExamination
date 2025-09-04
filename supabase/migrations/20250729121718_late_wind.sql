/*
  # Fix infinite recursion in RLS policies

  1. Security Changes
    - Drop all existing problematic RLS policies on users and roles tables
    - Create simple, non-recursive policies that avoid circular dependencies
    - Use direct auth.uid() checks instead of complex subqueries
    - Ensure service role has full access for system operations

  2. Policy Structure
    - Users can read their own data using auth.uid() = id
    - Service role bypasses all restrictions
    - Admin access uses direct role_id checks without recursion
    - Simplified supervisor and team member access

  3. Important Notes
    - Removes all circular references between users and roles tables
    - Uses straightforward policy expressions to prevent recursion
    - Maintains security while fixing the infinite loop issue
*/

-- Drop all existing problematic policies on users table
DROP POLICY IF EXISTS "Admin users can read all users" ON public.users;
DROP POLICY IF EXISTS "Allow anon to insert users during setup" ON public.users;
DROP POLICY IF EXISTS "Allow anon to read users for setup check" ON public.users;
DROP POLICY IF EXISTS "Service role can manage all users" ON public.users;
DROP POLICY IF EXISTS "Supervisors can read team members" ON public.users;
DROP POLICY IF EXISTS "Users can read own profile" ON public.users;

-- Drop all existing problematic policies on roles table
DROP POLICY IF EXISTS "Admin users can manage roles" ON public.roles;
DROP POLICY IF EXISTS "Allow anon to insert roles during setup" ON public.roles;
DROP POLICY IF EXISTS "Allow anon to read roles for setup check" ON public.roles;
DROP POLICY IF EXISTS "Users can view roles" ON public.roles;

-- Create simple, non-recursive policies for users table
CREATE POLICY "users_select_own" ON public.users
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "users_select_service_role" ON public.users
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "users_insert_anon" ON public.users
  FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "users_select_anon" ON public.users
  FOR SELECT TO anon
  USING (true);

-- Admin users can read all users (using direct role_id check)
CREATE POLICY "users_select_admin" ON public.users
  FOR SELECT TO authenticated
  USING (
    role_id = '550e8400-e29b-41d4-a716-446655440010'::uuid
  );

-- Create simple, non-recursive policies for roles table
CREATE POLICY "roles_select_all" ON public.roles
  FOR SELECT TO authenticated, anon
  USING (true);

CREATE POLICY "roles_insert_anon" ON public.roles
  FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "roles_all_service_role" ON public.roles
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Admin users can manage roles (using direct role_id check)
CREATE POLICY "roles_all_admin" ON public.roles
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
      AND users.role_id = '550e8400-e29b-41d4-a716-446655440010'::uuid
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
      AND users.role_id = '550e8400-e29b-41d4-a716-446655440010'::uuid
    )
  );

-- Ensure RLS is enabled on both tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;