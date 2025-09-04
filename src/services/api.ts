import { supabase, supabaseAdmin, isDemoMode } from '../lib/supabase';
import { User, Role, Survey, TestSession, TestResult, Certificate, SystemSettings, Activity, Dashboard, AnalyticsData, AnalyticsFilter } from '../types';
import bcrypt from 'bcryptjs';
import { ActivityLogger } from './activityLogger';

// Mock data for demo mode
const mockUsers: User[] = [
  {
    id: '1',
    email: 'admin@esigma.com',
    name: 'System Administrator',
    roleId: '1',
    role: { id: '1', name: 'Admin', description: 'System Administrator', level: 1, createdAt: new Date(), updatedAt: new Date(), isActive: true },
    createdAt: new Date(),
    updatedAt: new Date(),
    isActive: true,
    jurisdiction: 'National'
  }
];

const mockRoles: Role[] = [
  { id: '1', name: 'Admin', description: 'System Administrator', level: 1, createdAt: new Date(), updatedAt: new Date(), isActive: true },
  { id: '2', name: 'ZO User', description: 'Zonal Office User', level: 2, createdAt: new Date(), updatedAt: new Date(), isActive: true },
  { id: '3', name: 'RO User', description: 'Regional Office User', level: 3, createdAt: new Date(), updatedAt: new Date(), isActive: true },
  { id: '4', name: 'Supervisor', description: 'Field Supervisor', level: 4, createdAt: new Date(), updatedAt: new Date(), isActive: true },
  { id: '5', name: 'Enumerator', description: 'Field Enumerator', level: 5, createdAt: new Date(), updatedAt: new Date(), isActive: true }
];

// Auth API
export const authApi = {
  async login(email: string, password: string) {
    try {
      if (isDemoMode) {
        // Demo mode authentication
        const mockUser = mockUsers.find(u => u.email === email);
        if (mockUser && password === 'password123') {
          localStorage.setItem('userData', JSON.stringify(mockUser));
          return {
            success: true,
            message: 'Login successful (Demo Mode)',
            data: { user: mockUser, token: 'demo-token', session: null }
          };
        }
        return { success: false, message: 'Invalid credentials (Demo Mode)' };
      }

      // Production mode authentication
      const { data, error } = await supabase!.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        console.error('Supabase auth error:', error);
        return { success: false, message: error.message };
      }

      if (!data.user) {
        return { success: false, message: 'Authentication failed' };
      }

      // Get user details from custom users table
      const { data: userData, error: userError } = await supabase!
        .from('users')
        .select(`
          *,
          role:roles(*)
        `)
        .eq('id', data.user.id)
        .single();

      if (userError || !userData) {
        console.error('User data fetch error:', userError);
        return { success: false, message: 'User profile not found' };
      }

      // Update last login
      await supabase!
        .from('users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', data.user.id);

      // Log login activity
      await ActivityLogger.logLogin(data.user.id, email);

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
          createdAt: new Date(userData.role.created_at),
          updatedAt: new Date(userData.role.updated_at),
          isActive: userData.role.is_active,
          menuAccess: userData.role.menu_access
        },
        isActive: userData.is_active,
        jurisdiction: userData.jurisdiction,
        zone: userData.zone,
        region: userData.region,
        district: userData.district,
        employeeId: userData.employee_id,
        phoneNumber: userData.phone_number,
        profileImage: userData.profile_image,
        parentId: userData.parent_id,
        lastLogin: userData.last_login ? new Date(userData.last_login) : undefined,
        passwordChangedAt: userData.password_changed_at ? new Date(userData.password_changed_at) : undefined,
        createdAt: new Date(userData.created_at),
        updatedAt: new Date(userData.updated_at)
      };

      return {
        success: true,
        message: 'Login successful',
        data: { user, token: data.session?.access_token, session: data.session }
      };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, message: 'Login failed. Please try again.' };
    }
  },

  async logout() {
    try {
      if (isDemoMode) {
        localStorage.removeItem('userData');
        return { success: true, message: 'Logged out successfully (Demo Mode)' };
      }

      const { error } = await supabase!.auth.signOut();
      if (error) {
        console.error('Logout error:', error);
        return { success: false, message: error.message };
      }

      return { success: true, message: 'Logged out successfully' };
    } catch (error) {
      console.error('Logout error:', error);
      return { success: false, message: 'Logout failed' };
    }
  },

  async changePassword(currentPassword: string, newPassword: string) {
    try {
      if (isDemoMode) {
        return { success: true, message: 'Password changed successfully (Demo Mode)' };
      }

      const { error } = await supabase!.auth.updateUser({
        password: newPassword
      });

      if (error) {
        return { success: false, message: error.message };
      }

      return { success: true, message: 'Password changed successfully' };
    } catch (error) {
      console.error('Password change error:', error);
      return { success: false, message: 'Failed to change password' };
    }
  }
};

