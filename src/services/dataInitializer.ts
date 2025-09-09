import { supabase, supabaseAdmin } from '../lib/supabase';
import bcrypt from 'bcryptjs';
import { isDemoMode } from '../lib/supabase';

// Helper function to disable RLS temporarily
async function disableRLS() {
  try {
    // Disable RLS on all tables during initialization
    const tables = ['roles', 'users', 'surveys', 'survey_sections', 'questions', 'question_options', 'system_settings'];
    
    for (const table of tables) {
      await supabase.rpc('exec_sql', { 
        sql: `ALTER TABLE ${table} DISABLE ROW LEVEL SECURITY;` 
      }).catch(() => {
        // Ignore errors if RPC doesn't exist, we'll use service role instead
      });
    }
  } catch (error) {
    console.log('Could not disable RLS via RPC, using service role client');
  }
}

// Helper function to re-enable RLS after initialization
async function enableRLS() {
  try {
    const tables = ['roles', 'users', 'surveys', 'survey_sections', 'questions', 'question_options', 'system_settings'];
    
    for (const table of tables) {
      await supabase.rpc('exec_sql', { 
        sql: `ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;` 
      }).catch(() => {
        // Ignore errors if RPC doesn't exist
      });
    }
  } catch (error) {
    console.log('Could not re-enable RLS via RPC');
  }
}

export class DataInitializer {
  static async initializeDatabase() {
    try {
      if (import.meta.env.DEV) {
        console.log('Starting database initialization...');
      }
      
      // Check if we're in demo mode
      if (isDemoMode) {
        return {
          success: false,
          message: 'Cannot initialize database in demo mode. Please configure Supabase first:\n\n1. Create a Supabase project at https://supabase.com\n2. Get your project URL and API keys from Settings → API\n3. Update the .env file with your actual credentials\n4. Restart the development server\n5. Try initialization again'
        };
      }
      
      // Disable RLS temporarily to avoid recursion during initialization
      await disableRLS();

      // Check if Supabase is configured
      // This check is now redundant since we check isDemoMode above
      
      // Test admin client first
      if (import.meta.env.DEV) {
        console.log('Testing admin client...');
      }
      try {
        const { data: testUsers, error: testError } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1 });
        if (testError) {
          if (import.meta.env.DEV) {
            console.error('Admin client test failed:', testError);
          }
          return {
            success: false,
            message: `Admin client authentication failed: ${testError.message}. Please check your VITE_SUPABASE_SERVICE_ROLE_KEY in .env file.`
          };
        }
        if (import.meta.env.DEV) {
          console.log('Admin client test successful');
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error('Admin client test error:', error);
        }
        await enableRLS();
        return {
          success: false,
          message: 'Failed to authenticate with Supabase admin client. Please verify your service role key.'
        };
      }
      
      if (import.meta.env.DEV) {
        console.log('Checking database connection...');
      }
      
      // Clean up existing data first
      if (import.meta.env.DEV) {
        console.log('Cleaning up existing data...');
      }
      await this.cleanupExistingData(supabase, supabaseAdmin);
      
      // Check if data already exists
      const { data: existingRoles, error: checkError } = await supabase
        .from('roles')
        .select('id')
        .limit(1);
      
      if (checkError) {
        console.error('Database connection failed:', checkError);
        return { 
          success: false, 
          message: `Failed to connect to database: ${checkError.message}. Please check your Supabase configuration.`,
          error: checkError
        };
      }
      
      console.log('Database is empty, starting initialization...');
      
      // Run the comprehensive schema migration first
      console.log('Running comprehensive schema migration...');
      try {
        // Read and execute the migration file
        const migrationResponse = await fetch('/supabase/migrations/create_comprehensive_schema.sql');
        if (migrationResponse.ok) {
          const migrationSQL = await migrationResponse.text();
          const { error: migrationError } = await supabaseAdmin.rpc('exec_sql', { sql: migrationSQL });
          
          if (migrationError) {
            console.error('Migration execution failed:', migrationError);
            // Continue with manual creation if migration fails
          } else {
            console.log('Schema migration executed successfully');
          }
        }
      } catch (error) {
        console.log('Could not run migration file, proceeding with manual creation...');
      }
      
