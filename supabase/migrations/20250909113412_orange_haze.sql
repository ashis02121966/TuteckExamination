/*
  # Admin User Access RLS Policy

  1. Security Updates
    - Enable RLS on users table if not already enabled
    - Create policy for admin-level users to view all user records
    - Maintain existing policies for individual user access

  2. Policy Details
    - Allows users with role level <= 5 to view all user records
    - Includes Admin (1), ZO User (3), RO User (4), Supervisor (5)
    - Maintains existing users_select_own policy for individual access

  3. Changes
    - Enable RLS on users table
    - Create users_select_admin_zo_ro_supervisor policy for SELECT operations
    - Policy checks if current user has role level <= 5
*/

-- Enable RLS on users table (safe if already enabled)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists to avoid conflicts
DROP POLICY IF EXISTS "users_select_admin_zo_ro_supervisor" ON users;

-- Create policy allowing admin-level users to view all user records
CREATE POLICY "users_select_admin_zo_ro_supervisor"
  ON users
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1
    FROM users AS u_viewer
    JOIN roles AS r_viewer ON u_viewer.role_id = r_viewer.id
    WHERE u_viewer.id = auth.uid() AND r_viewer.level <= 5
  ));

-- Ensure the existing users_select_own policy exists for individual access
-- This allows users to view their own data regardless of role level
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'users' 
    AND policyname = 'users_select_own'
  ) THEN
    CREATE POLICY "users_select_own"
      ON users
      FOR SELECT
      TO authenticated
      USING (id = auth.uid());
  END IF;
END $$;