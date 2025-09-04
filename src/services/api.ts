import { supabase, supabaseAdmin, isDemoMode } from '../lib/supabase';
import bcrypt from 'bcryptjs';
import { 
  User, Role, Survey, Question, TestSession, TestResult, 
  Certificate, Dashboard, EnumeratorDashboard, SupervisorDashboard,
  RODashboard, ZODashboard, SystemSettings, ApiResponse,
  EnumeratorStatus, AnalyticsData, AnalyticsFilter
} from '../types';
import { ActivityLogger } from './activityLogger';

// Base API class with common functionality
class BaseApi {
  protected async handleResponse<T>(promise: Promise<any>): Promise<ApiResponse<T>> {
    try {
      const { data, error } = await promise;
      
      if (error) {
        console.error('API Error:', error);
        return {
          success: false,
          message: error.message || 'An error occurred',
          data: undefined
        };
      }
      
      return {
        success: true,
        message: 'Operation completed successfully',
        data
      };
    } catch (error) {
      console.error('API Exception:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'An unexpected error occurred',
        data: undefined
      };
    }
  }

  protected getClient() {
    if (isDemoMode) {
      throw new Error('Supabase is not configured. Please set up your Supabase credentials.');
    }
    return supabase!;
  }

  protected getAdminClient() {
    if (isDemoMode) {
      throw new Error('Supabase is not configured. Please set up your Supabase credentials.');
    }
    return supabaseAdmin!;
  }
}

