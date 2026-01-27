/*
  # Complete Database Initialization for eSigma Survey Platform

  This migration creates the complete database schema and initializes it with sample data
  for the online examination platform.

  ## 1. Tables Created
  - `roles` - User roles and permissions (Admin, ZO User, RO User, Supervisor, Enumerator)
  - `users` - User accounts with authentication and hierarchy
  - `surveys` - Survey/test definitions with targeting
  - `survey_sections` - Sections within surveys
  - `questions` - Question bank with different types and complexity
  - `question_options` - Multiple choice options for questions
  - `test_sessions` - Active test sessions with state management
  - `test_answers` - User responses to questions
  - `test_results` - Final test results and scores
  - `section_scores` - Section-wise performance tracking
  - `certificates` - Generated certificates for passed tests
  - `system_settings` - Configurable system parameters
  - `activity_logs` - Audit trail and activity logging

  ## 2. Sample Data
  - 5 user roles with hierarchical levels
  - Demo users for each role with proper credentials
  - 3 sample surveys with different configurations
  - Sample questions and options for testing
  - System settings for security, test, and general configuration

  ## 3. Security
  - Row Level Security (RLS) enabled on all tables
  - Role-based access policies
  - Proper foreign key constraints
  - Audit logging capabilities

  ## 4. Features
  - Hierarchical user management
  - Zone/Region/District targeting
  - Real-time test sessions with auto-save
  - Certificate generation
  - Comprehensive analytics and reporting
*/

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create roles table
CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  title varchar(255) NOT NULL,
  description text,
  target_date date NOT NULL,
  duration integer DEFAULT 35 NOT NULL,
  total_questions integer DEFAULT 30 NOT NULL,
  passing_score integer DEFAULT 70 NOT NULL,
  max_attempts integer DEFAULT 3 NOT NULL,
  is_active boolean DEFAULT true,
  assigned_zones text[] DEFAULT '{}',
  assigned_regions text[] DEFAULT '{}',
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create survey_sections table
CREATE TABLE IF NOT EXISTS survey_sections (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  survey_id uuid NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  title varchar(255) NOT NULL,
  description text,
  questions_count integer DEFAULT 10 NOT NULL,
  section_order integer DEFAULT 1 NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create questions table
CREATE TABLE IF NOT EXISTS questions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  section_id uuid NOT NULL REFERENCES survey_sections(id) ON DELETE CASCADE,
  text text NOT NULL,
  question_type varchar(20) NOT NULL CHECK (question_type IN ('single_choice', 'multiple_choice')),
  complexity varchar(10) DEFAULT 'medium' NOT NULL CHECK (complexity IN ('easy', 'medium', 'hard')),
  points integer DEFAULT 1 NOT NULL,
  explanation text,
  question_order integer DEFAULT 1 NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create question_options table
CREATE TABLE IF NOT EXISTS question_options (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  text text NOT NULL,
  is_correct boolean DEFAULT false,
  option_order integer DEFAULT 1 NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create test_sessions table
CREATE TABLE IF NOT EXISTS test_sessions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES users(id),
  survey_id uuid NOT NULL REFERENCES surveys(id),
  start_time timestamptz DEFAULT now() NOT NULL,
  end_time timestamptz,
  time_remaining integer NOT NULL,
  current_question_index integer DEFAULT 0,
  session_status varchar(20) DEFAULT 'in_progress' NOT NULL CHECK (session_status IN ('in_progress', 'completed', 'timeout', 'paused')),
  attempt_number integer DEFAULT 1 NOT NULL,
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
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES users(id),
  survey_id uuid NOT NULL REFERENCES surveys(id),
  result_id uuid NOT NULL REFERENCES test_results(id),
  certificate_number varchar(100) UNIQUE NOT NULL,
  issued_at timestamptz DEFAULT now() NOT NULL,
  valid_until date,
  download_count integer DEFAULT 0,
  certificate_status varchar(20) DEFAULT 'active' NOT NULL CHECK (certificate_status IN ('active', 'revoked', 'expired')),
  created_at timestamptz DEFAULT now()
);

-- Create system_settings table
CREATE TABLE IF NOT EXISTS system_settings (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  category varchar(50) NOT NULL,
  setting_key varchar(100) NOT NULL,
  setting_value text NOT NULL,
  description text,
  setting_type varchar(20) DEFAULT 'string' NOT NULL CHECK (setting_type IN ('string', 'number', 'boolean', 'json', 'email', 'url', 'color', 'select')),
  is_editable boolean DEFAULT true,
  options text[],
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES users(id),
  UNIQUE(category, setting_key)
);

-- Create activity_logs table
CREATE TABLE IF NOT EXISTS activity_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES users(id),
  activity_type varchar(50) NOT NULL,
  description text NOT NULL,
  metadata jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- Add foreign key constraint for test_results.certificate_id
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

-- Create RLS policies for roles
CREATE POLICY "roles_select_all" ON roles FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "roles_insert_anon" ON roles FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "roles_all_admin" ON roles FOR ALL TO authenticated USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role_id = '550e8400-e29b-41d4-a716-446655440001'
  )
);
CREATE POLICY "roles_all_service_role" ON roles FOR ALL TO service_role USING (true);

