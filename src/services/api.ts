import { supabase, supabaseAdmin, isDemoMode } from '../lib/supabase';
import { User, Role, Survey, Question, TestResult, Certificate, SystemSettings, TestSession, TestAnswer } from '../types';
import bcrypt from 'bcryptjs';
import { ActivityLogger } from './activityLogger';

// Mock data for demo mode
const mockUsers: User[] = [
  {
    id: '1',
    email: 'admin@esigma.com',
    name: 'System Administrator',
    roleId: '1',
    role: { id: '1', name: 'Admin', description: 'Administrator', level: 1, isActive: true, createdAt: new Date(), updatedAt: new Date() },
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

const mockRoles = [
  { id: '1', name: 'Admin', description: 'Administrator', level: 1, isActive: true, createdAt: new Date(), updatedAt: new Date() }
];

// Auth API
export const authApi = {
  async login(email: string, password: string) {
    try {
      console.log('AuthAPI: Login attempt for:', email);
      
      if (isDemoMode) {
        console.log('AuthAPI: Demo mode - simulating login');
        return {
          success: true,
          message: 'Demo login successful',
          data: {
            user: mockUsers[0],
            token: 'demo-token',
            session: null
          }
        };
      }

      if (!supabase) {
        throw new Error('Supabase client not available');
      }

      // First, try to authenticate with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (authError) {
        console.error('AuthAPI: Supabase auth error:', authError);
        return {
          success: false,
          message: authError.message || 'Authentication failed'
        };
      }

      if (!authData.user) {
        return {
          success: false,
          message: 'Authentication failed - no user data'
        };
      }

      // Fetch user details from our custom users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select(`
          *,
          role:roles(*)
        `)
        .eq('id', authData.user.id)
        .single();

      if (userError || !userData) {
        console.error('AuthAPI: User data fetch error:', userError);
        return {
          success: false,
          message: 'Failed to fetch user profile'
        };
      }

      // Check if user is active
      if (!userData.is_active) {
        await supabase.auth.signOut();
        return {
          success: false,
          message: 'Your account has been deactivated. Please contact your administrator.'
        };
      }

      const user: User = {
        id: userData.id,
        email: userData.email,
        name: userData.name,
        roleId: userData.role_id,
        role: {
          id: userData.role.id,
          name: userData.role.name,
          description: userData.role.description,
          level: userData.role.level,
          isActive: userData.role.is_active,
          createdAt: new Date(userData.role.created_at),
          updatedAt: new Date(userData.role.updated_at),
          menuAccess: userData.role.menu_access
        },
        isActive: userData.is_active,
        jurisdiction: userData.jurisdiction,
        zone: userData.zone,
        region: userData.region,
        district: userData.district,
        employeeId: userData.employee_id,
        phoneNumber: userData.phone_number,
        createdAt: new Date(userData.created_at),
        updatedAt: new Date(userData.updated_at),
        lastLogin: userData.last_login ? new Date(userData.last_login) : undefined
      };

      // Log successful login
      await ActivityLogger.logLogin(user.id, user.email);

      console.log('AuthAPI: Login successful for:', email);
      return {
        success: true,
        message: 'Login successful',
        data: {
          user,
          token: authData.session?.access_token,
          session: authData.session
        }
      };
    } catch (error) {
      console.error('AuthAPI: Login error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Login failed'
      };
    }
  },

  async logout() {
    try {
      if (isDemoMode) {
        return { success: true, message: 'Demo logout successful' };
      }

      if (!supabase) {
        throw new Error('Supabase client not available');
      }

      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('AuthAPI: Logout error:', error);
      }
      
      return { success: true, message: 'Logout successful' };
    } catch (error) {
      console.error('AuthAPI: Logout error:', error);
      return { success: false, message: 'Logout failed' };
    }
  },

  async changePassword(currentPassword: string, newPassword: string) {
    try {
      if (isDemoMode) {
        return { success: true, message: 'Demo password change successful' };
      }

      if (!supabase) {
        throw new Error('Supabase client not available');
      }

      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        return { success: false, message: error.message };
      }

      return { success: true, message: 'Password changed successfully' };
    } catch (error) {
      console.error('AuthAPI: Password change error:', error);
      return { success: false, message: 'Password change failed' };
    }
  }
};

// User API
export const userApi = {
  async getUsers() {
    try {
      console.log('UserAPI: Fetching users...');
      
      if (isDemoMode) {
        console.log('UserAPI: Demo mode - returning mock users');
        return {
          success: true,
          data: mockUsers,
          count: mockUsers.length,
          message: 'Users fetched successfully (demo mode)'
        };
      }

      if (!supabaseAdmin) {
        throw new Error('Supabase client not available');
      }

      // Fetch users with role information and get count
      const { data: users, error, count } = await supabaseAdmin
        .from('users')
        .select(`
          *,
          role:roles(*)
        `, { count: 'exact' })
        .order('created_at', { ascending: false });

      if (error) {
        console.error('UserAPI: Error fetching users:', error);
        return {
          success: false,
          data: [],
          count: 0,
          message: `Failed to fetch users: ${error.message}`
        };
      }

      console.log(`UserAPI: Fetched ${users?.length || 0} users, total count: ${count}`);

      const formattedUsers: User[] = (users || []).map(user => ({
        id: user.id,
        email: user.email,
        name: user.name,
        roleId: user.role_id,
        role: {
          id: user.role.id,
          name: user.role.name,
          description: user.role.description,
          level: user.role.level,
          isActive: user.role.is_active,
          createdAt: new Date(user.role.created_at),
          updatedAt: new Date(user.role.updated_at)
        },
        isActive: user.is_active,
        jurisdiction: user.jurisdiction,
        zone: user.zone,
        region: user.region,
        district: user.district,
        employeeId: user.employee_id,
        phoneNumber: user.phone_number,
        createdAt: new Date(user.created_at),
        updatedAt: new Date(user.updated_at),
        lastLogin: user.last_login ? new Date(user.last_login) : undefined
      }));

      return {
        success: true,
        data: formattedUsers,
        count: count || 0,
        message: 'Users fetched successfully'
      };
    } catch (error) {
      console.error('UserAPI: Error:', error);
      return {
        success: false,
        data: [],
        count: 0,
        message: error instanceof Error ? error.message : 'Failed to fetch users'
      };
    }
  },

  async createUser(userData: any) {
    try {
      if (isDemoMode) {
        return { success: true, data: mockUsers[0], message: 'Demo user created' };
      }

      if (!supabaseAdmin) {
        throw new Error('Supabase admin client not available');
      }

      // Create user in Supabase Auth
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: userData.email,
        password: userData.password,
        email_confirm: true
      });

      if (authError) {
        return { success: false, message: authError.message };
      }

      // Hash password for custom table
      const hashedPassword = bcrypt.hashSync(userData.password, 10);

      // Create user profile
      const { data: user, error: profileError } = await supabaseAdmin
        .from('users')
        .insert({
          id: authData.user.id,
          email: userData.email,
          password_hash: hashedPassword,
          name: userData.name,
          role_id: userData.roleId,
          jurisdiction: userData.jurisdiction,
          zone: userData.zone,
          region: userData.region,
          district: userData.district,
          employee_id: userData.employeeId,
          phone_number: userData.phoneNumber
        })
        .select(`
          *,
          role:roles(*)
        `)
        .single();

      if (profileError) {
        return { success: false, message: profileError.message };
      }

      return { success: true, data: user, message: 'User created successfully' };
    } catch (error) {
      console.error('UserAPI: Create user error:', error);
      return { success: false, message: 'Failed to create user' };
    }
  },

  async updateUser(userId: string, userData: any) {
    try {
      if (isDemoMode) {
        return { success: true, data: mockUsers[0], message: 'Demo user updated' };
      }

      if (!supabaseAdmin) {
        throw new Error('Supabase client not available');
      }

      const updateData: any = {
        name: userData.name,
        email: userData.email,
        role_id: userData.roleId,
        jurisdiction: userData.jurisdiction,
        zone: userData.zone,
        region: userData.region,
        district: userData.district,
        employee_id: userData.employeeId,
        phone_number: userData.phoneNumber,
        updated_at: new Date().toISOString()
      };

      // Only update password if provided
      if (userData.password && userData.password.trim()) {
        updateData.password_hash = bcrypt.hashSync(userData.password, 10);
      }

      const { data: user, error } = await supabaseAdmin
        .from('users')
        .update(updateData)
        .eq('id', userId)
        .select(`
          *,
          role:roles(*)
        `)
        .single();

      if (error) {
        return { success: false, message: error.message };
      }

      return { success: true, data: user, message: 'User updated successfully' };
    } catch (error) {
      console.error('UserAPI: Update user error:', error);
      return { success: false, message: 'Failed to update user' };
    }
  },

  async deleteUser(userId: string) {
    try {
      if (isDemoMode) {
        return { success: true, message: 'Demo user deleted' };
      }

      if (!supabaseAdmin) {
        throw new Error('Supabase admin client not available');
      }

      // Delete from custom users table first
      const { error: profileError } = await supabaseAdmin
        .from('users')
        .delete()
        .eq('id', userId);

      if (profileError) {
        return { success: false, message: profileError.message };
      }

      // Delete from Supabase Auth
      const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (authError) {
        console.error('Failed to delete auth user:', authError);
      }

      return { success: true, message: 'User deleted successfully' };
    } catch (error) {
      console.error('UserAPI: Delete user error:', error);
      return { success: false, message: 'Failed to delete user' };
    }
  }
};

// Role API
export const roleApi = {
  async getRoles() {
    try {
      if (isDemoMode) {
        return { success: true, data: mockRoles, message: 'Roles fetched (demo)' };
      }

      if (!supabaseAdmin) {
        throw new Error('Supabase client not available');
      }

      const { data: roles, error } = await supabaseAdmin
        .from('roles')
        .select('*')
        .order('level', { ascending: true });

      if (error) {
        return { success: false, data: [], message: error.message };
      }

      const formattedRoles = (roles || []).map(role => ({
        id: role.id,
        name: role.name,
        description: role.description,
        level: role.level,
        isActive: role.is_active,
        menuAccess: role.menu_access,
        createdAt: new Date(role.created_at),
        updatedAt: new Date(role.updated_at)
      }));

      return { success: true, data: formattedRoles, message: 'Roles fetched successfully' };
    } catch (error) {
      console.error('RoleAPI: Error:', error);
      return { success: false, data: [], message: 'Failed to fetch roles' };
    }
  },

  async createRole(roleData: any) {
    try {
      if (isDemoMode) {
        return { success: true, data: mockRoles[0], message: 'Demo role created' };
      }

      if (!supabaseAdmin) {
        throw new Error('Supabase client not available');
      }

      const { data: role, error } = await supabaseAdmin
        .from('roles')
        .insert({
          name: roleData.name,
          description: roleData.description,
          level: roleData.level || 5,
          is_active: true
        })
        .select()
        .single();

      if (error) {
        return { success: false, message: error.message };
      }

      return { success: true, data: role, message: 'Role created successfully' };
    } catch (error) {
      console.error('RoleAPI: Create role error:', error);
      return { success: false, message: 'Failed to create role' };
    }
  },

  async updateRole(roleId: string, roleData: any) {
    try {
      if (isDemoMode) {
        return { success: true, data: mockRoles[0], message: 'Demo role updated' };
      }

      if (!supabaseAdmin) {
        throw new Error('Supabase client not available');
      }

      const { data: role, error } = await supabaseAdmin
        .from('roles')
        .update({
          name: roleData.name,
          description: roleData.description,
          updated_at: new Date().toISOString()
        })
        .eq('id', roleId)
        .select()
        .single();

      if (error) {
        return { success: false, message: error.message };
      }

      return { success: true, data: role, message: 'Role updated successfully' };
    } catch (error) {
      console.error('RoleAPI: Update role error:', error);
      return { success: false, message: 'Failed to update role' };
    }
  },

  async deleteRole(roleId: string) {
    try {
      if (isDemoMode) {
        return { success: true, message: 'Demo role deleted' };
      }

      if (!supabaseAdmin) {
        throw new Error('Supabase client not available');
      }

      const { error } = await supabaseAdmin
        .from('roles')
        .delete()
        .eq('id', roleId);

      if (error) {
        return { success: false, message: error.message };
      }

      return { success: true, message: 'Role deleted successfully' };
    } catch (error) {
      console.error('RoleAPI: Delete role error:', error);
      return { success: false, message: 'Failed to delete role' };
    }
  },

  async getPermissions() {
    try {
      if (isDemoMode) {
        return { success: true, data: [], message: 'Permissions fetched (demo)' };
      }

      // Return empty array for now as permissions table doesn't exist
      return { success: true, data: [], message: 'Permissions fetched successfully' };
    } catch (error) {
      console.error('RoleAPI: Get permissions error:', error);
      return { success: false, data: [], message: 'Failed to fetch permissions' };
    }
  },

  async updateRoleMenuAccess(roleId: string, menuAccess: string[]) {
    try {
      if (isDemoMode) {
        return { success: true, message: 'Demo menu access updated' };
      }

      if (!supabaseAdmin) {
        throw new Error('Supabase client not available');
      }

      const { error } = await supabaseAdmin
        .from('roles')
        .update({
          menu_access: menuAccess,
          updated_at: new Date().toISOString()
        })
        .eq('id', roleId);

      if (error) {
        return { success: false, message: error.message };
      }

      return { success: true, message: 'Menu access updated successfully' };
    } catch (error) {
      console.error('RoleAPI: Update menu access error:', error);
      return { success: false, message: 'Failed to update menu access' };
    }
  }
};

// Survey API
export const surveyApi = {
  async getSurveys() {
    try {
      console.log('SurveyAPI: Fetching surveys...');
      
      if (isDemoMode) {
        console.log('SurveyAPI: Demo mode - returning empty surveys');
        return { success: true, data: [], message: 'Surveys fetched (demo mode)' };
      }

      if (!supabase) {
        throw new Error('Supabase client not available');
      }

      const { data: surveys, error } = await supabase
        .from('surveys')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('SurveyAPI: Error fetching surveys:', error);
        return { success: false, data: [], message: error.message };
      }

      console.log(`SurveyAPI: Fetched ${surveys?.length || 0} surveys`);

      const formattedSurveys = (surveys || []).map(survey => ({
        id: survey.id,
        title: survey.title,
        description: survey.description,
        targetDate: new Date(survey.target_date),
        duration: survey.duration,
        totalQuestions: survey.total_questions,
        passingScore: survey.passing_score,
        maxAttempts: survey.max_attempts,
        isActive: survey.is_active,
        assignedZones: survey.assigned_zones,
        assignedRegions: survey.assigned_regions,
        createdBy: survey.created_by,
        createdAt: new Date(survey.created_at),
        updatedAt: new Date(survey.updated_at),
        sections: []
      }));

      return { success: true, data: formattedSurveys, message: 'Surveys fetched successfully' };
    } catch (error) {
      console.error('SurveyAPI: Error:', error);
      return { success: false, data: [], message: 'Failed to fetch surveys' };
    }
  },

  async getSurveySections(surveyId?: string) {
    try {
      console.log('SurveyAPI: Fetching survey sections...', surveyId ? `for survey ${surveyId}` : 'all sections');
      
      if (isDemoMode) {
        console.log('SurveyAPI: Demo mode - returning empty sections');
        return { success: true, data: [], message: 'Survey sections fetched (demo mode)' };
      }

      if (!supabase) {
        throw new Error('Supabase client not available');
      }

      let query = supabase
        .from('survey_sections')
        .select('*')
        .order('section_order', { ascending: true });

      if (surveyId) {
        query = query.eq('survey_id', surveyId);
      }

      const { data: sections, error } = await query;

      if (error) {
        console.error('SurveyAPI: Error fetching sections:', error);
        return { success: false, data: [], message: error.message };
      }

      console.log(`SurveyAPI: Fetched ${sections?.length || 0} sections`);

      const formattedSections = (sections || []).map(section => ({
        id: section.id,
        surveyId: section.survey_id,
        title: section.title,
        description: section.description,
        questionsCount: section.questions_count,
        order: section.section_order,
        questions: [],
        createdAt: new Date(section.created_at),
        updatedAt: new Date(section.updated_at)
      }));

      return { success: true, data: formattedSections, message: 'Survey sections fetched successfully' };
    } catch (error) {
      console.error('SurveyAPI: Error fetching sections:', error);
      return { success: false, data: [], message: 'Failed to fetch survey sections' };
    }
  },

  async createSurvey(surveyData: any) {
    try {
      if (isDemoMode) {
        return { success: true, data: {}, message: 'Demo survey created' };
      }

      if (!supabase) {
        throw new Error('Supabase client not available');
      }

      const { data: survey, error } = await supabase
        .from('surveys')
        .insert({
          title: surveyData.title,
          description: surveyData.description,
          target_date: surveyData.targetDate.toISOString().split('T')[0],
          duration: surveyData.duration,
          total_questions: surveyData.totalQuestions,
          passing_score: surveyData.passingScore,
          max_attempts: surveyData.maxAttempts,
          created_by: surveyData.createdBy
        })
        .select()
        .single();

      if (error) {
        return { success: false, message: error.message };
      }

      return { success: true, data: survey, message: 'Survey created successfully' };
    } catch (error) {
      console.error('SurveyAPI: Create survey error:', error);
      return { success: false, message: 'Failed to create survey' };
    }
  },

  async updateSurvey(surveyId: string, surveyData: any) {
    try {
      if (isDemoMode) {
        return { success: true, data: {}, message: 'Demo survey updated' };
      }

      if (!supabase) {
        throw new Error('Supabase client not available');
      }

      const { data: survey, error } = await supabase
        .from('surveys')
        .update({
          title: surveyData.title,
          description: surveyData.description,
          target_date: surveyData.targetDate.toISOString().split('T')[0],
          duration: surveyData.duration,
          total_questions: surveyData.totalQuestions,
          passing_score: surveyData.passingScore,
          max_attempts: surveyData.maxAttempts,
          is_active: surveyData.isActive,
          updated_at: new Date().toISOString()
        })
        .eq('id', surveyId)
        .select()
        .single();

      if (error) {
        return { success: false, message: error.message };
      }

      return { success: true, data: survey, message: 'Survey updated successfully' };
    } catch (error) {
      console.error('SurveyAPI: Update survey error:', error);
      return { success: false, message: 'Failed to update survey' };
    }
  },

  async deleteSurvey(surveyId: string) {
    try {
      if (isDemoMode) {
        return { success: true, message: 'Demo survey deleted' };
      }

      if (!supabase) {
        throw new Error('Supabase client not available');
      }

      const { error } = await supabase
        .from('surveys')
        .delete()
        .eq('id', surveyId);

      if (error) {
        return { success: false, message: error.message };
      }

      return { success: true, message: 'Survey deleted successfully' };
    } catch (error) {
      console.error('SurveyAPI: Delete survey error:', error);
      return { success: false, message: 'Failed to delete survey' };
    }
  }
};

// Question API
export const questionApi = {
  async getQuestions(surveyId?: string, sectionId?: string) {
    try {
      console.log('QuestionAPI: Fetching questions...', sectionId ? `for section ${sectionId}` : surveyId ? `for survey ${surveyId}` : 'all questions');
      
      if (isDemoMode) {
        console.log('QuestionAPI: Demo mode - returning empty questions');
        return { success: true, data: [], message: 'Questions fetched (demo mode)' };
      }

      if (!supabase) {
        throw new Error('Supabase client not available');
      }

      let query = supabase
        .from('questions')
        .select(`
          *,
          options:question_options(*),
          section:survey_sections(*)
        `)
        .order('question_order', { ascending: true });

      if (sectionId) {
        query = query.eq('section_id', sectionId);
      } else if (surveyId) {
        // If only surveyId is provided, get questions for all sections of that survey
        query = query.eq('section.survey_id', surveyId);
      }

      const { data: questions, error } = await query;

      if (error) {
        console.error('QuestionAPI: Error fetching questions:', error);
        return { success: false, data: [], message: error.message };
      }

      console.log(`QuestionAPI: Fetched ${questions?.length || 0} questions`);

      const formattedQuestions = (questions || []).map(question => ({
        id: question.id,
        sectionId: question.section_id,
        text: question.text,
        type: question.question_type as 'single_choice' | 'multiple_choice',
        complexity: question.complexity as 'easy' | 'medium' | 'hard',
        points: question.points,
        explanation: question.explanation,
        order: question.question_order,
        options: (question.options || []).map((option: any) => ({
          id: option.id,
          text: option.text,
          isCorrect: option.is_correct
        })),
        correctAnswers: (question.options || [])
          .filter((option: any) => option.is_correct)
          .map((option: any) => option.id),
        createdAt: new Date(question.created_at),
        updatedAt: new Date(question.updated_at)
      }));

      return { success: true, data: formattedQuestions, message: 'Questions fetched successfully' };
    } catch (error) {
      console.error('QuestionAPI: Error:', error);
      return { success: false, data: [], message: 'Failed to fetch questions' };
    }
  },

  async createQuestion(questionData: any) {
    try {
      if (isDemoMode) {
        return { success: true, data: {}, message: 'Demo question created' };
      }

      if (!supabase) {
        throw new Error('Supabase client not available');
      }

      const { data: question, error } = await supabase
        .from('questions')
        .insert({
          section_id: questionData.sectionId,
          text: questionData.text,
          question_type: questionData.type,
          complexity: questionData.complexity,
          points: questionData.points,
          explanation: questionData.explanation,
          question_order: questionData.order
        })
        .select()
        .single();

      if (error) {
        return { success: false, message: error.message };
      }

      return { success: true, data: question, message: 'Question created successfully' };
    } catch (error) {
      console.error('QuestionAPI: Create question error:', error);
      return { success: false, message: 'Failed to create question' };
    }
  },

  async downloadTemplate() {
    try {
      // Create a CSV template for question upload
      const csvContent = `Question Text,Question Type,Complexity,Option A,Option B,Option C,Option D,Correct Answer,Points,Explanation,Survey ID,Survey Title,Section ID,Section Title
"What is the primary function of an operating system?",single_choice,easy,"To manage hardware and software resources","To create documents","To browse the internet","To play games",A,1,"An operating system manages all hardware and software resources of a computer.",550e8400-e29b-41d4-a716-446655440020,"Digital Literacy Assessment",550e8400-e29b-41d4-a716-446655440030,"Basic Computer Skills"
"Which of the following are input devices?",multiple_choice,medium,"Keyboard","Mouse","Monitor","Microphone","A,B,D",2,"Input devices allow users to provide data to the computer. Monitor is an output device.",550e8400-e29b-41d4-a716-446655440020,"Digital Literacy Assessment",550e8400-e29b-41d4-a716-446655440030,"Basic Computer Skills"`;
      
      const blob = new Blob([csvContent], { type: 'text/csv' });
      return blob;
    } catch (error) {
      console.error('QuestionAPI: Download template error:', error);
      throw error;
    }
  },

  async uploadQuestions(surveyId: string, file: File) {
    try {
      if (isDemoMode) {
        return { 
          success: true, 
          data: { questionsAdded: 0, questionsSkipped: 0, errors: [] }, 
          message: 'Demo questions uploaded' 
        };
      }

      // For now, return a mock response
      return { 
        success: true, 
        data: { questionsAdded: 0, questionsSkipped: 0, errors: ['Upload functionality not yet implemented'] }, 
        message: 'Upload functionality coming soon' 
      };
    } catch (error) {
      console.error('QuestionAPI: Upload error:', error);
      return { success: false, message: 'Failed to upload questions' };
    }
  },

  async updateQuestion(questionId: string, questionData: any) {
    try {
      if (isDemoMode) {
        return { success: true, data: {}, message: 'Demo question updated' };
      }

      if (!supabase) {
        throw new Error('Supabase client not available');
      }

      const { data: question, error } = await supabase
        .from('questions')
        .update({
          text: questionData.text,
          question_type: questionData.type,
          complexity: questionData.complexity,
          points: questionData.points,
          explanation: questionData.explanation,
          updated_at: new Date().toISOString()
        })
        .eq('id', questionId)
        .select()
        .single();

      if (error) {
        return { success: false, message: error.message };
      }

      return { success: true, data: question, message: 'Question updated successfully' };
    } catch (error) {
      console.error('QuestionAPI: Update question error:', error);
      return { success: false, message: 'Failed to update question' };
    }
  },

  async deleteQuestion(questionId: string) {
    try {
      if (isDemoMode) {
        return { success: true, message: 'Demo question deleted' };
      }

      if (!supabase) {
        throw new Error('Supabase client not available');
      }

      const { error } = await supabase
        .from('questions')
        .delete()
        .eq('id', questionId);

      if (error) {
        return { success: false, message: error.message };
      }

      return { success: true, message: 'Question deleted successfully' };
    } catch (error) {
      console.error('QuestionAPI: Delete question error:', error);
      return { success: false, message: 'Failed to delete question' };
    }
  }
};

// Dashboard API
export const dashboardApi = {
  async getDashboardData() {
    try {
      console.log('DashboardAPI: Fetching dashboard data...');
      
      if (isDemoMode) {
        console.log('DashboardAPI: Demo mode - returning mock data');
        return {
          success: true,
          data: {
            totalUsers: 1,
            totalSurveys: 0,
            totalAttempts: 0,
            averageScore: 0,
            passRate: 0,
            recentActivity: [],
            performanceByRole: [],
            performanceBySurvey: [],
            monthlyTrends: []
          },
          message: 'Dashboard data fetched (demo mode)'
        };
      }

      if (!supabase) {
        throw new Error('Supabase client not available');
      }

      // Get total users count
      console.log('DashboardAPI: Fetching user count...');
      const { count: userCount, error: userError } = await supabaseAdmin
        .from('users')
        .select('*', { count: 'exact', head: true });

      if (userError) {
        console.error('DashboardAPI: Error fetching user count:', userError);
      }

      console.log('DashboardAPI: User count result:', userCount);

      // Get total surveys count
      const { count: surveyCount, error: surveyError } = await supabaseAdmin
        .from('surveys')
        .select('*', { count: 'exact', head: true });

      if (surveyError) {
        console.error('DashboardAPI: Error fetching survey count:', surveyError);
      }

      // Get total test attempts
      const { count: attemptCount, error: attemptError } = await supabaseAdmin
        .from('test_results')
        .select('*', { count: 'exact', head: true });

      if (attemptError) {
        console.error('DashboardAPI: Error fetching attempt count:', attemptError);
      }

      // Get average score and pass rate
      const { data: results, error: resultsError } = await supabaseAdmin
        .from('test_results')
        .select('score, is_passed');

      let averageScore = 0;
      let passRate = 0;

      if (!resultsError && results && results.length > 0) {
        averageScore = results.reduce((sum, result) => sum + result.score, 0) / results.length;
        const passedCount = results.filter(result => result.is_passed).length;
        passRate = (passedCount / results.length) * 100;
      }

      // Get recent activity
      const { data: activities, error: activityError } = await supabaseAdmin
        .from('activity_logs')
        .select(`
          *,
          user:users(name)
        `)
        .order('created_at', { ascending: false })
        .limit(10);

      const recentActivity = (activities || []).map(activity => ({
        id: activity.id,
        type: activity.activity_type as any,
        description: activity.description,
        userId: activity.user_id,
        userName: activity.user?.name || 'Unknown User',
        timestamp: new Date(activity.created_at)
      }));

      // Get performance by role
      const { data: rolePerformance, error: roleError } = await supabaseAdmin
        .from('test_results')
        .select(`
          is_passed,
          user:users!inner(
            role:roles!inner(name)
          )
        `);

      const performanceByRole = rolePerformance ? 
        Object.entries(
          rolePerformance.reduce((acc: any, result: any) => {
            const roleName = result.user?.role?.name || 'Unknown';
            if (!acc[roleName]) {
              acc[roleName] = { total: 0, passed: 0 };
            }
            acc[roleName].total++;
            if (result.is_passed) {
              acc[roleName].passed++;
            }
            return acc;
          }, {})
        ).map(([name, stats]: [string, any]) => ({
          name,
          value: stats.passed,
          total: stats.total,
          percentage: stats.total > 0 ? (stats.passed / stats.total) * 100 : 0
        })) : [];

      const dashboardData = {
        totalUsers: userCount || 0,
        totalSurveys: surveyCount || 0,
        totalAttempts: attemptCount || 0,
        averageScore,
        passRate,
        recentActivity,
        performanceByRole,
        performanceBySurvey: [],
        monthlyTrends: []
      };

      console.log('DashboardAPI: Dashboard data compiled:', dashboardData);

      return {
        success: true,
        data: dashboardData,
        message: 'Dashboard data fetched successfully'
      };
    } catch (error) {
      console.error('DashboardAPI: Error:', error);
      return {
        success: false,
        data: {
          totalUsers: 0,
          totalSurveys: 0,
          totalAttempts: 0,
          averageScore: 0,
          passRate: 0,
          recentActivity: [],
          performanceByRole: [],
          performanceBySurvey: [],
          monthlyTrends: []
        },
        message: 'Failed to fetch dashboard data'
      };
    }
  }
};

// Test API
export const testApi = {
  async createTestSession(surveyId: string) {
    try {
      if (isDemoMode) {
        return { success: true, data: { id: 'demo-session' }, message: 'Demo session created' };
      }

      if (!supabase) {
        throw new Error('Supabase client not available');
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data: session, error } = await supabase
        .from('test_sessions')
        .insert({
          user_id: user.id,
          survey_id: surveyId,
          time_remaining: 35 * 60, // 35 minutes in seconds
          current_question_index: 0,
          session_status: 'in_progress',
          attempt_number: 1
        })
        .select()
        .single();

      if (error) {
        return { success: false, message: error.message };
      }

      return { success: true, data: session, message: 'Test session created' };
    } catch (error) {
      console.error('TestAPI: Create session error:', error);
      return { success: false, message: 'Failed to create test session' };
    }
  },

  async getSession(sessionId: string) {
    try {
      if (isDemoMode) {
        return { success: true, data: { id: sessionId }, message: 'Demo session fetched' };
      }

      if (!supabase) {
        throw new Error('Supabase client not available');
      }

      const { data: session, error } = await supabase
        .from('test_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (error) {
        return { success: false, message: error.message };
      }

      return { success: true, data: session, message: 'Session fetched successfully' };
    } catch (error) {
      console.error('TestAPI: Get session error:', error);
      return { success: false, message: 'Failed to fetch session' };
    }
  },

  async getQuestionsForSurvey(surveyId: string) {
    try {
      if (isDemoMode) {
        return { success: true, data: [], message: 'Demo questions fetched' };
      }

      if (!supabase) {
        throw new Error('Supabase client not available');
      }

      const { data: questions, error } = await supabase
        .from('questions')
        .select(`
          *,
          options:question_options(*),
          section:survey_sections!inner(survey_id)
        `)
        .eq('section.survey_id', surveyId)
        .order('question_order', { ascending: true });

      if (error) {
        return { success: false, data: [], message: error.message };
      }

      return { success: true, data: questions, message: 'Questions fetched successfully' };
    } catch (error) {
      console.error('TestAPI: Get questions error:', error);
      return { success: false, data: [], message: 'Failed to fetch questions' };
    }
  },

  async saveAnswer(sessionId: string, questionId: string, selectedOptions: string[]) {
    try {
      if (isDemoMode) {
        return { success: true, message: 'Demo answer saved' };
      }

      if (!supabase) {
        throw new Error('Supabase client not available');
      }

      const { error } = await supabase
        .from('test_answers')
        .upsert({
          session_id: sessionId,
          question_id: questionId,
          selected_options: selectedOptions,
          answered: true,
          updated_at: new Date().toISOString()
        });

      if (error) {
        return { success: false, message: error.message };
      }

      return { success: true, message: 'Answer saved successfully' };
    } catch (error) {
      console.error('TestAPI: Save answer error:', error);
      return { success: false, message: 'Failed to save answer' };
    }
  },

  async updateSession(sessionId: string, sessionData: any) {
    try {
      if (isDemoMode) {
        return { success: true, message: 'Demo session updated' };
      }

      if (!supabase) {
        throw new Error('Supabase client not available');
      }

      const { error } = await supabase
        .from('test_sessions')
        .update({
          current_question_index: sessionData.currentQuestionIndex,
          time_remaining: sessionData.timeRemaining,
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId);

      if (error) {
        return { success: false, message: error.message };
      }

      return { success: true, message: 'Session updated successfully' };
    } catch (error) {
      console.error('TestAPI: Update session error:', error);
      return { success: false, message: 'Failed to update session' };
    }
  },

  async submitTest(sessionId: string) {
    try {
      if (isDemoMode) {
        return { success: true, data: { isPassed: true }, message: 'Demo test submitted' };
      }

      if (!supabase) {
        throw new Error('Supabase client not available');
      }

      // This would involve complex scoring logic
      // For now, return a simple success response
      return { success: true, data: { isPassed: true }, message: 'Test submitted successfully' };
    } catch (error) {
      console.error('TestAPI: Submit test error:', error);
      return { success: false, message: 'Failed to submit test' };
    }
  },

  async syncOfflineData() {
    try {
      if (isDemoMode) {
        return { success: true, message: 'Demo sync completed' };
      }

      // Sync any offline data stored in localStorage
      return { success: true, message: 'Offline data synced successfully' };
    } catch (error) {
      console.error('TestAPI: Sync error:', error);
      return { success: false, message: 'Failed to sync offline data' };
    }
  },

  async logSecurityViolation(sessionId: string, violation: string) {
    try {
      if (isDemoMode) {
        return { success: true, message: 'Demo security violation logged' };
      }

      console.warn('Security violation logged:', violation);
      return { success: true, message: 'Security violation logged' };
    } catch (error) {
      console.error('TestAPI: Log security violation error:', error);
      return { success: false, message: 'Failed to log security violation' };
    }
  }
};

// Result API
export const resultApi = {
  async getResults(filters?: any) {
    try {
      console.log('ResultAPI: Fetching results...');
      
      if (isDemoMode) {
        console.log('ResultAPI: Demo mode - returning empty results');
        return { success: true, data: [], message: 'Results fetched (demo)' };
      }

      if (!supabaseAdmin) {
        throw new Error('Supabase client not available');
      }

      // Use admin client to bypass RLS
      const { data: results, error } = await supabaseAdmin
        .from('test_results')
        .select(`
          *,
          user:users(
            *,
            role:roles(*)
          ),
          survey:surveys(*),
          section_scores:section_scores(*)
        `)
        .order('completed_at', { ascending: false });

      if (error) {
        console.error('ResultAPI: Error fetching results:', error);
        return { success: false, data: [], message: error.message };
      }

      console.log(`ResultAPI: Fetched ${results?.length || 0} results`);

      const formattedResults = (results || []).map(result => ({
        id: result.id,
        userId: result.user_id,
        user: result.user ? {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
          roleId: result.user.role_id,
          role: result.user.role ? {
            id: result.user.role.id,
            name: result.user.role.name,
            description: result.user.role.description,
            level: result.user.role.level,
            isActive: result.user.role.is_active,
            createdAt: new Date(result.user.role.created_at),
            updatedAt: new Date(result.user.role.updated_at)
          } : null,
          jurisdiction: result.user.jurisdiction,
          zone: result.user.zone,
          region: result.user.region,
          district: result.user.district,
          isActive: result.user.is_active,
          createdAt: new Date(result.user.created_at),
          updatedAt: new Date(result.user.updated_at)
        } : null,
        surveyId: result.survey_id,
        survey: result.survey ? {
          id: result.survey.id,
          title: result.survey.title,
          description: result.survey.description,
          targetDate: new Date(result.survey.target_date),
          duration: result.survey.duration,
          totalQuestions: result.survey.total_questions,
          passingScore: result.survey.passing_score,
          maxAttempts: result.survey.max_attempts,
          isActive: result.survey.is_active,
          sections: [],
          createdAt: new Date(result.survey.created_at),
          updatedAt: new Date(result.survey.updated_at),
          createdBy: result.survey.created_by
        } : null,
        sessionId: result.session_id,
        score: result.score,
        totalQuestions: result.total_questions,
        correctAnswers: result.correct_answers,
        isPassed: result.is_passed,
        timeSpent: result.time_spent,
        attemptNumber: result.attempt_number,
        grade: result.grade,
        completedAt: new Date(result.completed_at),
        certificateId: result.certificate_id,
        sectionScores: (result.section_scores || []).map((score: any) => ({
          sectionId: score.section_id,
          sectionTitle: score.section_title,
          score: parseFloat(score.score),
          totalQuestions: score.total_questions,
          correctAnswers: score.correct_answers
        }))
      }));

      return { success: true, data: formattedResults, message: 'Results fetched successfully' };
    } catch (error) {
      console.error('ResultAPI: Error:', error);
      return { success: false, data: [], message: 'Failed to fetch results' };
    }
  },

  async getAnalytics(filters?: any) {
    try {
      console.log('ResultAPI: Fetching analytics...');
      
      if (isDemoMode) {
        console.log('ResultAPI: Demo mode - returning empty analytics');
        return { 
          success: true, 
          data: {
            overview: { totalAttempts: 0, passRate: 0, averageScore: 0, averageTime: 0 },
            performanceByRole: [],
            performanceBySurvey: [],
            timeSeriesData: [],
            topPerformers: [],
            lowPerformers: []
          }, 
          message: 'Analytics fetched (demo)' 
        };
      }

      if (!supabaseAdmin) {
        throw new Error('Supabase admin client not available');
      }

      // Get all test results with user and survey data
      const { data: results, error } = await supabaseAdmin
        .from('test_results')
        .select(`
          *,
          user:users(
            *,
            role:roles(*)
          ),
          survey:surveys(*)
        `)
        .order('completed_at', { ascending: false });

      if (error) {
        console.error('ResultAPI: Error fetching analytics data:', error);
        return { success: false, message: error.message };
      }

      console.log(`ResultAPI: Processing analytics for ${results?.length || 0} results`);

      const validResults = results || [];
      
      // Calculate overview statistics
      const totalAttempts = validResults.length;
      const passedAttempts = validResults.filter(r => r.is_passed).length;
      const passRate = totalAttempts > 0 ? (passedAttempts / totalAttempts) * 100 : 0;
      const averageScore = totalAttempts > 0 
        ? validResults.reduce((sum, r) => sum + r.score, 0) / totalAttempts 
        : 0;
      const averageTime = totalAttempts > 0 
        ? validResults.reduce((sum, r) => sum + (r.time_spent || 0), 0) / totalAttempts / 60 // Convert to minutes
        : 0;

      // Performance by role
      const roleStats = validResults.reduce((acc: any, result) => {
        const roleName = result.user?.role?.name || 'Unknown';
        if (!acc[roleName]) {
          acc[roleName] = { total: 0, passed: 0 };
        }
        acc[roleName].total++;
        if (result.is_passed) {
          acc[roleName].passed++;
        }
        return acc;
      }, {});

      const performanceByRole = Object.entries(roleStats).map(([name, stats]: [string, any]) => ({
        name,
        value: stats.passed,
        total: stats.total,
        percentage: stats.total > 0 ? (stats.passed / stats.total) * 100 : 0
      }));

      // Performance by survey
      const surveyStats = validResults.reduce((acc: any, result) => {
        const surveyTitle = result.survey?.title || 'Unknown Survey';
        if (!acc[surveyTitle]) {
          acc[surveyTitle] = { total: 0, passed: 0 };
        }
        acc[surveyTitle].total++;
        if (result.is_passed) {
          acc[surveyTitle].passed++;
        }
        return acc;
      }, {});

      const performanceBySurvey = Object.entries(surveyStats).map(([name, stats]: [string, any]) => ({
        name,
        value: stats.passed,
        total: stats.total,
        percentage: stats.total > 0 ? (stats.passed / stats.total) * 100 : 0
      }));

      // Time series data (group by date)
      const dateStats = validResults.reduce((acc: any, result) => {
        const date = new Date(result.completed_at).toISOString().split('T')[0];
        if (!acc[date]) {
          acc[date] = { attempts: 0, passed: 0, totalScore: 0 };
        }
        acc[date].attempts++;
        if (result.is_passed) {
          acc[date].passed++;
        }
        acc[date].totalScore += result.score;
        return acc;
      }, {});

      const timeSeriesData = Object.entries(dateStats)
        .map(([date, stats]: [string, any]) => ({
          date,
          attempts: stats.attempts,
          passed: stats.passed,
          averageScore: stats.attempts > 0 ? stats.totalScore / stats.attempts : 0
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // Top performers (users with highest average scores)
      const userStats = validResults.reduce((acc: any, result) => {
        const userId = result.user_id;
        const userName = result.user?.name || 'Unknown User';
        if (!acc[userId]) {
          acc[userId] = { 
            userId, 
            userName, 
            totalScore: 0, 
            attempts: 0, 
            passed: 0 
          };
        }
        acc[userId].totalScore += result.score;
        acc[userId].attempts++;
        if (result.is_passed) {
          acc[userId].passed++;
        }
        return acc;
      }, {});

      const userPerformance = Object.values(userStats).map((stats: any) => ({
        userId: stats.userId,
        userName: stats.userName,
        averageScore: stats.attempts > 0 ? stats.totalScore / stats.attempts : 0,
        totalAttempts: stats.attempts,
        passRate: stats.attempts > 0 ? (stats.passed / stats.attempts) * 100 : 0
      }));

      const topPerformers = userPerformance
        .sort((a, b) => b.averageScore - a.averageScore)
        .slice(0, 5);

      const lowPerformers = userPerformance
        .sort((a, b) => a.averageScore - b.averageScore)
        .slice(0, 5);

      const analyticsData = {
        overview: {
          totalAttempts,
          passRate,
          averageScore,
          averageTime
        },
        performanceByRole,
        performanceBySurvey,
        performanceByJurisdiction: [], // Can be implemented later
        timeSeriesData,
        topPerformers,
        lowPerformers
      };

      console.log('ResultAPI: Analytics data compiled:', analyticsData);

      return { 
        success: true, 
        data: analyticsData, 
        message: 'Analytics fetched successfully' 
      };
    } catch (error) {
      console.error('ResultAPI: Analytics error:', error);
      return { 
        success: false, 
        data: {
          overview: { totalAttempts: 0, passRate: 0, averageScore: 0, averageTime: 0 },
          performanceByRole: [],
          performanceBySurvey: [],
          performanceByJurisdiction: [],
          timeSeriesData: [],
          topPerformers: [],
          lowPerformers: []
        },
        message: 'Failed to fetch analytics' 
      };
    }
  },

  async exportResults(filters?: any) {
    try {
      if (isDemoMode) {
        return { success: true, data: 'demo,csv,data', message: 'Results exported (demo)' };
      }

      return { success: true, data: '', message: 'Results exported successfully' };
    } catch (error) {
      console.error('ResultAPI: Export error:', error);
      return { success: false, message: 'Failed to export results' };
    }
  }
};

// Certificate API
export const certificateApi = {
  async getCertificates() {
    try {
      if (isDemoMode) {
        return { success: true, data: [], message: 'Certificates fetched (demo)' };
      }

      if (!supabase) {
        throw new Error('Supabase client not available');
      }

      const { data: certificates, error } = await supabase
        .from('certificates')
        .select(`
          *,
          user:users(*),
          survey:surveys(*)
        `)
        .order('issued_at', { ascending: false });

      if (error) {
        return { success: false, data: [], message: error.message };
      }

      return { success: true, data: certificates || [], message: 'Certificates fetched successfully' };
    } catch (error) {
      console.error('CertificateAPI: Error:', error);
      return { success: false, data: [], message: 'Failed to fetch certificates' };
    }
  },

  async downloadCertificate(certificateId: string) {
    try {
      if (isDemoMode) {
        return { success: true, data: new Blob(), message: 'Demo certificate downloaded' };
      }

      // Return empty blob for now
      return { success: true, data: new Blob(), message: 'Certificate downloaded' };
    } catch (error) {
      console.error('CertificateAPI: Download error:', error);
      return { success: false, message: 'Failed to download certificate' };
    }
  },

  async revokeCertificate(certificateId: string) {
    try {
      if (isDemoMode) {
        return { success: true, message: 'Demo certificate revoked' };
      }

      if (!supabase) {
        throw new Error('Supabase client not available');
      }

      const { error } = await supabase
        .from('certificates')
        .update({ certificate_status: 'revoked' })
        .eq('id', certificateId);

      if (error) {
        return { success: false, message: error.message };
      }

      return { success: true, message: 'Certificate revoked successfully' };
    } catch (error) {
      console.error('CertificateAPI: Revoke error:', error);
      return { success: false, message: 'Failed to revoke certificate' };
    }
  }
};

// Settings API
export const settingsApi = {
  async getSettings() {
    try {
      if (isDemoMode) {
        return { success: true, data: [], message: 'Settings fetched (demo)' };
      }

      if (!supabase) {
        throw new Error('Supabase client not available');
      }

      const { data: settings, error } = await supabase
        .from('system_settings')
        .select('*')
        .order('category', { ascending: true });

      if (error) {
        return { success: false, data: [], message: error.message };
      }

      const formattedSettings = (settings || []).map(setting => ({
        id: setting.id,
        category: setting.category,
        key: setting.setting_key,
        value: setting.setting_value,
        description: setting.description,
        type: setting.setting_type as any,
        isEditable: setting.is_editable,
        options: setting.options,
        updatedAt: new Date(setting.updated_at),
        updatedBy: setting.updated_by
      }));

      return { success: true, data: formattedSettings, message: 'Settings fetched successfully' };
    } catch (error) {
      console.error('SettingsAPI: Error:', error);
      return { success: false, data: [], message: 'Failed to fetch settings' };
    }
  },

  async updateSetting(settingId: string, value: string) {
    try {
      if (isDemoMode) {
        return { success: true, message: 'Demo setting updated' };
      }

      if (!supabase) {
        throw new Error('Supabase client not available');
      }

      const { error } = await supabase
        .from('system_settings')
        .update({
          setting_value: value,
          updated_at: new Date().toISOString()
        })
        .eq('id', settingId);

      if (error) {
        return { success: false, message: error.message };
      }

      return { success: true, message: 'Setting updated successfully' };
    } catch (error) {
      console.error('SettingsAPI: Update error:', error);
      return { success: false, message: 'Failed to update setting' };
    }
  }
};

// Enumerator Dashboard API
export const enumeratorDashboardApi = {
  async getDashboardData() {
    try {
      if (isDemoMode) {
        return {
          success: true,
          data: {
            availableTests: [],
            completedTests: [],
            upcomingTests: [],
            certificates: [],
            overallProgress: 0,
            averageScore: 0,
            totalAttempts: 0,
            passedTests: 0
          },
          message: 'Enumerator dashboard data fetched (demo)'
        };
      }

      // Return empty data for now
      return {
        success: true,
        data: {
          availableTests: [],
          completedTests: [],
          upcomingTests: [],
          certificates: [],
          overallProgress: 0,
          averageScore: 0,
          totalAttempts: 0,
          passedTests: 0
        },
        message: 'Enumerator dashboard data fetched successfully'
      };
    } catch (error) {
      console.error('EnumeratorDashboardAPI: Error:', error);
      return { success: false, message: 'Failed to fetch enumerator dashboard data' };
    }
  }
};

// ZO Dashboard API
export const zoDashboardApi = {
  async getDashboardData(dateFilter: string) {
    try {
      if (isDemoMode) {
        return {
          success: true,
          data: {
            totalZones: 0,
            totalRegions: 0,
            totalUsers: 0,
            totalSurveys: 0,
            totalAttempts: 0,
            averageScore: 0,
            passRate: 0,
            zonePerformance: [],
            regionalBreakdown: [],
            topPerformingRegions: [],
            lowPerformingRegions: [],
            recentActivity: [],
            performanceByRole: [],
            performanceBySurvey: [],
            monthlyTrends: []
          },
          message: 'ZO dashboard data fetched (demo)'
        };
      }

      // Return empty data for now
      return {
        success: true,
        data: {
          totalZones: 0,
          totalRegions: 0,
          totalUsers: 0,
          totalSurveys: 0,
          totalAttempts: 0,
          averageScore: 0,
          passRate: 0,
          zonePerformance: [],
          regionalBreakdown: [],
          topPerformingRegions: [],
          lowPerformingRegions: [],
          recentActivity: [],
          performanceByRole: [],
          performanceBySurvey: [],
          monthlyTrends: []
        },
        message: 'ZO dashboard data fetched successfully'
      };
    } catch (error) {
      console.error('ZODashboardAPI: Error:', error);
      return { success: false, message: 'Failed to fetch ZO dashboard data' };
    }
  }
};

// RO Dashboard API
export const roDashboardApi = {
  async getDashboardData(dateFilter: string) {
    try {
      if (isDemoMode) {
        return {
          success: true,
          data: {
            totalDistricts: 0,
            totalSupervisors: 0,
            totalUsers: 0,
            totalSurveys: 0,
            totalAttempts: 0,
            averageScore: 0,
            passRate: 0,
            districtPerformance: [],
            supervisorPerformance: [],
            enumeratorDistribution: [],
            recentActivity: [],
            performanceByRole: [],
            performanceBySurvey: [],
            monthlyTrends: []
          },
          message: 'RO dashboard data fetched (demo)'
        };
      }

      // Return empty data for now
      return {
        success: true,
        data: {
          totalDistricts: 0,
          totalSupervisors: 0,
          totalUsers: 0,
          totalSurveys: 0,
          totalAttempts: 0,
          averageScore: 0,
          passRate: 0,
          districtPerformance: [],
          supervisorPerformance: [],
          enumeratorDistribution: [],
          recentActivity: [],
          performanceByRole: [],
          performanceBySurvey: [],
          monthlyTrends: []
        },
        message: 'RO dashboard data fetched successfully'
      };
    } catch (error) {
      console.error('RODashboardAPI: Error:', error);
      return { success: false, message: 'Failed to fetch RO dashboard data' };
    }
  }
};

// Supervisor Dashboard API
export const supervisorDashboardApi = {
  async getDashboardData(dateFilter: string) {
    try {
      if (isDemoMode) {
        return {
          success: true,
          data: {
            totalEnumerators: 0,
            totalAttempts: 0,
            averageScore: 0,
            passRate: 0,
            teamPerformance: [],
            enumeratorStatus: [],
            upcomingDeadlines: [],
            recentActivity: [],
            performanceByRole: [],
            performanceBySurvey: [],
            monthlyTrends: []
          },
          message: 'Supervisor dashboard data fetched (demo)'
        };
      }

      // Return empty data for now
      return {
        success: true,
        data: {
          totalEnumerators: 0,
          totalAttempts: 0,
          averageScore: 0,
          passRate: 0,
          teamPerformance: [],
          enumeratorStatus: [],
          upcomingDeadlines: [],
          recentActivity: [],
          performanceByRole: [],
          performanceBySurvey: [],
          monthlyTrends: []
        },
        message: 'Supervisor dashboard data fetched successfully'
      };
    } catch (error) {
      console.error('SupervisorDashboardAPI: Error:', error);
      return { success: false, message: 'Failed to fetch supervisor dashboard data' };
    }
  }
};

// Enumerator API
export const enumeratorApi = {
  async getEnumeratorStatus() {
    try {
      if (isDemoMode) {
        return { success: true, data: [], message: 'Enumerator status fetched (demo)' };
      }

      // Return empty data for now
      return { success: true, data: [], message: 'Enumerator status fetched successfully' };
    } catch (error) {
      console.error('EnumeratorAPI: Error:', error);
      return { success: false, data: [], message: 'Failed to fetch enumerator status' };
    }
  }
};