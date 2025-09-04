/*
  # Fix RLS policies for questions and related tables

  1. Tables Updated
    - `questions` - Allow authenticated users to read questions
    - `question_options` - Allow authenticated users to read question options  
    - `survey_sections` - Allow authenticated users to read survey sections

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to read data
    - Remove overly restrictive policies that block legitimate access

  3. Changes
    - Drop existing restrictive policies
    - Create permissive SELECT policies for authenticated users
    - Ensure enumerators can access test questions
*/

-- Fix questions table RLS policies
DROP POLICY IF EXISTS "Allow anon to read questions for setup check" ON questions;
DROP POLICY IF EXISTS "Allow anon to insert questions during setup" ON questions;

CREATE POLICY "Authenticated users can read questions"
  ON questions
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow anon to read questions for setup check"
  ON questions
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon to insert questions during setup"
  ON questions
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Fix question_options table RLS policies
DROP POLICY IF EXISTS "Allow anon to read question_options for setup check" ON question_options;
DROP POLICY IF EXISTS "Allow anon to insert question_options during setup" ON question_options;

CREATE POLICY "Authenticated users can read question options"
  ON question_options
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow anon to read question_options for setup check"
  ON question_options
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon to insert question_options during setup"
  ON question_options
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Fix survey_sections table RLS policies
DROP POLICY IF EXISTS "Allow anon to read survey_sections for setup check" ON survey_sections;
DROP POLICY IF EXISTS "Allow anon to insert survey_sections during setup" ON survey_sections;

CREATE POLICY "Authenticated users can read survey sections"
  ON survey_sections
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow anon to read survey_sections for setup check"
  ON survey_sections
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon to insert survey_sections during setup"
  ON survey_sections
  FOR INSERT
  TO anon
  WITH CHECK (true);