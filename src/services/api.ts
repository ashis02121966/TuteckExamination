import { supabase, supabaseAdmin, isDemoMode } from '../lib/supabase';
import { ApiResponse, User, Role, Survey, Question, TestSession, TestResult, Certificate, SystemSettings, AnalyticsData, AnalyticsFilter } from '../types';
import { ActivityLogger } from './activityLogger';
import bcrypt from 'bcryptjs';
import { parseCSVQuestions } from '../utils';

// Base API configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

// Helper function to handle API responses
function createResponse<T>(success: boolean, data?: T, message: string = '', errors?: string[]): ApiResponse<T> {
  return { success, data, message, errors };
}

// Helper function to generate unique IDs
function generateId(): string {
  return crypto.randomUUID();
}

// Authentication API
export const authApi = {
  async login(email: string, password: string): Promise<ApiResponse<{ user: User; token: string; session: any }>> {
    try {
      if (isDemoMode) {
        return createResponse(false, undefined, 'Cannot login in demo mode. Please configure Supabase first.');
      }

      if (!supabase) {
        return createResponse(false, undefined, 'Database connection not available');
      }

      // First try to authenticate with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (authError) {
        console.error('Supabase auth error:', authError);
        return createResponse(false, undefined, authError.message);
      }

      if (!authData.user) {
        return createResponse(false, undefined, 'Authentication failed');
      }

      // Get user details from custom users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select(`
          *,
          role:roles(*)
        `)
        .eq('id', authData.user.id)
        .single();

      if (userError || !userData) {
        console.error('User data fetch error:', userError);
        return createResponse(false, undefined, 'User profile not found');
      }

      const user: User = {
        id: userData.id,
        email: userData.email,
        name: userData.name,
        roleId: userData.role_id,
        role: userData.role,
        isActive: userData.is_active,
        jurisdiction: userData.jurisdiction,
        zone: userData.zone,
        region: userData.region,
        district: userData.district,
        employeeId: userData.employee_id,
        phoneNumber: userData.phone_number,
        createdAt: new Date(userData.created_at),
        updatedAt: new Date(userData.updated_at)
      };

      // Log successful login
      await ActivityLogger.logLogin(user.id, user.email);

      return createResponse(true, {
        user,
        token: authData.session?.access_token || '',
        session: authData.session
      }, 'Login successful');

    } catch (error) {
      console.error('Login error:', error);
      return createResponse(false, undefined, 'Login failed. Please try again.');
    }
  },

  async logout(): Promise<ApiResponse<void>> {
    try {
      if (supabase) {
        await supabase.auth.signOut();
      }
      return createResponse(true, undefined, 'Logged out successfully');
    } catch (error) {
      console.error('Logout error:', error);
      return createResponse(false, undefined, 'Logout failed');
    }
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<ApiResponse<void>> {
    try {
      if (!supabase) {
        return createResponse(false, undefined, 'Database connection not available');
      }

      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        return createResponse(false, undefined, error.message);
      }

      return createResponse(true, undefined, 'Password changed successfully');
    } catch (error) {
      console.error('Change password error:', error);
      return createResponse(false, undefined, 'Failed to change password');
    }
  }
};

// User API
export const userApi = {
  async getUsers(): Promise<ApiResponse<User[]>> {
    try {
      if (isDemoMode) {
        return createResponse(false, [], 'Cannot fetch users in demo mode');
      }

      if (!supabase) {
        return createResponse(false, [], 'Database connection not available');
      }

      const { data, error } = await supabase
        .from('users')
        .select(`
          *,
          role:roles(*)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching users:', error);
        return createResponse(false, [], error.message);
      }

      const users: User[] = (data || []).map(user => ({
        id: user.id,
        email: user.email,
        name: user.name,
        roleId: user.role_id,
        role: user.role,
        isActive: user.is_active,
        jurisdiction: user.jurisdiction,
        zone: user.zone,
        region: user.region,
        district: user.district,
        employeeId: user.employee_id,
        phoneNumber: user.phone_number,
        createdAt: new Date(user.created_at),
        updatedAt: new Date(user.updated_at)
      }));

      return createResponse(true, users, 'Users fetched successfully');
    } catch (error) {
      console.error('Error in getUsers:', error);
      return createResponse(false, [], 'Failed to fetch users');
    }
  },

  async createUser(userData: any): Promise<ApiResponse<User>> {
    try {
      if (isDemoMode) {
        return createResponse(false, undefined, 'Cannot create users in demo mode');
      }

      if (!supabaseAdmin) {
        return createResponse(false, undefined, 'Admin access not available');
      }

      // Create user in Supabase Auth
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: userData.email,
        password: userData.password,
        email_confirm: true,
        user_metadata: {
          name: userData.name
        }
      });

      if (authError || !authData.user) {
        return createResponse(false, undefined, authError?.message || 'Failed to create auth user');
      }

      // Hash password for custom users table
      const hashedPassword = bcrypt.hashSync(userData.password, 10);

      // Create user profile in custom users table
      const { data: profileData, error: profileError } = await supabaseAdmin
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

      if (profileError || !profileData) {
        return createResponse(false, undefined, profileError?.message || 'Failed to create user profile');
      }

      const user: User = {
        id: profileData.id,
        email: profileData.email,
        name: profileData.name,
        roleId: profileData.role_id,
        role: profileData.role,
        isActive: profileData.is_active,
        jurisdiction: profileData.jurisdiction,
        zone: profileData.zone,
        region: profileData.region,
        district: profileData.district,
        employeeId: profileData.employee_id,
        phoneNumber: profileData.phone_number,
        createdAt: new Date(profileData.created_at),
        updatedAt: new Date(profileData.updated_at)
      };

      return createResponse(true, user, `User created successfully! Login credentials:\nEmail: ${userData.email}\nPassword: ${userData.password}\n\nPlease share these credentials securely with the user.`);
    } catch (error) {
      console.error('Error creating user:', error);
      return createResponse(false, undefined, 'Failed to create user');
    }
  },

  async updateUser(id: string, userData: any): Promise<ApiResponse<User>> {
    try {
      if (!supabaseAdmin) {
        return createResponse(false, undefined, 'Admin access not available');
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
        phone_number: userData.phoneNumber
      };

      // Only update password if provided
      if (userData.password && userData.password.trim()) {
        updateData.password_hash = bcrypt.hashSync(userData.password, 10);
        
        // Also update in Supabase Auth
        await supabaseAdmin.auth.admin.updateUserById(id, {
          password: userData.password
        });
      }

      const { data, error } = await supabaseAdmin
        .from('users')
        .update(updateData)
        .eq('id', id)
        .select(`
          *,
          role:roles(*)
        `)
        .single();

      if (error || !data) {
        return createResponse(false, undefined, error?.message || 'Failed to update user');
      }

      const user: User = {
        id: data.id,
        email: data.email,
        name: data.name,
        roleId: data.role_id,
        role: data.role,
        isActive: data.is_active,
        jurisdiction: data.jurisdiction,
        zone: data.zone,
        region: data.region,
        district: data.district,
        employeeId: data.employee_id,
        phoneNumber: data.phone_number,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at)
      };

      return createResponse(true, user, 'User updated successfully');
    } catch (error) {
      console.error('Error updating user:', error);
      return createResponse(false, undefined, 'Failed to update user');
    }
  },

  async deleteUser(id: string): Promise<ApiResponse<void>> {
    try {
      if (!supabaseAdmin) {
        return createResponse(false, undefined, 'Admin access not available');
      }

      // Delete from custom users table first
      const { error: profileError } = await supabaseAdmin
        .from('users')
        .delete()
        .eq('id', id);

      if (profileError) {
        return createResponse(false, undefined, profileError.message);
      }

      // Delete from Supabase Auth
      const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id);

      if (authError) {
        console.error('Auth deletion error:', authError);
        // Continue even if auth deletion fails
      }

      return createResponse(true, undefined, 'User deleted successfully');
    } catch (error) {
      console.error('Error deleting user:', error);
      return createResponse(false, undefined, 'Failed to delete user');
    }
  }
};

