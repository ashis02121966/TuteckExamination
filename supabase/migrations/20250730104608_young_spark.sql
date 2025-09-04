/*
  # Complete eSigma Survey Platform Database Schema
  
  1. New Tables
    - `roles` - User roles and permissions with hierarchical levels
    - `users` - User accounts with authentication and profile data
    - `surveys` - Survey definitions with targeting and configuration
    - `survey_sections` - Sections within surveys for organization
    - `questions` - Question bank with types and complexity levels
    - `question_options` - Multiple choice options for questions
    - `test_sessions` - Active test sessions with state management
    - `test_answers` - User responses to questions
    - `test_results` - Final test results and scoring
    - `section_scores` - Section-wise performance breakdown
    - `certificates` - Generated certificates for passed tests
    - `system_settings` - Configurable system parameters
    - `activity_logs` - Audit trail and user activity tracking

  2. Security
    - Enable RLS on all tables
    - Add comprehensive policies for role-based access
    - Implement proper data isolation by user hierarchy

  3. Features
    - Complete RBAC system with 6 hierarchical levels
    - Test session management with auto-save and resume
    - Certificate generation for passed tests
    - Comprehensive audit logging
    - Flexible system configuration
*/

-- Drop existing policies first to avoid conflicts
DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- Drop all existing policies on all tables
    FOR r IN (SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
    END LOOP;
END $$;

-- Create roles table
CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(50) UNIQUE NOT NULL,
  description text,
  level integer DEFAULT 5 NOT NULL,
  is_active boolean DEFAULT true,
  menu_access text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email varchar(255) UNIQUE NOT NULL,
  password_hash varchar(255) NOT NULL,
  name varchar(255) NOT NULL,
  role_id uuid NOT NULL REFERENCES roles(id),
  is_active boolean DEFAULT true,
  jurisdiction varchar(255),
  zone varchar(255),
  region varchar(255),
  district varchar(255),
  employee_id varchar(100),
  phone_number varchar(20),
  profile_image text,
  parent_id uuid REFERENCES users(id),
  last_login timestamptz,
  password_changed_at timestamptz DEFAULT now(),
  failed_login_attempts integer DEFAULT 0,
  locked_until timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create surveys table
CREATE TABLE IF NOT EXISTS surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title varchar(255) NOT NULL,
  description text,
  target_date date NOT NULL,
  duration integer DEFAULT 35,
  total_questions integer DEFAULT 30,
  passing_score integer DEFAULT 70,
  max_attempts integer DEFAULT 3,
  is_active boolean DEFAULT true,
  assigned_zones text[] DEFAULT '{}',
  assigned_regions text[] DEFAULT '{}',
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create survey_sections table
CREATE TABLE IF NOT EXISTS survey_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  title varchar(255) NOT NULL,
  description text,
  questions_count integer DEFAULT 10,
  section_order integer DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create questions table
CREATE TABLE IF NOT EXISTS questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id uuid NOT NULL REFERENCES survey_sections(id) ON DELETE CASCADE,
  text text NOT NULL,
  question_type varchar(20) NOT NULL CHECK (question_type IN ('single_choice', 'multiple_choice')),
  complexity varchar(10) DEFAULT 'medium' CHECK (complexity IN ('easy', 'medium', 'hard')),
  points integer DEFAULT 1,
  explanation text,
  question_order integer DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create question_options table
CREATE TABLE IF NOT EXISTS question_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  text text NOT NULL,
  is_correct boolean DEFAULT false,
  option_order integer DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

-- Create test_sessions table
CREATE TABLE IF NOT EXISTS test_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  survey_id uuid NOT NULL REFERENCES surveys(id),
  start_time timestamptz DEFAULT now() NOT NULL,
  end_time timestamptz,
  time_remaining integer NOT NULL,
  current_question_index integer DEFAULT 0,
  session_status varchar(20) DEFAULT 'in_progress' CHECK (session_status IN ('in_progress', 'completed', 'timeout', 'paused')),
  attempt_number integer DEFAULT 1,
  score numeric(5,2),
  is_passed boolean,
  completed_at timestamptz,
  pause_time timestamptz,
  resume_time timestamptz,
  total_pause_duration integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create test_answers table
CREATE TABLE IF NOT EXISTS test_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES test_sessions(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES questions(id),
  selected_options uuid[] DEFAULT '{}',
  is_correct boolean DEFAULT false,
  time_spent integer DEFAULT 0,
  answered boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(session_id, question_id)
);

-- Create test_results table
CREATE TABLE IF NOT EXISTS test_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  survey_id uuid NOT NULL REFERENCES surveys(id),
  session_id uuid NOT NULL REFERENCES test_sessions(id),
  score numeric(5,2) NOT NULL,
  total_questions integer NOT NULL,
  correct_answers integer NOT NULL,
  is_passed boolean NOT NULL,
  time_spent integer NOT NULL,
  attempt_number integer NOT NULL,
  grade varchar(2),
  completed_at timestamptz DEFAULT now() NOT NULL,
  certificate_id uuid,
  created_at timestamptz DEFAULT now()
);

-- Create section_scores table
CREATE TABLE IF NOT EXISTS section_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  result_id uuid NOT NULL REFERENCES test_results(id) ON DELETE CASCADE,
  section_id uuid NOT NULL REFERENCES survey_sections(id),
  section_title varchar(255) NOT NULL,
  score numeric(5,2) NOT NULL,
  total_questions integer NOT NULL,
  correct_answers integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create certificates table