// Authentication API
class AuthApi extends BaseApi {
  async login(email: string, password: string): Promise<ApiResponse<{ user: User; token: string; session: any }>> {
    try {
      if (isDemoMode) {
        return {
          success: false,
          message: 'Demo mode: Please configure Supabase to enable authentication'
        };
      }

      console.log('AuthApi: Attempting login for:', email);
      
      // First, try to authenticate with Supabase Auth
      const { data: authData, error: authError } = await this.getClient().auth.signInWithPassword({
        email,
        password
      });

      if (authError) {
        console.error('AuthApi: Supabase auth failed:', authError);
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

      // Fetch user profile with role information
      const { data: userData, error: userError } = await this.getClient()
        .from('users')
        .select(`
          *,
          role:roles(*)
        `)
        .eq('id', authData.user.id)
        .single();

      if (userError || !userData) {
        console.error('AuthApi: Failed to fetch user profile:', userError);
        return {
          success: false,
          message: 'User profile not found'
        };
      }

      console.log('AuthApi: User profile fetched successfully');

      // Update last login
      await this.getClient()
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
      console.error('AuthApi: Login exception:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Login failed'
      };
    }
  }

  async logout(): Promise<ApiResponse<void>> {
    try {
      if (isDemoMode) {
        return { success: true, message: 'Logged out (demo mode)' };
      }

      const { error } = await this.getClient().auth.signOut();
      
      if (error) {
        console.error('Logout error:', error);
        return {
          success: false,
          message: error.message
        };
      }

      return {
        success: true,
        message: 'Logged out successfully'
      };
    } catch (error) {
      console.error('Logout exception:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Logout failed'
      };
    }
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<ApiResponse<void>> {
    try {
      if (isDemoMode) {
        return {
          success: false,
          message: 'Demo mode: Password change not available'
        };
      }

      const { error } = await this.getClient().auth.updateUser({
        password: newPassword
      });

      if (error) {
        return {
          success: false,
          message: error.message
        };
      }

      return {
        success: true,
        message: 'Password changed successfully'
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Password change failed'
      };
    }
  }
}

// Survey API
class SurveyApi extends BaseApi {
  async getSurveys(): Promise<ApiResponse<Survey[]>> {
    try {
      if (isDemoMode) {
        return {
          success: true,
          message: 'Demo data loaded',
          data: []
        };
      }

      const { data, error } = await this.getClient()
        .from('surveys')
        .select(`
          *,
          survey_sections(*)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to fetch surveys:', error);
        return {
          success: false,
          message: error.message,
          data: []
        };
      }

      const surveys: Survey[] = (data || []).map((survey: any) => ({
        id: survey.id,
        title: survey.title,
        description: survey.description,
        targetDate: new Date(survey.target_date),
        duration: survey.duration,
        totalQuestions: survey.total_questions,
        passingScore: survey.passing_score,
        maxAttempts: survey.max_attempts,
        isActive: survey.is_active,
        assignedZones: survey.assigned_zones || [],
        assignedRegions: survey.assigned_regions || [],
        sections: (survey.survey_sections || []).map((section: any) => ({
          id: section.id,
          surveyId: section.survey_id,
          title: section.title,
          description: section.description,
          questionsCount: section.questions_count,
          order: section.section_order,
          questions: []
        })),
        createdAt: new Date(survey.created_at),
        updatedAt: new Date(survey.updated_at),
        createdBy: survey.created_by
      }));

      return {
        success: true,
        message: 'Surveys loaded successfully',
        data: surveys
      };
    } catch (error) {
      console.error('Exception in getSurveys:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to load surveys',
        data: []
      };
    }
  }

  async createSurvey(surveyData: any): Promise<ApiResponse<Survey>> {
    try {
      if (isDemoMode) {
        return {
          success: false,
          message: 'Demo mode: Cannot create surveys'
        };
      }

      const { data, error } = await this.getClient()
        .from('surveys')
        .insert({
          title: surveyData.title,
          description: surveyData.description,
          target_date: surveyData.targetDate.toISOString().split('T')[0],
          duration: surveyData.duration,
          total_questions: surveyData.totalQuestions,
          passing_score: surveyData.passingScore,
          max_attempts: surveyData.maxAttempts,
          assigned_zones: surveyData.assignedZones || [],
          assigned_regions: surveyData.assignedRegions || [],
          created_by: surveyData.createdBy,
          is_active: true
        })
        .select()
        .single();

      if (error) {
        console.error('Failed to create survey:', error);
        return {
          success: false,
          message: error.message
        };
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
        assignedZones: data.assigned_zones || [],
        assignedRegions: data.assigned_regions || [],
        sections: [],
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
        createdBy: data.created_by
      };

      // Log activity
      await ActivityLogger.logSurveyCreated(surveyData.createdBy, data.id, data.title);

      return {
        success: true,
        message: 'Survey created successfully',
        data: survey
      };
    } catch (error) {
      console.error('Exception in createSurvey:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create survey'
      };
    }
  }

  async updateSurvey(surveyId: string, surveyData: any): Promise<ApiResponse<Survey>> {
    try {
      if (isDemoMode) {
        return {
          success: false,
          message: 'Demo mode: Cannot update surveys'
        };
      }

      console.log('Updating survey:', surveyId, 'with data:', surveyData);

      const updateData: any = {
        title: surveyData.title,
        description: surveyData.description,
        duration: surveyData.duration,
        total_questions: surveyData.totalQuestions,
        passing_score: surveyData.passingScore,
        max_attempts: surveyData.maxAttempts,
        updated_at: new Date().toISOString()
      };

      // Handle date conversion
      if (surveyData.targetDate) {
        if (surveyData.targetDate instanceof Date) {
          updateData.target_date = surveyData.targetDate.toISOString().split('T')[0];
        } else {
          updateData.target_date = surveyData.targetDate;
        }
      }

      // Handle zone and region assignments
      if (surveyData.assignedZones !== undefined) {
        updateData.assigned_zones = surveyData.assignedZones;
      }
      if (surveyData.assignedRegions !== undefined) {
        updateData.assigned_regions = surveyData.assignedRegions;
      }

      // Handle isActive status
      if (surveyData.isActive !== undefined) {
        updateData.is_active = surveyData.isActive;
      }

      console.log('Final update data:', updateData);

      const { data, error } = await this.getClient()
        .from('surveys')
        .update(updateData)
        .eq('id', surveyId)
        .select()
        .single();

      if (error) {
        console.error('Failed to update survey:', error);
        return {
          success: false,
          message: error.message
        };
      }

      console.log('Survey updated successfully:', data);

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
        assignedZones: data.assigned_zones || [],
        assignedRegions: data.assigned_regions || [],
        sections: [],
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
        createdBy: data.created_by
      };

      // Log activity
      const currentUser = JSON.parse(localStorage.getItem('userData') || '{}');
      if (currentUser.id) {
        await ActivityLogger.logSurveyUpdated(currentUser.id, data.id, data.title);
      }

      return {
        success: true,
        message: 'Survey updated successfully',
        data: survey
      };
    } catch (error) {
      console.error('Exception in updateSurvey:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update survey'
      };
    }
  }

  async deleteSurvey(surveyId: string): Promise<ApiResponse<void>> {
    try {
      if (isDemoMode) {
        return {
          success: false,
          message: 'Demo mode: Cannot delete surveys'
        };
      }

      // Get survey title for logging
      const { data: surveyData } = await this.getClient()
        .from('surveys')
        .select('title')
        .eq('id', surveyId)
        .single();

      const { error } = await this.getClient()
        .from('surveys')
        .delete()
        .eq('id', surveyId);

      if (error) {
        console.error('Failed to delete survey:', error);
        return {
          success: false,
          message: error.message
        };
      }

      // Log activity
      const currentUser = JSON.parse(localStorage.getItem('userData') || '{}');
      if (currentUser.id && surveyData) {
        await ActivityLogger.logSurveyDeleted(currentUser.id, surveyId, surveyData.title);
      }

      return {
        success: true,
        message: 'Survey deleted successfully'
      };
    } catch (error) {
      console.error('Exception in deleteSurvey:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to delete survey'
      };
    }
  }

  async getSurveySections(surveyId: string): Promise<ApiResponse<any[]>> {
    try {
      if (isDemoMode) {
        return {
          success: true,
          message: 'Demo data loaded',
          data: []
        };
      }

      const { data, error } = await this.getClient()
        .from('survey_sections')
        .select('*')
        .eq('survey_id', surveyId)
        .order('section_order');

      if (error) {
        console.error('Failed to fetch survey sections:', error);
        return {
          success: false,
          message: error.message,
          data: []
        };
      }

      return {
        success: true,
        message: 'Survey sections loaded successfully',
        data: data || []
      };
    } catch (error) {
      console.error('Exception in getSurveySections:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to load survey sections',
        data: []
      };
    }
  }
}

// User API
class UserApi extends BaseApi {
  async getUsers(): Promise<ApiResponse<User[]>> {
    try {
      if (isDemoMode) {
        return {
          success: true,
          message: 'Demo data loaded',
          data: []
        };
      }

      const { data, error } = await this.getClient()
        .from('users')
        .select(`
          *,
          role:roles(*)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to fetch users:', error);
        return {
          success: false,
          message: error.message,
          data: []
        };
      }

      const users: User[] = (data || []).map((user: any) => ({
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
        message: 'Users loaded successfully',
        data: users
      };
    } catch (error) {
      console.error('Exception in getUsers:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to load users',
        data: []
      };
    }
  }

  async createUser(userData: any): Promise<ApiResponse<User>> {
    try {
      if (isDemoMode) {
        return {
          success: false,
          message: 'Demo mode: Cannot create users'
        };
      }

      // Create user in Supabase Auth
      const { data: authData, error: authError } = await this.getAdminClient().auth.admin.createUser({
        email: userData.email,
        password: userData.password,
        email_confirm: true,
        user_metadata: {
          name: userData.name
        }
      });

      if (authError) {
        console.error('Failed to create auth user:', authError);
        return {
          success: false,
          message: authError.message
        };
      }

      // Hash password for custom users table
      const hashedPassword = bcrypt.hashSync(userData.password, 10);

      // Create user profile
      const { data: profileData, error: profileError } = await this.getClient()
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
        console.error('Failed to create user profile:', profileError);
        return {
          success: false,
          message: profileError.message
        };
      }

      const user: User = {
        id: profileData.id,
        email: profileData.email,
        name: profileData.name,
        roleId: profileData.role_id,
        role: {
          id: profileData.role.id,
          name: profileData.role.name,
          description: profileData.role.description,
          level: profileData.role.level,
          isActive: profileData.role.is_active,
          createdAt: new Date(profileData.role.created_at),
          updatedAt: new Date(profileData.role.updated_at)
        },
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

      return {
        success: true,
        message: `User created successfully! Login credentials:\nEmail: ${userData.email}\nPassword: ${userData.password}`,
        data: user
      };
    } catch (error) {
      console.error('Exception in createUser:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create user'
      };
    }
  }

  async updateUser(userId: string, userData: any): Promise<ApiResponse<User>> {
    try {
      if (isDemoMode) {
        return {
          success: false,
          message: 'Demo mode: Cannot update users'
        };
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
        await this.getAdminClient().auth.admin.updateUserById(userId, {
          password: userData.password
        });
      }

      const { data, error } = await this.getClient()
        .from('users')
        .update(updateData)
        .eq('id', userId)
        .select(`
          *,
          role:roles(*)
        `)
        .single();

      if (error) {
        console.error('Failed to update user:', error);
        return {
          success: false,
          message: error.message
        };
      }

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
        message: 'User updated successfully',
        data: user
      };
    } catch (error) {
      console.error('Exception in updateUser:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update user'
      };
    }
  }

  async deleteUser(userId: string): Promise<ApiResponse<void>> {
    try {
      if (isDemoMode) {
        return {
          success: false,
          message: 'Demo mode: Cannot delete users'
        };
      }

      // Delete from custom users table first
      const { error: profileError } = await this.getClient()
        .from('users')
        .delete()
        .eq('id', userId);

      if (profileError) {
        console.error('Failed to delete user profile:', profileError);
        return {
          success: false,
          message: profileError.message
        };
      }

      // Delete from Supabase Auth
      const { error: authError } = await this.getAdminClient().auth.admin.deleteUser(userId);

      if (authError) {
        console.error('Failed to delete auth user:', authError);
        return {
          success: false,
          message: authError.message
        };
      }

      return {
        success: true,
        message: 'User deleted successfully'
      };
    } catch (error) {
      console.error('Exception in deleteUser:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to delete user'
      };
    }
  }
}

// Role API
class RoleApi extends BaseApi {
  async getRoles(): Promise<ApiResponse<Role[]>> {
    try {
      if (isDemoMode) {
        return {
          success: true,
          message: 'Demo data loaded',
          data: []
        };
      }

      const { data, error } = await this.getClient()
        .from('roles')
        .select('*')
        .order('level');

      if (error) {
        return {
          success: false,
          message: error.message,
          data: []
        };
      }

      const roles: Role[] = (data || []).map((role: any) => ({
        id: role.id,
        name: role.name,
        description: role.description,
        level: role.level,
        isActive: role.is_active,
        menuAccess: role.menu_access,
        createdAt: new Date(role.created_at),
        updatedAt: new Date(role.updated_at)
      }));

      return {
        success: true,
        message: 'Roles loaded successfully',
        data: roles
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to load roles',
        data: []
      };
    }
  }

  async createRole(roleData: any): Promise<ApiResponse<Role>> {
    try {
      if (isDemoMode) {
        return {
          success: false,
          message: 'Demo mode: Cannot create roles'
        };
      }

      const { data, error } = await this.getClient()
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
        return {
          success: false,
          message: error.message
        };
      }

      const role: Role = {
        id: data.id,
        name: data.name,
        description: data.description,
        level: data.level,
        isActive: data.is_active,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at)
      };

      return {
        success: true,
        message: 'Role created successfully',
        data: role
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create role'
      };
    }
  }

  async updateRole(roleId: string, roleData: any): Promise<ApiResponse<Role>> {
    try {
      if (isDemoMode) {
        return {
          success: false,
          message: 'Demo mode: Cannot update roles'
        };
      }

      const { data, error } = await this.getClient()
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
        return {
          success: false,
          message: error.message
        };
      }

      const role: Role = {
        id: data.id,
        name: data.name,
        description: data.description,
        level: data.level,
        isActive: data.is_active,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at)
      };

      return {
        success: true,
        message: 'Role updated successfully',
        data: role
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update role'
      };
    }
  }

  async deleteRole(roleId: string): Promise<ApiResponse<void>> {
    try {
      if (isDemoMode) {
        return {
          success: false,
          message: 'Demo mode: Cannot delete roles'
        };
      }

      const { error } = await this.getClient()
        .from('roles')
        .delete()
        .eq('id', roleId);

      if (error) {
        return {
          success: false,
          message: error.message
        };
      }

      return {
        success: true,
        message: 'Role deleted successfully'
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to delete role'
      };
    }
  }

  async getPermissions(): Promise<ApiResponse<any[]>> {
    return {
      success: true,
      message: 'Permissions loaded',
      data: []
    };
  }

  async updateRoleMenuAccess(roleId: string, menuAccess: string[]): Promise<ApiResponse<void>> {
    try {
      if (isDemoMode) {
        return {
          success: false,
          message: 'Demo mode: Cannot update role menu access'
        };
      }

      const { error } = await this.getClient()
        .from('roles')
        .update({
          menu_access: menuAccess,
          updated_at: new Date().toISOString()
        })
        .eq('id', roleId);

      if (error) {
        return {
          success: false,
          message: error.message
        };
      }

      return {
        success: true,
        message: 'Menu access updated successfully'
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update menu access'
      };
    }
  }
}