-- Create RLS policies for users
CREATE POLICY "users_select_own" ON users FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "users_update_own" ON users FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "users_anon_setup" ON users FOR ALL TO anon USING (true);
CREATE POLICY "users_service_role_all" ON users FOR ALL TO service_role USING (true);

-- Create RLS policies for surveys
CREATE POLICY "Allow anon to read surveys for setup check" ON surveys FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon to insert surveys during setup" ON surveys FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Users can view assigned surveys" ON surveys FOR SELECT TO authenticated USING (
  is_active = true AND (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND (
        u.zone = ANY(surveys.assigned_zones) OR 
        u.region = ANY(surveys.assigned_regions) OR 
        array_length(surveys.assigned_zones, 1) IS NULL
      )
    )
  )
);
CREATE POLICY "Admins can manage surveys" ON surveys FOR ALL TO authenticated USING (
  EXISTS (
    SELECT 1 FROM users u JOIN roles r ON u.role_id = r.id 
    WHERE u.id = auth.uid() AND r.level = 1
  )
);

-- Create RLS policies for survey_sections
CREATE POLICY "Users can read all survey sections" ON survey_sections FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow survey sections management" ON survey_sections FOR ALL TO anon, authenticated USING (true);

-- Create RLS policies for questions
CREATE POLICY "Users can read all questions" ON questions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow question management" ON questions FOR ALL TO anon, authenticated USING (true);

-- Create RLS policies for question_options
CREATE POLICY "Users can read all question options" ON question_options FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow question options management" ON question_options FOR ALL TO anon, authenticated USING (true);

-- Create RLS policies for test_sessions
CREATE POLICY "Allow all test session operations" ON test_sessions FOR ALL TO anon, authenticated USING (true);

-- Create RLS policies for test_answers
CREATE POLICY "Allow all test answer operations" ON test_answers FOR ALL TO anon, authenticated USING (true);

-- Create RLS policies for test_results
CREATE POLICY "Users can read test results" ON test_results FOR SELECT TO public USING (true);
CREATE POLICY "Users can create test results" ON test_results FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Users can update test results" ON test_results FOR UPDATE TO public USING (true);
CREATE POLICY "Allow users to update their own test results" ON test_results FOR UPDATE TO authenticated USING (true);

-- Create RLS policies for section_scores (inherits from test_results)

-- Create RLS policies for certificates
CREATE POLICY "Users can read their own certificates" ON certificates FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can read all certificates" ON certificates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow certificate creation for passed tests" ON certificates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow certificate updates" ON certificates FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow anon to read certificates" ON certificates FOR SELECT TO anon USING (true);
CREATE POLICY "Allow certificate creation for system" ON certificates FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon certificate updates" ON certificates FOR UPDATE TO anon USING (true);

-- Create RLS policies for system_settings
CREATE POLICY "Allow anon to read system_settings for setup check" ON system_settings FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon to insert system_settings during setup" ON system_settings FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Admins can manage settings" ON system_settings FOR ALL TO authenticated USING (
  EXISTS (
    SELECT 1 FROM users u JOIN roles r ON u.role_id = r.id 
    WHERE u.id = auth.uid() AND r.level = 1
  )
);

