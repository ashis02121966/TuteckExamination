import { supabase } from '../lib/supabase';
import { supabaseAdmin } from '../lib/supabase';
import { User, Role, Survey, Section, Question, TestSession, TestResult, Certificate, SystemSettings, ApiResponse } from '../types';
import { ActivityLogger } from './activityLogger';

// Authentication Service
export class AuthService {
  static async login(email: string, password: string): Promise<ApiResponse<{ user: User; token: string }>> {
    try {
      console.log('AuthService: Attempting login for:', email);
      
      if (!supabase) {
        console.warn('AuthService: Supabase not configured - running in demo mode');
        return {
          success: false,
          message: 'Database not configured. Please set up your Supabase credentials in the .env file and restart the development server. Then click "Initialize Database" on the login page.'
        };
      }

      // Check if input is mobile number or email
      const isMobileNumber = /^[\+]?[1-9][\d]{0,15}$/.test(email.replace(/[\s\-\(\)]/g, ''));
      let loginCredentials;
      
      if (isMobileNumber) {
        // For mobile login, first get user by phone number
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('email')
          .eq('phone_number', email)
          .maybeSingle();
        
        if (userError || !userData) {
          return {
            success: false,
            message: 'Mobile number not found. Please check your mobile number or use email to login.'
          };
        }
        
        loginCredentials = {
          email: userData.email,
          password
        };
      } else {
        loginCredentials = {
          email,
          password
        };
      }

      // Use Supabase Auth for authentication
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword(loginCredentials);

      if (authError || !authData.user) {
        console.error('AuthService: Authentication failed for:', isMobileNumber ? 'mobile number' : 'email', authError);
        return {
          success: false,
          message: 'Invalid credentials. Please check your email/mobile number and password or initialize the database if this is your first time.'
        };
      }

      console.log('AuthService: Supabase auth successful, fetching user profile...');

      let userData, userError;
      
      // Try RPC function first, fallback to direct query if RPC doesn't exist
      try {
        const rpcResult = await supabase
          .rpc('get_user_with_role', { user_id: authData.user.id })
          .maybeSingle();
        userData = rpcResult.data;
        userError = rpcResult.error;
      } catch (rpcError) {
        console.log('RPC function not available, using direct query');
        // Fallback to direct query with proper error handling
        try {
          const directResult = await supabase
            .from('users')
            .select(`
              *,
              role:roles(*)
            `)
            .eq('id', authData.user.id)
            .limit(1);
          userData = directResult.data && directResult.data.length > 0 ? directResult.data : null;
          userError = directResult.error;
        } catch (directError) {
          console.log('Direct query failed, user profile not found');
          userData = null;
          userError = { message: 'User profile not found' };
        }
      }

      if (userError || !userData || userData.length === 0) {
        console.error('AuthService: User profile not found. This usually means the database needs to be initialized.', userError);
        // Sign out from Supabase auth since profile lookup failed
        await supabase.auth.signOut();
        return {
          success: false,
          message: 'User profile not found in database. Please click "Initialize Database" to create the required user accounts and tables.'
        };
      }

      const userRecord = userData;
      const finalUserRecord = Array.isArray(userRecord) ? userRecord[0] : userRecord;
      
      // Handle both RPC function format and direct query format
      const roleData = finalUserRecord.role || {
        id: finalUserRecord.role_id,
        name: finalUserRecord.role_name || 'Unknown',
        description: finalUserRecord.role_description || '',
        level: finalUserRecord.role_level || 5,
        is_active: finalUserRecord.role_is_active !== false,
        menu_access: finalUserRecord.menu_access || []
      };
      // Update last login
      await supabase
        .from('users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', finalUserRecord.id);

      const user: User = {
        id: finalUserRecord.id,
        email: finalUserRecord.email,
        name: finalUserRecord.name,
        roleId: finalUserRecord.role_id,
        role: {
          id: roleData.id,
          name: roleData.name,
          description: roleData.description,
          level: roleData.level,
          isActive: roleData.is_active,
          menuAccess: roleData.menu_access,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        isActive: finalUserRecord.is_active,
        jurisdiction: finalUserRecord.jurisdiction,
        zone: finalUserRecord.zone,
        region: finalUserRecord.region,
        district: finalUserRecord.district,
        employeeId: finalUserRecord.employee_id,
        phoneNumber: finalUserRecord.phone_number,
        parentId: finalUserRecord.parent_id,
        createdAt: new Date(finalUserRecord.created_at),
        updatedAt: new Date(finalUserRecord.updated_at)
      };

      console.log('AuthService: Login successful for user:', user.name);

      // Log successful login
      await ActivityLogger.logLogin(user.id, user.email);

      return {
        success: true,
        data: {
          user,
          token: authData.session?.access_token || `demo-token-${finalUserRecord.id}-${Date.now()}`
        },
        message: 'Login successful'
      };
    } catch (error) {
      console.error('AuthService: Login error:', error);
      return {
        success: false,
        message: `Login failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  static async logout(): Promise<ApiResponse<void>> {
    try {
      if (!supabase) {
        return { success: false, message: 'Database not configured' };
      }
      if (!supabase) {
        console.log('AuthService: Supabase not configured, clearing local session');
        return { success: true, message: 'Logged out successfully' };
      }
      
      const { error } = await supabase.auth.signOut();
      if (error) {
        // Handle session_not_found error gracefully - user is effectively logged out
        if (error.message?.includes('session_not_found') || error.message?.includes('Session from session_id claim in JWT does not exist')) {
          console.log('AuthService: Session already invalid, treating as successful logout');
          return { success: true, message: 'Logged out successfully' };
        }
        
        console.error('AuthService: Logout error:', error);
        // For other errors, still return success but log the error
        console.log('AuthService: Continuing with logout despite error');
      }

      // Log logout if we have user data
      const userData = localStorage.getItem('userData');
      if (userData) {
        const user = JSON.parse(userData);
        await ActivityLogger.logLogout(user.id, user.email);
      }

      return { success: true, message: 'Logged out successfully' };
    } catch (error) {
      console.error('AuthService: Logout exception:', error);
      // Even if logout fails on the server, we should clear the client session
      return { success: true, message: 'Logged out successfully' };
    }
  }
}

// User Service
export class UserService {
  static async getUsers(): Promise<ApiResponse<User[]>> {
    try {
      console.log('UserService: Fetching users from database');
      
      if (!supabase || !supabaseAdmin) {
        console.error('DashboardService: Supabase clients not configured');
        return { success: false, message: 'Database not configured', data: [] };
      }

      // Use admin client to bypass RLS and see all users
      const { data, error } = await supabaseAdmin
        .from('users')
        .select(`
          *,
          role:roles(*)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('UserService: Error fetching users:', error);
        return { success: false, message: error.message, data: [] };
      }

      const users = data?.map(userData => ({
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
          menuAccess: userData.role.menu_access,
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
        parentId: userData.parent_id,
        createdAt: new Date(userData.created_at),
        updatedAt: new Date(userData.updated_at)
      })) || [];

      return { success: true, data: users, message: 'Users fetched successfully' };
    } catch (error) {
      console.error('UserService: Error:', error);
      return { success: false, message: 'Failed to fetch users', data: [] };
    }
  }

  static async createUser(userData: any): Promise<ApiResponse<User>> {
    try {
      if (!supabaseAdmin) {
        return { success: false, message: 'Database not configured' };
      }

      // Create user in Supabase Auth first
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: userData.email,
        password: userData.password || 'password123',
        email_confirm: true,
        user_metadata: {
          name: userData.name
        }
      });
      
      if (authError) {
        console.error('UserService: Error creating auth user:', authError);
        return { success: false, message: authError.message };
      }

      // Create user profile in custom users table
      const hashedPassword = userData.password ? 
        await import('bcryptjs').then(bcrypt => bcrypt.hashSync(userData.password, 10)) :
        await import('bcryptjs').then(bcrypt => bcrypt.hashSync('password123', 10));
      
      const { data, error } = await supabaseAdmin
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

      if (error) {
        console.error('UserService: Error creating user:', error);
        return { success: false, message: error.message };
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
        parentId: data.parent_id,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at)
      };