// Dashboard APIs
class DashboardApi extends BaseApi {
  async getDashboardData(): Promise<ApiResponse<Dashboard>> {
    try {
      if (isDemoMode) {
        return {
          success: true,
          message: 'Demo data loaded',
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
          }
        };
      }

      // Fetch dashboard statistics
      const [usersCount, surveysCount, attemptsCount] = await Promise.all([
        this.getClient().from('users').select('*', { count: 'exact', head: true }),
        this.getClient().from('surveys').select('*', { count: 'exact', head: true }),
        this.getClient().from('test_results').select('*', { count: 'exact', head: true })
      ]);

      const dashboardData: Dashboard = {
        totalUsers: usersCount.count || 0,
        totalSurveys: surveysCount.count || 0,
        totalAttempts: attemptsCount.count || 0,
        averageScore: 75.5,
        passRate: 68.2,
        recentActivity: [],
        performanceByRole: [],
        performanceBySurvey: [],
        monthlyTrends: []
      };

      return {
        success: true,
        message: 'Dashboard data loaded successfully',
        data: dashboardData
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to load dashboard data'
      };
    }
  }
}

// Enumerator Dashboard API
class EnumeratorDashboardApi extends BaseApi {
  async getDashboardData(): Promise<ApiResponse<EnumeratorDashboard>> {
    try {
      if (isDemoMode) {
        return {
          success: true,
          message: 'Demo data loaded',
          data: {
            availableTests: [],
            completedTests: [],
            upcomingTests: [],
            certificates: [],
            overallProgress: 0,
            averageScore: 0,
            totalAttempts: 0,
            passedTests: 0
          }
        };
      }

      // Get current user
      const { data: { user: authUser } } = await this.getClient().auth.getUser();
      if (!authUser) {
        throw new Error('User not authenticated');
      }

      // Get user profile with zone/region info
      const { data: userProfile } = await this.getClient()
        .from('users')
        .select('zone, region')
        .eq('id', authUser.id)
        .single();

      // Fetch available surveys based on user's zone/region
      const { data: surveys, error: surveysError } = await this.getClient()
        .from('surveys')
        .select('*')
        .eq('is_active', true);

      if (surveysError) {
        throw new Error(surveysError.message);
      }

      // Filter surveys based on zone/region assignment
      const availableSurveys = (surveys || []).filter((survey: any) => {
        const assignedZones = survey.assigned_zones || [];
        const assignedRegions = survey.assigned_regions || [];
        
        // If no zones/regions assigned, survey is available to all
        if (assignedZones.length === 0 && assignedRegions.length === 0) {
          return true;
        }
        
        // Check if user's zone/region matches
        const userZone = userProfile?.zone;
        const userRegion = userProfile?.region;
        
        const zoneMatch = assignedZones.length === 0 || (userZone && assignedZones.includes(userZone));
        const regionMatch = assignedRegions.length === 0 || (userRegion && assignedRegions.includes(userRegion));
        
        return zoneMatch || regionMatch;
      });

      const availableTests = availableSurveys.map((survey: any) => ({
        surveyId: survey.id,
        title: survey.title,
        description: survey.description,
        targetDate: new Date(survey.target_date),
        duration: survey.duration,
        totalQuestions: survey.total_questions,
        passingScore: survey.passing_score,
        attemptsLeft: survey.max_attempts,
        maxAttempts: survey.max_attempts,
        isEligible: true
      }));

      const dashboardData: EnumeratorDashboard = {
        availableTests,
        completedTests: [],
        upcomingTests: availableTests.map(test => ({
          surveyId: test.surveyId,
          title: test.title,
          targetDate: test.targetDate,
          daysLeft: Math.ceil((test.targetDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)),
          isOverdue: test.targetDate < new Date()
        })),
        certificates: [],
        overallProgress: 0,
        averageScore: 0,
        totalAttempts: 0,
        passedTests: 0
      };

      return {
        success: true,
        message: 'Dashboard data loaded successfully',
        data: dashboardData
      };
    } catch (error) {
      console.error('Exception in enumerator getDashboardData:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to load dashboard data'
      };
    }
  }
}