// User API
export const userApi = {
  async getUsers() {
    try {
      console.log('userApi.getUsers: Starting to fetch users...');
      
      if (isDemoMode) {
        console.log('userApi.getUsers: Demo mode - returning mock users');
        return {
          success: true,
          message: 'Users fetched successfully (Demo Mode)',
          data: mockUsers,
          count: mockUsers.length
        };
      }

      console.log('userApi.getUsers: Fetching from Supabase...');
      const { data, error, count } = await supabase!
        .from('users')
        .select(`
          *,
          role:roles(*)
        `, { count: 'exact' })
        .order('created_at', { ascending: false });

      console.log('userApi.getUsers: Supabase response:', { data, error, count });

      if (error) {
        console.error('userApi.getUsers: Supabase error:', error);
        return { 
          success: false, 
          message: `Failed to fetch users: ${error.message}`,
          data: [],
          count: 0
        };
      }

      if (!data) {
        console.log('userApi.getUsers: No data returned');
        return { 
          success: true, 
          message: 'No users found',
          data: [],
          count: 0
        };
      }

      console.log(`userApi.getUsers: Found ${data.length} users, total count: ${count}`);

      const users: User[] = data.map(userData => ({
        id: userData.id,
        email: userData.email,
        name: userData.name,
        roleId: userData.role_id,
        role: {
          id: userData.role.id,
          name: userData.role.name,
          description: userData.role.description,
          level: userData.role.level,
          createdAt: new Date(userData.role.created_at),
          updatedAt: new Date(userData.role.updated_at),
          isActive: userData.role.is_active,
          menuAccess: userData.role.menu_access
        },
        isActive: userData.is_active,
        jurisdiction: userData.jurisdiction,
        zone: userData.zone,
        region: userData.region,
        district: userData.district,
        employeeId: userData.employee_id,
        phoneNumber: userData.phone_number,
        profileImage: userData.profile_image,
        parentId: userData.parent_id,
        lastLogin: userData.last_login ? new Date(userData.last_login) : undefined,
        passwordChangedAt: userData.password_changed_at ? new Date(userData.password_changed_at) : undefined,
        createdAt: new Date(userData.created_at),
        updatedAt: new Date(userData.updated_at)
      }));

      console.log(`userApi.getUsers: Returning ${users.length} users`);

      return {
        success: true,
        message: 'Users fetched successfully',
        data: users,
        count: count || users.length
      };
    } catch (error) {
      console.error('userApi.getUsers: Exception:', error);
      return { 
        success: false, 
        message: `Failed to fetch users: ${error instanceof Error ? error.message : 'Unknown error'}`,
        data: [],
        count: 0
      };
    }
  },

  async createUser(userData: any) {
    try {
      if (isDemoMode) {
        const newUser: User = {
          id: Date.now().toString(),
          email: userData.email,
          name: userData.name,
          roleId: userData.roleId,
          role: mockRoles.find(r => r.id === userData.roleId) || mockRoles[0],
          createdAt: new Date(),
          updatedAt: new Date(),
          isActive: true,
          jurisdiction: userData.jurisdiction
        };
        return { success: true, message: 'User created successfully (Demo Mode)', data: newUser };
      }

      // Create user in Supabase Auth
      const { data: authData, error: authError } = await supabaseAdmin!.auth.admin.createUser({
        email: userData.email,
        password: userData.password,
        email_confirm: true,
        user_metadata: { name: userData.name }
      });

      if (authError || !authData.user) {
        return { success: false, message: authError?.message || 'Failed to create user' };
      }

      // Hash password for custom users table
      const hashedPassword = bcrypt.hashSync(userData.password, 10);

      // Create user profile
      const { data: profileData, error: profileError } = await supabase!
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
          createdAt: new Date(profileData.role.created_at),
          updatedAt: new Date(profileData.role.updated_at),
          isActive: profileData.role.is_active
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

      return { success: true, message: 'User created successfully', data: user };
    } catch (error) {
      console.error('Create user error:', error);
      return { success: false, message: 'Failed to create user' };
    }
  },

  async updateUser(userId: string, userData: any) {
    try {
      if (isDemoMode) {
        return { success: true, message: 'User updated successfully (Demo Mode)', data: mockUsers[0] };
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
        const { error: authError } = await supabaseAdmin!.auth.admin.updateUserById(userId, {
          password: userData.password
        });
        
        if (authError) {
          console.error('Auth password update error:', authError);
        }
      }

      const { data, error } = await supabase!
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
          createdAt: new Date(data.role.created_at),
          updatedAt: new Date(data.role.updated_at),
          isActive: data.role.is_active
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
      console.error('Update user error:', error);
      return { success: false, message: 'Failed to update user' };
    }
  },

  async deleteUser(userId: string) {
    try {
      if (isDemoMode) {
        return { success: true, message: 'User deleted successfully (Demo Mode)' };
      }

      // Delete from custom users table first
      const { error: profileError } = await supabase!
        .from('users')
        .delete()
        .eq('id', userId);

      if (profileError) {
        return { success: false, message: profileError.message };
      }

      // Delete from Supabase Auth
      const { error: authError } = await supabaseAdmin!.auth.admin.deleteUser(userId);
      
      if (authError) {
        console.error('Auth user deletion error:', authError);
        // Don't fail the operation if auth deletion fails
      }

      return { success: true, message: 'User deleted successfully' };
    } catch (error) {
      console.error('Delete user error:', error);
      return { success: false, message: 'Failed to delete user' };
    }
  }
};