      // Log user creation
      const currentUserData = localStorage.getItem('userData');
      if (currentUserData) {
        const currentUser = JSON.parse(currentUserData);
        await ActivityLogger.logUserCreated(currentUser.id, user.id, user.email, data.role.name);
      }

      return { 
        success: true, 
        data: user, 
        message: 'User created successfully! Default password: password123 (user should change on first login)' 
      };
    } catch (error) {
      console.error('UserService: Error:', error);
      return { success: false, message: 'Failed to create user' };
    }
  }

  static async updateUser(id: string, userData: {
    name: string;
    email: string;
    password?: string;
    roleId: string;
    jurisdiction?: string;
    zone?: string;
    region?: string;
    district?: string;
    employeeId?: string;
    phoneNumber?: string;
  }): Promise<ApiResponse<User>> {
    try {
      console.log('UserService: Updating user:', id);
      
      if (!supabaseAdmin) {
        return {
          success: false,
          message: 'Database not configured. Please check your Supabase configuration.'
        };
      }
      
      // Update auth user if email or password changed
      const { data: currentUser, error: getCurrentError } = await supabaseAdmin
        .from('users')
        .select('email')
        .eq('id', id)
        .single();
      
      if (getCurrentError) {
        throw new Error(`Failed to get current user: ${getCurrentError.message}`);
      }
      
      // Update auth user if needed
      const authUpdates: any = {};
      if (userData.email !== currentUser.email) {
        authUpdates.email = userData.email;
      }
      if (userData.password && userData.password.trim()) {
        authUpdates.password = userData.password;
      }
      
      if (Object.keys(authUpdates).length > 0) {
        const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, authUpdates);
        if (authError) {
          throw new Error(`Failed to update auth user: ${authError.message}`);
        }
      }
      
      // Prepare user profile updates
      const profileUpdates: any = {
        name: userData.name,
        email: userData.email,
        role_id: userData.roleId,
        jurisdiction: userData.jurisdiction || null,
        zone: userData.zone || null,
        region: userData.region || null,
        district: userData.district || null,
        employee_id: userData.employeeId || null,
        phone_number: userData.phoneNumber || null,
        updated_at: new Date().toISOString()
      };
      
      // Hash new password if provided
      if (userData.password && userData.password.trim()) {
        const bcrypt = await import('bcryptjs');
        const hashedPassword = bcrypt.hashSync(userData.password, 10);
        profileUpdates.password_hash = hashedPassword;
      }
      
      // Update user profile
      const { data: updatedUser, error: profileError } = await supabaseAdmin
        .from('users')
        .update(profileUpdates)
        .eq('id', id)
        .select(`
          *,
          role:roles(*)
        `)
        .single();
      
      if (profileError) {
        throw new Error(`Failed to update user profile: ${profileError.message}`);
      }
      
      const user: User = {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        roleId: updatedUser.role_id,
        role: {
          id: updatedUser.role.id,
          name: updatedUser.role.name,
          description: updatedUser.role.description,
          level: updatedUser.role.level,
          isActive: updatedUser.role.is_active,
          menuAccess: updatedUser.role.menu_access,
          createdAt: new Date(updatedUser.role.created_at),
          updatedAt: new Date(updatedUser.role.updated_at)
        },
        jurisdiction: updatedUser.jurisdiction,
        zone: updatedUser.zone,
        region: updatedUser.region,
        district: updatedUser.district,
        employeeId: updatedUser.employee_id,
        phoneNumber: updatedUser.phone_number,
        isActive: updatedUser.is_active,
        createdAt: new Date(updatedUser.created_at),
        updatedAt: new Date(updatedUser.updated_at)
      };
      
      console.log('UserService: User updated successfully:', user.email);
      
      return {
        success: true,
        data: user,
        message: 'User updated successfully!'
      };
    } catch (error) {
      console.error('UserService: Error updating user:', error);
      return {
        success: false,
        message: `Failed to update user: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  static async deleteUser(id: string): Promise<ApiResponse<void>> {
    try {
      if (!supabase) {
        return { success: false, message: 'Database not configured' };
      }

      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', id);

      if (error) {
        return { success: false, message: error.message };
      }

      return { success: true, message: 'User deleted successfully' };
    } catch (error) {
      console.error('UserService: Error:', error);
      return { success: false, message: 'Failed to delete user' };
    }
  }
}

// Role Service
export class RoleService {
  static async getRoles(): Promise<ApiResponse<Role[]>> {
    try {
      if (!supabase) {
        return { success: false, message: 'Database not configured', data: [] };
      }

      const { data, error } = await supabase
        .from('roles')
        .select('*')
        .order('level', { ascending: true });

      if (error) {
        return { success: false, message: error.message, data: [] };
      }

      const roles = data?.map(role => ({
        id: role.id,
        name: role.name,
        description: role.description,
        level: role.level,
        isActive: role.is_active,
        menuAccess: role.menu_access,
        createdAt: new Date(role.created_at),
        updatedAt: new Date(role.updated_at)
      })) || [];

      return { success: true, data: roles, message: 'Roles fetched successfully' };
    } catch (error) {
      console.error('RoleService: Error:', error);
      return { success: false, message: 'Failed to fetch roles', data: [] };
    }
  }

  static async createRole(roleData: any): Promise<ApiResponse<Role>> {
    try {
      if (!supabase) {
        return { success: false, message: 'Database not configured' };
      }

      const { data, error } = await supabase
        .from('roles')
        .insert(roleData)
        .select()
        .single();

      if (error) {
        return { success: false, message: error.message };
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

      return { success: true, data: role, message: 'Role created successfully' };
    } catch (error) {
      console.error('RoleService: Error:', error);
      return { success: false, message: 'Failed to create role' };
    }
  }

  static async updateRole(id: string, roleData: any): Promise<ApiResponse<Role>> {
    try {
      if (!supabase) {
        return { success: false, message: 'Database not configured' };
      }

      const { data, error } = await supabase
        .from('roles')
        .update(roleData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        return { success: false, message: error.message };
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

      return { success: true, data: role, message: 'Role updated successfully' };
    } catch (error) {
      console.error('RoleService: Error:', error);
      return { success: false, message: 'Failed to update role' };
    }
  }

  static async deleteRole(id: string): Promise<ApiResponse<void>> {
    try {
      if (!supabase) {
        return { success: false, message: 'Database not configured' };
      }

      const { error } = await supabase
        .from('roles')
        .delete()
        .eq('id', id);

      if (error) {
        return { success: false, message: error.message };
      }

      return { success: true, message: 'Role deleted successfully' };
    } catch (error) {
      console.error('RoleService: Error:', error);
      return { success: false, message: 'Failed to delete role' };
    }
  }

  static async updateRoleMenuAccess(roleId: string, menuAccess: string[]): Promise<ApiResponse<void>> {
    try {
      if (!supabase) {
        return { success: false, message: 'Database not configured' };
      }

      const { error } = await supabase
        .from('roles')
        .update({ menu_access: menuAccess })
        .eq('id', roleId);

      if (error) {
        return { success: false, message: error.message };
      }

      return { success: true, message: 'Menu access updated successfully' };
    } catch (error) {
      console.error('RoleService: Error:', error);
      return { success: false, message: 'Failed to update menu access' };
    }
  }
}

// Survey Service
export class SurveyService {
  static async getSurveys(): Promise<ApiResponse<Survey[]>> {
    try {
      if (!supabase) {
        return { success: false, message: 'Database not configured', data: [] };
      }

      const { data, error } = await supabase
        .from('surveys')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        return { success: false, message: error.message, data: [] };
      }

      const surveys = data?.map(survey => ({
        id: survey.id,
        title: survey.title,
        description: survey.description,
        targetDate: new Date(survey.target_date),
        duration: survey.duration,
        totalQuestions: survey.total_questions,
        passingScore: survey.passing_score,
        maxAttempts: survey.max_attempts,
        isActive: survey.is_active,
        sections: [],
        createdAt: new Date(survey.created_at),
        updatedAt: new Date(survey.updated_at),
        createdBy: survey.created_by,
        assignedZones: survey.assigned_zones,
        assignedRegions: survey.assigned_regions
      })) || [];

      return { success: true, data: surveys, message: 'Surveys fetched successfully' };
    } catch (error) {
      console.error('SurveyService: Error:', error);
      return { success: false, message: 'Failed to fetch surveys', data: [] };
    }
  }

  static async createSurvey(surveyData: any): Promise<ApiResponse<Survey>> {
    try {
      if (!supabase) {
        return { success: false, message: 'Database not configured' };
      }

      const { data, error } = await supabase
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
        sections: [],
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
        createdBy: data.created_by
      };

      // Log survey creation
      await ActivityLogger.logSurveyCreated(surveyData.createdBy, survey.id, survey.title);

      return { success: true, data: survey, message: 'Survey created successfully' };
    } catch (error) {
      console.error('SurveyService: Error:', error);
      return { success: false, message: 'Failed to create survey' };
    }
  }

  static async updateSurvey(surveyId: string, surveyData: any): Promise<ApiResponse<Survey>> {
    try {
      if (!supabase) {
        return { success: false, message: 'Database not configured' };
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
        updateData.target_date = surveyData.targetDate.toISOString().split('T')[0];
      }

      if (typeof surveyData.isActive !== 'undefined') {
        updateData.is_active = surveyData.isActive;
      }

      const { data, error } = await supabase
        .from('surveys')
        .update(updateData)
        .eq('id', surveyId)
        .select()
        .single();

      if (error) {
        return { success: false, message: error.message };
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
        sections: [],
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
        createdBy: data.created_by
      };

      // Log survey update
      const userData = localStorage.getItem('userData');
      if (userData) {
        const currentUser = JSON.parse(userData);
        await ActivityLogger.logSurveyUpdated(currentUser.id, survey.id, survey.title);
      }

      return { success: true, data: survey, message: 'Survey updated successfully' };
    } catch (error) {
      console.error('SurveyService: Error:', error);
      return { success: false, message: 'Failed to update survey' };
    }
  }

  static async deleteSurvey(surveyId: string): Promise<ApiResponse<void>> {
    try {
      if (!supabaseAdmin) {
        return { success: false, message: 'Database not configured' };
      }

      // Get survey title for logging before deletion
      const { data: surveyData } = await supabaseAdmin
        .from('surveys')
        .select('title')
        .eq('id', surveyId)
        .single();

      // Delete dependent records in the correct order to respect foreign key constraints
      
      // 1. Delete test answers (references test_sessions)
      const { data: sessionIds } = await supabaseAdmin
        .from('test_sessions')
        .select('id')
        .eq('survey_id', surveyId);
      
      if (sessionIds && sessionIds.length > 0) {
        await supabaseAdmin
          .from('test_answers')
          .delete()
          .in('session_id', sessionIds.map(s => s.id));
      }

      // 2. Delete section scores (references test_results)
      const { data: resultIds } = await supabaseAdmin
        .from('test_results')
        .select('id')
        .eq('survey_id', surveyId);
      
      if (resultIds && resultIds.length > 0) {
        await supabaseAdmin
          .from('section_scores')
          .delete()
          .in('result_id', resultIds.map(r => r.id));
      }

      // 3. Delete certificates (references test_results and surveys)
      await supabaseAdmin
        .from('certificates')
        .delete()
        .eq('survey_id', surveyId);

      // 4. Delete test results (references surveys and test_sessions)
      await supabaseAdmin
        .from('test_results')
        .delete()
        .eq('survey_id', surveyId);

      // 5. Delete test sessions (references surveys)
      await supabaseAdmin
        .from('test_sessions')
        .delete()
        .eq('survey_id', surveyId);

      // 6. Delete question options (references questions)
      const { data: sectionIds } = await supabaseAdmin
        .from('survey_sections')
        .select('id')
        .eq('survey_id', surveyId);
      
      if (sectionIds && sectionIds.length > 0) {
        const { data: questionIds } = await supabaseAdmin
          .from('questions')
          .select('id')
          .in('section_id', sectionIds.map(s => s.id));
        
        if (questionIds && questionIds.length > 0) {
          await supabaseAdmin
            .from('question_options')
            .delete()
            .in('question_id', questionIds.map(q => q.id));
        }
      }

      // 7. Delete questions (references survey_sections)
      if (sectionIds && sectionIds.length > 0) {
        await supabaseAdmin
          .from('questions')
          .delete()
          .in('section_id', sectionIds.map(s => s.id));
      }

      // 8. Delete survey sections (references surveys)
      await supabaseAdmin
        .from('survey_sections')
        .delete()
        .eq('survey_id', surveyId);

      // 9. Finally, delete the survey itself
      const { error } = await supabaseAdmin
        .from('surveys')
        .delete()
        .eq('id', surveyId);

      if (error) {
        return { success: false, message: error.message };
      }

      // Log survey deletion
      const userData = localStorage.getItem('userData');
      if (userData && surveyData) {
        const currentUser = JSON.parse(userData);
        await ActivityLogger.logSurveyDeleted(currentUser.id, surveyId, surveyData.title);
      }

      return { success: true, message: 'Survey deleted successfully' };
    } catch (error) {
      console.error('SurveyService: Error:', error);
      return { success: false, message: 'Failed to delete survey' };
    }
  }

  static async deleteSection(sectionId: string): Promise<ApiResponse<void>> {
    try {
      if (!supabaseAdmin) {
        return { success: false, message: 'Database not configured' };
      }

      // Delete dependent records in the correct order to respect foreign key constraints
      
      // 1. Delete question options (references questions)
      const { data: questionIds } = await supabaseAdmin
        .from('questions')
        .select('id')
        .eq('section_id', sectionId);
      
      if (questionIds && questionIds.length > 0) {
        await supabaseAdmin
          .from('question_options')
          .delete()
          .in('question_id', questionIds.map(q => q.id));
      }

      // 2. Delete questions (references survey_sections)
      await supabaseAdmin
        .from('questions')
        .delete()
        .eq('section_id', sectionId);

      // 3. Finally, delete the section itself
      const { error } = await supabaseAdmin
        .from('survey_sections')
        .delete()
        .eq('id', sectionId);

      if (error) {
        return { success: false, message: error.message };
      }

      return { success: true, message: 'Section deleted successfully' };
    } catch (error) {
      console.error('SurveyService: Error:', error);
      return { success: false, message: 'Failed to delete section' };
    }
  }

  static async getSurveySections(surveyId: string): Promise<ApiResponse<Section[]>> {
    try {
      if (!supabase) {
        return { success: false, message: 'Database not configured', data: [] };
      }

      const { data, error } = await supabase
        .from('survey_sections')
        .select('*')
        .eq('survey_id', surveyId)
        .order('section_order', { ascending: true });

      if (error) {
        return { success: false, message: error.message, data: [] };
      }

      const sections = data?.map(section => ({
        id: section.id,
        surveyId: section.survey_id,
        title: section.title,
        description: section.description,
        questionsCount: section.questions_count,
        order: section.section_order,
        questions: []
      })) || [];

      return { success: true, data: sections, message: 'Sections fetched successfully' };
    } catch (error) {
      console.error('SurveyService: Error:', error);
      return { success: false, message: 'Failed to fetch sections', data: [] };
    }
  }

  static async createSection(surveyId: string, sectionData: any): Promise<ApiResponse<Section>> {
    try {
      if (!supabase) {
        return { success: false, message: 'Database not configured' };
      }

      const { data, error } = await supabase
        .from('survey_sections')
        .insert({
          survey_id: surveyId,
          title: sectionData.title,
          description: sectionData.description,
          questions_count: sectionData.questionsCount,
          section_order: sectionData.order
        })
        .select()
        .single();

      if (error) {
        return { success: false, message: error.message };
      }

      const section: Section = {
        id: data.id,
        surveyId: data.survey_id,
        title: data.title,
        description: data.description,
        questionsCount: data.questions_count,
        order: data.section_order,
        questions: []
      };

      return { success: true, data: section, message: 'Section created successfully' };
    } catch (error) {
      console.error('SurveyService: Error:', error);
      return { success: false, message: 'Failed to create section' };
    }
  }
}

// Question Service
export class QuestionService {
  static async getQuestions(surveyId: string, sectionId: string): Promise<ApiResponse<Question[]>> {
    try {
      if (!supabase) {
        return { success: false, message: 'Database not configured', data: [] };
      }

      const { data, error } = await supabase
        .from('questions')
        .select(`
          *,
          question_options(*)
        `)
        .eq('section_id', sectionId)
        .order('question_order', { ascending: true });

      if (error) {
        return { success: false, message: error.message, data: [] };
      }

      const questions = data?.map(question => ({
        id: question.id,
        sectionId: question.section_id,
        text: question.text,
        type: question.question_type as 'single_choice' | 'multiple_choice',
        complexity: question.complexity as 'easy' | 'medium' | 'hard',
        points: question.points,
        explanation: question.explanation,
        order: question.question_order,
        options: question.question_options
          .sort((a: any, b: any) => a.option_order - b.option_order)
          .map((opt: any) => ({
            id: opt.id,
            text: opt.text,
            isCorrect: opt.is_correct
          })),
        correctAnswers: question.question_options
          .filter((opt: any) => opt.is_correct)
          .map((opt: any) => opt.id),
        createdAt: new Date(question.created_at),
        updatedAt: new Date(question.updated_at)
      })) || [];

      return { success: true, data: questions, message: 'Questions fetched successfully' };
    } catch (error) {
      console.error('QuestionService: Error:', error);
      return { success: false, message: 'Failed to fetch questions', data: [] };
    }
  }

  static async createQuestion(questionData: any): Promise<ApiResponse<Question>> {
    try {
      if (!supabase) {
        return { success: false, message: 'Database not configured' };
      }

      // Insert question
      const { data: questionResult, error: questionError } = await supabase
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

      if (questionError) {
        return { success: false, message: questionError.message };
      }

      // Insert options
      const optionsToInsert = questionData.options.map((option: any, index: number) => ({
        question_id: questionResult.id,
        text: option.text,
        is_correct: option.isCorrect,
        option_order: index + 1
      }));

      const { error: optionsError } = await supabase
        .from('question_options')
        .insert(optionsToInsert);

      if (optionsError) {
        return { success: false, message: optionsError.message };
      }

      // Fetch complete question with options
      const { data: completeQuestion, error: fetchError } = await supabase
        .from('questions')
        .select(`
          *,
          question_options(*)
        `)
        .eq('id', questionResult.id)
        .single();

      if (fetchError) {
        return { success: false, message: fetchError.message };
      }

      const question: Question = {
        id: completeQuestion.id,
        sectionId: completeQuestion.section_id,
        text: completeQuestion.text,
        type: completeQuestion.question_type,
        complexity: completeQuestion.complexity,
        points: completeQuestion.points,
        explanation: completeQuestion.explanation,
        order: completeQuestion.question_order,
        options: completeQuestion.question_options
          .sort((a: any, b: any) => a.option_order - b.option_order)
          .map((opt: any) => ({
            id: opt.id,
            text: opt.text,
            isCorrect: opt.is_correct
          })),
        correctAnswers: completeQuestion.question_options
          .filter((opt: any) => opt.is_correct)
          .map((opt: any) => opt.id),
        createdAt: new Date(completeQuestion.created_at),
        updatedAt: new Date(completeQuestion.updated_at)
      };

      return { success: true, data: question, message: 'Question created successfully' };
    } catch (error) {
      console.error('QuestionService: Error:', error);
      return { success: false, message: 'Failed to create question' };
    }
  }

  static async uploadQuestions(csvContent: string): Promise<ApiResponse<any>> {
    // Basic CSV parsing implementation
    return {
      success: true,
      data: {
        questionsAdded: 0,
        questionsSkipped: 0,
        errors: []
      },
      message: 'CSV upload feature not implemented yet'
    };
  }
}

// Test Service
export class TestService {
  static async getSession(sessionId: string): Promise<ApiResponse<TestSession>> {
    try {
      if (!supabase) {
        return { success: false, message: 'Database not configured' };
      }

      const { data, error } = await supabase
        .from('test_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (error) {
        return { success: false, message: error.message };
      }

      const session: TestSession = {
        id: data.id,
        userId: data.user_id,
        surveyId: data.survey_id,
        startTime: new Date(data.start_time),
        timeRemaining: data.time_remaining,
        currentQuestionIndex: data.current_question_index,
        answers: [],
        status: data.session_status,
        attemptNumber: data.attempt_number
      };

      return { success: true, data: session, message: 'Session fetched successfully' };
    } catch (error) {
      console.error('TestService: Error:', error);
      return { success: false, message: 'Failed to fetch session' };
    }
  }
}

// Dashboard Service
export class DashboardService {
  static async getDashboardData(): Promise<ApiResponse<any>> {
    try {
      if (!supabase || !supabaseAdmin) {
        console.warn('DashboardService: Supabase clients not configured - returning empty dashboard data');
        return { 
          success: false, 
          message: 'Database not configured. Please set up your Supabase credentials in the .env file, restart the development server, and initialize the database.',
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

      console.log('DashboardService: Supabase clients available, fetching data...');

      // Get basic counts
      console.log('DashboardService: Fetching user count...');
      const { count: usersCount, error: usersError } = await supabaseAdmin
        .from('users')
        .select('*', { count: 'exact', head: true });

      if (usersError) {
        console.error('DashboardService: Error fetching users count:', usersError);
        throw new Error(`Failed to fetch users: ${usersError.message}`);
      }

      console.log('DashboardService: Fetching surveys count...');
      const { count: surveysCount, error: surveysError } = await supabaseAdmin
        .from('surveys')
        .select('*', { count: 'exact', head: true });

      if (surveysError) {
        console.error('DashboardService: Error fetching surveys count:', surveysError);
        throw new Error(`Failed to fetch surveys: ${surveysError.message}`);
      }

      console.log('DashboardService: Fetching test sessions count...');
      const { count: attemptsCount, error: attemptsError } = await supabaseAdmin
        .from('test_sessions')
        .select('*', { count: 'exact', head: true });

      if (attemptsError) {
        console.error('DashboardService: Error fetching test sessions count:', attemptsError);
        throw new Error(`Failed to fetch test sessions: ${attemptsError.message}`);
      }

      console.log('DashboardService: Basic counts fetched successfully');
      console.log('Users:', usersCount, 'Surveys:', surveysCount, 'Attempts:', attemptsCount);

      // Get test results for calculations
      console.log('DashboardService: Fetching test results...');
      const { data: testResults, error: resultsError } = await supabaseAdmin
        .from('test_results')
        .select('*');

      if (resultsError) {
        console.error('Dashboard: Error fetching test results:', resultsError);
        // Don't throw here, continue with empty results
        console.log('DashboardService: Continuing with empty test results');
      }

      console.log('DashboardService: Test results count:', testResults?.length || 0);

      // Calculate average score and pass rate
      let averageScore = 0;
      let passRate = 0;
      
      if (testResults && testResults.length > 0) {
        console.log('DashboardService: Calculating scores and pass rates...');
        const totalScore = testResults.reduce((sum, result) => sum + (result.score || 0), 0);
        averageScore = totalScore / testResults.length;
        
        const passedTests = testResults.filter(result => result.is_passed).length;
        passRate = (passedTests / testResults.length) * 100;
        console.log('DashboardService: Average score:', averageScore, 'Pass rate:', passRate);
      } else {
        console.log('DashboardService: No test results found, using default values');
      }

      // Get performance by role
      console.log('DashboardService: Fetching performance by role...');
      const { data: rolePerformance, error: roleError } = await supabaseAdmin
        .from('test_results')
        .select(`
          *,
          user:users(
            role:roles(name)
          )
        `);

      if (roleError) {
        console.error('Dashboard: Error fetching role performance:', roleError);
        // Continue with empty data
      }

      console.log('DashboardService: Role performance data count:', rolePerformance?.length || 0);

      const performanceByRole = rolePerformance ? rolePerformance.reduce((acc: any[], result: any) => {
        const roleName = result.user?.role?.name || 'Unknown';
        const existing = acc.find(item => item.role === roleName);
        
        if (existing) {
          existing.totalTests++;
          existing.totalScore += result.score || 0;
          if (result.is_passed) existing.passedTests++;
        } else {
          acc.push({
            role: roleName,
            totalTests: 1,
            totalScore: result.score || 0,
            passedTests: result.is_passed ? 1 : 0,
            averageScore: result.score || 0,
            passRate: result.is_passed ? 100 : 0
          });
        }
        
        return acc;
      }, []).map((item: any) => ({
        ...item,
        averageScore: item.totalScore / item.totalTests,
        passRate: (item.passedTests / item.totalTests) * 100
      })) : [];

      // Get performance by survey
      console.log('DashboardService: Fetching performance by survey...');
      const { data: surveyPerformance, error: surveyError } = await supabaseAdmin
        .from('test_results')
        .select(`
          *,
          survey:surveys(title)
        `);

      if (surveyError) {
        console.error('Dashboard: Error fetching survey performance:', surveyError);
        // Continue with empty data
      }

      console.log('DashboardService: Survey performance data count:', surveyPerformance?.length || 0);

      const performanceBySurvey = surveyPerformance ? surveyPerformance.reduce((acc: any[], result: any) => {
        const surveyTitle = result.survey?.title || 'Unknown Survey';
        const existing = acc.find(item => item.survey === surveyTitle);
        
        if (existing) {
          existing.totalAttempts++;
          existing.totalScore += result.score || 0;
          if (result.is_passed) existing.passedAttempts++;
        } else {
          acc.push({
            survey: surveyTitle,
            totalAttempts: 1,
            totalScore: result.score || 0,
            passedAttempts: result.is_passed ? 1 : 0,
            averageScore: result.score || 0,
            passRate: result.is_passed ? 100 : 0
          });
        }
        
        return acc;
      }, []).map((item: any) => ({
        ...item,
        averageScore: item.totalScore / item.totalAttempts,
        passRate: (item.passedAttempts / item.totalAttempts) * 100
      })) : [];

      // Get recent activity
      console.log('DashboardService: Fetching recent activity...');
      const { data: recentActivity, error: activityError } = await supabaseAdmin
        .from('activity_logs')
        .select(`
          *,
          user:users(name)
        `)
        .order('created_at', { ascending: false })
        .limit(10);

      if (activityError) {
        console.error('Dashboard: Error fetching recent activity:', activityError);
        // Continue with empty data
      }

      console.log('DashboardService: Recent activity count:', recentActivity?.length || 0);

      const formattedActivity = recentActivity ? recentActivity.map((activity: any) => ({
        id: activity.id,
        action: activity.action,
        description: activity.description,
        userName: activity.user?.name || 'Unknown User',
        timestamp: new Date(activity.created_at)
      })) : [];

      // Get monthly trends (last 6 months)
      console.log('DashboardService: Fetching monthly trends...');
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const { data: monthlyData, error: monthlyError } = await supabaseAdmin
        .from('test_results')
        .select('completed_at, is_passed')
        .gte('completed_at', sixMonthsAgo.toISOString());

      if (monthlyError) {
        console.error('Dashboard: Error fetching monthly trends:', monthlyError);
        // Continue with empty data
      }

      console.log('DashboardService: Monthly data count:', monthlyData?.length || 0);

      const monthlyTrends = monthlyData ? monthlyData.reduce((acc: any[], result: any) => {
        const month = new Date(result.completed_at).toLocaleString('default', { month: 'short', year: 'numeric' });
        const existing = acc.find(item => item.month === month);
        
        if (existing) {
          existing.totalTests++;
          if (result.is_passed) existing.passedTests++;
        } else {
          acc.push({
            month,
            totalTests: 1,
            passedTests: result.is_passed ? 1 : 0
          });
        }
        
        return acc;
      }, []).map((item: any) => ({
        ...item,
        passRate: (item.passedTests / item.totalTests) * 100
      })) : [];

      const dashboardData = {
        totalUsers: usersCount || 0,
        totalSurveys: surveysCount || 0,
        totalAttempts: attemptsCount || 0,
        averageScore: Math.round(averageScore * 10) / 10,
        passRate: Math.round(passRate * 10) / 10,
        recentActivity: formattedActivity,
        performanceByRole,
        performanceBySurvey,
        monthlyTrends
      };

      console.log('DashboardService: Dashboard data compiled successfully');
      return { success: true, data: dashboardData, message: 'Dashboard data fetched successfully' };
    } catch (error) {
      console.error('DashboardService: Error:', error);
      
      // Return fallback data instead of failing completely
      return { 
        success: false, 
        message: `Failed to fetch dashboard data: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
  }
}