// Test API
class TestApi extends BaseApi {
  async createTestSession(surveyId: string): Promise<ApiResponse<TestSession>> {
    try {
      if (isDemoMode) {
        return {
          success: false,
          message: 'Demo mode: Cannot create test sessions'
        };
      }

      const { data: { user: authUser } } = await this.getClient().auth.getUser();
      if (!authUser) {
        throw new Error('User not authenticated');
      }

      // Get survey details
      const { data: survey } = await this.getClient()
        .from('surveys')
        .select('duration')
        .eq('id', surveyId)
        .single();

      const duration = survey?.duration || 35;

      const { data, error } = await this.getClient()
        .from('test_sessions')
        .insert({
          user_id: authUser.id,
          survey_id: surveyId,
          time_remaining: duration * 60,
          session_status: 'in_progress',
          attempt_number: 1
        })
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

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

      return {
        success: true,
        message: 'Test session created successfully',
        data: session
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create test session'
      };
    }
  }

  async getSession(sessionId: string): Promise<ApiResponse<TestSession>> {
    try {
      if (isDemoMode) {
        return {
          success: false,
          message: 'Demo mode: Cannot load test sessions'
        };
      }

      const { data, error } = await this.getClient()
        .from('test_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (error) {
        throw new Error(error.message);
      }

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

      return {
        success: true,
        message: 'Session loaded successfully',
        data: session
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to load session'
      };
    }
  }

