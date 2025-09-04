import { supabase, supabaseAdmin, isDemoMode } from '../lib/supabase';
import { User, Role, Survey, Question, TestSession, TestResult, Certificate, SystemSettings, EnumeratorDashboard, SupervisorDashboard, RODashboard, ZODashboard, Dashboard, AnalyticsData, AnalyticsFilter, EnumeratorStatus, ApiResponse } from '../types';
import bcrypt from 'bcryptjs';
import { ActivityLogger } from './activityLogger';

// Base API class with common functionality
class BaseApi {
  protected async handleResponse<T>(response: any): Promise<ApiResponse<T>> {
    if (response.error) {
      console.error('API Error:', response.error);
      return {
        success: false,
        message: response.error.message || 'An error occurred',
        data: undefined
      };
    }
    
    return {
      success: true,
      message: 'Operation completed successfully',
      data: response.data
    };
  }

  protected async handleError(error: any): Promise<ApiResponse<any>> {
    console.error('API Exception:', error);
    return {
      success: false,
      message: error.message || 'An unexpected error occurred',
      data: undefined
    };
  }

  async getSurveySections(surveyId: string): Promise<ApiResponse<Section[]>> {
    try {
      if (!supabase) {
        return { success: false, message: 'Database not configured', data: [] };
      }

      const { data, error } = await supabase
        .from('survey_sections')
        .select('*')
        .eq('survey_id', surveyId)
        .order('section_order');

      if (error) throw error;

      return { success: true, data: data || [], message: 'Sections fetched successfully' };
    } catch (error) {
      console.error('Get survey sections error:', error);
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Failed to fetch sections',
        data: []
      };
    }
  }

  async createSection(sectionData: {
    surveyId: string;
    title: string;
    description: string;
    questionsCount: number;
    sectionOrder: number;
  }): Promise<ApiResponse<Section>> {
    try {
      if (!supabase) {
        return { success: false, message: 'Database not configured' };
      }

      const { data, error } = await supabase
        .from('survey_sections')
        .insert({
          survey_id: sectionData.surveyId,
          title: sectionData.title,
          description: sectionData.description,
          questions_count: sectionData.questionsCount,
          section_order: sectionData.sectionOrder
        })
        .select()
        .single();

      if (error) throw error;

      return { success: true, data, message: 'Section created successfully' };
    } catch (error) {
      console.error('Create section error:', error);
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Failed to create section' 
      };
    }
  }

  async updateSection(sectionId: string, sectionData: {
    title: string;
    description: string;
    questionsCount: number;
    sectionOrder: number;
  }): Promise<ApiResponse<Section>> {
    try {
      if (!supabase) {
        return { success: false, message: 'Database not configured' };
      }

      const { data, error } = await supabase
        .from('survey_sections')
        .update({
          title: sectionData.title,
          description: sectionData.description,
          questions_count: sectionData.questionsCount,
          section_order: sectionData.sectionOrder,
          updated_at: new Date().toISOString()
        })
        .eq('id', sectionId)
        .select()
        .single();

      if (error) throw error;

      return { success: true, data, message: 'Section updated successfully' };
    } catch (error) {
      console.error('Update section error:', error);
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Failed to update section' 
      };
    }
  }

  async deleteSection(sectionId: string): Promise<ApiResponse<void>> {
    try {
      if (!supabase) {
        return { success: false, message: 'Database not configured' };
      }

      const { error } = await supabase
        .from('survey_sections')
        .delete()
        .eq('id', sectionId);

      if (error) throw error;

      return { success: true, message: 'Section deleted successfully' };
    } catch (error) {
      console.error('Delete section error:', error);
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Failed to delete section' 
      };
    }
  }
}