// Certificate Service
export class CertificateService {
  static async getCertificates(): Promise<ApiResponse<Certificate[]>> {
    try {
      if (!supabase) {
        return { success: false, message: 'Database not configured', data: [] };
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
        return { success: false, message: error.message, data: [] };
      }

      const certificates = data?.map(cert => ({
        id: cert.id,
        userId: cert.user_id,
        user: cert.user,
        surveyId: cert.survey_id,
        survey: cert.survey,
        resultId: cert.result_id,
        certificateNumber: cert.certificate_number,
        issuedAt: new Date(cert.issued_at),
        validUntil: cert.valid_until ? new Date(cert.valid_until) : undefined,
        downloadCount: cert.download_count,
        status: cert.certificate_status
      })) || [];

      return { success: true, data: certificates, message: 'Certificates fetched successfully' };
    } catch (error) {
      console.error('CertificateService: Error:', error);
      return { success: false, message: 'Failed to fetch certificates', data: [] };
    }
  }

  static async downloadCertificate(certificateId: string): Promise<ApiResponse<Blob>> {
    // Generate a simple PDF-like content
    const pdfContent = `Certificate ID: ${certificateId}\nGenerated on: ${new Date().toISOString()}`;
    const blob = new Blob([pdfContent], { type: 'application/pdf' });
    
    return { success: true, data: blob, message: 'Certificate downloaded successfully' };
  }