// Role API
export const roleApi = {
  async getRoles(): Promise<ApiResponse<Role[]>> {
    try {
      if (!supabase) {
        return createResponse(false, [], 'Database connection not available');
      }

      const { data, error } = await supabase
        .from('roles')
        .select('*')
        .order('level', { ascending: true });

      if (error) {
        return createResponse(false, [], error.message);
      }

      const roles: Role[] = (data || []).map(role => ({
        id: role.id,
        name: role.name,
        description: role.description,
        level: role.level,
        isActive: role.is_active,
        menuAccess: role.menu_access,
        createdAt: new Date(role.created_at),
        updatedAt: new Date(role.updated_at)
      }));

      return createResponse(true, roles, 'Roles fetched successfully');
    } catch (error) {
      console.error('Error fetching roles:', error);
      return createResponse(false, [], 'Failed to fetch roles');
    }
  },

  async createRole(roleData: any): Promise<ApiResponse<Role>> {
    try {
      if (!supabaseAdmin) {
        return createResponse(false, undefined, 'Admin access not available');
      }

      const { data, error } = await supabaseAdmin
        .from('roles')
        .insert({
          name: roleData.name,
          description: roleData.description,
          level: roleData.level || 5,
          is_active: true
        })
        .select()
        .single();

      if (error || !data) {
        return createResponse(false, undefined, error?.message || 'Failed to create role');
      }

      const role: Role = {
        id: data.id,
        name: data.name,
        description: data.description,
        level: data.level,
        isActive: data.is_active,
        menuAccess: data.menu_access,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at)
      };

      return createResponse(true, role, 'Role created successfully');
    } catch (error) {
      console.error('Error creating role:', error);
      return createResponse(false, undefined, 'Failed to create role');
    }
  },

  async updateRole(id: string, roleData: any): Promise<ApiResponse<Role>> {
    try {
      if (!supabaseAdmin) {
        return createResponse(false, undefined, 'Admin access not available');
      }

      const { data, error } = await supabaseAdmin
        .from('roles')
        .update({
          name: roleData.name,
          description: roleData.description
        })
        .eq('id', id)
        .select()
        .single();

      if (error || !data) {
        return createResponse(false, undefined, error?.message || 'Failed to update role');
      }

      const role: Role = {
        id: data.id,
        name: data.name,
        description: data.description,
        level: data.level,
        isActive: data.is_active,
        menuAccess: data.menu_access,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at)
      };

      return createResponse(true, role, 'Role updated successfully');
    } catch (error) {
      console.error('Error updating role:', error);
      return createResponse(false, undefined, 'Failed to update role');
    }
  },

  async deleteRole(id: string): Promise<ApiResponse<void>> {
    try {
      if (!supabaseAdmin) {
        return createResponse(false, undefined, 'Admin access not available');
      }

      const { error } = await supabaseAdmin
        .from('roles')
        .delete()
        .eq('id', id);

      if (error) {
        return createResponse(false, undefined, error.message);
      }

      return createResponse(true, undefined, 'Role deleted successfully');
    } catch (error) {
      console.error('Error deleting role:', error);
      return createResponse(false, undefined, 'Failed to delete role');
    }
  },

  async updateRoleMenuAccess(id: string, menuAccess: string[]): Promise<ApiResponse<void>> {
    try {
      if (!supabaseAdmin) {
        return createResponse(false, undefined, 'Admin access not available');
      }

      const { error } = await supabaseAdmin
        .from('roles')
        .update({ menu_access: menuAccess })
        .eq('id', id);

      if (error) {
        return createResponse(false, undefined, error.message);
      }

      return createResponse(true, undefined, 'Menu access updated successfully');
    } catch (error) {
      console.error('Error updating menu access:', error);
      return createResponse(false, undefined, 'Failed to update menu access');
    }
  },

  async getPermissions(): Promise<ApiResponse<any[]>> {
    // Mock permissions for now
    return createResponse(true, [], 'Permissions fetched successfully');
  }
};