// Authentication API
class AuthApi extends BaseApi {
  async login(email: string, password: string): Promise<ApiResponse<{ user: User; token: string; session: any }>> {
    try {
      if (isDemoMode) {
        return {
          success: false,
          message: 'Demo mode: Supabase not configured. Please set up your Supabase credentials.'
        };
      }

      console.log('AuthApi: Attempting login for:', email);

      // First, try to sign in with Supabase Auth
      const { data: authData, error: authError } = await supabase!.auth.signInWithPassword({
        email,
        password
      });

      if (authError) {
        console.error('AuthApi: Supabase auth error:', authError);
        return {
          success: false,
          message: authError.message || 'Invalid email or password'
        };
      }

      if (!authData.user) {
        return {
          success: false,
          message: 'Authentication failed'
        };
      }

      console.log('AuthApi: Supabase auth successful, fetching user profile...');

      // Get user profile from our custom users table
      const { data: userData, error: userError } = await supabase!
        .from('users')
        .select(`
          *,
          role:roles(*)
        `)
        .eq('id', authData.user.id)
        .single();

      if (userError || !userData) {
        console.error('AuthApi: User profile fetch error:', userError);
        return {
          success: false,
          message: 'User profile not found'
        };
      }

      console.log('AuthApi: User profile fetched successfully');

      // Update last login
      await supabase!
        .from('users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', authData.user.id);

      // Log the login activity
      await ActivityLogger.logLogin(authData.user.id, email);

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

      return {
        success: true,
        message: 'Login successful',
        data: {
          user,
          token: authData.session?.access_token || '',
          session: authData.session
        }
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async logout(): Promise<ApiResponse<void>> {
    try {
      if (isDemoMode) {
        return { success: true, message: 'Logged out (demo mode)' };
      }

      const { error } = await supabase!.auth.signOut();
      if (error) throw error;

      return { success: true, message: 'Logged out successfully' };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<ApiResponse<void>> {
    try {
      if (isDemoMode) {
        return { success: false, message: 'Password change not available in demo mode' };
      }

      const { error } = await supabase!.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      return { success: true, message: 'Password changed successfully' };
    } catch (error) {
      return this.handleError(error);
    }
  }
}

// User Management API
class UserApi extends BaseApi {
  async getUsers(): Promise<ApiResponse<User[]>> {
    try {
      if (isDemoMode) {
        return { success: false, message: 'User management not available in demo mode' };
      }

      console.log('UserApi: Fetching users...');
      // Use service role to bypass RLS and get all users for admin
      const { data, error } = await supabaseAdmin
        .from('users')
        .select(`
          *,
          role:roles(*)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('UserApi: Error fetching users:', error);
        throw error;
      }

      console.log('UserApi: Raw data from Supabase:', data);

      if (!data || data.length === 0) {
        console.log('UserApi: No users found in database');
        return {
          success: true,
          message: 'No users found. Initialize the database to create demo users.',
          data: []
        };
      }

      const users: User[] = data.map((userData: any) => ({
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
          updatedAt: new Date(userData.role.updated_at)
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
      }));

      console.log('UserApi: Processed users:', users);
      return { success: true, message: 'Users fetched successfully', data: users };
    } catch (error) {
      console.error('UserApi: Exception in getUsers:', error);
      return this.handleError(error);
    }
  }

  async createUser(userData: any): Promise<ApiResponse<User>> {
    try {
      if (isDemoMode) {
        return { success: false, message: 'User creation not available in demo mode' };
      }

      // Create user in Supabase Auth first
      const { data: authData, error: authError } = await supabaseAdmin!.auth.admin.createUser({
        email: userData.email,
        password: userData.password,
        email_confirm: true,
        user_metadata: {
          name: userData.name
        }
      });

      if (authError) throw authError;

      // Hash password for custom users table
      const hashedPassword = bcrypt.hashSync(userData.password, 10);

      // Create user profile in custom users table
      const { data, error } = await supabaseAdmin!
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

      if (error) throw error;

      const user: User = {
        id: data.id,
        email: data.email,
        name: data.name,
        roleId: data.role_id,
        role: {
          id: data.role.id,
          name: data.role.name,
          description: data.role.description,
          level: data.role.level,
          isActive: data.role.is_active,
          createdAt: new Date(data.role.created_at),
          updatedAt: new Date(data.role.updated_at)
        },
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

      return {
        success: true,
        message: `User created successfully! Login credentials:\nEmail: ${userData.email}\nPassword: ${userData.password}\n\nThe user should change their password on first login.`,
        data: user
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async updateUser(id: string, userData: any): Promise<ApiResponse<User>> {
    try {
      if (isDemoMode) {
        return { success: false, message: 'User updates not available in demo mode' };
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
        
        // Also update in Supabase Auth
        await supabaseAdmin!.auth.admin.updateUserById(id, {
          password: userData.password
        });
      }

      const { data, error } = await supabaseAdmin!
        .from('users')
        .update(updateData)
        .eq('id', id)
        .select(`
          *,
          role:roles(*)
        `)
        .single();

      if (error) throw error;

      const user: User = {
        id: data.id,
        email: data.email,
        name: data.name,
        roleId: data.role_id,
        role: {
          id: data.role.id,
          name: data.role.name,
          description: data.role.description,
          level: data.role.level,
          isActive: data.role.is_active,
          createdAt: new Date(data.role.created_at),
          updatedAt: new Date(data.role.updated_at)
        },
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

      return { success: true, message: 'User updated successfully', data: user };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async deleteUser(id: string): Promise<ApiResponse<void>> {
    try {
      if (isDemoMode) {
        return { success: false, message: 'User deletion not available in demo mode' };
      }

      // Delete from custom users table first
      const { error: userError } = await supabaseAdmin!
        .from('users')
        .delete()
        .eq('id', id);

      if (userError) throw userError;

      // Delete from Supabase Auth
      const { error: authError } = await supabaseAdmin!.auth.admin.deleteUser(id);
      if (authError) throw authError;

      return { success: true, message: 'User deleted successfully' };
    } catch (error) {
      return this.handleError(error);
    }
  }
}

// Role Management API
class RoleApi extends BaseApi {
  async getRoles(): Promise<ApiResponse<Role[]>> {
    try {
      if (isDemoMode) {
        return { success: false, message: 'Role management not available in demo mode' };
      }

      const { data, error } = await supabase!
        .from('roles')
        .select('*')
        .order('level', { ascending: true });

      if (error) throw error;

      const roles: Role[] = (data || []).map((roleData: any) => ({
        id: roleData.id,
        name: roleData.name,
        description: roleData.description,
        level: roleData.level,
        isActive: roleData.is_active,
        menuAccess: roleData.menu_access,
        createdAt: new Date(roleData.created_at),
        updatedAt: new Date(roleData.updated_at)
      }));

      return { success: true, message: 'Roles fetched successfully', data: roles };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async createRole(roleData: any): Promise<ApiResponse<Role>> {
    try {
      if (isDemoMode) {
        return { success: false, message: 'Role creation not available in demo mode' };
      }

      const { data, error } = await supabase!
        .from('roles')
        .insert({
          name: roleData.name,
          description: roleData.description,
          level: roleData.level || 5,
          is_active: true
        })
        .select()
        .single();

      if (error) throw error;

      const role: Role = {
        id: data.id,
        name: data.name,
        description: data.description,
        level: data.level,
        isActive: data.is_active,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at)
      };

      return { success: true, message: 'Role created successfully', data: role };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async updateRole(id: string, roleData: any): Promise<ApiResponse<Role>> {
    try {
      if (isDemoMode) {
        return { success: false, message: 'Role updates not available in demo mode' };
      }

      const { data, error } = await supabase!
        .from('roles')
        .update({
          name: roleData.name,
          description: roleData.description,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      const role: Role = {
        id: data.id,
        name: data.name,
        description: data.description,
        level: data.level,
        isActive: data.is_active,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at)
      };

      return { success: true, message: 'Role updated successfully', data: role };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async deleteRole(id: string): Promise<ApiResponse<void>> {
    try {
      if (isDemoMode) {
        return { success: false, message: 'Role deletion not available in demo mode' };
      }

      const { error } = await supabase!
        .from('roles')
        .delete()
        .eq('id', id);

      if (error) throw error;

      return { success: true, message: 'Role deleted successfully' };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getPermissions(): Promise<ApiResponse<any[]>> {
    try {
      // Return mock permissions for now
      const permissions = [
        { id: '1', name: 'Create Users', resource: 'users', action: 'create', description: 'Create new users', module: 'User Management' },
        { id: '2', name: 'Edit Users', resource: 'users', action: 'update', description: 'Edit existing users', module: 'User Management' },
        { id: '3', name: 'Delete Users', resource: 'users', action: 'delete', description: 'Delete users', module: 'User Management' },
        { id: '4', name: 'View Surveys', resource: 'surveys', action: 'read', description: 'View surveys', module: 'Survey Management' },
        { id: '5', name: 'Create Surveys', resource: 'surveys', action: 'create', description: 'Create new surveys', module: 'Survey Management' }
      ];

      return { success: true, message: 'Permissions fetched successfully', data: permissions };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async updateRoleMenuAccess(roleId: string, menuAccess: string[]): Promise<ApiResponse<void>> {
    try {
      if (isDemoMode) {
        return { success: false, message: 'Menu access updates not available in demo mode' };
      }

      const { error } = await supabase!
        .from('roles')
        .update({
          menu_access: menuAccess,
          updated_at: new Date().toISOString()
        })
        .eq('id', roleId);

      if (error) throw error;

      return { success: true, message: 'Menu access updated successfully' };
    } catch (error) {
      return this.handleError(error);
    }
  }
}

// Survey Management API
class SurveyApi extends BaseApi {
  async getSurveys(): Promise<ApiResponse<Survey[]>> {
    try {
      if (isDemoMode) {
        return { success: false, message: 'Survey management not available in demo mode' };
      }

      const { data, error } = await supabase!
        .from('surveys')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const surveys: Survey[] = (data || []).map((surveyData: any) => ({
        id: surveyData.id,
        title: surveyData.title,
        description: surveyData.description,
        targetDate: new Date(surveyData.target_date),
        duration: surveyData.duration,
        totalQuestions: surveyData.total_questions,
        passingScore: surveyData.passing_score,
        maxAttempts: surveyData.max_attempts,
        isActive: surveyData.is_active,
        assignedZones: surveyData.assigned_zones,
        assignedRegions: surveyData.assigned_regions,
        sections: [],
        createdAt: new Date(surveyData.created_at),
        updatedAt: new Date(surveyData.updated_at),
        createdBy: surveyData.created_by
      }));

      return { success: true, message: 'Surveys fetched successfully', data: surveys };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async createSurvey(surveyData: any): Promise<ApiResponse<Survey>> {
    try {
      if (isDemoMode) {
        return { success: false, message: 'Survey creation not available in demo mode' };
      }

      const { data, error } = await supabase!
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

      if (error) throw error;

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

      return { success: true, message: 'Survey created successfully', data: survey };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async updateSurvey(id: string, surveyData: any): Promise<ApiResponse<Survey>> {
    try {
      if (isDemoMode) {
        return { success: false, message: 'Survey updates not available in demo mode' };
      }

      const updateData: any = {
        title: surveyData.title,
        description: surveyData.description,
        duration: surveyData.duration,
        total_questions: surveyData.totalQuestions,
        passing_score: surveyData.passingScore,
        max_attempts: surveyData.maxAttempts,
        updated_at: new Date().toISOString()
      };

      if (surveyData.targetDate) {
        updateData.target_date = surveyData.targetDate instanceof Date 
          ? surveyData.targetDate.toISOString().split('T')[0]
          : surveyData.targetDate;
      }

      if (surveyData.assignedZones !== undefined) {
        updateData.assigned_zones = surveyData.assignedZones;
      }

      if (surveyData.assignedRegions !== undefined) {
        updateData.assigned_regions = surveyData.assignedRegions;
      }

      if (surveyData.isActive !== undefined) {
        updateData.is_active = surveyData.isActive;
      }

      const { data, error } = await supabase!
        .from('surveys')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

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

      return { success: true, message: 'Survey updated successfully', data: survey };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async deleteSurvey(id: string): Promise<ApiResponse<void>> {
    try {
      if (isDemoMode) {
        return { success: false, message: 'Survey deletion not available in demo mode' };
      }

      const { error } = await supabase!
        .from('surveys')
        .delete()
        .eq('id', id);

      if (error) throw error;

      return { success: true, message: 'Survey deleted successfully' };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getSurveySections(surveyId: string): Promise<ApiResponse<any[]>> {
    try {
      if (isDemoMode) {
        return { success: false, message: 'Survey sections not available in demo mode' };
      }

      const { data, error } = await supabase!
        .from('survey_sections')
        .select('*')
        .eq('survey_id', surveyId)
        .order('section_order', { ascending: true });

      if (error) throw error;

      return { success: true, message: 'Survey sections fetched successfully', data: data || [] };
    } catch (error) {
      return this.handleError(error);
    }
  }
}

// Question Management API
class QuestionApi extends BaseApi {
  async getQuestions(sectionId: string): Promise<ApiResponse<Question[]>> {
    try {
      if (isDemoMode) {
        return { success: false, message: 'Questions not available in demo mode' };
      }

      const { data, error } = await supabase!
        .from('questions')
        .select(`
          *,
          options:question_options(*)
        `)
        .eq('section_id', sectionId)
        .order('question_order', { ascending: true });

      if (error) throw error;

      const questions: Question[] = (data || []).map((questionData: any) => ({
        id: questionData.id,
        sectionId: questionData.section_id,
        text: questionData.text,
        type: questionData.question_type as 'multiple_choice' | 'single_choice',
        complexity: questionData.complexity as 'easy' | 'medium' | 'hard',
        points: questionData.points,
        explanation: questionData.explanation,
        order: questionData.question_order,
        options: (questionData.options || []).map((option: any) => ({
          id: option.id,
          text: option.text,
          isCorrect: option.is_correct
        })),
        correctAnswers: (questionData.options || [])
          .filter((option: any) => option.is_correct)
          .map((option: any) => option.id),
        createdAt: new Date(questionData.created_at),
        updatedAt: new Date(questionData.updated_at)
      }));

      return { success: true, message: 'Questions fetched successfully', data: questions };
    } catch (error) {
      return this.handleError(error);
    }
  }
}

// Test Management API
class TestApi extends BaseApi {
  async createTestSession(surveyId: string): Promise<ApiResponse<TestSession>> {
    try {
      if (isDemoMode) {
        return { success: false, message: 'Test sessions not available in demo mode' };
      }

      // Get current user
      const { data: { user: authUser } } = await supabase!.auth.getUser();
      if (!authUser) {
        throw new Error('User not authenticated');
      }

      // Get survey details
      const { data: surveyData, error: surveyError } = await supabase!
        .from('surveys')
        .select('*')
        .eq('id', surveyId)
        .single();

      if (surveyError || !surveyData) {
        throw new Error('Survey not found');
      }

      // Check existing attempts
      const { data: existingResults, error: resultsError } = await supabase!
        .from('test_results')
        .select('attempt_number')
        .eq('user_id', authUser.id)
        .eq('survey_id', surveyId)
        .order('attempt_number', { ascending: false })
        .limit(1);

      if (resultsError) throw resultsError;

      const nextAttemptNumber = existingResults && existingResults.length > 0 
        ? existingResults[0].attempt_number + 1 
        : 1;

      if (nextAttemptNumber > surveyData.max_attempts) {
        throw new Error('Maximum attempts exceeded');
      }

      // Create test session
      const { data, error } = await supabase!
        .from('test_sessions')
        .insert({
          user_id: authUser.id,
          survey_id: surveyId,
          time_remaining: surveyData.duration * 60, // Convert minutes to seconds
          attempt_number: nextAttemptNumber,
          session_status: 'in_progress'
        })
        .select()
        .single();

      if (error) throw error;

      const session: TestSession = {
        id: data.id,
        userId: data.user_id,
        surveyId: data.survey_id,
        startTime: new Date(data.start_time),
        timeRemaining: data.time_remaining,
        currentQuestionIndex: data.current_question_index,
        answers: [],
        status: data.session_status as any,
        attemptNumber: data.attempt_number
      };

      return { success: true, message: 'Test session created successfully', data: session };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getSession(sessionId: string): Promise<ApiResponse<TestSession>> {
    try {
      if (isDemoMode) {
        return { success: false, message: 'Test sessions not available in demo mode' };
      }

      const { data, error } = await supabase!
        .from('test_sessions')
        .select(`
          *,
          answers:test_answers(*)
        `)
        .eq('id', sessionId)
        .single();

      if (error) throw error;

      const session: TestSession = {
        id: data.id,
        userId: data.user_id,
        surveyId: data.survey_id,
        startTime: new Date(data.start_time),
        endTime: data.end_time ? new Date(data.end_time) : undefined,
        timeRemaining: data.time_remaining,
        currentQuestionIndex: data.current_question_index,
        answers: (data.answers || []).map((answer: any) => ({
          questionId: answer.question_id,
          selectedOptions: answer.selected_options || [],
          isCorrect: answer.is_correct,
          timeSpent: answer.time_spent,
          answered: answer.answered
        })),
        status: data.session_status as any,
        attemptNumber: data.attempt_number,
        score: data.score,
        isPassed: data.is_passed,
        completedAt: data.completed_at ? new Date(data.completed_at) : undefined
      };

      return { success: true, message: 'Session fetched successfully', data: session };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async updateSession(sessionId: string, updates: any): Promise<ApiResponse<void>> {
    try {
      if (isDemoMode) {
        return { success: false, message: 'Session updates not available in demo mode' };
      }

      const { error } = await supabase!
        .from('test_sessions')
        .update({
          current_question_index: updates.currentQuestionIndex,
          time_remaining: updates.timeRemaining,
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId);

      if (error) throw error;

      // Save answers if provided
      if (updates.answers && updates.answers.length > 0) {
        for (const answer of updates.answers) {
          await this.saveAnswer(sessionId, answer.questionId, answer.selectedOptions);
        }
      }

      return { success: true, message: 'Session updated successfully' };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async saveAnswer(sessionId: string, questionId: string, selectedOptions: string[]): Promise<ApiResponse<void>> {
    try {
      if (isDemoMode) {
        return { success: false, message: 'Answer saving not available in demo mode' };
      }

      const { error } = await supabase!
        .from('test_answers')
        .upsert({
          session_id: sessionId,
          question_id: questionId,
          selected_options: selectedOptions,
          answered: selectedOptions.length > 0,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'session_id,question_id'
        });

      if (error) throw error;

      return { success: true, message: 'Answer saved successfully' };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async submitTest(sessionId: string): Promise<ApiResponse<TestResult>> {
    try {
      if (isDemoMode) {
        return { success: false, message: 'Test submission not available in demo mode' };
      }

      // Get session data
      const { data: sessionData, error: sessionError } = await supabase!
        .from('test_sessions')
        .select(`
          *,
          survey:surveys(*),
          answers:test_answers(*)
        `)
        .eq('id', sessionId)
        .single();

      if (sessionError || !sessionData) {
        throw new Error('Session not found');
      }

      // Get survey sections to calculate total target questions
      const { data: sections, error: sectionsError } = await supabase!
        .from('survey_sections')
        .select('questions_count')
        .eq('survey_id', sessionData.survey_id);

      if (sectionsError) {
        throw new Error('Failed to fetch survey sections');
      }

      // Calculate total questions as sum of target questions from all sections
      const totalQuestions = sections?.reduce((sum, section) => sum + section.questions_count, 0) || 0;

      // Get all questions for the survey with their correct answers
      const { data: sectionsData, error: sectionsDataError } = await supabase!
        .from('survey_sections')
        .select(`
          *,
          questions:questions(
            *,
            options:question_options(*)
          )
        `)
        .eq('survey_id', sessionData.survey_id)
        .order('section_order', { ascending: true });

      if (sectionsDataError) throw sectionsDataError;

      // Flatten all questions from all sections
      const allQuestions = sectionsData.flatMap(section => 
        section.questions.map((q: any) => ({
          ...q,
          sectionId: section.id,
          sectionTitle: section.title
        }))
      );

      // Calculate score
      let correctAnswers = 0;
      const sectionScores: any[] = [];

      // Group questions by section for section-wise scoring
      const questionsBySection = allQuestions.reduce((acc: any, question: any) => {
        if (!acc[question.sectionId]) {
          acc[question.sectionId] = {
            sectionId: question.sectionId,
            sectionTitle: question.sectionTitle,
            questions: []
          };
        }
        acc[question.sectionId].questions.push(question);
        return acc;
      }, {});

      // Calculate section-wise scores
      for (const sectionData of Object.values(questionsBySection) as any[]) {
        let sectionCorrect = 0;
        const sectionTotal = sectionData.questions.length;

        for (const question of sectionData.questions) {
          const userAnswer = sessionData.answers.find((a: any) => a.question_id === question.id);
          const correctOptionIds = question.options
            .filter((opt: any) => opt.is_correct)
            .map((opt: any) => opt.id);

          if (userAnswer && userAnswer.selected_options) {
            const userSelectedOptions = userAnswer.selected_options;
            
            // Check if answer is correct
            if (question.question_type === 'single_choice') {
              if (userSelectedOptions.length === 1 && correctOptionIds.includes(userSelectedOptions[0])) {
                correctAnswers++;
                sectionCorrect++;
              }
            } else if (question.question_type === 'multiple_choice') {
              const isCorrect = correctOptionIds.length === userSelectedOptions.length &&
                correctOptionIds.every(id => userSelectedOptions.includes(id));
              if (isCorrect) {
                correctAnswers++;
                sectionCorrect++;
              }
            }
          }
        }

        const sectionScore = sectionTotal > 0 ? (sectionCorrect / sectionTotal) * 100 : 0;
        sectionScores.push({
          section_id: sectionData.sectionId,
          section_title: sectionData.sectionTitle,
          score: sectionScore,
          total_questions: sectionTotal,
          correct_answers: sectionCorrect
        });
      }

      const finalScore = totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;
      const isPassed = finalScore >= sessionData.survey.passing_score;
      const timeSpent = (sessionData.survey.duration * 60) - sessionData.time_remaining;

      // Create test result
      const { data: resultData, error: resultError } = await supabase!
        .from('test_results')
        .insert({
          user_id: sessionData.user_id,
          survey_id: sessionData.survey_id,
          session_id: sessionId,
          score: finalScore,
          total_questions: totalQuestions,
          correct_answers: correctAnswers,
          is_passed: isPassed,
          time_spent: timeSpent,
          attempt_number: sessionData.attempt_number,
          grade: this.calculateGrade(finalScore)
        })
        .select()
        .single();

      if (resultError) throw resultError;

      // Create section scores
      for (const sectionScore of sectionScores) {
        await supabase!
          .from('section_scores')
          .insert({
            result_id: resultData.id,
            ...sectionScore
          });
      }

      // Update session status
      await supabase!
        .from('test_sessions')
        .update({
          session_status: 'completed',
          end_time: new Date().toISOString(),
          score: finalScore,
          is_passed: isPassed,
          completed_at: new Date().toISOString()
        })
        .eq('id', sessionId);

      // Create certificate if passed
      let certificateId = null;
      if (isPassed) {
        const certificateNumber = `CERT-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        
        const { data: certData, error: certError } = await supabase!
          .from('certificates')
          .insert({
            user_id: sessionData.user_id,
            survey_id: sessionData.survey_id,
            result_id: resultData.id,
            certificate_number: certificateNumber,
            certificate_status: 'active'
          })
          .select()
          .single();

        if (!certError && certData) {
          certificateId = certData.id;
          
          // Update result with certificate ID
          await supabase!
            .from('test_results')
            .update({ certificate_id: certificateId })
            .eq('id', resultData.id);
        }
      }

      const testResult: TestResult = {
        id: resultData.id,
        userId: resultData.user_id,
        user: {} as User,
        surveyId: resultData.survey_id,
        survey: {} as Survey,
        sessionId: resultData.session_id,
        score: resultData.score,
        totalQuestions: resultData.total_questions,
        correctAnswers: resultData.correct_answers,
        isPassed: resultData.is_passed,
        timeSpent: resultData.time_spent,
        attemptNumber: resultData.attempt_number,
        sectionScores: sectionScores.map(score => ({
          sectionId: score.section_id,
          sectionTitle: score.section_title,
          score: score.score,
          totalQuestions: score.total_questions,
          correctAnswers: score.correct_answers
        })),
        completedAt: new Date(resultData.completed_at),
        certificateId: certificateId,
        grade: resultData.grade
      };

      return { 
        success: true, 
        message: `Test submitted successfully! Score: ${finalScore.toFixed(1)}% (${isPassed ? 'Passed' : 'Failed'})`, 
        data: testResult 
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  private calculateGrade(score: number): string {
    if (score >= 90) return 'A+';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C';
    if (score >= 50) return 'D';
    return 'F';
  }

  async syncOfflineData(): Promise<ApiResponse<void>> {
    try {
      // Implementation for syncing offline data
      return { success: true, message: 'Data synced successfully' };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async logSecurityViolation(sessionId: string, violation: string): Promise<ApiResponse<void>> {
    try {
      if (isDemoMode) {
        console.log('Security violation (demo mode):', violation);
        return { success: true, message: 'Security violation logged (demo mode)' };
      }

      await ActivityLogger.log({
        activity_type: 'security_violation',
        description: `Security violation during test: ${violation}`,
        metadata: { session_id: sessionId, violation }
      });

      return { success: true, message: 'Security violation logged' };
    } catch (error) {
      return this.handleError(error);
    }
  }
}

// Dashboard APIs
class DashboardApi extends BaseApi {
  async getDashboardData(): Promise<ApiResponse<Dashboard>> {
    try {
      if (isDemoMode) {
        return { success: false, message: 'Dashboard not available in demo mode' };
      }

      if (!supabaseAdmin) {
        throw new Error('Supabase admin client not available');
      }

      // Get total users count
      const { count: totalUsers, error: usersError } = await supabaseAdmin
        .from('users')
        .select('*', { count: 'exact', head: true });

      if (usersError) {
        console.error('Error fetching users count:', usersError);
        throw usersError;
      }

      // Get total surveys count
      const { count: totalSurveys, error: surveysError } = await supabaseAdmin
        .from('surveys')
        .select('*', { count: 'exact', head: true });

      if (surveysError) {
        console.error('Error fetching surveys count:', surveysError);
        throw surveysError;
      }

      // Get total test attempts
      const { count: totalAttempts, error: attemptsError } = await supabaseAdmin
        .from('test_results')
        .select('*', { count: 'exact', head: true });

      if (attemptsError) {
        console.error('Error fetching attempts count:', attemptsError);
        throw attemptsError;
      }

      // Get average score and pass rate
      const { data: resultsData, error: resultsError } = await supabaseAdmin
        .from('test_results')
        .select('score, is_passed');

      if (resultsError) {
        console.error('Error fetching results data:', resultsError);
        throw resultsError;
      }

      const averageScore = resultsData && resultsData.length > 0
        ? resultsData.reduce((sum, result) => sum + result.score, 0) / resultsData.length
        : 0;

      const passedCount = resultsData ? resultsData.filter(result => result.is_passed).length : 0;
      const passRate = resultsData && resultsData.length > 0
        ? (passedCount / resultsData.length) * 100
        : 0;

      // Get recent activity
      const { data: activityData, error: activityError } = await supabaseAdmin
        .from('activity_logs')
        .select(`
          id,
          activity_type,
          description,
          user_id,
          created_at,
          users!inner(name)
        `)
        .order('created_at', { ascending: false })
        .limit(10);

      const recentActivity = activityData ? activityData.map(activity => ({
        id: activity.id,
        type: activity.activity_type as any,
        description: activity.description,
        userId: activity.user_id || '',
        userName: activity.users?.name || 'Unknown User',
        timestamp: new Date(activity.created_at)
      })) : [];

      // Get performance by role
      const { data: rolePerformanceData, error: rolePerformanceError } = await supabaseAdmin
        .from('test_results')
        .select(`
          is_passed,
          users!inner(
            role_id,
            roles!inner(name)
          )
        `);

      const performanceByRole = rolePerformanceData ? 
        Object.entries(
          rolePerformanceData.reduce((acc, result) => {
            const roleName = result.users?.roles?.name || 'Unknown';
            if (!acc[roleName]) {
              acc[roleName] = { total: 0, passed: 0 };
            }
            acc[roleName].total++;
            if (result.is_passed) {
              acc[roleName].passed++;
            }
            return acc;
          }, {} as Record<string, { total: number; passed: number }>)
        ).map(([name, data]) => ({
          name,
          value: data.passed,
          total: data.total,
          percentage: data.total > 0 ? (data.passed / data.total) * 100 : 0
        })) : [];

      // Get performance by survey
      const { data: surveyPerformanceData, error: surveyPerformanceError } = await supabaseAdmin
        .from('test_results')
        .select(`
          is_passed,
          surveys!inner(title)
        `);

      const performanceBySurvey = surveyPerformanceData ?
        Object.entries(
          surveyPerformanceData.reduce((acc, result) => {
            const surveyTitle = result.surveys?.title || 'Unknown';
            if (!acc[surveyTitle]) {
              acc[surveyTitle] = { total: 0, passed: 0 };
            }
            acc[surveyTitle].total++;
            if (result.is_passed) {
              acc[surveyTitle].passed++;
            }
            return acc;
          }, {} as Record<string, { total: number; passed: number }>)
        ).map(([name, data]) => ({
          name,
          value: data.passed,
          total: data.total,
          percentage: data.total > 0 ? (data.passed / data.total) * 100 : 0
        })) : [];

      // Mock monthly trends for now (would need more complex query for real data)
      const monthlyTrends = [
        { month: 'Jan', attempts: totalAttempts ? Math.floor(totalAttempts * 0.3) : 0, passed: passedCount ? Math.floor(passedCount * 0.3) : 0, failed: 0, passRate: passRate },
        { month: 'Feb', attempts: totalAttempts ? Math.floor(totalAttempts * 0.35) : 0, passed: passedCount ? Math.floor(passedCount * 0.35) : 0, failed: 0, passRate: passRate },
        { month: 'Mar', attempts: totalAttempts ? Math.floor(totalAttempts * 0.35) : 0, passed: passedCount ? Math.floor(passedCount * 0.35) : 0, failed: 0, passRate: passRate }
      ];

      const dashboardData: Dashboard = {
        totalUsers: totalUsers || 0,
        totalSurveys: totalSurveys || 0,
        totalAttempts: totalAttempts || 0,
        averageScore,
        passRate,
        recentActivity,
        performanceByRole,
        performanceBySurvey,
        monthlyTrends
      };

      return { success: true, data: dashboardData, message: 'Dashboard data retrieved successfully' };
    } catch (error) {
      return this.handleError(error);
    }
  }
}

class EnumeratorDashboardApi extends BaseApi {
  async getDashboardData(): Promise<ApiResponse<EnumeratorDashboard>> {
    try {
      if (isDemoMode) {
        return { success: false, message: 'Enumerator dashboard not available in demo mode' };
      }

      // Get current user
      const { data: { user: authUser } } = await supabase!.auth.getUser();
      if (!authUser) {
        throw new Error('User not authenticated');
      }

      // Get user profile
      const { data: userData, error: userError } = await supabase!
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (userError || !userData) {
        throw new Error('User profile not found');
      }

      // Get available tests (surveys assigned to user's zone/region or all if no assignment)
      const { data: surveysData, error: surveysError } = await supabase!
        .from('surveys')
        .select('*')
        .eq('is_active', true);

      if (surveysError) throw surveysError;

      // Filter surveys based on user's zone/region
      const availableSurveys = (surveysData || []).filter((survey: any) => {
        const assignedZones = survey.assigned_zones || [];
        const assignedRegions = survey.assigned_regions || [];
        
        // If no zones/regions assigned, survey is available to all
        if (assignedZones.length === 0 && assignedRegions.length === 0) {
          return true;
        }
        
        // Check if user's zone/region matches
        const zoneMatch = assignedZones.length === 0 || assignedZones.includes(userData.zone);
        const regionMatch = assignedRegions.length === 0 || assignedRegions.includes(userData.region);
        
        return zoneMatch && regionMatch;
      });

      // Get user's test results
      const { data: resultsData, error: resultsError } = await supabase!
        .from('test_results')
        .select(`
          *,
          survey:surveys(title)
        `)
        .eq('user_id', authUser.id)
        .order('completed_at', { ascending: false });

      if (resultsError) throw resultsError;

      // Get user's certificates
      const { data: certificatesData, error: certificatesError } = await supabase!
        .from('certificates')
        .select(`
          *,
          survey:surveys(title),
          user:users(name, email, role:roles(name))
        `)
        .eq('user_id', authUser.id)
        .order('issued_at', { ascending: false });

      if (certificatesError) throw certificatesError;

      // Process available tests
      const availableTests = availableSurveys.map((survey: any) => {
        const userResults = (resultsData || []).filter((r: any) => r.survey_id === survey.id);
        const attemptsUsed = userResults.length;
        const attemptsLeft = Math.max(0, survey.max_attempts - attemptsUsed);
        const isEligible = attemptsLeft > 0 && new Date(survey.target_date) >= new Date();

        return {
          surveyId: survey.id,
          title: survey.title,
          description: survey.description,
          targetDate: new Date(survey.target_date),
          duration: survey.duration,
          totalQuestions: survey.total_questions,
          passingScore: survey.passing_score,
          attemptsLeft,
          maxAttempts: survey.max_attempts,
          isEligible
        };
      });

      // Process completed tests
      const completedTests = (resultsData || []).map((result: any) => ({
        resultId: result.id,
        surveyTitle: result.survey.title,
        score: result.score,
        isPassed: result.is_passed,
        completedAt: new Date(result.completed_at),
        attemptNumber: result.attempt_number,
        certificateId: result.certificate_id
      }));

      // Process upcoming tests
      const upcomingTests = availableTests
        .filter(test => test.isEligible)
        .map(test => {
          const daysLeft = Math.ceil((test.targetDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
          return {
            surveyId: test.surveyId,
            title: test.title,
            targetDate: test.targetDate,
            daysLeft: Math.max(0, daysLeft),
            isOverdue: daysLeft < 0
          };
        })
        .sort((a, b) => a.daysLeft - b.daysLeft);

      // Process certificates
      const certificates = (certificatesData || []).map((cert: any) => ({
        id: cert.id,
        userId: cert.user_id,
        user: {
          id: cert.user_id,
          name: cert.user.name,
          email: cert.user.email,
          role: cert.user.role
        },
        surveyId: cert.survey_id,
        survey: {
          id: cert.survey_id,
          title: cert.survey.title
        },
        resultId: cert.result_id,
        certificateNumber: cert.certificate_number,
        issuedAt: new Date(cert.issued_at),
        validUntil: cert.valid_until ? new Date(cert.valid_until) : undefined,
        downloadCount: cert.download_count,
        status: cert.certificate_status
      }));

      // Calculate statistics
      const passedTests = completedTests.filter(t => t.isPassed).length;
      const averageScore = completedTests.length > 0 
        ? completedTests.reduce((sum, t) => sum + t.score, 0) / completedTests.length 
        : 0;
      const overallProgress = availableTests.length > 0 
        ? (completedTests.length / availableTests.length) * 100 
        : 0;

      const dashboardData: EnumeratorDashboard = {
        availableTests,
        completedTests,
        upcomingTests,
        certificates,
        overallProgress,
        averageScore,
        totalAttempts: completedTests.length,
        passedTests
      };

      return { success: true, message: 'Dashboard data fetched successfully', data: dashboardData };
    } catch (error) {
      return this.handleError(error);
    }
  }
}

class SupervisorDashboardApi extends BaseApi {
  async getDashboardData(dateFilter: string): Promise<ApiResponse<SupervisorDashboard>> {
    try {
      if (isDemoMode) {
        return { success: false, message: 'Supervisor dashboard not available in demo mode' };
      }

      // Get total users count - use service role to bypass RLS
      const { count: totalUsers } = await supabaseAdmin
        .from('users')
        .select('*', { count: 'exact', head: true });

      // Mock data for now
      const dashboardData: SupervisorDashboard = {
        totalUsers: totalUsers || 0,
        totalSurveys: 0,
        totalAttempts: 0,
        averageScore: 0,
        passRate: 0,
        recentActivity: [],
        performanceByRole: [],
        performanceBySurvey: [],
        monthlyTrends: [],
        totalEnumerators: 0,
        teamPerformance: [],
        enumeratorStatus: [],
        upcomingDeadlines: []
      };

      return { success: true, message: 'Supervisor dashboard data fetched successfully', data: dashboardData };
    } catch (error) {
      return this.handleError(error);
    }
  }
}

class RODashboardApi extends BaseApi {
  async getDashboardData(dateFilter: string): Promise<ApiResponse<RODashboard>> {
    try {
      if (isDemoMode) {
        return { success: false, message: 'RO dashboard not available in demo mode' };
      }

      // Mock data for now
      const dashboardData: RODashboard = {
        totalUsers: 0,
        totalSurveys: 0,
        totalAttempts: 0,
        averageScore: 0,
        passRate: 0,
        recentActivity: [],
        performanceByRole: [],
        performanceBySurvey: [],
        monthlyTrends: [],
        totalDistricts: 0,
        totalSupervisors: 0,
        districtPerformance: [],
        supervisorPerformance: [],
        enumeratorDistribution: []
      };

      return { success: true, message: 'RO dashboard data fetched successfully', data: dashboardData };
    } catch (error) {
      return this.handleError(error);
    }
  }
}

class ZODashboardApi extends BaseApi {
  async getDashboardData(dateFilter: string): Promise<ApiResponse<ZODashboard>> {
    try {
      if (isDemoMode) {
        return { success: false, message: 'ZO dashboard not available in demo mode' };
      }

      // Mock data for now
      const dashboardData: ZODashboard = {
        totalUsers: 0,
        totalSurveys: 0,
        totalAttempts: 0,
        averageScore: 0,
        passRate: 0,
        recentActivity: [],
        performanceByRole: [],
        performanceBySurvey: [],
        monthlyTrends: [],
        totalZones: 0,
        totalRegions: 0,
        zonePerformance: [],
        regionalBreakdown: [],
        topPerformingRegions: [],
        lowPerformingRegions: []
      };

      return { success: true, message: 'ZO dashboard data fetched successfully', data: dashboardData };
    } catch (error) {
      return this.handleError(error);
    }
  }
}

// Results and Analytics API
class ResultApi extends BaseApi {
  async getResults(filters?: AnalyticsFilter): Promise<ApiResponse<TestResult[]>> {
    try {
      if (!supabase) {
        return { success: false, message: 'Database not configured', data: [] };
      }

      // Fetch test results with proper joins
      const { data: results, error } = await supabase
        .from('test_results')
        .select(`
          *,
          user:users(
            id,
            name,
            email,
            role:roles(
              id,
              name,
              level
            )
          ),
          survey:surveys(
            id,
            title,
            max_attempts
          )
        `)
        .order('completed_at', { ascending: false });

      if (error) {
        return { success: false, message: error.message, data: [] };
      }

      if (!results || results.length === 0) {
        return { success: true, data: [], message: 'No test results found' };
      }

      // Get unique user IDs and survey IDs
      const userIds = [...new Set(results.map(r => r.user_id))];
      const surveyIds = [...new Set(results.map(r => r.survey_id))];

      // Fetch users data
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, name, email, role_id, roles(name)')
        .in('id', userIds);

      if (userError) {
        console.error('Error fetching users:', userError);
      }

      // Fetch surveys data
      const { data: surveyData, error: surveyError } = await supabase
        .from('surveys')
        .select('id, title, max_attempts')
        .in('id', surveyIds);

      if (surveyError) {
        console.error('Error fetching surveys:', surveyError);
      }

      // Create lookup maps
      const userMap = new Map(userData?.map(u => [u.id, u]) || []);
      const surveyMap = new Map(surveyData?.map(s => [s.id, s]) || []);

      // Transform the data
      const transformedResults = results.map(result => {
        const user = userMap.get(result.user_id);
        const survey = surveyMap.get(result.survey_id);

        return {
          id: result.id,
          userId: result.user_id,
          user: user ? {
            id: user.id,
            name: user.name,
            email: user.email,
            role: {
              name: user.roles?.name || 'Unknown Role'
            }
          } : {
            id: result.user_id,
            name: 'Unknown User',
            email: 'unknown@example.com',
            role: { name: 'Unknown Role' }
          },
          surveyId: result.survey_id,
          survey: survey ? {
            id: survey.id,
            title: survey.title,
            maxAttempts: survey.max_attempts
          } : {
            id: result.survey_id,
            title: 'Unknown Survey',
            maxAttempts: 3
          },
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
          sectionScores: [] // Will be populated separately if needed
        };
      });

      return { success: true, data: transformedResults, message: 'Results fetched successfully' };
    } catch (error) {
      console.error('Error fetching results:', error);
      return { success: false, message: 'Failed to fetch results', data: [] };
    }
  }

  async getAnalytics(filters?: AnalyticsFilter): Promise<ApiResponse<AnalyticsData>> {
    try {
      if (!supabase) {
        return { success: false, message: 'Database not configured', data: {} as AnalyticsData };
      }

      // Get overview statistics
      const { data: resultsData, error: resultsError } = await supabase
        .from('test_results')
        .select('*');

      if (resultsError) {
        console.error('Error fetching analytics:', resultsError);
        return { success: false, message: resultsError.message, data: {} as AnalyticsData };
      }

      const totalAttempts = resultsData?.length || 0;
      const passedAttempts = resultsData?.filter(r => r.is_passed).length || 0;
      const passRate = totalAttempts > 0 ? (passedAttempts / totalAttempts) * 100 : 0;
      const averageScore = totalAttempts > 0 
        ? resultsData!.reduce((sum, r) => sum + r.score, 0) / totalAttempts 
        : 0;
      const averageTime = totalAttempts > 0 
        ? resultsData!.reduce((sum, r) => sum + (r.time_spent / 60), 0) / totalAttempts 
        : 0;

      // Get performance by role
      const { data: rolePerformance, error: roleError } = await supabase
        .from('test_results')
        .select(`
          is_passed,
          user:users(
            role:roles(name)
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
            if (result.is_passed) acc[roleName].passed++;
            return acc;
          }, {})
        ).map(([name, stats]: [string, any]) => ({
          name,
          value: stats.passed,
          total: stats.total,
          percentage: stats.total > 0 ? (stats.passed / stats.total) * 100 : 0
        })) : [];

      // Get performance by survey
      const { data: surveyPerformance, error: surveyError } = await supabase
        .from('test_results')
        .select(`
          is_passed,
          survey:surveys(title)
        `);

      const performanceBySurvey = surveyPerformance ? 
        Object.entries(
          surveyPerformance.reduce((acc: any, result: any) => {
            const surveyTitle = result.survey?.title || 'Unknown Survey';
            if (!acc[surveyTitle]) {
              acc[surveyTitle] = { total: 0, passed: 0 };
            }
            acc[surveyTitle].total++;
            if (result.is_passed) acc[surveyTitle].passed++;
            return acc;
          }, {})
        ).map(([name, stats]: [string, any]) => ({
          name,
          value: stats.passed,
          total: stats.total,
          percentage: stats.total > 0 ? (stats.passed / stats.total) * 100 : 0
        })) : [];

      // Get top and low performers
      const { data: userPerformance, error: userError } = await supabase
        .from('test_results')
        .select(`
          score,
          is_passed,
          user:users(id, name)
        `);

      const userStats = userPerformance ? 
        Object.entries(
          userPerformance.reduce((acc: any, result: any) => {
            const userId = result.user?.id;
            const userName = result.user?.name || 'Unknown User';
            if (!userId) return acc;
            
            if (!acc[userId]) {
              acc[userId] = { 
                userName, 
                totalAttempts: 0, 
                totalScore: 0, 
                passed: 0 
              };
            }
            acc[userId].totalAttempts++;
            acc[userId].totalScore += result.score;
            if (result.is_passed) acc[userId].passed++;
            return acc;
          }, {})
        ).map(([userId, stats]: [string, any]) => ({
          userId,
          userName: stats.userName,
          averageScore: stats.totalAttempts > 0 ? stats.totalScore / stats.totalAttempts : 0,
          totalAttempts: stats.totalAttempts,
          passRate: stats.totalAttempts > 0 ? (stats.passed / stats.totalAttempts) * 100 : 0
        })) : [];

      const topPerformers = userStats
        .sort((a, b) => b.averageScore - a.averageScore)
        .slice(0, 5);

      const lowPerformers = userStats
        .sort((a, b) => a.averageScore - b.averageScore)
        .slice(0, 5);

      const analytics: AnalyticsData = {
        overview: {
          totalAttempts,
          passRate,
          averageScore,
          averageTime
        },
        performanceByRole,
        performanceBySurvey,
        performanceByJurisdiction: [], // Can be implemented later if needed
        timeSeriesData: [], // Can be implemented later if needed
        topPerformers,
        lowPerformers
      };

      return { success: true, data: analytics, message: 'Analytics fetched successfully' };
    } catch (error) {
      console.error('Error fetching analytics:', error);
      return { success: false, message: 'Failed to fetch analytics', data: {} as AnalyticsData };
    }
  }

  async exportResults(filters: AnalyticsFilter): Promise<ApiResponse<Blob>> {
    try {
      if (isDemoMode) {
        return { success: false, message: 'Export not available in demo mode' };
      }

      // Mock CSV export
      const csvContent = 'Name,Email,Survey,Score,Status,Date\n';
      const blob = new Blob([csvContent], { type: 'text/csv' });

      return { success: true, message: 'Results exported successfully', data: blob };
    } catch (error) {
      return this.handleError(error);
    }
  }
}

// Certificate API
class CertificateApi extends BaseApi {
  async getCertificates(): Promise<ApiResponse<Certificate[]>> {
    try {
      if (isDemoMode) {
        return { success: false, message: 'Certificates not available in demo mode' };
      }

      const { data, error } = await supabase!
        .from('certificates')
        .select(`
          *,
          user:users(name, email, role:roles(name)),
          survey:surveys(title)
        `)
        .order('issued_at', { ascending: false });

      if (error) throw error;

      const certificates: Certificate[] = (data || []).map((certData: any) => ({
        id: certData.id,
        userId: certData.user_id,
        user: {
          id: certData.user_id,
          name: certData.user.name,
          email: certData.user.email,
          role: certData.user.role
        } as User,
        surveyId: certData.survey_id,
        survey: {
          id: certData.survey_id,
          title: certData.survey.title
        } as Survey,
        resultId: certData.result_id,
        certificateNumber: certData.certificate_number,
        issuedAt: new Date(certData.issued_at),
        validUntil: certData.valid_until ? new Date(certData.valid_until) : undefined,
        downloadCount: certData.download_count,
        status: certData.certificate_status
      }));

      return { success: true, message: 'Certificates fetched successfully', data: certificates };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async downloadCertificate(certificateId: string): Promise<ApiResponse<Blob>> {
    try {
      if (isDemoMode) {
        return { success: false, message: 'Certificate download not available in demo mode' };
      }

      // Mock PDF generation
      const pdfContent = `Certificate ${certificateId}`;
      const blob = new Blob([pdfContent], { type: 'application/pdf' });

      // Update download count
      await supabase!
        .from('certificates')
        .update({ download_count: supabase!.raw('download_count + 1') })
        .eq('id', certificateId);

      return { success: true, message: 'Certificate downloaded successfully', data: blob };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async revokeCertificate(certificateId: string): Promise<ApiResponse<void>> {
    try {
      if (isDemoMode) {
        return { success: false, message: 'Certificate revocation not available in demo mode' };
      }

      const { error } = await supabase!
        .from('certificates')
        .update({ certificate_status: 'revoked' })
        .eq('id', certificateId);

      if (error) throw error;

      return { success: true, message: 'Certificate revoked successfully' };
    } catch (error) {
      return this.handleError(error);
    }
  }
}

// Settings API
class SettingsApi extends BaseApi {
  async getSettings(): Promise<ApiResponse<SystemSettings[]>> {
    try {
      if (isDemoMode) {
        return { success: false, message: 'Settings not available in demo mode' };
      }

      const { data, error } = await supabase!
        .from('system_settings')
        .select('*')
        .order('category', { ascending: true });

      if (error) throw error;

      const settings: SystemSettings[] = (data || []).map((settingData: any) => ({
        id: settingData.id,
        category: settingData.category,
        key: settingData.setting_key,
        value: settingData.setting_value,
        description: settingData.description,
        type: settingData.setting_type as any,
        isEditable: settingData.is_editable,
        options: settingData.options,
        updatedAt: new Date(settingData.updated_at),
        updatedBy: settingData.updated_by
      }));

      return { success: true, message: 'Settings fetched successfully', data: settings };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async updateSetting(id: string, value: string): Promise<ApiResponse<void>> {
    try {
      if (isDemoMode) {
        return { success: false, message: 'Setting updates not available in demo mode' };
      }

      const { error } = await supabase!
        .from('system_settings')
        .update({
          setting_value: value,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      return { success: true, message: 'Setting updated successfully' };
    } catch (error) {
      return this.handleError(error);
    }
  }
}

// Enumerator Status API
class EnumeratorApi extends BaseApi {
  async getEnumeratorStatus(): Promise<ApiResponse<EnumeratorStatus[]>> {
    try {
      if (isDemoMode) {
        return { success: false, message: 'Enumerator status not available in demo mode' };
      }

      // Mock data for now
      return { success: true, message: 'Enumerator status fetched successfully', data: [] };
    } catch (error) {
      return this.handleError(error);
    }
  }
}

// Survey Section API
export const sectionApi = {
  async getSections(surveyId: string): Promise<ApiResponse<Section[]>> {
    try {
      if (!supabase) {
        return { success: false, message: 'Database not configured', data: [] };
      }

      const { data, error } = await supabase
        .from('survey_sections')
        .select('*')
        .eq('survey_id', surveyId)
        .order('section_order');

      if (error) throw error;

      return { success: true, data: data || [], message: 'Sections fetched successfully' };
    } catch (error) {
      console.error('Failed to fetch sections:', error);
      return { success: false, message: 'Failed to fetch sections', data: [] };
    }
  },

  async createSection(sectionData: {
    surveyId: string;
    title: string;
    description: string;
    questionsCount: number;
    sectionOrder: number;
  }): Promise<ApiResponse<Section>> {
    try {
      if (!supabase) {
        return { success: false, message: 'Database not configured' };
      }

      const { data, error } = await supabase
        .from('survey_sections')
        .insert({
          survey_id: sectionData.surveyId,
          title: sectionData.title,
          description: sectionData.description,
          questions_count: sectionData.questionsCount,
          section_order: sectionData.sectionOrder
        })
        .select()
        .single();

      if (error) throw error;

      return { success: true, data, message: 'Section created successfully' };
    } catch (error) {
      console.error('Failed to create section:', error);
      return { success: false, message: 'Failed to create section' };
    }
  },

  async updateSection(sectionId: string, sectionData: {
    title: string;
    description: string;
    questionsCount: number;
    sectionOrder: number;
  }): Promise<ApiResponse<Section>> {
    try {
      if (!supabase) {
        return { success: false, message: 'Database not configured' };
      }

      const { data, error } = await supabase
        .from('survey_sections')
        .update({
          title: sectionData.title,
          description: sectionData.description,
          questions_count: sectionData.questionsCount,
          section_order: sectionData.sectionOrder,
          updated_at: new Date().toISOString()
        })
        .eq('id', sectionId)
        .select()
        .single();

      if (error) throw error;

      return { success: true, data, message: 'Section updated successfully' };
    } catch (error) {
      console.error('Failed to update section:', error);
      return { success: false, message: 'Failed to update section' };
    }
  },

  async deleteSection(sectionId: string): Promise<ApiResponse<void>> {
    try {
      if (!supabase) {
        return { success: false, message: 'Database not configured' };
      }

      const { error } = await supabase
        .from('survey_sections')
        .delete()
        .eq('id', sectionId);

      if (error) throw error;

      return { success: true, message: 'Section deleted successfully' };
    } catch (error) {
      console.error('Failed to delete section:', error);
      return { success: false, message: 'Failed to delete section' };
    }
  }
};

// Export API instances
export const authApi = new AuthApi();
export const userApi = new UserApi();
export const roleApi = new RoleApi();
export const surveyApi = new SurveyApi();
export const questionApi = new QuestionApi();
export const testApi = new TestApi();
export const dashboardApi = new DashboardApi();
export const enumeratorDashboardApi = new EnumeratorDashboardApi();
export const supervisorDashboardApi = new SupervisorDashboardApi();
export const roDashboardApi = new RODashboardApi();
export const zoDashboardApi = new ZODashboardApi();
export const resultApi = new ResultApi();
export const certificateApi = new CertificateApi();
export const settingsApi = new SettingsApi();
export const enumeratorApi = new EnumeratorApi();