  static async revokeCertificate(certificateId: string): Promise<ApiResponse<void>> {
    try {
      if (!supabase) {
        return { success: false, message: 'Database not configured' };
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
      console.error('CertificateService: Error:', error);
      return { success: false, message: 'Failed to revoke certificate' };
    }
  }
}

// Settings Service
export class SettingsService {
  static async getSettings(): Promise<ApiResponse<SystemSettings[]>> {
    try {
      if (!supabase) {
        return { success: false, message: 'Database not configured', data: [] };
      }

      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .order('category', { ascending: true });

      if (error) {
        return { success: false, message: error.message, data: [] };
      }

      const settings = data?.map(setting => ({
        id: setting.id,
        category: setting.category,
        key: setting.setting_key,
        value: setting.setting_value,
        description: setting.description,
        type: setting.setting_type,
        isEditable: setting.is_editable,
        options: setting.options,
        updatedAt: new Date(setting.updated_at),
        updatedBy: setting.updated_by || 'System'
      })) || [];

      return { success: true, data: settings, message: 'Settings fetched successfully' };
    } catch (error) {
      console.error('SettingsService: Error:', error);
      return { success: false, message: 'Failed to fetch settings', data: [] };
    }
  }

  static async updateSetting(id: string, value: string, userId?: string): Promise<ApiResponse<void>> {
    try {
      if (!supabase) {
        return { success: false, message: 'Database not configured' };
      }

      const { error } = await supabase
        .from('system_settings')
        .update({ 
          setting_value: value,
          updated_by: userId 
        })
        .eq('id', id);

      if (error) {
        return { success: false, message: error.message };
      }

      // Log setting update
      const { data: settingData } = await supabase
        .from('system_settings')
        .select('setting_key, setting_value')
        .eq('id', id)
        .single();

      if (settingData && userId) {
        await ActivityLogger.logSettingUpdated(userId, settingData.setting_key, settingData.setting_value, value);
      }

      return { success: true, message: 'Setting updated successfully' };
    } catch (error) {
      console.error('SettingsService: Error:', error);
      return { success: false, message: 'Failed to update setting' };
    }
  }
}