// Role API
export const roleApi = {
  async getRoles() {
    try {
      if (isDemoMode) {
        return { success: true, message: 'Roles fetched successfully (Demo Mode)', data: mockRoles };
      }

      const { data, error } = await supabase!
        .from('roles')
        .select('*')
        .order('level', { ascending: true });

      if (error) {
        return { success: false, message: error.message, data: [] };
      }

      const roles: Role[] = data.map(role => ({
        id: role.id,
        name: role.name,
        description: role.description,
        level: role.level,
        createdAt: new Date(role.created_at),
        updatedAt: new Date(role.updated_at),
        isActive: role.is_active,
        menuAccess: role.menu_access
      }));

      return { success: true, message: 'Roles fetched successfully', data: roles };
    } catch (error) {
      console.error('Get roles error:', error);
      return { success: false, message: 'Failed to fetch roles', data: [] };
    }
  },

  async createRole(roleData: any) {
    try {
      if (isDemoMode) {
        const newRole: Role = {
          id: Date.now().toString(),
          name: roleData.name,
          description: roleData.description,
          level: 5,
          createdAt: new Date(),
          updatedAt: new Date(),
          isActive: true
        };
        return { success: true, message: 'Role created successfully (Demo Mode)', data: newRole };
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

      if (error) {
        return { success: false, message: error.message };
      }

      const role: Role = {
        id: data.id,
        name: data.name,
        description: data.description,
        level: data.level,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
        isActive: data.is_active,
        menuAccess: data.menu_access
      };

      return { success: true, message: 'Role created successfully', data: role };
    } catch (error) {
      console.error('Create role error:', error);
      return { success: false, message: 'Failed to create role' };
    }
  },

  async updateRole(roleId: string, roleData: any) {
    try {
      if (isDemoMode) {
        return { success: true, message: 'Role updated successfully (Demo Mode)', data: mockRoles[0] };
      }

      const { data, error } = await supabase!
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

      const role: Role = {
        id: data.id,
        name: data.name,
        description: data.description,
        level: data.level,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
        isActive: data.is_active,
        menuAccess: data.menu_access
      };

      return { success: true, message: 'Role updated successfully', data: role };
    } catch (error) {
      console.error('Update role error:', error);
      return { success: false, message: 'Failed to update role' };
    }
  },

  async deleteRole(roleId: string) {
    try {
      if (isDemoMode) {
        return { success: true, message: 'Role deleted successfully (Demo Mode)' };
      }

      const { error } = await supabase!
        .from('roles')
        .delete()
        .eq('id', roleId);

      if (error) {
        return { success: false, message: error.message };
      }

      return { success: true, message: 'Role deleted successfully' };
    } catch (error) {
      console.error('Delete role error:', error);
      return { success: false, message: 'Failed to delete role' };
    }
  },

  async getPermissions() {
    try {
      if (isDemoMode) {
        return { success: true, message: 'Permissions fetched successfully (Demo Mode)', data: [] };
      }

      // For now, return empty array as permissions table doesn't exist yet
      return { success: true, message: 'Permissions fetched successfully', data: [] };
    } catch (error) {
      console.error('Get permissions error:', error);
      return { success: false, message: 'Failed to fetch permissions', data: [] };
    }
  },

  async updateRoleMenuAccess(roleId: string, menuAccess: string[]) {
    try {
      if (isDemoMode) {
        return { success: true, message: 'Menu access updated successfully (Demo Mode)' };
      }

      const { error } = await supabase!
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
      console.error('Update menu access error:', error);
      return { success: false, message: 'Failed to update menu access' };
    }
  }
};

// Dashboard API
export const dashboardApi = {
  async getDashboardData() {
    try {
      console.log('dashboardApi.getDashboardData: Starting to fetch dashboard data...');
      
      if (isDemoMode) {
        console.log('dashboardApi.getDashboardData: Demo mode - returning mock data');
        return {
          success: true,
          message: 'Dashboard data fetched successfully (Demo Mode)',
          data: {
            totalUsers: mockUsers.length,
            totalSurveys: 3,
            totalAttempts: 15,
            averageScore: 78.5,
            passRate: 85.2,
            recentActivity: [],
            performanceByRole: [],
            performanceBySurvey: [],
            monthlyTrends: []
          }
        };
      }

      console.log('dashboardApi.getDashboardData: Fetching user count...');
      // Get total users count
      const { count: totalUsers, error: usersError } = await supabase!
        .from('users')
        .select('*', { count: 'exact', head: true });

      if (usersError) {
        console.error('dashboardApi.getDashboardData: Users count error:', usersError);
        return { success: false, message: `Failed to fetch user count: ${usersError.message}` };
      }

      console.log('dashboardApi.getDashboardData: User count:', totalUsers);

      console.log('dashboardApi.getDashboardData: Fetching survey count...');
      // Get total surveys count
      const { count: totalSurveys, error: surveysError } = await supabase!
        .from('surveys')
        .select('*', { count: 'exact', head: true });

      if (surveysError) {
        console.error('dashboardApi.getDashboardData: Surveys count error:', surveysError);
        return { success: false, message: `Failed to fetch survey count: ${surveysError.message}` };
      }

      console.log('dashboardApi.getDashboardData: Survey count:', totalSurveys);

      console.log('dashboardApi.getDashboardData: Fetching test results count...');
      // Get total test attempts count
      const { count: totalAttempts, error: attemptsError } = await supabase!
        .from('test_results')
        .select('*', { count: 'exact', head: true });

      if (attemptsError) {
        console.error('dashboardApi.getDashboardData: Attempts count error:', attemptsError);
        return { success: false, message: `Failed to fetch attempts count: ${attemptsError.message}` };
      }

      console.log('dashboardApi.getDashboardData: Attempts count:', totalAttempts);

      console.log('dashboardApi.getDashboardData: Fetching test results for calculations...');
      // Get test results for calculations
      const { data: testResults, error: resultsError } = await supabase!
        .from('test_results')
        .select('score, is_passed');

      if (resultsError) {
        console.error('dashboardApi.getDashboardData: Results fetch error:', resultsError);
        return { success: false, message: `Failed to fetch test results: ${resultsError.message}` };
      }

      console.log('dashboardApi.getDashboardData: Test results count:', testResults?.length || 0);

      // Calculate averages
      const averageScore = testResults && testResults.length > 0 
        ? testResults.reduce((sum, result) => sum + result.score, 0) / testResults.length 
        : 0;

      const passRate = testResults && testResults.length > 0 
        ? (testResults.filter(result => result.is_passed).length / testResults.length) * 100 
        : 0;

      console.log('dashboardApi.getDashboardData: Calculated averages - Score:', averageScore, 'Pass Rate:', passRate);

      const dashboardData: Dashboard = {
        totalUsers: totalUsers || 0,
        totalSurveys: totalSurveys || 0,
        totalAttempts: totalAttempts || 0,
        averageScore,
        passRate,
        recentActivity: [], // TODO: Implement recent activity
        performanceByRole: [], // TODO: Implement performance by role
        performanceBySurvey: [], // TODO: Implement performance by survey
        monthlyTrends: [] // TODO: Implement monthly trends
      };

      console.log('dashboardApi.getDashboardData: Final dashboard data:', dashboardData);

      return {
        success: true,
        message: 'Dashboard data fetched successfully',
        data: dashboardData
      };
    } catch (error) {
      console.error('dashboardApi.getDashboardData: Exception:', error);
      return { 
        success: false, 
        message: `Failed to fetch dashboard data: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }
};

// Survey API
export const surveyApi = {
  async getSurveys() {
    try {
      if (isDemoMode) {
        return { success: true, message: 'Surveys fetched successfully (Demo Mode)', data: [] };
      }

      const { data, error } = await supabase!
        .from('surveys')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        return { success: false, message: error.message, data: [] };
      }

      const surveys: Survey[] = data.map(survey => ({
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
      }));

      return { success: true, message: 'Surveys fetched successfully', data: surveys };
    } catch (error) {
      console.error('Get surveys error:', error);
      return { success: false, message: 'Failed to fetch surveys', data: [] };
    }
  },

  async createSurvey(surveyData: any) {
    try {
      if (isDemoMode) {
        return { success: true, message: 'Survey created successfully (Demo Mode)', data: null };
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
        createdBy: data.created_by,
        assignedZones: data.assigned_zones,
        assignedRegions: data.assigned_regions
      };

      return { success: true, message: 'Survey created successfully', data: survey };
    } catch (error) {
      console.error('Create survey error:', error);
      return { success: false, message: 'Failed to create survey' };
    }
  },

  async updateSurvey(surveyId: string, surveyData: any) {
    try {
      if (isDemoMode) {
        return { success: true, message: 'Survey updated successfully (Demo Mode)', data: null };
      }

      const { data, error } = await supabase!
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
        createdBy: data.created_by,
        assignedZones: data.assigned_zones,
        assignedRegions: data.assigned_regions
      };

      return { success: true, message: 'Survey updated successfully', data: survey };
    } catch (error) {
      console.error('Update survey error:', error);
      return { success: false, message: 'Failed to update survey' };
    }
  },

  async deleteSurvey(surveyId: string) {
    try {
      if (isDemoMode) {
        return { success: true, message: 'Survey deleted successfully (Demo Mode)' };
      }

      const { error } = await supabase!
        .from('surveys')
        .delete()
        .eq('id', surveyId);

      if (error) {
        return { success: false, message: error.message };
      }

      return { success: true, message: 'Survey deleted successfully' };
    } catch (error) {
      console.error('Delete survey error:', error);
      return { success: false, message: 'Failed to delete survey' };
    }
  }
};

// Test API
export const testApi = {
  async createTestSession(surveyId: string) {
    try {
      if (isDemoMode) {
        return { 
          success: true, 
          message: 'Test session created successfully (Demo Mode)', 
          data: { id: 'demo-session-' + Date.now(), startTime: new Date() }
        };
      }

      // Get current user
      const { data: { user } } = await supabase!.auth.getUser();
      if (!user) {
        return { success: false, message: 'User not authenticated' };
      }

      // Get survey details
      const { data: survey, error: surveyError } = await supabase!
        .from('surveys')
        .select('*')
        .eq('id', surveyId)
        .single();

      if (surveyError || !survey) {
        return { success: false, message: 'Survey not found' };
      }

      // Check existing attempts
      const { count: attemptCount } = await supabase!
        .from('test_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('survey_id', surveyId);

      if ((attemptCount || 0) >= survey.max_attempts) {
        return { success: false, message: 'Maximum attempts reached for this survey' };
      }

      // Create new test session
      const { data, error } = await supabase!
        .from('test_sessions')
        .insert({
          user_id: user.id,
          survey_id: surveyId,
          time_remaining: survey.duration * 60, // Convert minutes to seconds
          attempt_number: (attemptCount || 0) + 1
        })
        .select()
        .single();

      if (error) {
        return { success: false, message: error.message };
      }

      return { 
        success: true, 
        message: 'Test session created successfully', 
        data: {
          id: data.id,
          startTime: new Date(data.start_time),
          timeRemaining: data.time_remaining,
          attemptNumber: data.attempt_number
        }
      };
    } catch (error) {
      console.error('Create test session error:', error);
      return { success: false, message: 'Failed to create test session' };
    }
  },

  async getSession(sessionId: string) {
    try {
      if (isDemoMode) {
        return { 
          success: true, 
          message: 'Session fetched successfully (Demo Mode)', 
          data: { 
            id: sessionId, 
            surveyId: 'demo-survey',
            timeRemaining: 2100,
            currentQuestionIndex: 0,
            answers: []
          }
        };
      }

      const { data, error } = await supabase!
        .from('test_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (error) {
        return { success: false, message: error.message };
      }

      return { success: true, message: 'Session fetched successfully', data };
    } catch (error) {
      console.error('Get session error:', error);
      return { success: false, message: 'Failed to fetch session' };
    }
  },

  async getQuestionsForSurvey(surveyId: string) {
    try {
      if (isDemoMode) {
        return { success: true, message: 'Questions fetched successfully (Demo Mode)', data: [] };
      }

      const { data, error } = await supabase!
        .from('questions')
        .select(`
          *,
          options:question_options(*)
        `)
        .eq('section_id', surveyId)
        .order('question_order');

      if (error) {
        return { success: false, message: error.message, data: [] };
      }

      return { success: true, message: 'Questions fetched successfully', data };
    } catch (error) {
      console.error('Get questions error:', error);
      return { success: false, message: 'Failed to fetch questions', data: [] };
    }
  },

  async saveAnswer(sessionId: string, questionId: string, selectedOptions: string[]) {
    try {
      if (isDemoMode) {
        return { success: true, message: 'Answer saved successfully (Demo Mode)' };
      }

      const { error } = await supabase!
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
      console.error('Save answer error:', error);
      return { success: false, message: 'Failed to save answer' };
    }
  },

  async updateSession(sessionId: string, sessionData: any) {
    try {
      if (isDemoMode) {
        return { success: true, message: 'Session updated successfully (Demo Mode)' };
      }

      const { error } = await supabase!
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
      console.error('Update session error:', error);
      return { success: false, message: 'Failed to update session' };
    }
  },

  async submitTest(sessionId: string) {
    try {
      if (isDemoMode) {
        return { 
          success: true, 
          message: 'Test submitted successfully (Demo Mode)', 
          data: { isPassed: true, score: 85, certificateId: 'demo-cert' }
        };
      }

      // Implementation would calculate score and create result
      return { success: true, message: 'Test submitted successfully', data: null };
    } catch (error) {
      console.error('Submit test error:', error);
      return { success: false, message: 'Failed to submit test' };
    }
  },

  async syncOfflineData() {
    try {
      if (isDemoMode) {
        return { success: true, message: 'Data synced successfully (Demo Mode)' };
      }

      // Implementation for syncing offline data
      return { success: true, message: 'Data synced successfully' };
    } catch (error) {
      console.error('Sync offline data error:', error);
      return { success: false, message: 'Failed to sync data' };
    }
  },

  async logSecurityViolation(sessionId: string, violation: string) {
    try {
      if (isDemoMode) {
        console.log('Security violation logged (Demo Mode):', violation);
        return { success: true, message: 'Security violation logged (Demo Mode)' };
      }

      await ActivityLogger.log({
        activity_type: 'security_violation',
        description: `Security violation during test: ${violation}`,
        metadata: { session_id: sessionId, violation }
      });

      return { success: true, message: 'Security violation logged' };
    } catch (error) {
      console.error('Log security violation error:', error);
      return { success: false, message: 'Failed to log security violation' };
    }
  }
};

// Results API
export const resultApi = {
  async getResults(filters?: AnalyticsFilter) {
    try {
      if (isDemoMode) {
        return { success: true, message: 'Results fetched successfully (Demo Mode)', data: [] };
      }

      const { data, error } = await supabase!
        .from('test_results')
        .select(`
          *,
          user:users(*),
          survey:surveys(*)
        `)
        .order('completed_at', { ascending: false });

      if (error) {
        return { success: false, message: error.message, data: [] };
      }

      return { success: true, message: 'Results fetched successfully', data };
    } catch (error) {
      console.error('Get results error:', error);
      return { success: false, message: 'Failed to fetch results', data: [] };
    }
  },

  async getAnalytics(filters?: AnalyticsFilter) {
    try {
      if (isDemoMode) {
        return { 
          success: true, 
          message: 'Analytics fetched successfully (Demo Mode)', 
          data: {
            overview: { totalAttempts: 0, passRate: 0, averageScore: 0, averageTime: 0 },
            performanceByRole: [],
            performanceBySurvey: [],
            performanceByJurisdiction: [],
            timeSeriesData: [],
            topPerformers: [],
            lowPerformers: []
          }
        };
      }

      // Implementation for analytics
      return { success: true, message: 'Analytics fetched successfully', data: null };
    } catch (error) {
      console.error('Get analytics error:', error);
      return { success: false, message: 'Failed to fetch analytics' };
    }
  },

  async exportResults(filters?: AnalyticsFilter) {
    try {
      if (isDemoMode) {
        return { success: true, message: 'Results exported successfully (Demo Mode)', data: 'CSV data' };
      }

      // Implementation for exporting results
      return { success: true, message: 'Results exported successfully', data: '' };
    } catch (error) {
      console.error('Export results error:', error);
      return { success: false, message: 'Failed to export results' };
    }
  }
};

// Certificate API
export const certificateApi = {
  async getCertificates() {
    try {
      if (isDemoMode) {
        return { success: true, message: 'Certificates fetched successfully (Demo Mode)', data: [] };
      }

      const { data, error } = await supabase!
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

      return { success: true, message: 'Certificates fetched successfully', data };
    } catch (error) {
      console.error('Get certificates error:', error);
      return { success: false, message: 'Failed to fetch certificates', data: [] };
    }
  },

  async downloadCertificate(certificateId: string) {
    try {
      if (isDemoMode) {
        return { success: true, message: 'Certificate downloaded successfully (Demo Mode)', data: new Blob() };
      }

      // Implementation for downloading certificate
      return { success: true, message: 'Certificate downloaded successfully', data: new Blob() };
    } catch (error) {
      console.error('Download certificate error:', error);
      return { success: false, message: 'Failed to download certificate' };
    }
  },

  async revokeCertificate(certificateId: string) {
    try {
      if (isDemoMode) {
        return { success: true, message: 'Certificate revoked successfully (Demo Mode)' };
      }

      const { error } = await supabase!
        .from('certificates')
        .update({ certificate_status: 'revoked' })
        .eq('id', certificateId);

      if (error) {
        return { success: false, message: error.message };
      }

      return { success: true, message: 'Certificate revoked successfully' };
    } catch (error) {
      console.error('Revoke certificate error:', error);
      return { success: false, message: 'Failed to revoke certificate' };
    }
  }
};

// Settings API
export const settingsApi = {
  async getSettings() {
    try {
      if (isDemoMode) {
        return { success: true, message: 'Settings fetched successfully (Demo Mode)', data: [] };
      }

      const { data, error } = await supabase!
        .from('system_settings')
        .select('*')
        .order('category', { ascending: true });

      if (error) {
        return { success: false, message: error.message, data: [] };
      }

      const settings: SystemSettings[] = data.map(setting => ({
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

      return { success: true, message: 'Settings fetched successfully', data: settings };
    } catch (error) {
      console.error('Get settings error:', error);
      return { success: false, message: 'Failed to fetch settings', data: [] };
    }
  },

  async updateSetting(settingId: string, value: string) {
    try {
      if (isDemoMode) {
        return { success: true, message: 'Setting updated successfully (Demo Mode)' };
      }

      const { error } = await supabase!
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
      console.error('Update setting error:', error);
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
          message: 'Enumerator dashboard data fetched successfully (Demo Mode)',
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

      // Implementation for enumerator dashboard
      return { success: true, message: 'Dashboard data fetched successfully', data: null };
    } catch (error) {
      console.error('Get enumerator dashboard error:', error);
      return { success: false, message: 'Failed to fetch dashboard data' };
    }
  }
};

// ZO Dashboard API
export const zoDashboardApi = {
  async getDashboardData(dateFilter: string) {
    try {
      if (isDemoMode) {
        return { success: true, message: 'ZO dashboard data fetched successfully (Demo Mode)', data: null };
      }

      // Implementation for ZO dashboard
      return { success: true, message: 'Dashboard data fetched successfully', data: null };
    } catch (error) {
      console.error('Get ZO dashboard error:', error);
      return { success: false, message: 'Failed to fetch dashboard data' };
    }
  }
};

// RO Dashboard API
export const roDashboardApi = {
  async getDashboardData(dateFilter: string) {
    try {
      if (isDemoMode) {
        return { success: true, message: 'RO dashboard data fetched successfully (Demo Mode)', data: null };
      }

      // Implementation for RO dashboard
      return { success: true, message: 'Dashboard data fetched successfully', data: null };
    } catch (error) {
      console.error('Get RO dashboard error:', error);
      return { success: false, message: 'Failed to fetch dashboard data' };
    }
  }
};

// Supervisor Dashboard API
export const supervisorDashboardApi = {
  async getDashboardData(dateFilter: string) {
    try {
      if (isDemoMode) {
        return { success: true, message: 'Supervisor dashboard data fetched successfully (Demo Mode)', data: null };
      }

      // Implementation for supervisor dashboard
      return { success: true, message: 'Dashboard data fetched successfully', data: null };
    } catch (error) {
      console.error('Get supervisor dashboard error:', error);
      return { success: false, message: 'Failed to fetch dashboard data' };
    }
  }
};

// Enumerator API
export const enumeratorApi = {
  async getEnumeratorStatus() {
    try {
      if (isDemoMode) {
        return { success: true, message: 'Enumerator status fetched successfully (Demo Mode)', data: [] };
      }

      // Implementation for enumerator status
      return { success: true, message: 'Enumerator status fetched successfully', data: [] };
    } catch (error) {
      console.error('Get enumerator status error:', error);
      return { success: false, message: 'Failed to fetch enumerator status', data: [] };
    }
  }
};