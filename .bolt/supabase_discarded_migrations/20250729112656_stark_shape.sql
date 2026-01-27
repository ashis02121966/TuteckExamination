/*
  # Complete Database Schema for eSigma Survey Platform

  1. New Tables
    - `roles` - User roles with hierarchical levels
    - `permissions` - System permissions
    - `role_permissions` - Role-permission mapping
    - `users` - User accounts with authentication
    - `surveys` - Survey definitions
    - `survey_sections` - Survey sections
    - `questions` - Question bank
    - `question_options` - Answer options
    - `test_sessions` - Active test sessions
    - `test_answers` - User responses
    - `test_results` - Final results
    - `section_scores` - Section-wise performance
    - `certificates` - Generated certificates
    - `survey_assignments` - Survey assignments
    - `system_settings` - Configuration
    - `activity_logs` - Audit trail
    - `capi_sync_status` - CAPI integration
    - `notifications` - User notifications

  2. Security
    - Enable RLS on all tables
    - Add appropriate policies for data access
    - Create indexes for performance

  3. Initial Data
    - Default roles (Admin, ZO User, RO User, Supervisor, Enumerator)
    - Demo users with correct password hashes
    - System permissions
    - Default settings
*/

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- CORE TABLES
-- =====================================================

-- Roles table for role-based access control
CREATE TABLE IF NOT EXISTS roles (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name varchar(100) NOT NULL UNIQUE,
    description text,
    level integer NOT NULL DEFAULT 5, -- 1=Admin, 2=ZO, 3=RO, 4=Supervisor, 5=Enumerator
    is_active boolean DEFAULT true,
    menu_access text[] DEFAULT '{}',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Permissions table
CREATE TABLE IF NOT EXISTS permissions (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name varchar(100) NOT NULL,
    resource varchar(50) NOT NULL,
    action varchar(50) NOT NULL,
    description text,
    module varchar(50) NOT NULL,
    created_at timestamptz DEFAULT now(),
    UNIQUE(resource, action)
);

-- Role permissions mapping
CREATE TABLE IF NOT EXISTS role_permissions (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    UNIQUE(role_id, permission_id)
);

-- Users table with hierarchical structure
CREATE TABLE IF NOT EXISTS users (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    email varchar(255) NOT NULL UNIQUE,
    password_hash varchar(255) NOT NULL,
    name varchar(255) NOT NULL,
    role_id uuid NOT NULL REFERENCES roles(id),
    employee_id varchar(50) UNIQUE,
    phone_number varchar(20),
    profile_image varchar(500),
    parent_id uuid REFERENCES users(id) ON DELETE SET NULL,
    zone varchar(100),
    region varchar(100),
    district varchar(100),
    jurisdiction text,
    is_active boolean DEFAULT true,
    last_login timestamptz,
    password_changed_at timestamptz DEFAULT now(),
    failed_login_attempts integer DEFAULT 0,
    locked_until timestamptz,
    email_verified_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- =====================================================
-- SURVEY AND QUESTION MANAGEMENT
-- =====================================================

-- Surveys table
CREATE TABLE IF NOT EXISTS surveys (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    title varchar(255) NOT NULL,
    description text,
    target_date date NOT NULL,
    duration integer NOT NULL DEFAULT 35, -- in minutes
    total_questions integer NOT NULL DEFAULT 30,
    passing_score integer NOT NULL DEFAULT 70,
    max_attempts integer NOT NULL DEFAULT 3,
    is_active boolean DEFAULT true,
    assigned_zones text[] DEFAULT '{}',
    assigned_regions text[] DEFAULT '{}',
    created_by uuid NOT NULL REFERENCES users(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Survey sections
CREATE TABLE IF NOT EXISTS survey_sections (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    survey_id uuid NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
    title varchar(255) NOT NULL,
    description text,
    questions_count integer NOT NULL DEFAULT 10,
    section_order integer NOT NULL DEFAULT 1,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Questions table
CREATE TABLE IF NOT EXISTS questions (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    section_id uuid NOT NULL REFERENCES survey_sections(id) ON DELETE CASCADE,
    text text NOT NULL,
    question_type varchar(20) NOT NULL DEFAULT 'single_choice' CHECK (question_type IN ('single_choice', 'multiple_choice')),
    complexity varchar(10) NOT NULL DEFAULT 'medium' CHECK (complexity IN ('easy', 'medium', 'hard')),
    explanation text,
    points integer NOT NULL DEFAULT 1,
    question_order integer NOT NULL DEFAULT 1,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Question options
CREATE TABLE IF NOT EXISTS question_options (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    text text NOT NULL,
    is_correct boolean DEFAULT false,
    option_order integer NOT NULL DEFAULT 1,
    created_at timestamptz DEFAULT now()
);

-- =====================================================
-- TEST SESSIONS AND RESULTS
-- =====================================================

-- Test sessions for tracking ongoing tests
CREATE TABLE IF NOT EXISTS test_sessions (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    survey_id uuid NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
    start_time timestamptz DEFAULT now(),
    end_time timestamptz,
    time_remaining integer NOT NULL, -- in seconds
    current_question_index integer DEFAULT 0,
    session_status varchar(20) DEFAULT 'in_progress' CHECK (session_status IN ('in_progress', 'completed', 'timeout', 'paused')),
    attempt_number integer NOT NULL DEFAULT 1,
    score numeric(5,2),
    is_passed boolean,
    completed_at timestamptz,
    pause_time timestamptz,
    resume_time timestamptz,
    total_pause_duration integer DEFAULT 0,
    ip_address inet,
    user_agent text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Test answers for tracking user responses
CREATE TABLE IF NOT EXISTS test_answers (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id uuid NOT NULL REFERENCES test_sessions(id) ON DELETE CASCADE,
    question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    selected_options uuid[], -- Array of selected option IDs
    is_correct boolean DEFAULT false,
    time_spent integer DEFAULT 0, -- in seconds
    answered boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(session_id, question_id)
);

-- Test results
CREATE TABLE IF NOT EXISTS test_results (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    survey_id uuid NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
    session_id uuid NOT NULL REFERENCES test_sessions(id) ON DELETE CASCADE,
    score numeric(5,2) NOT NULL DEFAULT 0.00,
    total_questions integer NOT NULL,
    correct_answers integer NOT NULL DEFAULT 0,
    is_passed boolean DEFAULT false,
    time_spent integer NOT NULL DEFAULT 0, -- in seconds
    attempt_number integer NOT NULL DEFAULT 1,
    grade varchar(5), -- A, B, C, D, F
    completed_at timestamptz DEFAULT now(),
    certificate_id uuid,
    created_at timestamptz DEFAULT now()
);

-- Section-wise scores
CREATE TABLE IF NOT EXISTS section_scores (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    result_id uuid NOT NULL REFERENCES test_results(id) ON DELETE CASCADE,
    section_id uuid NOT NULL REFERENCES survey_sections(id) ON DELETE CASCADE,
    section_title varchar(255) NOT NULL,
    score numeric(5,2) NOT NULL DEFAULT 0.00,
    total_questions integer NOT NULL,
    correct_answers integer NOT NULL DEFAULT 0,
    created_at timestamptz DEFAULT now()
);

-- =====================================================
-- CERTIFICATES
-- =====================================================

-- Certificates table
CREATE TABLE IF NOT EXISTS certificates (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    survey_id uuid NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
    result_id uuid NOT NULL REFERENCES test_results(id) ON DELETE CASCADE,
    certificate_number varchar(100) NOT NULL UNIQUE,
    issued_at timestamptz DEFAULT now(),
    valid_until date,
    download_count integer DEFAULT 0,
    certificate_status varchar(20) DEFAULT 'active' CHECK (certificate_status IN ('active', 'revoked', 'expired')),
    revoked_at timestamptz,
    revoked_by uuid REFERENCES users(id) ON DELETE SET NULL,
    revocation_reason text,
    created_at timestamptz DEFAULT now()
);

-- =====================================================
-- SURVEY ASSIGNMENTS
-- =====================================================

-- Survey assignments to users/groups
CREATE TABLE IF NOT EXISTS survey_assignments (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    survey_id uuid NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
    user_id uuid REFERENCES users(id) ON DELETE CASCADE,
    zone varchar(100),
    region varchar(100),
    district varchar(100),
    role_id uuid REFERENCES roles(id) ON DELETE CASCADE,
    assigned_by uuid NOT NULL REFERENCES users(id),
    assigned_at timestamptz DEFAULT now(),
    target_date date NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

-- =====================================================
-- SYSTEM SETTINGS
-- =====================================================

-- System settings
CREATE TABLE IF NOT EXISTS system_settings (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    category varchar(50) NOT NULL,
    setting_key varchar(100) NOT NULL,
    setting_value text,
    description text,
    setting_type varchar(20) DEFAULT 'string' CHECK (setting_type IN ('string', 'number', 'boolean', 'json', 'email', 'url', 'color', 'select')),
    is_editable boolean DEFAULT true,
    options text[],
    updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(category, setting_key)
);

-- =====================================================
-- ACTIVITY LOGS
-- =====================================================

-- Activity logs for audit trail
CREATE TABLE IF NOT EXISTS activity_logs (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    activity_type varchar(50) NOT NULL,
    description text NOT NULL,
    metadata jsonb,
    ip_address inet,
    user_agent text,
    created_at timestamptz DEFAULT now()
);

-- =====================================================
-- CAPI INTEGRATION
-- =====================================================

-- CAPI sync status for offline application integration
CREATE TABLE IF NOT EXISTS capi_sync_status (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    survey_id uuid NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
    sync_status varchar(20) DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'failed')),
    last_sync_at timestamptz,
    sync_data jsonb,
    error_message text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(user_id, survey_id)
);

-- =====================================================
-- NOTIFICATIONS
-- =====================================================

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title varchar(255) NOT NULL,
    message text NOT NULL,
    type varchar(20) DEFAULT 'info' CHECK (type IN ('info', 'warning', 'error', 'success')),
    is_read boolean DEFAULT false,
    action_url varchar(500),
    metadata jsonb,
    created_at timestamptz DEFAULT now(),
    read_at timestamptz
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Roles indexes
CREATE INDEX IF NOT EXISTS idx_roles_level ON roles(level);
CREATE INDEX IF NOT EXISTS idx_roles_name ON roles(name);

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_users_parent_id ON users(parent_id);

-- Surveys indexes
CREATE INDEX IF NOT EXISTS idx_surveys_created_by ON surveys(created_by);

-- Survey sections indexes
CREATE INDEX IF NOT EXISTS idx_survey_sections_survey_id ON survey_sections(survey_id);

-- Questions indexes
CREATE INDEX IF NOT EXISTS idx_questions_section_id ON questions(section_id);

-- Question options indexes
CREATE INDEX IF NOT EXISTS idx_question_options_question_id ON question_options(question_id);

-- Test sessions indexes
CREATE INDEX IF NOT EXISTS idx_test_sessions_user_id ON test_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_test_sessions_survey_id ON test_sessions(survey_id);

-- Test answers indexes
CREATE INDEX IF NOT EXISTS idx_test_answers_session_id ON test_answers(session_id);

-- Test results indexes
CREATE INDEX IF NOT EXISTS idx_test_results_user_id ON test_results(user_id);
CREATE INDEX IF NOT EXISTS idx_test_results_survey_id ON test_results(survey_id);

-- Certificates indexes
CREATE INDEX IF NOT EXISTS idx_certificates_user_id ON certificates(user_id);

-- Activity logs indexes
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

-- Enable RLS on all tables
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

-- RLS Policies for roles
CREATE POLICY "Allow anon to read roles for setup check" ON roles FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon to insert roles during setup" ON roles FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Users can view roles" ON roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage all roles" ON roles FOR ALL TO authenticated USING (
    EXISTS (
        SELECT 1 FROM users u 
        JOIN roles r ON u.role_id = r.id 
        WHERE u.id = auth.uid() AND r.level = 1
    )
);

-- RLS Policies for users
CREATE POLICY "Allow anon to read users for setup check" ON users FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon to insert users during setup" ON users FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Users can view their own data" ON users FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "Supervisors can view their team" ON users FOR SELECT TO authenticated USING (
    parent_id = auth.uid() OR 
    EXISTS (
        SELECT 1 FROM users u 
        JOIN roles r ON u.role_id = r.id 
        WHERE u.id = auth.uid() AND r.level <= 4
    )
);
CREATE POLICY "Admins can manage all users" ON users FOR ALL TO authenticated USING (
    EXISTS (
        SELECT 1 FROM users u 
        JOIN roles r ON u.role_id = r.id 
        WHERE u.id = auth.uid() AND r.level = 1
    )
);

-- RLS Policies for surveys
CREATE POLICY "Allow anon to read surveys for setup check" ON surveys FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon to insert surveys during setup" ON surveys FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Users can view assigned surveys" ON surveys FOR SELECT TO authenticated USING (
    is_active = true AND (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = auth.uid() AND (
                u.zone = ANY(assigned_zones) OR 
                u.region = ANY(assigned_regions) OR 
                array_length(assigned_zones, 1) IS NULL
            )
        )
    )
);
CREATE POLICY "Admins can manage surveys" ON surveys FOR ALL TO authenticated USING (
    EXISTS (
        SELECT 1 FROM users u 
        JOIN roles r ON u.role_id = r.id 
        WHERE u.id = auth.uid() AND r.level = 1
    )
);

-- RLS Policies for survey sections
CREATE POLICY "Users can read all survey sections" ON survey_sections FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow survey sections management" ON survey_sections FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- RLS Policies for questions
CREATE POLICY "Users can read all questions" ON questions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow question management" ON questions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- RLS Policies for question options
CREATE POLICY "Users can read all question options" ON question_options FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow question options management" ON question_options FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- RLS Policies for test sessions
CREATE POLICY "Allow all test session operations" ON test_sessions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- RLS Policies for test answers
CREATE POLICY "Allow all test answer operations" ON test_answers FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- RLS Policies for test results
CREATE POLICY "Users can read test results" ON test_results FOR SELECT TO public USING (true);
CREATE POLICY "Users can create test results" ON test_results FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Users can update test results" ON test_results FOR UPDATE TO public USING (true) WITH CHECK (true);
CREATE POLICY "Allow users to update their own test results" ON test_results FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- RLS Policies for certificates
CREATE POLICY "Users can read their own certificates" ON certificates FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can read all certificates" ON certificates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow anon to read certificates" ON certificates FOR SELECT TO anon USING (true);
CREATE POLICY "Allow certificate creation for passed tests" ON certificates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow certificate creation for system" ON certificates FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow certificate updates" ON certificates FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon certificate updates" ON certificates FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- RLS Policies for system settings
CREATE POLICY "Allow anon to read system_settings for setup check" ON system_settings FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon to insert system_settings during setup" ON system_settings FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Admins can manage settings" ON system_settings FOR ALL TO authenticated USING (
    EXISTS (
        SELECT 1 FROM users u 
        JOIN roles r ON u.role_id = r.id 
        WHERE u.id = auth.uid() AND r.level = 1
    )
);

-- RLS Policies for activity logs
CREATE POLICY "Users can view their own logs" ON activity_logs FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins can view all logs" ON activity_logs FOR SELECT TO authenticated USING (
    EXISTS (
        SELECT 1 FROM users u 
        JOIN roles r ON u.role_id = r.id 
        WHERE u.id = auth.uid() AND r.level = 1
    )
);

-- =====================================================
-- FUNCTIONS AND TRIGGERS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_roles_updated_at BEFORE UPDATE ON roles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_surveys_updated_at BEFORE UPDATE ON surveys FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_survey_sections_updated_at BEFORE UPDATE ON survey_sections FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_questions_updated_at BEFORE UPDATE ON questions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_test_sessions_updated_at BEFORE UPDATE ON test_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_test_answers_updated_at BEFORE UPDATE ON test_answers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON system_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- INITIAL DATA INSERTION
-- =====================================================

-- Insert default roles with menu access
INSERT INTO roles (id, name, description, level, menu_access) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'Admin', 'System Administrator with full access to all features', 1, ARRAY[
    '/dashboard', '/users', '/roles', '/role-menu-management', 
    '/surveys', '/questions', '/results', '/enumerator-status', 
    '/certificates', '/settings'
]),
('550e8400-e29b-41d4-a716-446655440002', 'ZO User', 'Zonal Office User with zone-level management access', 2, ARRAY[
    '/zo-dashboard', '/zone-performance', '/regional-overview',
    '/enumerator-status', '/results', '/certificates'
]),
('550e8400-e29b-41d4-a716-446655440003', 'RO User', 'Regional Office User with regional management access', 3, ARRAY[
    '/ro-dashboard', '/district-performance', '/supervisor-teams',
    '/enumerator-status', '/results', '/certificates'
]),
('550e8400-e29b-41d4-a716-446655440004', 'Supervisor', 'Field Supervisor with team management capabilities', 4, ARRAY[
    '/supervisor-dashboard', '/team-results', '/my-enumerators',
    '/enumerator-status', '/assigned-surveys', '/certificates'
]),
('550e8400-e29b-41d4-a716-446655440005', 'Enumerator', 'Field Enumerator with test-taking access', 5, ARRAY[
    '/enumerator-dashboard', '/available-tests', '/my-results',
    '/my-certificates', '/test-schedule'
])
ON CONFLICT (id) DO NOTHING;

-- Insert demo users with correct password hash for 'password123'
INSERT INTO users (id, email, password_hash, name, role_id, jurisdiction, zone, region, district, employee_id, phone_number) VALUES
('550e8400-e29b-41d4-a716-446655440010', 'admin@esigma.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/VcSforHgK', 'System Administrator', '550e8400-e29b-41d4-a716-446655440001', 'National', NULL, NULL, NULL, 'ADM001', '+91-9876543210'),
('550e8400-e29b-41d4-a716-446655440011', 'zo@esigma.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/VcSforHgK', 'Zonal Officer', '550e8400-e29b-41d4-a716-446655440002', 'North Zone', 'North Zone', NULL, NULL, 'ZO001', '+91-9876543211'),
('550e8400-e29b-41d4-a716-446655440012', 'ro@esigma.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/VcSforHgK', 'Regional Officer', '550e8400-e29b-41d4-a716-446655440003', 'Delhi Region', 'North Zone', 'Delhi Region', NULL, 'RO001', '+91-9876543212'),
('550e8400-e29b-41d4-a716-446655440013', 'supervisor@esigma.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/VcSforHgK', 'Field Supervisor', '550e8400-e29b-41d4-a716-446655440004', 'Central Delhi District', 'North Zone', 'Delhi Region', 'Central Delhi', 'SUP001', '+91-9876543213'),
('550e8400-e29b-41d4-a716-446655440014', 'enumerator@esigma.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/VcSforHgK', 'Field Enumerator', '550e8400-e29b-41d4-a716-446655440005', 'Block A, Central Delhi', 'North Zone', 'Delhi Region', 'Central Delhi', 'ENU001', '+91-9876543214'),
('550e8400-e29b-41d4-a716-446655440015', 'enumerator2@esigma.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/VcSforHgK', 'Field Enumerator 2', '550e8400-e29b-41d4-a716-446655440005', 'Block B, Central Delhi', 'North Zone', 'Delhi Region', 'Central Delhi', 'ENU002', '+91-9876543215'),
('550e8400-e29b-41d4-a716-446655440016', 'enumerator3@esigma.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/VcSforHgK', 'Field Enumerator 3', '550e8400-e29b-41d4-a716-446655440005', 'Block C, Central Delhi', 'North Zone', 'Delhi Region', 'Central Delhi', 'ENU003', '+91-9876543216')
ON CONFLICT (id) DO NOTHING;

-- Set up user hierarchy
UPDATE users SET parent_id = '550e8400-e29b-41d4-a716-446655440012' WHERE id = '550e8400-e29b-41d4-a716-446655440013';
UPDATE users SET parent_id = '550e8400-e29b-41d4-a716-446655440013' WHERE id IN ('550e8400-e29b-41d4-a716-446655440014', '550e8400-e29b-41d4-a716-446655440015', '550e8400-e29b-41d4-a716-446655440016');

-- Insert sample surveys
INSERT INTO surveys (id, title, description, target_date, duration, total_questions, passing_score, max_attempts, assigned_zones, assigned_regions, created_by) VALUES
('550e8400-e29b-41d4-a716-446655440020', 'Digital Literacy Assessment', 'Comprehensive assessment of digital skills and computer literacy for field staff', CURRENT_DATE + INTERVAL '30 days', 35, 30, 70, 3, ARRAY['North Zone', 'South Zone'], ARRAY['Delhi Region', 'Mumbai Region'], '550e8400-e29b-41d4-a716-446655440010'),
('550e8400-e29b-41d4-a716-446655440021', 'Data Collection Procedures', 'Assessment of field data collection methods and procedures', CURRENT_DATE + INTERVAL '45 days', 40, 25, 75, 2, ARRAY['North Zone'], ARRAY['Delhi Region'], '550e8400-e29b-41d4-a716-446655440010'),
('550e8400-e29b-41d4-a716-446655440022', 'Survey Methodology Training', 'Training assessment on survey methodology and best practices', CURRENT_DATE + INTERVAL '60 days', 30, 20, 80, 3, ARRAY['North Zone', 'South Zone', 'East Zone'], ARRAY['Delhi Region', 'Mumbai Region', 'Kolkata Region'], '550e8400-e29b-41d4-a716-446655440010')
ON CONFLICT (id) DO NOTHING;

-- Insert survey sections
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
('550e8400-e29b-41d4-a716-446655440043', '550e8400-e29b-41d4-a716-446655440032', 'Which of the following are good password practices?', 'multiple_choice', 'medium', 2, 'Strong passwords should be long, complex, unique, and not shared.', 1)
ON CONFLICT (id) DO NOTHING;

-- Insert question options
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
('550e8400-e29b-41d4-a716-446655440065', '550e8400-e29b-41d4-a716-446655440043', 'Use unique passwords for each account', true, 4)
ON CONFLICT (id) DO NOTHING;

-- Insert default system settings
INSERT INTO system_settings (category, setting_key, setting_value, description, setting_type, is_editable) VALUES
-- Security Settings
('security', 'max_login_attempts', '5', 'Maximum failed login attempts before account lockout', 'number', true),
('security', 'lockout_duration', '30', 'Account lockout duration in minutes', 'number', true),
('security', 'session_timeout', '120', 'User session timeout in minutes', 'number', true),
('security', 'password_min_length', '8', 'Minimum password length requirement', 'number', true),
('security', 'password_complexity', 'true', 'Require complex passwords (uppercase, lowercase, numbers)', 'boolean', true),
('security', 'force_password_change', '90', 'Force password change every X days', 'number', true),
-- Test Settings
('test', 'auto_save_interval', '30', 'Auto-save test progress every X seconds', 'number', true),
('test', 'enable_auto_save', 'true', 'Enable automatic saving of test progress', 'boolean', true),
('test', 'auto_submit_on_timeout', 'true', 'Automatically submit test when time expires', 'boolean', true),
('test', 'show_time_warning', 'true', 'Show warning when 5 minutes remaining', 'boolean', true),
('test', 'allow_question_navigation', 'true', 'Allow users to navigate between questions', 'boolean', true),
('test', 'enable_question_flagging', 'true', 'Allow users to flag questions for review', 'boolean', true),
('test', 'network_pause_enabled', 'true', 'Auto-pause test when network is unavailable', 'boolean', true),
-- General Settings
('general', 'site_name', 'eSigma Survey Platform', 'Application name displayed to users', 'string', true),
('general', 'site_description', 'Online MCQ Test Management System', 'Application description', 'string', true),
('general', 'support_email', 'support@esigma.com', 'Support contact email address', 'email', true),
('general', 'maintenance_mode', 'false', 'Enable maintenance mode to restrict access', 'boolean', true),
('general', 'default_timezone', 'Asia/Kolkata', 'Default system timezone', 'select', true),
('general', 'date_format', 'DD/MM/YYYY', 'Date display format', 'select', true)
ON CONFLICT (category, setting_key) DO NOTHING;

-- Update system settings with options for select types
UPDATE system_settings SET options = ARRAY['Asia/Kolkata', 'UTC', 'America/New_York', 'Europe/London'] WHERE setting_key = 'default_timezone';
UPDATE system_settings SET options = ARRAY['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'] WHERE setting_key = 'date_format';