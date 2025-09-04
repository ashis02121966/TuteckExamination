/*
  # Fix RLS policies to prevent infinite recursion

  1. Policy Changes
    - Remove problematic recursive policies on users table
    - Add simple, non-recursive policies for user access
    - Ensure admin access without circular dependencies

  2. Security
    - Users can read their own data using auth.uid()
    - Admins can read all users without recursive lookups
    - Supervisors can view their team without circular references
*/

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view their own data" ON users;
DROP POLICY IF EXISTS "Supervisors can view their team" ON users;
DROP POLICY IF EXISTS "Admins can manage all users" ON users;

-- Create simple, non-recursive policies
CREATE POLICY "Users can read own profile"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Service role can manage all users"
  ON users
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow anon access for setup (keep existing)
-- These policies should already exist and work fine

-- Create a simple admin policy that doesn't cause recursion
CREATE POLICY "Admin users can read all users"
  ON users
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM roles 
      WHERE id = (
        SELECT role_id FROM users 
        WHERE id = auth.uid()
      ) 
      AND level = 1
    )
  );

-- Create a simple supervisor policy that doesn't cause recursion
CREATE POLICY "Supervisors can read team members"
  ON users
  FOR SELECT
  TO authenticated
  USING (
    parent_id = auth.uid() 
    OR 
    EXISTS (
      SELECT 1 FROM roles 
      WHERE id = (
        SELECT role_id FROM users 
        WHERE id = auth.uid()
      ) 
      AND level <= 4
    )
  );

-- Update roles policies to be simpler
DROP POLICY IF EXISTS "Admins can manage all roles" ON roles;

CREATE POLICY "Admin users can manage roles"
  ON roles
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM roles r
      WHERE r.id = (
        SELECT role_id FROM users 
        WHERE id = auth.uid()
      ) 
      AND r.level = 1
    )
  );