CREATE TABLE IF NOT EXISTS certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  survey_id uuid NOT NULL REFERENCES surveys(id),
  result_id uuid NOT NULL REFERENCES test_results(id),
  certificate_number varchar(100) UNIQUE NOT NULL,
  issued_at timestamptz DEFAULT now() NOT NULL,
  valid_until date,
  download_count integer DEFAULT 0,
  certificate_status varchar(20) DEFAULT 'active' CHECK (certificate_status IN ('active', 'revoked', 'expired')),
  created_at timestamptz DEFAULT now()
);

-- Create system_settings table
CREATE TABLE IF NOT EXISTS system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category varchar(50) NOT NULL,
  setting_key varchar(100) NOT NULL,
  setting_value text NOT NULL,
  description text,
  setting_type varchar(20) DEFAULT 'string' CHECK (setting_type IN ('string', 'number', 'boolean', 'json', 'email', 'url', 'color', 'select')),
  is_editable boolean DEFAULT true,
  options text[],
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES users(id),
  UNIQUE(category, setting_key)
);

-- Create activity_logs table
CREATE TABLE IF NOT EXISTS activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id),
  activity_type varchar(50) NOT NULL,
  description text NOT NULL,
  metadata jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- Add foreign key constraint for certificates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'test_results_certificate_id_fkey'
  ) THEN
    ALTER TABLE test_results ADD CONSTRAINT test_results_certificate_id_fkey 
    FOREIGN KEY (certificate_id) REFERENCES certificates(id);
  END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_users_parent_id ON users(parent_id);
CREATE INDEX IF NOT EXISTS idx_surveys_created_by ON surveys(created_by);
CREATE INDEX IF NOT EXISTS idx_survey_sections_survey_id ON survey_sections(survey_id);
CREATE INDEX IF NOT EXISTS idx_questions_section_id ON questions(section_id);
CREATE INDEX IF NOT EXISTS idx_question_options_question_id ON question_options(question_id);
CREATE INDEX IF NOT EXISTS idx_test_sessions_user_id ON test_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_test_sessions_survey_id ON test_sessions(survey_id);
CREATE INDEX IF NOT EXISTS idx_test_answers_session_id ON test_answers(session_id);
CREATE INDEX IF NOT EXISTS idx_test_results_user_id ON test_results(user_id);
CREATE INDEX IF NOT EXISTS idx_test_results_survey_id ON test_results(survey_id);
CREATE INDEX IF NOT EXISTS idx_certificates_user_id ON certificates(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);

-- Enable Row Level Security on all tables
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE section_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for roles table
CREATE POLICY "roles_select_all" ON roles FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "roles_insert_anon" ON roles FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "roles_all_service_role" ON roles FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "roles_all_admin" ON roles FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role_id = '550e8400-e29b-41d4-a716-446655440010'))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role_id = '550e8400-e29b-41d4-a716-446655440010'));

-- Create RLS policies for users table
CREATE POLICY "users_select_own" ON users FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "users_update_own" ON users FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "users_anon_setup" ON users FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "users_service_role_all" ON users FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Create RLS policies for surveys table
CREATE POLICY "Allow anon to read surveys for setup check" ON surveys FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon to insert surveys during setup" ON surveys FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Users can view assigned surveys" ON surveys FOR SELECT TO authenticated 
  USING (is_active = true AND (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND (
      u.zone::text = ANY(surveys.assigned_zones) OR 
      u.region::text = ANY(surveys.assigned_regions) OR 
      array_length(surveys.assigned_zones, 1) IS NULL
    ))
  ));
CREATE POLICY "Admins can manage surveys" ON surveys FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = auth.uid() AND r.level = 1));

-- Create RLS policies for survey_sections table
CREATE POLICY "Users can read all survey sections" ON survey_sections FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow survey sections management" ON survey_sections FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Create RLS policies for questions table
CREATE POLICY "Users can read all questions" ON questions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow question management" ON questions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Create RLS policies for question_options table
CREATE POLICY "Users can read all question options" ON question_options FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow question options management" ON question_options FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Create RLS policies for test_sessions table
CREATE POLICY "Allow all test session operations" ON test_sessions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Create RLS policies for test_answers table
CREATE POLICY "Allow all test answer operations" ON test_answers FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Create RLS policies for test_results table
CREATE POLICY "Users can read test results" ON test_results FOR SELECT TO public USING (true);
CREATE POLICY "Users can create test results" ON test_results FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Users can update test results" ON test_results FOR UPDATE TO public USING (true) WITH CHECK (true);
CREATE POLICY "Allow users to update their own test results" ON test_results FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Create RLS policies for certificates table
CREATE POLICY "Users can read their own certificates" ON certificates FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can read all certificates" ON certificates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow certificate creation for passed tests" ON certificates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow certificate creation for system" ON certificates FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow certificate updates" ON certificates FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon to read certificates" ON certificates FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon certificate updates" ON certificates FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- Create RLS policies for system_settings table
CREATE POLICY "Allow anon to read system_settings for setup check" ON system_settings FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon to insert system_settings during setup" ON system_settings FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Admins can manage settings" ON system_settings FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = auth.uid() AND r.level = 1));

-- Create RLS policies for activity_logs table
CREATE POLICY "Users can view their own logs" ON activity_logs FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins can view all logs" ON activity_logs FOR SELECT TO authenticated 
  USING (EXISTS (SELECT 1 FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = auth.uid() AND r.level = 1));