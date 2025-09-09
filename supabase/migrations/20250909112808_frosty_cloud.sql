/*
  # Enable RLS and create admin access policy for users table

  1. Security Updates
    - Enable Row Level Security on users table
    - Create policy for admin/management roles to view all users
    - Ensure proper access control based on role levels

  2. Policy Details
    - Allows users with role level <= 5 to view all user records
    - Includes Admin (1), ZO User (3), RO User (4), Supervisor (5)
    - Maintains existing user_select_own policy for individual access
*/

-- Enable RLS on users table if not already enabled
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Drop existing conflicting policies if they exist
DROP POLICY IF EXISTS "users_select_admin_zo_ro_supervisor" ON users;
DROP POLICY IF EXISTS "users_select_all_management" ON users;

-- Create policy for admin and management roles to view all users
CREATE POLICY "users_select_admin_management"
  ON users
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1
    FROM users AS u_viewer
    JOIN roles AS r_viewer ON u_viewer.role_id = r_viewer.id
    WHERE u_viewer.id = auth.uid() AND r_viewer.level <= 5
  ));

-- Ensure the existing policy for users to view their own data still exists
CREATE POLICY IF NOT EXISTS "users_select_own"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Create policy for users to update their own data
CREATE POLICY IF NOT EXISTS "users_update_own"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);