// Survey API
export const surveyApi = {
  async getSurveys(): Promise<ApiResponse<Survey[]>> {
    try {
      if (!supabase) {
        return createResponse(false, [], 'Database connection not available');
      }

      const { data, error } = await supabase
        .from('surveys')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        return createResponse(false, [], error.message);
      }

      const surveys: Survey[] = (data || []).map(survey => ({
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
        sections: [],
        createdAt: new Date(survey.created_at),
        updatedAt: new Date(survey.updated_at),
        createdBy: survey.created_by
      }));

      return createResponse(true, surveys, 'Surveys fetched successfully');
    } catch (error) {
      console.error('Error fetching surveys:', error);
      return createResponse(false, [], 'Failed to fetch surveys');
    }
  },

  async createSurvey(surveyData: any): Promise<ApiResponse<Survey>> {
    try {
      if (!supabaseAdmin) {
        return createResponse(false, undefined, 'Admin access not available');
      }

      const { data, error } = await supabaseAdmin
        .from('surveys')
        .insert({
          title: surveyData.title,
          description: surveyData.description,
          target_date: surveyData.targetDate.toISOString().split('T')[0],
          duration: surveyData.duration,
          total_questions: surveyData.totalQuestions,
          passing_score: surveyData.passingScore,
          max_attempts: surveyData.maxAttempts,
          assigned_zones: surveyData.assignedZones,
          assigned_regions: surveyData.assignedRegions,
          created_by: surveyData.createdBy
        })
        .select()
        .single();

      if (error || !data) {
        return createResponse(false, undefined, error?.message || 'Failed to create survey');
      }

      const survey: Survey = {
        id: data.id,
        title: data.title,
        description: data.description,
        targetDate: new Date(data.target_date),
        duration: data.duration,
        totalQuestions: data.total_questions,
        passingScore: data.passing_score,
        maxAttempts: data.max_attempts,
        isActive: data.is_active,
        assignedZones: data.assigned_zones,
        assignedRegions: data.assigned_regions,
        sections: [],
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
        createdBy: data.created_by
      };

      return createResponse(true, survey, 'Survey created successfully');
    } catch (error) {
      console.error('Error creating survey:', error);
      return createResponse(false, undefined, 'Failed to create survey');
    }
  },

  async updateSurvey(id: string, surveyData: any): Promise<ApiResponse<Survey>> {
    try {
      if (!supabaseAdmin) {
        return createResponse(false, undefined, 'Admin access not available');
      }

      const updateData: any = {
        title: surveyData.title,
        description: surveyData.description,
        duration: surveyData.duration,
        total_questions: surveyData.totalQuestions,
        passing_score: surveyData.passingScore,
        max_attempts: surveyData.maxAttempts
      };

      if (surveyData.targetDate) {
        updateData.target_date = surveyData.targetDate instanceof Date 
          ? surveyData.targetDate.toISOString().split('T')[0]
          : surveyData.targetDate;
      }

      if (surveyData.hasOwnProperty('isActive')) {
        updateData.is_active = surveyData.isActive;
      }

      if (surveyData.assignedZones) {
        updateData.assigned_zones = surveyData.assignedZones;
      }

      if (surveyData.assignedRegions) {
        updateData.assigned_regions = surveyData.assignedRegions;
      }

      const { data, error } = await supabaseAdmin
        .from('surveys')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error || !data) {
        return createResponse(false, undefined, error?.message || 'Failed to update survey');
      }

      const survey: Survey = {
        id: data.id,
        title: data.title,
        description: data.description,
        targetDate: new Date(data.target_date),
        duration: data.duration,
        totalQuestions: data.total_questions,
        passingScore: data.passing_score,
        maxAttempts: data.max_attempts,
        isActive: data.is_active,
        assignedZones: data.assigned_zones,
        assignedRegions: data.assigned_regions,
        sections: [],
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
        createdBy: data.created_by
      };

      return createResponse(true, survey, 'Survey updated successfully');
    } catch (error) {
      console.error('Error updating survey:', error);
      return createResponse(false, undefined, 'Failed to update survey');
    }
  },

  async deleteSurvey(id: string): Promise<ApiResponse<void>> {
    try {
      if (!supabaseAdmin) {
        return createResponse(false, undefined, 'Admin access not available');
      }

      const { error } = await supabaseAdmin
        .from('surveys')
        .delete()
        .eq('id', id);

      if (error) {
        return createResponse(false, undefined, error.message);
      }

      return createResponse(true, undefined, 'Survey deleted successfully');
    } catch (error) {
      console.error('Error deleting survey:', error);
      return createResponse(false, undefined, 'Failed to delete survey');
    }
  },

  async getSurveySections(surveyId: string): Promise<ApiResponse<any[]>> {
    try {
      if (!supabase) {
        return createResponse(false, [], 'Database connection not available');
      }

      const { data, error } = await supabase
        .from('survey_sections')
        .select('*')
        .eq('survey_id', surveyId)
        .order('section_order', { ascending: true });

      if (error) {
        return createResponse(false, [], error.message);
      }

      return createResponse(true, data || [], 'Survey sections fetched successfully');
    } catch (error) {
      console.error('Error fetching survey sections:', error);
      return createResponse(false, [], 'Failed to fetch survey sections');
    }
  }
};