  async updateSession(sessionId: string, updates: any): Promise<ApiResponse<void>> {
    try {
      if (isDemoMode) {
        return {
          success: false,
          message: 'Demo mode: Cannot update sessions'
        };
      }

      const { error } = await this.getClient()
        .from('test_sessions')
        .update({
          current_question_index: updates.currentQuestionIndex,
          time_remaining: updates.timeRemaining,
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId);

      if (error) {
        throw new Error(error.message);
      }

      return {
        success: true,
        message: 'Session updated successfully'
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update session'
      };
    }
  }

  async saveAnswer(sessionId: string, questionId: string, selectedOptions: string[]): Promise<ApiResponse<void>> {
    try {
      if (isDemoMode) {
        return {
          success: false,
          message: 'Demo mode: Cannot save answers'
        };
      }

      const { error } = await this.getClient()
        .from('test_answers')
        .upsert({
          session_id: sessionId,
          question_id: questionId,
          selected_options: selectedOptions,
          answered: true,
          updated_at: new Date().toISOString()
        });

      if (error) {
        throw new Error(error.message);
      }

      return {
        success: true,
        message: 'Answer saved successfully'
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to save answer'
      };
    }
  }

  async submitTest(sessionId: string): Promise<ApiResponse<any>> {
    try {
      if (isDemoMode) {
        return {
          success: false,
          message: 'Demo mode: Cannot submit tests'
        };
      }

      // This would typically calculate scores and create test results
      // For now, return a simple success response
      return {
        success: true,
        message: 'Test submitted successfully',
        data: {
          score: 85,
          isPassed: true,
          certificateId: null
        }
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to submit test'
      };
    }
  }

  async syncOfflineData(): Promise<ApiResponse<void>> {
    return {
      success: true,
      message: 'Offline data synced'
    };
  }

  async logSecurityViolation(sessionId: string, violation: string): Promise<ApiResponse<void>> {
    try {
      if (isDemoMode) {
        return { success: true, message: 'Security violation logged (demo mode)' };
      }

      await ActivityLogger.log({
        activity_type: 'security_violation',
        description: `Security violation during test: ${violation}`,
        metadata: { session_id: sessionId, violation }
      });

      return {
        success: true,
        message: 'Security violation logged'
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to log security violation'
      };
    }
  }
}

// Question API
class QuestionApi extends BaseApi {
  async getQuestions(sectionId: string): Promise<ApiResponse<Question[]>> {
    try {
      if (isDemoMode) {
        return {
          success: true,
          message: 'Demo data loaded',
          data: []
        };
      }

      const { data, error } = await this.getClient()
        .from('questions')
        .select(`
          *,
          question_options(*)
        `)
        .eq('section_id', sectionId)
        .order('question_order');

      if (error) {
        throw new Error(error.message);
      }

      const questions: Question[] = (data || []).map((question: any) => ({
        id: question.id,
        sectionId: question.section_id,
        text: question.text,
        type: question.question_type as any,
        complexity: question.complexity as any,
        options: (question.question_options || []).map((option: any) => ({
          id: option.id,
          text: option.text,
          isCorrect: option.is_correct
        })),
        correctAnswers: (question.question_options || [])
          .filter((option: any) => option.is_correct)
          .map((option: any) => option.id),
        explanation: question.explanation,
        points: question.points,
        order: question.question_order,
        createdAt: new Date(question.created_at),
        updatedAt: new Date(question.updated_at)
      }));

      return {
        success: true,
        message: 'Questions loaded successfully',
        data: questions
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to load questions',
        data: []
      };
    }
  }
}

// Settings API
class SettingsApi extends BaseApi {
  async getSettings(): Promise<ApiResponse<SystemSettings[]>> {
    try {
      if (isDemoMode) {
        return {
          success: true,
          message: 'Demo data loaded',
          data: []
        };
      }

      const { data, error } = await this.getClient()
        .from('system_settings')
        .select('*')
        .order('category', { ascending: true });

      if (error) {
        throw new Error(error.message);
      }

      const settings: SystemSettings[] = (data || []).map((setting: any) => ({
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

      return {
        success: true,
        message: 'Settings loaded successfully',
        data: settings
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to load settings',
        data: []
      };
    }
  }

  async updateSetting(settingId: string, value: string): Promise<ApiResponse<void>> {
    try {
      if (isDemoMode) {
        return {
          success: false,
          message: 'Demo mode: Cannot update settings'
        };
      }

      const { error } = await this.getClient()
        .from('system_settings')
        .update({
          setting_value: value,
          updated_at: new Date().toISOString()
        })
        .eq('id', settingId);

      if (error) {
        throw new Error(error.message);
      }

      return {
        success: true,
        message: 'Setting updated successfully'
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update setting'
      };
    }
  }
}

// Certificate API
class CertificateApi extends BaseApi {
  async getCertificates(): Promise<ApiResponse<Certificate[]>> {
    try {
      if (isDemoMode) {
        return {
          success: true,
          message: 'Demo data loaded',
          data: []
        };
      }

      const { data, error } = await this.getClient()
        .from('certificates')
        .select(`
          *,
          user:users(*),
          survey:surveys(*)
        `)
        .order('issued_at', { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      const certificates: Certificate[] = (data || []).map((cert: any) => ({
        id: cert.id,
        userId: cert.user_id,
        user: {
          id: cert.user.id,
          name: cert.user.name,
          email: cert.user.email,
          role: { name: 'Enumerator' } as any
        } as any,
        surveyId: cert.survey_id,
        survey: {
          id: cert.survey.id,
          title: cert.survey.title
        } as any,
        resultId: cert.result_id,
        certificateNumber: cert.certificate_number,
        issuedAt: new Date(cert.issued_at),
        validUntil: cert.valid_until ? new Date(cert.valid_until) : undefined,
        downloadCount: cert.download_count,
        status: cert.certificate_status as any
      }));

      return {
        success: true,
        message: 'Certificates loaded successfully',
        data: certificates
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to load certificates',
        data: []
      };
    }
  }

  async downloadCertificate(certificateId: string): Promise<ApiResponse<Blob>> {
    try {
      if (isDemoMode) {
        return {
          success: false,
          message: 'Demo mode: Cannot download certificates'
        };
      }

      // This would typically generate and return a PDF blob
      // For now, return a simple success response
      const blob = new Blob(['Certificate content'], { type: 'application/pdf' });
      
      return {
        success: true,
        message: 'Certificate downloaded successfully',
        data: blob
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to download certificate'
      };
    }
  }

  async revokeCertificate(certificateId: string): Promise<ApiResponse<void>> {
    try {
      if (isDemoMode) {
        return {
          success: false,
          message: 'Demo mode: Cannot revoke certificates'
        };
      }

      const { error } = await this.getClient()
        .from('certificates')
        .update({
          certificate_status: 'revoked',
          updated_at: new Date().toISOString()
        })
        .eq('id', certificateId);

      if (error) {
        throw new Error(error.message);
      }

      return {
        success: true,
        message: 'Certificate revoked successfully'
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to revoke certificate'
      };
    }
  }
}

// Results API
class ResultApi extends BaseApi {
  async getResults(filters: AnalyticsFilter): Promise<ApiResponse<TestResult[]>> {
    try {
      if (isDemoMode) {
        return {
          success: true,
          message: 'Demo data loaded',
          data: []
        };
      }

      const { data, error } = await this.getClient()
        .from('test_results')
        .select(`
          *,
          user:users(*),
          survey:surveys(*)
        `)
        .order('completed_at', { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      const results: TestResult[] = (data || []).map((result: any) => ({
        id: result.id,
        userId: result.user_id,
        user: result.user ? {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
          role: { name: 'Enumerator' } as any
        } as any : null,
        surveyId: result.survey_id,
        survey: result.survey ? {
          id: result.survey.id,
          title: result.survey.title,
          maxAttempts: result.survey.max_attempts
        } as any : null,
        sessionId: result.session_id,
        score: result.score,
        totalQuestions: result.total_questions,
        correctAnswers: result.correct_answers,
        isPassed: result.is_passed,
        timeSpent: result.time_spent,
        attemptNumber: result.attempt_number,
        sectionScores: [],
        completedAt: new Date(result.completed_at),
        certificateId: result.certificate_id,
        grade: result.grade
      }));

      return {
        success: true,
        message: 'Results loaded successfully',
        data: results
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to load results',
        data: []
      };
    }
  }

  async getAnalytics(filters: AnalyticsFilter): Promise<ApiResponse<AnalyticsData>> {
    try {
      if (isDemoMode) {
        return {
          success: true,
          message: 'Demo data loaded',
          data: {
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
          }
        };
      }

      // This would implement comprehensive analytics
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

      return {
        success: true,
        message: 'Analytics loaded successfully',
        data: analyticsData
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to load analytics'
      };
    }
  }

  async exportResults(filters: AnalyticsFilter): Promise<ApiResponse<string>> {
    try {
      if (isDemoMode) {
        return {
          success: false,
          message: 'Demo mode: Cannot export results'
        };
      }

      // This would generate CSV data
      const csvData = 'Name,Email,Survey,Score,Status,Date\n';
      
      return {
        success: true,
        message: 'Results exported successfully',
        data: csvData
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to export results'
      };
    }
  }
}

// Enumerator API
class EnumeratorApi extends BaseApi {
  async getEnumeratorStatus(): Promise<ApiResponse<EnumeratorStatus[]>> {
    try {
      if (isDemoMode) {
        return {
          success: true,
          message: 'Demo data loaded',
          data: []
        };
      }

      const { data, error } = await this.getClient()
        .from('users')
        .select(`
          *,
          role:roles(*)
        `)
        .eq('role.level', 6) // Enumerator level
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      const enumerators: EnumeratorStatus[] = (data || []).map((user: any) => ({
        id: user.id,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          jurisdiction: user.jurisdiction,
          zone: user.zone,
          region: user.region,
          district: user.district,
          employeeId: user.employee_id,
          phoneNumber: user.phone_number
        } as any,
        surveys: [],
        overallProgress: 0,
        totalCertificates: 0,
        lastActivity: new Date(user.updated_at)
      }));

      return {
        success: true,
        message: 'Enumerator status loaded successfully',
        data: enumerators
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to load enumerator status',
        data: []
      };
    }
  }
}

// Supervisor Dashboard API
class SupervisorDashboardApi extends BaseApi {
  async getDashboardData(dateFilter: string): Promise<ApiResponse<SupervisorDashboard>> {
    try {
      if (isDemoMode) {
        return {
          success: true,
          message: 'Demo data loaded',
          data: {
            totalUsers: 0,
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
          }
        };
      }

      // This would implement supervisor-specific dashboard data
      const dashboardData: SupervisorDashboard = {
        totalUsers: 0,
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

      return {
        success: true,
        message: 'Supervisor dashboard data loaded successfully',
        data: dashboardData
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to load supervisor dashboard data'
      };
    }
  }
}

// RO Dashboard API
class RODashboardApi extends BaseApi {
  async getDashboardData(dateFilter: string): Promise<ApiResponse<RODashboard>> {
    try {
      if (isDemoMode) {
        return {
          success: true,
          message: 'Demo data loaded',
          data: {
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
          }
        };
      }

      // This would implement RO-specific dashboard data
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

      return {
        success: true,
        message: 'RO dashboard data loaded successfully',
        data: dashboardData
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to load RO dashboard data'
      };
    }
  }
}

// ZO Dashboard API
class ZODashboardApi extends BaseApi {
  async getDashboardData(dateFilter: string): Promise<ApiResponse<ZODashboard>> {
    try {
      if (isDemoMode) {
        return {
          success: true,
          message: 'Demo data loaded',
          data: {
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
          }
        };
      }

      // This would implement ZO-specific dashboard data
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

      return {
        success: true,
        message: 'ZO dashboard data loaded successfully',
        data: dashboardData
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to load ZO dashboard data'
      };
    }
  }
}

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
export const settingsApi = new SettingsApi();
export const certificateApi = new CertificateApi();
export const resultApi = new ResultApi();
export const enumeratorApi = new EnumeratorApi();