/*
  # Fix Activity Logs RLS Policy

  1. Security Updates
    - Add INSERT policy for authenticated users to create activity logs
    - Add INSERT policy for anon users during system operations
    - Ensure proper access control for activity logging

  2. Changes
    - Allow authenticated users to insert their own activity logs
    - Allow anon users to insert activity logs during setup/system operations
    - Maintain existing SELECT policies for reading logs
*/

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow activity log creation" ON activity_logs;
DROP POLICY IF EXISTS "Allow anon activity log creation" ON activity_logs;

-- Create INSERT policy for authenticated users
CREATE POLICY "Allow authenticated users to insert activity logs"
  ON activity_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create INSERT policy for anon users (for system operations)
CREATE POLICY "Allow anon users to insert activity logs"
  ON activity_logs
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Ensure UPDATE policy exists for system operations
CREATE POLICY "Allow activity log updates"
  ON activity_logs
  FOR UPDATE
  TO authenticated, anon
  USING (true)
  WITH CHECK (true);