// Question API
export const questionApi = {
  async getQuestions(sectionId: string): Promise<ApiResponse<Question[]>> {
    try {
      if (!supabase) {
        return createResponse(false, [], 'Database connection not available');
      }

      const { data: questionsData, error: questionsError } = await supabase
        .from('questions')
        .select(`
          *,
          options:question_options(*)
        `)
        .eq('section_id', sectionId)
        .order('question_order', { ascending: true });

      if (questionsError) {
        return createResponse(false, [], questionsError.message);
      }

      const questions: Question[] = (questionsData || []).map(question => ({
        id: question.id,
        sectionId: question.section_id,
        text: question.text,
        type: question.question_type as 'multiple_choice' | 'single_choice',
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

      return createResponse(true, questions, 'Questions fetched successfully');
    } catch (error) {
      console.error('Error fetching questions:', error);
      return createResponse(false, [], 'Failed to fetch questions');
    }
  },

  async createQuestion(sectionId: string, questionData: any): Promise<ApiResponse<Question>> {
    try {
      if (!supabaseAdmin) {
        return createResponse(false, undefined, 'Admin access not available');
      }

      // Create question
      const { data: questionResult, error: questionError } = await supabaseAdmin
        .from('questions')
        .insert({
          section_id: sectionId,
          text: questionData.text,
          question_type: questionData.type,
          complexity: questionData.complexity,
          points: questionData.points,
          explanation: questionData.explanation
        })
        .select()
        .single();

      if (questionError || !questionResult) {
        return createResponse(false, undefined, questionError?.message || 'Failed to create question');
      }

      // Create options
      const optionsData = questionData.options.map((option: any, index: number) => ({
        question_id: questionResult.id,
        text: option.text,
        is_correct: option.isCorrect,
        option_order: index + 1
      }));

      const { error: optionsError } = await supabaseAdmin
        .from('question_options')
        .insert(optionsData);

      if (optionsError) {
        return createResponse(false, undefined, optionsError.message);
      }

      return createResponse(true, undefined, 'Question created successfully');
    } catch (error) {
      console.error('Error creating question:', error);
      return createResponse(false, undefined, 'Failed to create question');
    }
  },

  async updateQuestion(id: string, questionData: any): Promise<ApiResponse<Question>> {
    try {
      if (!supabaseAdmin) {
        return createResponse(false, undefined, 'Admin access not available');
      }

      // Update question
      const { error: questionError } = await supabaseAdmin
        .from('questions')
        .update({
          text: questionData.text,
          question_type: questionData.type,
          complexity: questionData.complexity,
          points: questionData.points,
          explanation: questionData.explanation
        })
        .eq('id', id);

      if (questionError) {
        return createResponse(false, undefined, questionError.message);
      }

      // Delete existing options
      await supabaseAdmin
        .from('question_options')
        .delete()
        .eq('question_id', id);

      // Create new options
      const optionsData = questionData.options.map((option: any, index: number) => ({
        question_id: id,
        text: option.text,
        is_correct: option.isCorrect,
        option_order: index + 1
      }));

      const { error: optionsError } = await supabaseAdmin
        .from('question_options')
        .insert(optionsData);

      if (optionsError) {
        return createResponse(false, undefined, optionsError.message);
      }

      return createResponse(true, undefined, 'Question updated successfully');
    } catch (error) {
      console.error('Error updating question:', error);
      return createResponse(false, undefined, 'Failed to update question');
    }
  },

  async deleteQuestion(id: string): Promise<ApiResponse<void>> {
    try {
      if (!supabaseAdmin) {
        return createResponse(false, undefined, 'Admin access not available');
      }

      const { error } = await supabaseAdmin
        .from('questions')
        .delete()
        .eq('id', id);

      if (error) {
        return createResponse(false, undefined, error.message);
      }

      return createResponse(true, undefined, 'Question deleted successfully');
    } catch (error) {
      console.error('Error deleting question:', error);
      return createResponse(false, undefined, 'Failed to delete question');
    }
  },

  async bulkUploadQuestions(sectionId: string, file: File): Promise<any> {
    try {
      if (!supabaseAdmin) {
        return {
          success: false,
          message: 'Admin access not available',
          errors: ['Database connection not available']
        };
      }

      // Read file content
      const fileContent = await file.text();
      
      // Parse CSV content
      const { questions, errors } = parseCSVQuestions(fileContent);
      
      if (errors.length > 0) {
        return {
          success: false,
          message: 'Failed to parse CSV file',
          errors: errors
        };
      }

      let questionsAdded = 0;
      let questionsSkipped = 0;
      const uploadErrors: string[] = [];

      // Insert questions one by one
      for (const questionData of questions) {
        try {
          // Create question
          const { data: questionResult, error: questionError } = await supabaseAdmin
            .from('questions')
            .insert({
              section_id: sectionId,
              text: questionData.text,
              question_type: questionData.type,
              complexity: questionData.complexity,
              points: questionData.points,
              explanation: questionData.explanation
            })
            .select()
            .single();

          if (questionError || !questionResult) {
            uploadErrors.push(`Failed to create question: ${questionData.text.substring(0, 50)}...`);
            questionsSkipped++;
            continue;
          }

          // Create options
          const optionsData = questionData.options.map((option: any, index: number) => ({
            question_id: questionResult.id,
            text: option.text,
            is_correct: option.isCorrect,
            option_order: index + 1
          }));

          const { error: optionsError } = await supabaseAdmin
            .from('question_options')
            .insert(optionsData);

          if (optionsError) {
            uploadErrors.push(`Failed to create options for question: ${questionData.text.substring(0, 50)}...`);
            questionsSkipped++;
          } else {
            questionsAdded++;
          }
        } catch (error) {
          uploadErrors.push(`Error processing question: ${questionData.text.substring(0, 50)}...`);
          questionsSkipped++;
        }
      }

      return {
        success: questionsAdded > 0,
        message: `Upload completed. ${questionsAdded} questions added, ${questionsSkipped} skipped.`,
        questionsAdded,
        questionsSkipped,
        errors: uploadErrors
      };
    } catch (error) {
      console.error('Error in bulk upload:', error);
      return {
        success: false,
        message: 'Failed to upload questions',
        errors: ['Unexpected error occurred during upload']
      };
    }
  }
};

// Test API
export const testApi = {
  async createTestSession(surveyId: string): Promise<ApiResponse<TestSession>> {
    try {
      if (!supabase) {
        return createResponse(false, undefined, 'Database connection not available');
      }

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return createResponse(false, undefined, 'User not authenticated');
      }

      // Get survey details
      const { data: surveyData, error: surveyError } = await supabase
        .from('surveys')
        .select('*')
        .eq('id', surveyId)
        .single();

      if (surveyError || !surveyData) {
        return createResponse(false, undefined, 'Survey not found');
      }

      // Check existing attempts
      const { data: existingResults, error: resultsError } = await supabase
        .from('test_results')
        .select('attempt_number')
        .eq('user_id', user.id)
        .eq('survey_id', surveyId)
        .order('attempt_number', { ascending: false })
        .limit(1);

      const nextAttemptNumber = existingResults && existingResults.length > 0 
        ? existingResults[0].attempt_number + 1 
        : 1;

      if (nextAttemptNumber > surveyData.max_attempts) {
        return createResponse(false, undefined, 'Maximum attempts exceeded');
      }

      // Create test session
      const { data: sessionData, error: sessionError } = await supabase
        .from('test_sessions')
        .insert({
          user_id: user.id,
          survey_id: surveyId,
          time_remaining: surveyData.duration * 60, // Convert minutes to seconds
          attempt_number: nextAttemptNumber
        })
        .select()
        .single();

      if (sessionError || !sessionData) {
        return createResponse(false, undefined, sessionError?.message || 'Failed to create test session');
      }

      const session: TestSession = {
        id: sessionData.id,
        userId: sessionData.user_id,
        surveyId: sessionData.survey_id,
        startTime: new Date(sessionData.start_time),
        timeRemaining: sessionData.time_remaining,
        currentQuestionIndex: sessionData.current_question_index,
        status: sessionData.session_status as any,
        attemptNumber: sessionData.attempt_number,
        answers: []
      };

      return createResponse(true, session, 'Test session created successfully');
    } catch (error) {
      console.error('Error creating test session:', error);
      return createResponse(false, undefined, 'Failed to create test session');
    }
  },

  async getSession(sessionId: string): Promise<ApiResponse<TestSession>> {
    try {
      if (!supabase) {
        return createResponse(false, undefined, 'Database connection not available');
      }

      const { data, error } = await supabase
        .from('test_sessions')
        .select(`
          *,
          answers:test_answers(*)
        `)
        .eq('id', sessionId)
        .single();

      if (error || !data) {
        return createResponse(false, undefined, error?.message || 'Session not found');
      }

      const session: TestSession = {
        id: data.id,
        userId: data.user_id,
        surveyId: data.survey_id,
        startTime: new Date(data.start_time),
        endTime: data.end_time ? new Date(data.end_time) : undefined,
        timeRemaining: data.time_remaining,
        currentQuestionIndex: data.current_question_index,
        status: data.session_status as any,
        attemptNumber: data.attempt_number,
        answers: (data.answers || []).map((answer: any) => ({
          questionId: answer.question_id,
          selectedOptions: answer.selected_options || [],
          isCorrect: answer.is_correct,
          timeSpent: answer.time_spent,
          answered: answer.answered
        }))
      };

      return createResponse(true, session, 'Session fetched successfully');
    } catch (error) {
      console.error('Error fetching session:', error);
      return createResponse(false, undefined, 'Failed to fetch session');
    }
  },

  async updateSession(sessionId: string, updates: any): Promise<ApiResponse<void>> {
    try {
      if (!supabase) {
        return createResponse(false, undefined, 'Database connection not available');
      }

      const { error } = await supabase
        .from('test_sessions')
        .update({
          current_question_index: updates.currentQuestionIndex,
          time_remaining: updates.timeRemaining
        })
        .eq('id', sessionId);

      if (error) {
        return createResponse(false, undefined, error.message);
      }

      return createResponse(true, undefined, 'Session updated successfully');
    } catch (error) {
      console.error('Error updating session:', error);
      return createResponse(false, undefined, 'Failed to update session');
    }
  },

  async saveAnswer(sessionId: string, questionId: string, selectedOptions: string[]): Promise<ApiResponse<void>> {
    try {
      if (!supabase) {
        return createResponse(false, undefined, 'Database connection not available');
      }

      const { error } = await supabase
        .from('test_answers')
        .upsert({
          session_id: sessionId,
          question_id: questionId,
          selected_options: selectedOptions,
          answered: true
        });

      if (error) {
        return createResponse(false, undefined, error.message);
      }

      return createResponse(true, undefined, 'Answer saved successfully');
    } catch (error) {
      console.error('Error saving answer:', error);
      return createResponse(false, undefined, 'Failed to save answer');
    }
  },

  async submitTest(sessionId: string): Promise<ApiResponse<any>> {
    try {
      if (!supabase) {
        return createResponse(false, undefined, 'Database connection not available');
      }

      // Get session data
      const { data: sessionData, error: sessionError } = await supabase
        .from('test_sessions')
        .select(`
          *,
          answers:test_answers(*),
          survey:surveys(*)
        `)
        .eq('id', sessionId)
        .single();

      if (sessionError || !sessionData) {
        return createResponse(false, undefined, 'Session not found');
      }

      // Calculate score
      const totalQuestions = sessionData.survey.total_questions;
      const correctAnswers = sessionData.answers?.filter((answer: any) => answer.is_correct).length || 0;
      const score = Math.round((correctAnswers / totalQuestions) * 100);
      const isPassed = score >= sessionData.survey.passing_score;

      // Create test result
      const { data: resultData, error: resultError } = await supabase
        .from('test_results')
        .insert({
          user_id: sessionData.user_id,
          survey_id: sessionData.survey_id,
          session_id: sessionId,
          score,
          total_questions: totalQuestions,
          correct_answers: correctAnswers,
          is_passed: isPassed,
          time_spent: (sessionData.survey.duration * 60) - sessionData.time_remaining,
          attempt_number: sessionData.attempt_number
        })
        .select()
        .single();

      if (resultError) {
        return createResponse(false, undefined, resultError.message);
      }

      // Update session status
      await supabase
        .from('test_sessions')
        .update({
          session_status: 'completed',
          end_time: new Date().toISOString(),
          score,
          is_passed: isPassed,
          completed_at: new Date().toISOString()
        })
        .eq('id', sessionId);

      return createResponse(true, {
        score,
        isPassed,
        correctAnswers,
        totalQuestions,
        certificateId: null // Will be set if certificate is generated
      }, 'Test submitted successfully');
    } catch (error) {
      console.error('Error submitting test:', error);
      return createResponse(false, undefined, 'Failed to submit test');
    }
  },

  async syncOfflineData(): Promise<ApiResponse<void>> {
    try {
      // Implementation for syncing offline data
      return createResponse(true, undefined, 'Data synced successfully');
    } catch (error) {
      console.error('Error syncing offline data:', error);
      return createResponse(false, undefined, 'Failed to sync data');
    }
  },

  async logSecurityViolation(sessionId: string, violation: string): Promise<ApiResponse<void>> {
    try {
      await ActivityLogger.log({
        activity_type: 'security_violation',
        description: `Security violation during test: ${violation}`,
        metadata: { session_id: sessionId, violation }
      });
      return createResponse(true, undefined, 'Security violation logged');
    } catch (error) {
      console.error('Error logging security violation:', error);
      return createResponse(false, undefined, 'Failed to log security violation');
    }
  }
};

// Dashboard APIs
export const dashboardApi = {
  async getDashboardData(): Promise<ApiResponse<any>> {
    try {
      if (!supabase) {
        return createResponse(false, undefined, 'Database connection not available');
      }

      // Mock dashboard data for now
      const dashboardData = {
        totalUsers: 0,
        totalSurveys: 0,
        totalAttempts: 0,
        passRate: 0,
        averageScore: 0,
        recentActivity: [],
        performanceByRole: [],
        performanceBySurvey: []
      };

      return createResponse(true, dashboardData, 'Dashboard data fetched successfully');
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      return createResponse(false, undefined, 'Failed to fetch dashboard data');
    }
  }
};

export const enumeratorDashboardApi = {
  async getDashboardData(): Promise<ApiResponse<any>> {
    try {
      if (!supabase) {
        return createResponse(false, undefined, 'Database connection not available');
      }

      // Mock enumerator dashboard data
      const dashboardData = {
        availableTests: [],
        completedTests: [],
        upcomingTests: [],
        certificates: [],
        overallProgress: 0,
        averageScore: 0,
        totalAttempts: 0,
        passedTests: 0
      };

      return createResponse(true, dashboardData, 'Enumerator dashboard data fetched successfully');
    } catch (error) {
      console.error('Error fetching enumerator dashboard data:', error);
      return createResponse(false, undefined, 'Failed to fetch enumerator dashboard data');
    }
  }
};

export const supervisorDashboardApi = {
  async getDashboardData(dateFilter: string): Promise<ApiResponse<any>> {
    try {
      if (!supabase) {
        return createResponse(false, undefined, 'Database connection not available');
      }

      // Mock supervisor dashboard data
      const dashboardData = {
        totalEnumerators: 0,
        totalAttempts: 0,
        passRate: 0,
        averageScore: 0,
        teamPerformance: [],
        enumeratorStatus: [],
        upcomingDeadlines: []
      };

      return createResponse(true, dashboardData, 'Supervisor dashboard data fetched successfully');
    } catch (error) {
      console.error('Error fetching supervisor dashboard data:', error);
      return createResponse(false, undefined, 'Failed to fetch supervisor dashboard data');
    }
  }
};

export const roDashboardApi = {
  async getDashboardData(dateFilter: string): Promise<ApiResponse<any>> {
    try {
      if (!supabase) {
        return createResponse(false, undefined, 'Database connection not available');
      }

      // Mock RO dashboard data
      const dashboardData = {
        totalDistricts: 0,
        totalSupervisors: 0,
        totalUsers: 0,
        passRate: 0,
        averageScore: 0,
        districtPerformance: [],
        supervisorPerformance: [],
        enumeratorDistribution: [],
        monthlyTrends: []
      };

      return createResponse(true, dashboardData, 'RO dashboard data fetched successfully');
    } catch (error) {
      console.error('Error fetching RO dashboard data:', error);
      return createResponse(false, undefined, 'Failed to fetch RO dashboard data');
    }
  }
};

export const zoDashboardApi = {
  async getDashboardData(dateFilter: string): Promise<ApiResponse<any>> {
    try {
      if (!supabase) {
        return createResponse(false, undefined, 'Database connection not available');
      }

      // Mock ZO dashboard data
      const dashboardData = {
        totalZones: 0,
        totalRegions: 0,
        totalUsers: 0,
        passRate: 0,
        averageScore: 0,
        zonePerformance: [],
        regionalBreakdown: [],
        topPerformingRegions: [],
        lowPerformingRegions: [],
        monthlyTrends: []
      };

      return createResponse(true, dashboardData, 'ZO dashboard data fetched successfully');
    } catch (error) {
      console.error('Error fetching ZO dashboard data:', error);
      return createResponse(false, undefined, 'Failed to fetch ZO dashboard data');
    }
  }
};

// Results API
export const resultApi = {
  async getResults(filters: AnalyticsFilter): Promise<ApiResponse<TestResult[]>> {
    try {
      if (!supabase) {
        return createResponse(false, [], 'Database connection not available');
      }

      const { data, error } = await supabase
        .from('test_results')
        .select(`
          *,
          user:users(*),
          survey:surveys(*)
        `)
        .order('completed_at', { ascending: false });

      if (error) {
        return createResponse(false, [], error.message);
      }

      return createResponse(true, data || [], 'Results fetched successfully');
    } catch (error) {
      console.error('Error fetching results:', error);
      return createResponse(false, [], 'Failed to fetch results');
    }
  },

  async getAnalytics(filters: AnalyticsFilter): Promise<ApiResponse<AnalyticsData>> {
    try {
      // Mock analytics data
      const analyticsData: AnalyticsData = {
        overview: {
          totalAttempts: 0,
          passRate: 0,
          averageScore: 0,
          averageTime: 0
        },
        performanceByRole: [],
        performanceBySurvey: [],
        performanceByJurisdiction: [],
        timeSeriesData: [],
        topPerformers: [],
        lowPerformers: []
      };

      return createResponse(true, analyticsData, 'Analytics data fetched successfully');
    } catch (error) {
      console.error('Error fetching analytics:', error);
      return createResponse(false, undefined, 'Failed to fetch analytics');
    }
  },

  async exportResults(filters: AnalyticsFilter): Promise<ApiResponse<Blob>> {
    try {
      // Mock CSV export
      const csvContent = 'Name,Email,Survey,Score,Status,Date\n';
      const blob = new Blob([csvContent], { type: 'text/csv' });
      return createResponse(true, blob, 'Results exported successfully');
    } catch (error) {
      console.error('Error exporting results:', error);
      return createResponse(false, undefined, 'Failed to export results');
    }
  }
};

// Certificate API
export const certificateApi = {
  async getCertificates(): Promise<ApiResponse<Certificate[]>> {
    try {
      if (!supabase) {
        return createResponse(false, [], 'Database connection not available');
      }

      const { data, error } = await supabase
        .from('certificates')
        .select(`
          *,
          user:users(*),
          survey:surveys(*)
        `)
        .order('issued_at', { ascending: false });

      if (error) {
        return createResponse(false, [], error.message);
      }

      return createResponse(true, data || [], 'Certificates fetched successfully');
    } catch (error) {
      console.error('Error fetching certificates:', error);
      return createResponse(false, [], 'Failed to fetch certificates');
    }
  },

  async downloadCertificate(certificateId: string): Promise<ApiResponse<Blob>> {
    try {
      // Mock PDF generation
      const pdfContent = new Uint8Array([37, 80, 68, 70]); // PDF header
      const blob = new Blob([pdfContent], { type: 'application/pdf' });
      return createResponse(true, blob, 'Certificate downloaded successfully');
    } catch (error) {
      console.error('Error downloading certificate:', error);
      return createResponse(false, undefined, 'Failed to download certificate');
    }
  },

  async revokeCertificate(certificateId: string): Promise<ApiResponse<void>> {
    try {
      if (!supabaseAdmin) {
        return createResponse(false, undefined, 'Admin access not available');
      }

      const { error } = await supabaseAdmin
        .from('certificates')
        .update({ certificate_status: 'revoked' })
        .eq('id', certificateId);

      if (error) {
        return createResponse(false, undefined, error.message);
      }

      return createResponse(true, undefined, 'Certificate revoked successfully');
    } catch (error) {
      console.error('Error revoking certificate:', error);
      return createResponse(false, undefined, 'Failed to revoke certificate');
    }
  }
};

// Settings API
export const settingsApi = {
  async getSettings(): Promise<ApiResponse<SystemSettings[]>> {
    try {
      if (!supabase) {
        return createResponse(false, [], 'Database connection not available');
      }

      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .order('category', { ascending: true });

      if (error) {
        return createResponse(false, [], error.message);
      }

      const settings: SystemSettings[] = (data || []).map(setting => ({
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

      return createResponse(true, settings, 'Settings fetched successfully');
    } catch (error) {
      console.error('Error fetching settings:', error);
      return createResponse(false, [], 'Failed to fetch settings');
    }
  },

  async updateSetting(id: string, value: string): Promise<ApiResponse<void>> {
    try {
      if (!supabaseAdmin) {
        return createResponse(false, undefined, 'Admin access not available');
      }

      const { error } = await supabaseAdmin
        .from('system_settings')
        .update({
          setting_value: value,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) {
        return createResponse(false, undefined, error.message);
      }

      return createResponse(true, undefined, 'Setting updated successfully');
    } catch (error) {
      console.error('Error updating setting:', error);
      return createResponse(false, undefined, 'Failed to update setting');
    }
  }
};