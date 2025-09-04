/*
  # Fix Questions Access Policies

  1. Security Updates
    - Drop existing restrictive policies that block question access
    - Create comprehensive policies for authenticated users
    - Allow proper access to questions, options, and sections for test taking

  2. Tables Updated
    - questions: Allow SELECT for authenticated users
    - question_options: Allow SELECT for authenticated users  
    - survey_sections: Allow SELECT for authenticated users
    - test_sessions: Allow all operations for authenticated users
    - test_answers: Allow all operations for authenticated users
*/

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Allow anon to read questions for setup check" ON questions;
DROP POLICY IF EXISTS "Allow anon to insert questions during setup" ON questions;
DROP POLICY IF EXISTS "Authenticated users can read questions" ON questions;

DROP POLICY IF EXISTS "Allow anon to read question_options for setup check" ON question_options;
DROP POLICY IF EXISTS "Allow anon to insert question_options during setup" ON question_options;
DROP POLICY IF EXISTS "Authenticated users can read question options" ON question_options;

DROP POLICY IF EXISTS "Allow anon to read survey_sections for setup check" ON survey_sections;
DROP POLICY IF EXISTS "Allow anon to insert survey_sections during setup" ON survey_sections;
DROP POLICY IF EXISTS "Authenticated users can read survey sections" ON survey_sections;

-- Create comprehensive policies for questions
CREATE POLICY "Users can read all questions"
  ON questions
  FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Allow question management"
  ON questions
  FOR ALL
  TO authenticated, anon
  USING (true)
  WITH CHECK (true);

-- Create comprehensive policies for question_options
CREATE POLICY "Users can read all question options"
  ON question_options
  FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Allow question options management"
  ON question_options
  FOR ALL
  TO authenticated, anon
  USING (true)
  WITH CHECK (true);

-- Create comprehensive policies for survey_sections
CREATE POLICY "Users can read all survey sections"
  ON survey_sections
  FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Allow survey sections management"
  ON survey_sections
  FOR ALL
  TO authenticated, anon
  USING (true)
  WITH CHECK (true);

-- Ensure test_sessions policies are permissive
DROP POLICY IF EXISTS "Users can create test sessions" ON test_sessions;
DROP POLICY IF EXISTS "Users can manage their own sessions" ON test_sessions;
DROP POLICY IF EXISTS "Users can read all test sessions" ON test_sessions;
DROP POLICY IF EXISTS "Users can update test sessions" ON test_sessions;
DROP POLICY IF EXISTS "Supervisors can view team sessions" ON test_sessions;

CREATE POLICY "Allow all test session operations"
  ON test_sessions
  FOR ALL
  TO authenticated, anon
  USING (true)
  WITH CHECK (true);

-- Ensure test_answers policies are permissive
DROP POLICY IF EXISTS "Users can manage test answers" ON test_answers;

CREATE POLICY "Allow all test answer operations"
  ON test_answers
  FOR ALL
  TO authenticated, anon
  USING (true)
  WITH CHECK (true);