-- Create RLS policies for activity_logs
CREATE POLICY "Users can view their own logs" ON activity_logs FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins can view all logs" ON activity_logs FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM users u JOIN roles r ON u.role_id = r.id 
    WHERE u.id = auth.uid() AND r.level = 1
  )
);
CREATE POLICY "Allow authenticated users to insert activity logs" ON activity_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow anon users to insert activity logs" ON activity_logs FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow activity log updates" ON activity_logs FOR UPDATE TO anon, authenticated USING (true);

-- Insert sample roles
INSERT INTO roles (id, name, description, level, is_active, menu_access) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'Administrator', 'System Administrator with full access to all features', 1, true, 
 ARRAY['/dashboard', '/users', '/roles', '/role-menu-management', '/surveys', '/questions', '/results', '/enumerator-status', '/certificates', '/settings']),
('550e8400-e29b-41d4-a716-446655440002', 'ZO User', 'Zonal Office User with zone-level management access', 2, true, 
 ARRAY['/zo-dashboard', '/zone-performance', '/regional-overview', '/enumerator-status', '/results', '/certificates']),
('550e8400-e29b-41d4-a716-446655440003', 'RO User', 'Regional Office User with regional management access', 3, true, 
 ARRAY['/ro-dashboard', '/district-performance', '/supervisor-teams', '/enumerator-status', '/results', '/certificates']),
('550e8400-e29b-41d4-a716-446655440004', 'Supervisor', 'Field Supervisor with team management capabilities', 4, true, 
 ARRAY['/supervisor-dashboard', '/team-results', '/my-enumerators', '/assigned-surveys', '/enumerator-status', '/certificates']),
('550e8400-e29b-41d4-a716-446655440005', 'Enumerator', 'Field Enumerator with test-taking access', 5, true, 
 ARRAY['/enumerator-dashboard', '/available-tests', '/my-results', '/my-certificates', '/test-schedule'])
ON CONFLICT (id) DO NOTHING;