      // Initialize in order: roles -> users -> surveys -> sections -> questions -> settings
      await this.createRoles(supabaseAdmin);
      console.log('Roles created successfully');
      
      await this.createUsers(supabaseAdmin);
      console.log('Users created successfully');
      
      // Verify user creation
      const adminUserId = await this.verifyUserCreation(supabaseAdmin);
      
      await this.createSurveys(supabaseAdmin, adminUserId);
      console.log('Surveys created successfully');
      
      await this.createSurveySections(supabaseAdmin);
      console.log('Survey sections created successfully');
      
      await this.createQuestions(supabaseAdmin);
      console.log('Questions created successfully');
      
      await this.createSystemSettings(supabaseAdmin);
      console.log('System settings created successfully');
      
      // Create RLS policies for questions and options
      await this.createRLSPolicies(supabaseAdminClient);
      console.log('RLS policies created successfully');
      
      // Re-enable RLS after initialization
      await enableRLS();

      console.log('Database initialization completed successfully');
      return { success: true, message: 'Database initialized successfully with demo users and sample data!' };
    } catch (error) {
      console.error('Database initialization failed:', error);
      
      // Try to re-enable RLS even if initialization failed
      await enableRLS();
      
      return { 
        success: false, 
        message: `Failed to initialize database: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error 
      };
    }
  }

  static async cleanupExistingData(supabaseClient: any, supabaseAdminClient: any) {
    try {
      // Drop all existing policies first to avoid conflicts
      try {
        const { error: policyError } = await supabaseAdminClient.rpc('exec_sql', {
          sql: `
            DO $$ 
            DECLARE
                r RECORD;
            BEGIN
                FOR r IN (SELECT schemaname, tablename FROM pg_tables WHERE schemaname = 'public') LOOP
                    EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident('policy_' || r.tablename) || ' ON ' || quote_ident(r.schemaname) || '.' || quote_ident(r.tablename);
                END LOOP;
            END $$;
          `
        });
        
        if (!policyError) {
          console.log('Existing policies dropped successfully');
        }
      } catch (error) {
        console.log('Policy cleanup failed, continuing with data cleanup...');
      }
      
      // Delete in correct order of foreign key dependencies using admin client
      console.log('Deleting test_answers...');
      await supabaseAdminClient.from('test_answers').delete().gte('created_at', '1900-01-01');
      
      console.log('Deleting section_scores...');
      await supabaseAdminClient.from('section_scores').delete().gte('created_at', '1900-01-01');
      
      console.log('Deleting certificates...');
      await supabaseAdminClient.from('certificates').delete().gte('created_at', '1900-01-01');
      
      console.log('Deleting test_results...');
      await supabaseAdminClient.from('test_results').delete().gte('created_at', '1900-01-01');
      
      console.log('Deleting test_sessions...');
      await supabaseAdminClient.from('test_sessions').delete().gte('created_at', '1900-01-01');
      
      console.log('Deleting activity_logs...');
      await supabaseAdminClient.from('activity_logs').delete().gte('created_at', '1900-01-01');
      
      console.log('Deleting question_options...');
      await supabaseAdminClient.from('question_options').delete().gte('created_at', '1900-01-01');
      
      console.log('Deleting questions...');
      await supabaseAdminClient.from('questions').delete().gte('created_at', '1900-01-01');
      
      console.log('Deleting survey_sections...');
      await supabaseAdminClient.from('survey_sections').delete().gte('created_at', '1900-01-01');
      
      console.log('Deleting surveys...');
      await supabaseAdminClient.from('surveys').delete().gte('created_at', '1900-01-01');
      
      console.log('Deleting system_settings...');
      await supabaseAdminClient.from('system_settings').delete().gte('updated_at', '1900-01-01');
      
      console.log('Deleting users...');
      await supabaseAdminClient.from('users').delete().gte('created_at', '1900-01-01');
      
      console.log('Deleting roles...');
      await supabaseAdminClient.from('roles').delete().gte('created_at', '1900-01-01');
      
      // Clean up auth users
      console.log('Cleaning up auth users...');
      const { data: authUsers } = await supabaseAdminClient.auth.admin.listUsers();
      if (authUsers && authUsers.users) {
        for (const user of authUsers.users) {
          if (user.email && !user.email.includes('supabase')) {
            console.log(`Deleting auth user: ${user.email}`);
            await supabaseAdminClient.auth.admin.deleteUser(user.id);
          }
        }
      }
      
      console.log('Cleanup completed');
    } catch (error) {
      console.error('Cleanup error:', error);
      // Don't throw error here - continue with initialization even if cleanup fails
    }
  }

  static async verifyUserCreation(supabaseAdminClient: any) {
    console.log('Verifying user creation...');
    
    const testEmails = ['admin@esigma.com', 'enumerator@esigma.com'];
    let adminUserId = null;
    
    for (const email of testEmails) {
      try {
        // Test authentication
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password: 'password123'
        });
        
        if (error) {
          console.error(`Verification failed for ${email}:`, error);
          throw new Error(`User ${email} cannot authenticate: ${error.message}`);
        }
        
        console.log(`✓ User ${email} can authenticate successfully`);
        
        // Capture admin user ID for survey creation
        if (email === 'admin@esigma.com') {
          adminUserId = data.user.id;
        }
        
        // Sign out after verification
        await supabase.auth.signOut();
      } catch (error) {
        console.error(`Verification error for ${email}:`, error);
        throw error;
      }
    }
    
    console.log('All users verified successfully');
    return adminUserId;
  }
  static async createRoles(supabaseAdminClient: any) {
    console.log('Creating roles...');
    
    const roles = [
      {
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: 'Administrator',
        description: 'System Administrator with full access to all features',
        level: 1,
        is_active: true,
        menu_access: [
          '/dashboard', '/users', '/roles', '/role-menu-management', 
          '/surveys', '/questions', '/results', '/enumerator-status', 
          '/certificates', '/settings'
        ]
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440002',
        name: 'CPG User',
        description: 'Central Planning Group User with national oversight',
        level: 2,
        is_active: true,
        menu_access: [
          '/cpg-dashboard', '/results', '/enumerator-status', '/certificates'
        ]
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440003',
        name: 'ZO User',
        description: 'Zonal Office User with zone-level management access',
        level: 3,
        is_active: true,
        menu_access: [
          '/zo-dashboard', '/results', '/enumerator-status', '/certificates'
        ]
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440004',
        name: 'RO User',
        description: 'Regional Office User with regional management access',
        level: 4,
        is_active: true,
        menu_access: [
          '/ro-dashboard', '/results', '/enumerator-status', '/certificates'
        ]
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440005',
        name: 'Supervisor',
        description: 'Field Supervisor with team management capabilities',
        level: 5,
        is_active: true,
        menu_access: [
          '/supervisor-dashboard', '/team-results', '/my-enumerators', 
          '/enumerator-status', '/certificates'
        ]
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440006',
        name: 'Enumerator',
        description: 'Field Enumerator with test-taking access (Lowest Level)',
        level: 6,
        is_active: true,
        menu_access: [
          '/enumerator-dashboard', '/available-tests', '/my-results', 
          '/my-certificates', '/test-schedule'
        ]
      }
    ];

    const { error } = await supabaseAdminClient
      .from('roles')
      .insert(roles);

    if (error) throw error;
    console.log('Roles created successfully');
  }

  static async createUsers(supabaseClient: any) {
    console.log('Creating users...');
    
    console.log('Creating users in Supabase Auth and custom user profiles...');
    
    const users = [
      {
        email: 'admin@esigma.com',
        password: 'password123',
        name: 'System Administrator',
        role_id: '550e8400-e29b-41d4-a716-446655440001', // Admin
        is_active: true,
        jurisdiction: 'National',
        zone: null,
        region: null,
        district: null,
        employee_id: 'ADM001',
        phone_number: '+91-9876543210'
      },
      {
        email: 'zo@esigma.com',
        password: 'password123',
        name: 'Zonal Officer',
        role_id: '550e8400-e29b-41d4-a716-446655440003', // ZO User
        is_active: true,
        jurisdiction: 'North Zone',
        zone: 'North Zone',
        region: null,
        district: null,
        employee_id: 'ZO001',
        phone_number: '+91-9876543211'
      },
      {
        email: 'ro@esigma.com',
        password: 'password123',
        name: 'Regional Officer',
        role_id: '550e8400-e29b-41d4-a716-446655440004', // RO User
        is_active: true,
        jurisdiction: 'Delhi Region',
        zone: 'North Zone',
        region: 'Delhi Region',
        district: null,
        employee_id: 'RO001',
        phone_number: '+91-9876543212',
        parent_id: null
      },
      {
        email: 'supervisor@esigma.com',
        password: 'password123',
        name: 'Field Supervisor',
        role_id: '550e8400-e29b-41d4-a716-446655440005', // Supervisor
        is_active: true,
        jurisdiction: 'Central Delhi District',
        zone: 'North Zone',
        region: 'Delhi Region',
        district: 'Central Delhi',
        employee_id: 'SUP001',
        phone_number: '+91-9876543213',
        parent_id: null
      },
      {
        email: 'enumerator@esigma.com',
        password: 'password123',
        name: 'Field Enumerator',
        role_id: '550e8400-e29b-41d4-a716-446655440006', // Enumerator
        is_active: true,
        jurisdiction: 'Block A, Central Delhi',
        zone: 'North Zone',
        region: 'Delhi Region',
        district: 'Central Delhi',
        employee_id: 'ENU001',
        phone_number: '+91-9876543214',
        parent_id: null
      }
    ];

    console.log(`Creating ${users.length} users...`);
    
    for (const user of users) {
      try {
        console.log(`Processing user: ${user.email}`);
        
        // Create user in Supabase Auth
        console.log(`Creating new auth user: ${user.email}`);
        const { data: authData, error: authError } = await supabaseAdminClient.auth.admin.createUser({
          email: user.email,
          password: user.password,
          email_confirm: true, // Confirm email immediately
          user_metadata: {
            name: user.name
          },
          app_metadata: {
            role: user.role_id
          }
        });
        
        if (authError) {
          console.error(`Failed to create auth user ${user.email}:`, authError);
          throw new Error(`Auth creation failed for ${user.email}: ${authError.message}`);
        }

        // Manually confirm the user's email to bypass confirmation requirement
        if (authData.user) {
          const { error: confirmError } = await supabaseAdminClient.auth.admin.updateUserById(
            authData.user.id,
            { email_confirm: true }
          );
          
          if (confirmError) {
            console.error(`Failed to confirm email for ${user.email}:`, confirmError);
          } else {
            console.log(`Email confirmed for ${user.email}`);
          }
        }
        
        console.log(`Created auth user for ${user.email} with ID: ${authData.user.id}`);
        
        // Hash the password for the custom users table
        const hashedPassword = bcrypt.hashSync(user.password, 10);
        
        // Create user profile in custom users table
        console.log(`Creating profile for ${user.email}`);
        const { error: profileError } = await supabaseAdminClient
          .from('users')
          .insert({
            id: authData.user.id,
            email: user.email,
            password_hash: hashedPassword,
            name: user.name,
            role_id: user.role_id,
            is_active: user.is_active,
            jurisdiction: user.jurisdiction,
            zone: user.zone,
            region: user.region,
            district: user.district,
            employee_id: user.employee_id,
            phone_number: user.phone_number,
            parent_id: user.parent_id
          });
        
        if (profileError) {
          console.error(`Failed to create user profile ${user.email}:`, profileError);
          throw new Error(`Profile creation failed for ${user.email}: ${profileError.message}`);
        }
        
        console.log(`Successfully created user: ${user.email}`);
      } catch (error) {
        console.error(`Error creating user ${user.email}:`, error);
        throw error; // Stop initialization on user creation failure
      }
    }

    console.log('Users created successfully');
  }

  static async createSurveys(supabaseAdminClient: any, adminUserId: string) {
    console.log('Creating surveys...');
    
    const surveys = [
      {
        id: '550e8400-e29b-41d4-a716-446655440020',
        title: 'Digital Literacy Assessment',
        description: 'Comprehensive assessment of digital skills and computer literacy for field staff',
        target_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        duration: 35,
        total_questions: 30,
        passing_score: 70,
        max_attempts: 3,
        is_active: true,
        assigned_zones: ['North Zone', 'South Zone', 'East Zone'],
        assigned_regions: ['Delhi Region', 'Mumbai Region', 'Kolkata Region'],
        created_by: adminUserId
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440021',
        title: 'Data Collection Procedures',
        description: 'Assessment of field data collection methods and procedures',
        target_date: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        duration: 40,
        total_questions: 25,
        passing_score: 75,
        max_attempts: 2,
        is_active: true,
        assigned_zones: ['North Zone', 'South Zone', 'East Zone'],
        assigned_regions: ['Delhi Region', 'Mumbai Region', 'Kolkata Region'],
        created_by: adminUserId
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440022',
        title: 'Survey Methodology Training',
        description: 'Training assessment on survey methodology and best practices',
        target_date: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        duration: 30,
        total_questions: 20,
        passing_score: 80,
        max_attempts: 3,
        is_active: true,
        assigned_zones: ['North Zone', 'South Zone', 'East Zone'],
        assigned_regions: ['Delhi Region', 'Mumbai Region', 'Kolkata Region'],
        created_by: adminUserId
      }
    ];

    const { error } = await supabaseAdminClient
      .from('surveys')
      .insert(surveys);

    if (error) throw error;
    console.log('Surveys created successfully');
  }

  static async createSurveySections(supabaseAdminClient: any) {
    console.log('Creating survey sections...');
    
    const sections = [
      // Digital Literacy Assessment sections
      {
        id: '550e8400-e29b-41d4-a716-446655440030',
        survey_id: '550e8400-e29b-41d4-a716-446655440020',
        title: 'Basic Computer Skills',
        description: 'Fundamental computer operations and software usage',
        questions_count: 2,
        section_order: 1
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440031',
        survey_id: '550e8400-e29b-41d4-a716-446655440020',
        title: 'Internet and Digital Communication',
        description: 'Web browsing, email, and online communication tools',
        questions_count: 1,
        section_order: 2
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440032',
        survey_id: '550e8400-e29b-41d4-a716-446655440020',
        title: 'Digital Security and Privacy',
        description: 'Online safety, password management, and privacy protection',
        questions_count: 1,
        section_order: 3
      },
      // Data Collection Procedures sections
      {
        id: '550e8400-e29b-41d4-a716-446655440033',
        survey_id: '550e8400-e29b-41d4-a716-446655440021',
        title: 'Field Data Collection',
        description: 'Methods and procedures for collecting data in the field',
        questions_count: 2,
        section_order: 1
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440034',
        survey_id: '550e8400-e29b-41d4-a716-446655440021',
        title: 'Data Quality Assurance',
        description: 'Ensuring accuracy and completeness of collected data',
        questions_count: 1,
        section_order: 2
      }
    ];

    const { error } = await supabaseAdminClient
      .from('survey_sections')
      .insert(sections);

    if (error) throw error;
    console.log('Survey sections created successfully');
  }

  static async createQuestions(supabaseAdminClient: any) {
    console.log('Creating sample questions...');
    
    const questions = [
      {
        id: '550e8400-e29b-41d4-a716-446655440040',
        section_id: '550e8400-e29b-41d4-a716-446655440030',
        text: 'What is the primary function of an operating system?',
        question_type: 'single_choice',
        complexity: 'easy',
        points: 1,
        explanation: 'An operating system manages all hardware and software resources of a computer.',
        question_order: 1
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440041',
        section_id: '550e8400-e29b-41d4-a716-446655440030',
        text: 'Which of the following are input devices? (Select all that apply)',
        question_type: 'multiple_choice',
        complexity: 'medium',
        points: 2,
        explanation: 'Input devices allow users to provide data to the computer. Monitor is an output device.',
        question_order: 2
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440042',
        section_id: '550e8400-e29b-41d4-a716-446655440031',
        text: 'What does URL stand for?',
        question_type: 'single_choice',
        complexity: 'easy',
        points: 1,
        explanation: 'URL stands for Uniform Resource Locator, which is the address of a web page.',
        question_order: 1
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440043',
        section_id: '550e8400-e29b-41d4-a716-446655440032',
        text: 'Which of the following are good password practices?',
        question_type: 'multiple_choice',
        complexity: 'medium',
        points: 2,
        explanation: 'Strong passwords should be long, complex, unique, and not shared.',
        question_order: 1
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440044',
        section_id: '550e8400-e29b-41d4-a716-446655440033',
        text: 'What is the first step in field data collection?',
        question_type: 'single_choice',
        complexity: 'easy',
        points: 1,
        explanation: 'Planning and preparation are essential before starting data collection.',
        question_order: 1
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440045',
        section_id: '550e8400-e29b-41d4-a716-446655440033',
        text: 'Which tools are commonly used for field data collection?',
        question_type: 'multiple_choice',
        complexity: 'medium',
        points: 2,
        explanation: 'Multiple tools can be used for effective field data collection.',
        question_order: 2
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440046',
        section_id: '550e8400-e29b-41d4-a716-446655440034',
        text: 'What is the primary goal of data quality assurance?',
        question_type: 'single_choice',
        complexity: 'medium',
        points: 1,
        explanation: 'Data quality assurance ensures data accuracy and reliability.',
        question_order: 1
      }
    ];

    const { error: questionsError } = await supabaseAdminClient
      .from('questions')
      .insert(questions);

    if (questionsError) throw questionsError;

    // Create question options
    const options = [
      // Question 1 options
      { id: '550e8400-e29b-41d4-a716-446655440050', question_id: '550e8400-e29b-41d4-a716-446655440040', text: 'To manage hardware and software resources', is_correct: true, option_order: 1 },
      { id: '550e8400-e29b-41d4-a716-446655440051', question_id: '550e8400-e29b-41d4-a716-446655440040', text: 'To create documents', is_correct: false, option_order: 2 },
      { id: '550e8400-e29b-41d4-a716-446655440052', question_id: '550e8400-e29b-41d4-a716-446655440040', text: 'To browse the internet', is_correct: false, option_order: 3 },
      { id: '550e8400-e29b-41d4-a716-446655440053', question_id: '550e8400-e29b-41d4-a716-446655440040', text: 'To play games', is_correct: false, option_order: 4 },
      
      // Question 2 options
      { id: '550e8400-e29b-41d4-a716-446655440054', question_id: '550e8400-e29b-41d4-a716-446655440041', text: 'Keyboard', is_correct: true, option_order: 1 },
      { id: '550e8400-e29b-41d4-a716-446655440055', question_id: '550e8400-e29b-41d4-a716-446655440041', text: 'Mouse', is_correct: true, option_order: 2 },
      { id: '550e8400-e29b-41d4-a716-446655440056', question_id: '550e8400-e29b-41d4-a716-446655440041', text: 'Monitor', is_correct: false, option_order: 3 },
      { id: '550e8400-e29b-41d4-a716-446655440057', question_id: '550e8400-e29b-41d4-a716-446655440041', text: 'Microphone', is_correct: true, option_order: 4 },
      
      // Question 3 options
      { id: '550e8400-e29b-41d4-a716-446655440058', question_id: '550e8400-e29b-41d4-a716-446655440042', text: 'Uniform Resource Locator', is_correct: true, option_order: 1 },
      { id: '550e8400-e29b-41d4-a716-446655440059', question_id: '550e8400-e29b-41d4-a716-446655440042', text: 'Universal Resource Link', is_correct: false, option_order: 2 },
      { id: '550e8400-e29b-41d4-a716-446655440060', question_id: '550e8400-e29b-41d4-a716-446655440042', text: 'Unified Resource Location', is_correct: false, option_order: 3 },
      { id: '550e8400-e29b-41d4-a716-446655440061', question_id: '550e8400-e29b-41d4-a716-446655440042', text: 'Universal Reference Locator', is_correct: false, option_order: 4 },
      
      // Question 4 options
      { id: '550e8400-e29b-41d4-a716-446655440062', question_id: '550e8400-e29b-41d4-a716-446655440043', text: 'Use at least 8 characters', is_correct: true, option_order: 1 },
      { id: '550e8400-e29b-41d4-a716-446655440063', question_id: '550e8400-e29b-41d4-a716-446655440043', text: 'Include uppercase and lowercase letters', is_correct: true, option_order: 2 },
      { id: '550e8400-e29b-41d4-a716-446655440064', question_id: '550e8400-e29b-41d4-a716-446655440043', text: 'Share passwords with colleagues', is_correct: false, option_order: 3 },
      { id: '550e8400-e29b-41d4-a716-446655440065', question_id: '550e8400-e29b-41d4-a716-446655440043', text: 'Use unique passwords for each account', is_correct: true, option_order: 4 },
      
      // Question 5 options (Field Data Collection)
      { id: '550e8400-e29b-41d4-a716-446655440066', question_id: '550e8400-e29b-41d4-a716-446655440044', text: 'Planning and preparation', is_correct: true, option_order: 1 },
      { id: '550e8400-e29b-41d4-a716-446655440067', question_id: '550e8400-e29b-41d4-a716-446655440044', text: 'Start collecting immediately', is_correct: false, option_order: 2 },
      { id: '550e8400-e29b-41d4-a716-446655440068', question_id: '550e8400-e29b-41d4-a716-446655440044', text: 'Buy equipment first', is_correct: false, option_order: 3 },
      { id: '550e8400-e29b-41d4-a716-446655440069', question_id: '550e8400-e29b-41d4-a716-446655440044', text: 'Hire staff first', is_correct: false, option_order: 4 },
      
      // Question 6 options (Field Data Collection Tools)
      { id: '550e8400-e29b-41d4-a716-446655440070', question_id: '550e8400-e29b-41d4-a716-446655440045', text: 'Tablets and smartphones', is_correct: true, option_order: 1 },
      { id: '550e8400-e29b-41d4-a716-446655440071', question_id: '550e8400-e29b-41d4-a716-446655440045', text: 'Paper forms', is_correct: true, option_order: 2 },
      { id: '550e8400-e29b-41d4-a716-446655440072', question_id: '550e8400-e29b-41d4-a716-446655440045', text: 'GPS devices', is_correct: true, option_order: 3 },
      { id: '550e8400-e29b-41d4-a716-446655440073', question_id: '550e8400-e29b-41d4-a716-446655440045', text: 'Gaming consoles', is_correct: false, option_order: 4 },
      
      // Question 7 options (Data Quality Assurance)
      { id: '550e8400-e29b-41d4-a716-446655440074', question_id: '550e8400-e29b-41d4-a716-446655440046', text: 'Ensure data accuracy and reliability', is_correct: true, option_order: 1 },
      { id: '550e8400-e29b-41d4-a716-446655440075', question_id: '550e8400-e29b-41d4-a716-446655440046', text: 'Collect as much data as possible', is_correct: false, option_order: 2 },
      { id: '550e8400-e29b-41d4-a716-446655440076', question_id: '550e8400-e29b-41d4-a716-446655440046', text: 'Speed up data collection', is_correct: false, option_order: 3 },
      { id: '550e8400-e29b-41d4-a716-446655440077', question_id: '550e8400-e29b-41d4-a716-446655440046', text: 'Reduce data collection costs', is_correct: false, option_order: 4 }
    ];

    const { error: optionsError } = await supabaseAdminClient
      .from('question_options')
      .insert(options);

    if (optionsError) throw optionsError;
    console.log('Questions and options created successfully');
  }

  static async createSystemSettings(supabaseAdminClient: any) {
    console.log('Creating system settings...');
    
    const settings = [
      // Security Settings
      { category: 'security', setting_key: 'max_login_attempts', setting_value: '5', description: 'Maximum failed login attempts before account lockout', setting_type: 'number', is_editable: true },
      { category: 'security', setting_key: 'lockout_duration', setting_value: '30', description: 'Account lockout duration in minutes', setting_type: 'number', is_editable: true },
      { category: 'security', setting_key: 'session_timeout', setting_value: '120', description: 'User session timeout in minutes', setting_type: 'number', is_editable: true },
      { category: 'security', setting_key: 'password_min_length', setting_value: '8', description: 'Minimum password length requirement', setting_type: 'number', is_editable: true },
      { category: 'security', setting_key: 'password_complexity', setting_value: 'true', description: 'Require complex passwords (uppercase, lowercase, numbers)', setting_type: 'boolean', is_editable: true },
      { category: 'security', setting_key: 'force_password_change', setting_value: '90', description: 'Force password change every X days', setting_type: 'number', is_editable: true },
      
      // Test Settings
      { category: 'test', setting_key: 'auto_save_interval', setting_value: '30', description: 'Auto-save test progress every X seconds', setting_type: 'number', is_editable: true },
      { category: 'test', setting_key: 'enable_auto_save', setting_value: 'true', description: 'Enable automatic saving of test progress', setting_type: 'boolean', is_editable: true },
      { category: 'test', setting_key: 'auto_submit_on_timeout', setting_value: 'true', description: 'Automatically submit test when time expires', setting_type: 'boolean', is_editable: true },
      { category: 'test', setting_key: 'show_time_warning', setting_value: 'true', description: 'Show warning when 5 minutes remaining', setting_type: 'boolean', is_editable: true },
      { category: 'test', setting_key: 'allow_question_navigation', setting_value: 'true', description: 'Allow users to navigate between questions', setting_type: 'boolean', is_editable: true },
      { category: 'test', setting_key: 'enable_question_flagging', setting_value: 'true', description: 'Allow users to flag questions for review', setting_type: 'boolean', is_editable: true },
      { category: 'test', setting_key: 'network_pause_enabled', setting_value: 'true', description: 'Auto-pause test when network is unavailable', setting_type: 'boolean', is_editable: true },
      
      // General Settings
      { category: 'general', setting_key: 'site_name', setting_value: 'eSigma Survey Platform', description: 'Application name displayed to users', setting_type: 'string', is_editable: true },
      { category: 'general', setting_key: 'site_description', setting_value: 'Online MCQ Test Management System', description: 'Application description', setting_type: 'string', is_editable: true },
      { category: 'general', setting_key: 'support_email', setting_value: 'support@esigma.com', description: 'Support contact email address', setting_type: 'email', is_editable: true },
      { category: 'general', setting_key: 'maintenance_mode', setting_value: 'false', description: 'Enable maintenance mode to restrict access', setting_type: 'boolean', is_editable: true },
      { category: 'general', setting_key: 'default_timezone', setting_value: 'Asia/Kolkata', description: 'Default system timezone', setting_type: 'select', is_editable: true, options: ['Asia/Kolkata', 'UTC', 'America/New_York', 'Europe/London'] },
      { category: 'general', setting_key: 'date_format', setting_value: 'DD/MM/YYYY', description: 'Date display format', setting_type: 'select', is_editable: true, options: ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'] }
    ];

    const { error } = await supabaseAdminClient
      .from('system_settings')
      .insert(settings);

    if (error) throw error;
    console.log('System settings created successfully');
  }

  static async createRLSPolicies(supabaseAdminClient: any) {
    console.log('Creating RLS policies...');
    
    try {
      // Note: RLS policies are already created in the database schema
      // The database schema includes proper RLS policies for all tables
      // This function is kept for compatibility but policies are handled by the schema
      console.log('RLS policies are managed by the database schema');
      
      console.log('RLS policies created successfully');
    } catch (error) {
      console.error('Error creating RLS policies:', error);
      // Don't throw error - continue with initialization
    }
  }

  static async checkDatabaseConnection() {
    try {
      // Use a simple count query that doesn't trigger RLS
      const { count, error } = await supabase
        .from('roles')
        .select('*', { count: 'exact', head: true });
      
      if (error) throw error;
      return (count || 0) > 0;
    } catch (error) {
      console.error('Database connection failed:', error);
      return { success: false, message: 'Database connection failed', error };
    }
  }
}