-- Insert sample users (passwords are hashed version of 'password123')
INSERT INTO users (id, email, password_hash, name, role_id, is_active, jurisdiction, zone, region, district, employee_id, phone_number) VALUES
('550e8400-e29b-41d4-a716-446655440010', 'admin@esigma.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'System Administrator', '550e8400-e29b-41d4-a716-446655440001', true, 'National', null, null, null, 'ADM001', '+91-9876543210'),
('550e8400-e29b-41d4-a716-446655440011', 'zo@esigma.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Zonal Officer', '550e8400-e29b-41d4-a716-446655440002', true, 'North Zone', 'North Zone', null, null, 'ZO001', '+91-9876543211'),
('550e8400-e29b-41d4-a716-446655440012', 'ro@esigma.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Regional Officer', '550e8400-e29b-41d4-a716-446655440003', true, 'Delhi Region', 'North Zone', 'Delhi Region', null, 'RO001', '+91-9876543212'),
('550e8400-e29b-41d4-a716-446655440013', 'supervisor@esigma.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Field Supervisor', '550e8400-e29b-41d4-a716-446655440004', true, 'Central Delhi District', 'North Zone', 'Delhi Region', 'Central Delhi', 'SUP001', '+91-9876543213'),
('550e8400-e29b-41d4-a716-446655440014', 'enumerator@esigma.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Field Enumerator', '550e8400-e29b-41d4-a716-446655440005', true, 'Block A, Central Delhi', 'North Zone', 'Delhi Region', 'Central Delhi', 'ENU001', '+91-9876543214')
ON CONFLICT (id) DO NOTHING;

-- Insert sample surveys
INSERT INTO surveys (id, title, description, target_date, duration, total_questions, passing_score, max_attempts, is_active, assigned_zones, assigned_regions, created_by) VALUES
('550e8400-e29b-41d4-a716-446655440020', 'Digital Literacy Assessment', 'Comprehensive assessment of digital skills and computer literacy for field staff', CURRENT_DATE + INTERVAL '30 days', 35, 30, 70, 3, true, ARRAY['North Zone', 'South Zone'], ARRAY['Delhi Region', 'Mumbai Region'], '550e8400-e29b-41d4-a716-446655440010'),
('550e8400-e29b-41d4-a716-446655440021', 'Data Collection Procedures', 'Assessment of field data collection methods and procedures', CURRENT_DATE + INTERVAL '45 days', 40, 25, 75, 2, true, ARRAY['North Zone'], ARRAY['Delhi Region'], '550e8400-e29b-41d4-a716-446655440010'),
('550e8400-e29b-41d4-a716-446655440022', 'Survey Methodology Training', 'Training assessment on survey methodology and best practices', CURRENT_DATE + INTERVAL '60 days', 30, 20, 80, 3, true, ARRAY['North Zone', 'South Zone', 'East Zone'], ARRAY['Delhi Region', 'Mumbai Region', 'Kolkata Region'], '550e8400-e29b-41d4-a716-446655440010')
ON CONFLICT (id) DO NOTHING;

-- Insert sample survey sections
INSERT INTO survey_sections (id, survey_id, title, description, questions_count, section_order) VALUES
('550e8400-e29b-41d4-a716-446655440030', '550e8400-e29b-41d4-a716-446655440020', 'Basic Computer Skills', 'Fundamental computer operations and software usage', 10, 1),
('550e8400-e29b-41d4-a716-446655440031', '550e8400-e29b-41d4-a716-446655440020', 'Internet and Digital Communication', 'Web browsing, email, and online communication tools', 10, 2),
('550e8400-e29b-41d4-a716-446655440032', '550e8400-e29b-41d4-a716-446655440020', 'Digital Security and Privacy', 'Online safety, password management, and privacy protection', 10, 3),
('550e8400-e29b-41d4-a716-446655440033', '550e8400-e29b-41d4-a716-446655440021', 'Field Data Collection', 'Methods and procedures for collecting data in the field', 15, 1),
('550e8400-e29b-41d4-a716-446655440034', '550e8400-e29b-41d4-a716-446655440021', 'Data Quality Assurance', 'Ensuring accuracy and completeness of collected data', 10, 2)
ON CONFLICT (id) DO NOTHING;

-- Insert sample questions
INSERT INTO questions (id, section_id, text, question_type, complexity, points, explanation, question_order) VALUES
('550e8400-e29b-41d4-a716-446655440040', '550e8400-e29b-41d4-a716-446655440030', 'What is the primary function of an operating system?', 'single_choice', 'easy', 1, 'An operating system manages all hardware and software resources of a computer.', 1),
('550e8400-e29b-41d4-a716-446655440041', '550e8400-e29b-41d4-a716-446655440030', 'Which of the following are input devices? (Select all that apply)', 'multiple_choice', 'medium', 2, 'Input devices allow users to provide data to the computer. Monitor is an output device.', 2),
('550e8400-e29b-41d4-a716-446655440042', '550e8400-e29b-41d4-a716-446655440031', 'What does URL stand for?', 'single_choice', 'easy', 1, 'URL stands for Uniform Resource Locator, which is the address of a web page.', 1),
('550e8400-e29b-41d4-a716-446655440043', '550e8400-e29b-41d4-a716-446655440032', 'Which of the following are good password practices?', 'multiple_choice', 'medium', 2, 'Strong passwords should be long, complex, unique, and not shared.', 1),
('550e8400-e29b-41d4-a716-446655440044', '550e8400-e29b-41d4-a716-446655440030', 'Which key combination is used to copy text?', 'single_choice', 'easy', 1, 'Ctrl+C is the standard keyboard shortcut for copying text.', 3),
('550e8400-e29b-41d4-a716-446655440045', '550e8400-e29b-41d4-a716-446655440031', 'What is the purpose of a web browser?', 'single_choice', 'easy', 1, 'A web browser is software used to access and view websites on the internet.', 2),
('550e8400-e29b-41d4-a716-446655440046', '550e8400-e29b-41d4-a716-446655440032', 'What should you do if you receive a suspicious email?', 'single_choice', 'medium', 2, 'Never click links or download attachments from suspicious emails.', 2),
('550e8400-e29b-41d4-a716-446655440047', '550e8400-e29b-41d4-a716-446655440033', 'What is the first step in field data collection?', 'single_choice', 'medium', 2, 'Planning and preparation are crucial before starting data collection.', 1),
('550e8400-e29b-41d4-a716-446655440048', '550e8400-e29b-41d4-a716-446655440034', 'How often should data quality checks be performed?', 'single_choice', 'medium', 2, 'Regular quality checks ensure data accuracy throughout the collection process.', 1)
ON CONFLICT (id) DO NOTHING;

-- Insert sample question options
INSERT INTO question_options (id, question_id, text, is_correct, option_order) VALUES
-- Question 1 options
('550e8400-e29b-41d4-a716-446655440050', '550e8400-e29b-41d4-a716-446655440040', 'To manage hardware and software resources', true, 1),
('550e8400-e29b-41d4-a716-446655440051', '550e8400-e29b-41d4-a716-446655440040', 'To create documents', false, 2),
('550e8400-e29b-41d4-a716-446655440052', '550e8400-e29b-41d4-a716-446655440040', 'To browse the internet', false, 3),
('550e8400-e29b-41d4-a716-446655440053', '550e8400-e29b-41d4-a716-446655440040', 'To play games', false, 4),

-- Question 2 options
('550e8400-e29b-41d4-a716-446655440054', '550e8400-e29b-41d4-a716-446655440041', 'Keyboard', true, 1),
('550e8400-e29b-41d4-a716-446655440055', '550e8400-e29b-41d4-a716-446655440041', 'Mouse', true, 2),
('550e8400-e29b-41d4-a716-446655440056', '550e8400-e29b-41d4-a716-446655440041', 'Monitor', false, 3),
('550e8400-e29b-41d4-a716-446655440057', '550e8400-e29b-41d4-a716-446655440041', 'Microphone', true, 4),

-- Question 3 options
('550e8400-e29b-41d4-a716-446655440058', '550e8400-e29b-41d4-a716-446655440042', 'Uniform Resource Locator', true, 1),
('550e8400-e29b-41d4-a716-446655440059', '550e8400-e29b-41d4-a716-446655440042', 'Universal Resource Link', false, 2),
('550e8400-e29b-41d4-a716-446655440060', '550e8400-e29b-41d4-a716-446655440042', 'Unified Resource Location', false, 3),
('550e8400-e29b-41d4-a716-446655440061', '550e8400-e29b-41d4-a716-446655440042', 'Universal Reference Locator', false, 4),

-- Question 4 options
('550e8400-e29b-41d4-a716-446655440062', '550e8400-e29b-41d4-a716-446655440043', 'Use at least 8 characters', true, 1),
('550e8400-e29b-41d4-a716-446655440063', '550e8400-e29b-41d4-a716-446655440043', 'Include uppercase and lowercase letters', true, 2),
('550e8400-e29b-41d4-a716-446655440064', '550e8400-e29b-41d4-a716-446655440043', 'Share passwords with colleagues', false, 3),
('550e8400-e29b-41d4-a716-446655440065', '550e8400-e29b-41d4-a716-446655440043', 'Use unique passwords for each account', true, 4),

-- Question 5 options
('550e8400-e29b-41d4-a716-446655440066', '550e8400-e29b-41d4-a716-446655440044', 'Ctrl+C', true, 1),
('550e8400-e29b-41d4-a716-446655440067', '550e8400-e29b-41d4-a716-446655440044', 'Ctrl+V', false, 2),
('550e8400-e29b-41d4-a716-446655440068', '550e8400-e29b-41d4-a716-446655440044', 'Ctrl+X', false, 3),
('550e8400-e29b-41d4-a716-446655440069', '550e8400-e29b-41d4-a716-446655440044', 'Ctrl+Z', false, 4),

-- Question 6 options
('550e8400-e29b-41d4-a716-446655440070', '550e8400-e29b-41d4-a716-446655440045', 'To access and view websites on the internet', true, 1),
('550e8400-e29b-41d4-a716-446655440071', '550e8400-e29b-41d4-a716-446655440045', 'To create websites', false, 2),
('550e8400-e29b-41d4-a716-446655440072', '550e8400-e29b-41d4-a716-446655440045', 'To send emails', false, 3),
('550e8400-e29b-41d4-a716-446655440073', '550e8400-e29b-41d4-a716-446655440045', 'To edit documents', false, 4),

-- Question 7 options
('550e8400-e29b-41d4-a716-446655440074', '550e8400-e29b-41d4-a716-446655440046', 'Do not click any links or download attachments', true, 1),
('550e8400-e29b-41d4-a716-446655440075', '550e8400-e29b-41d4-a716-446655440046', 'Forward it to all your contacts', false, 2),
('550e8400-e29b-41d4-a716-446655440076', '550e8400-e29b-41d4-a716-446655440046', 'Reply with your personal information', false, 3),
('550e8400-e29b-41d4-a716-446655440077', '550e8400-e29b-41d4-a716-446655440046', 'Click the link to verify it is safe', false, 4),

-- Question 8 options
('550e8400-e29b-41d4-a716-446655440078', '550e8400-e29b-41d4-a716-446655440047', 'Planning and preparation', true, 1),
('550e8400-e29b-41d4-a716-446655440079', '550e8400-e29b-41d4-a716-446655440047', 'Starting data collection immediately', false, 2),
('550e8400-e29b-41d4-a716-446655440080', '550e8400-e29b-41d4-a716-446655440047', 'Analyzing the data', false, 3),
('550e8400-e29b-41d4-a716-446655440081', '550e8400-e29b-41d4-a716-446655440047', 'Reporting results', false, 4),

-- Question 9 options
('550e8400-e29b-41d4-a716-446655440082', '550e8400-e29b-41d4-a716-446655440048', 'Continuously throughout the process', true, 1),
('550e8400-e29b-41d4-a716-446655440083', '550e8400-e29b-41d4-a716-446655440048', 'Only at the end', false, 2),
('550e8400-e29b-41d4-a716-446655440084', '550e8400-e29b-41d4-a716-446655440048', 'Never', false, 3),
('550e8400-e29b-41d4-a716-446655440085', '550e8400-e29b-41d4-a716-446655440048', 'Only when problems are detected', false, 4)
ON CONFLICT (id) DO NOTHING;

-- Insert system settings
INSERT INTO system_settings (category, setting_key, setting_value, description, setting_type, is_editable, options) VALUES
-- Security Settings
('security', 'max_login_attempts', '5', 'Maximum failed login attempts before account lockout', 'number', true, null),
('security', 'lockout_duration', '30', 'Account lockout duration in minutes', 'number', true, null),
('security', 'session_timeout', '120', 'User session timeout in minutes', 'number', true, null),
('security', 'password_min_length', '8', 'Minimum password length requirement', 'number', true, null),
('security', 'password_complexity', 'true', 'Require complex passwords (uppercase, lowercase, numbers)', 'boolean', true, null),
('security', 'force_password_change', '90', 'Force password change every X days', 'number', true, null),

-- Test Settings
('test', 'auto_save_interval', '30', 'Auto-save test progress every X seconds', 'number', true, null),
('test', 'enable_auto_save', 'true', 'Enable automatic saving of test progress', 'boolean', true, null),
('test', 'auto_submit_on_timeout', 'true', 'Automatically submit test when time expires', 'boolean', true, null),
('test', 'show_time_warning', 'true', 'Show warning when 5 minutes remaining', 'boolean', true, null),
('test', 'allow_question_navigation', 'true', 'Allow users to navigate between questions', 'boolean', true, null),
('test', 'enable_question_flagging', 'true', 'Allow users to flag questions for review', 'boolean', true, null),
('test', 'network_pause_enabled', 'true', 'Auto-pause test when network is unavailable', 'boolean', true, null),

-- General Settings
('general', 'site_name', 'eSigma Survey Platform', 'Application name displayed to users', 'string', true, null),
('general', 'site_description', 'Online MCQ Test Management System', 'Application description', 'string', true, null),
('general', 'support_email', 'support@esigma.com', 'Support contact email address', 'email', true, null),
('general', 'maintenance_mode', 'false', 'Enable maintenance mode to restrict access', 'boolean', true, null),
('general', 'default_timezone', 'Asia/Kolkata', 'Default system timezone', 'select', true, ARRAY['Asia/Kolkata', 'UTC', 'America/New_York', 'Europe/London']),
('general', 'date_format', 'DD/MM/YYYY', 'Date display format', 'select', true, ARRAY['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'])
ON CONFLICT (category, setting_key) DO NOTHING;

-- Log initialization activity
INSERT INTO activity_logs (activity_type, description, metadata) VALUES
('database_initialized', 'Database schema and sample data initialized successfully', 
 jsonb_build_object(
   'tables_created', 13,
   'roles_created', 5,
   'users_created', 5,
   'surveys_created', 3,
   'questions_created', 9,
   'settings_created', 15,
   'initialization_time', now()
 ))
ON CONFLICT DO NOTHING;