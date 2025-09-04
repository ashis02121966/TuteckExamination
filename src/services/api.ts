import { supabase, supabaseAdmin, isDemoMode } from '../lib/supabase';
import { User, Role, Survey, TestResult, Certificate, SystemSettings, TestSession, Question, AnalyticsData, AnalyticsFilter, Dashboard, ZODashboard, RODashboard, SupervisorDashboard, EnumeratorDashboard, Activity, PerformanceData, MonthlyTrend, ApiResponse, PaginatedResponse } from '../types';
import bcrypt from 'bcryptjs';
import { ActivityLogger } from './activityLogger';

// Demo data for when Supabase is not configured
const demoUsers = [
  {
    id: '550e8400-e29b-41d4-a716-446655440010',
    email: 'admin@esigma.com',
    password: 'password123',
    name: 'System Administrator',
    role: {
      id: '550e8400-e29b-41d4-a716-446655440001',
      name: 'Administrator',
      description: 'System Administrator with full access',
      level: 1,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      menuAccess: ['/dashboard', '/users', '/roles', '/surveys', '/questions', '/results', '/certificates', '/settings']
    },
    roleId: '550e8400-e29b-41d4-a716-446655440001',
    isActive: true,
    jurisdiction: 'National',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440011',
    email: 'enumerator@esigma.com',
    password: 'password123',
    name: 'Field Enumerator',
    role: {
      id: '550e8400-e29b-41d4-a716-446655440006',
      name: 'Enumerator',
      description: 'Field Enumerator with test access',
      level: 6,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      menuAccess: ['/enumerator-dashboard', '/available-tests', '/my-results', '/my-certificates']
    },
    roleId: '550e8400-e29b-41d4-a716-446655440006',
    isActive: true,
    jurisdiction: 'Block A, Central Delhi',
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

// Authentication API
export const authApi = {
  async login(email: string, password: string): Promise<ApiResponse<{ user: User; token: string; session?: any }>> {
    try {
      if (isDemoMode) {
        // Demo mode authentication
        const demoUser = demoUsers.find(u => u.email === email && u.password === password);
        if (demoUser) {
          return {
            success: true,
            message: 'Login successful (Demo Mode)',
            data: {
              user: demoUser as User,
              token: 'demo-token-' + Date.now()
            }
          };
        }
        return {
          success: false,
          message: 'Invalid credentials'
        };
      }

      // Real Supabase authentication
      const { data: authData, error: authError } = await supabase!.auth.signInWithPassword({
        email,
        password
      });

      if (authError) {
        return {
          success: false,
          message: authError.message
        };
      }

      if (!authData.user) {
        return {
          success: false,
          message: 'Authentication failed'
        };
      }

      // Fetch user profile from database
      const { data: userData, error: userError } = await supabase!
        .from('users')
        .select(`
          *,
          role:roles(*)
        `)
        .eq('id', authData.user.id)
        .single();

      if (userError || !userData) {
        return {
          success: false,
          message: 'User profile not found'
        };
      }

      // Update last login
      await supabase!
        .from('users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', authData.user.id);

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
        profileImage: userData.profile_image,
        parentId: userData.parent_id,
        lastLogin: userData.last_login ? new Date(userData.last_login) : undefined,
        passwordChangedAt: userData.password_changed_at ? new Date(userData.password_changed_at) : undefined,
        createdAt: new Date(userData.created_at),
        updatedAt: new Date(userData.updated_at)
      };

      // Log successful login
      await ActivityLogger.logLogin(user.id, user.email);

      return {
        success: true,
        message: 'Login successful',
        data: {
          user,
          token: authData.session.access_token,
          session: authData.session
        }
      };
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        message: 'Login failed. Please try again.'
      };
    }
  },

  async logout(): Promise<ApiResponse<void>> {
    try {
      if (isDemoMode) {
        return { success: true, message: 'Logged out (Demo Mode)' };
      }

      const { error } = await supabase!.auth.signOut();
      if (error) {
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
      console.error('Logout error:', error);
      return {
        success: false,
        message: 'Logout failed'
      };
    }
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<ApiResponse<void>> {
    try {
      if (isDemoMode) {
        return { success: true, message: 'Password changed (Demo Mode)' };
      }

      const { error } = await supabase!.auth.updateUser({
        password: newPassword
      });

      if (error) {
        return {
          success: false,
          message: error.message
        };
      }

      // Update password_changed_at in custom users table
      const { data: { user } } = await supabase!.auth.getUser();
      if (user) {
        await supabase!
          .from('users')
          .update({ password_changed_at: new Date().toISOString() })
          .eq('id', user.id);
      }

      return {
        success: true,
        message: 'Password changed successfully'
      };
    } catch (error) {
      console.error('Password change error:', error);
      return {
        success: false,
        message: 'Failed to change password'
      };
    }
  }
};

// User API
export const userApi = {
  async getUsers(): Promise<ApiResponse<User[]>> {
    try {
      if (isDemoMode) {
        return {
          success: true,
          message: 'Users fetched (Demo Mode)',
          data: demoUsers as User[]
        };
      }

      const { data, error } = await supabase!
        .from('users')
        .select(`
          *,
          role:roles(*)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        return {
          success: false,
          message: error.message
        };
      }

      const users: User[] = (data || []).map(userData => ({
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
        profileImage: userData.profile_image,
        parentId: userData.parent_id,
        lastLogin: userData.last_login ? new Date(userData.last_login) : undefined,
        passwordChangedAt: userData.password_changed_at ? new Date(userData.password_changed_at) : undefined,
        createdAt: new Date(userData.created_at),
        updatedAt: new Date(userData.updated_at)
      }));

      return {
        success: true,
        message: 'Users fetched successfully',
        data: users
      };
    } catch (error) {
      console.error('Failed to fetch users:', error);
      return {
        success: false,
        message: 'Failed to fetch users'
      };
    }
  },

  async createUser(userData: any): Promise<ApiResponse<User>> {
    try {
      if (isDemoMode) {
        return {
          success: false,
          message: 'User creation not available in demo mode'
        };
      }

      // Create user in Supabase Auth
      const { data: authData, error: authError } = await supabaseAdmin!.auth.admin.createUser({
        email: userData.email,
        password: userData.password,
        email_confirm: true,
        user_metadata: {
          name: userData.name
        }
      });

      if (authError || !authData.user) {
        return {
          success: false,
          message: authError?.message || 'Failed to create user'
        };
      }

      // Hash password for custom users table
      const hashedPassword = bcrypt.hashSync(userData.password, 10);

      // Create user profile in custom users table
      const { data: profileData, error: profileError } = await supabase!
        .from('users')
        .insert({
          id: authData.user.id,
          email: userData.email,
          password_hash: hashedPassword,
          name: userData.name,
          role_id: userData.roleId,
          is_active: true,
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
        return {
          success: false,
          message: profileError?.message || 'Failed to create user profile'
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
          updatedAt: new Date(profileData.role.updated_at),
          menuAccess: profileData.role.menu_access
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
        message: 'User created successfully',
        data: user
      };
    } catch (error) {
      console.error('Failed to create user:', error);
      return {
        success: false,
        message: 'Failed to create user'
      };
    }
  },

  async updateUser(userId: string, userData: any): Promise<ApiResponse<User>> {
    try {
      if (isDemoMode) {
        return {
          success: false,
          message: 'User updates not available in demo mode'
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

      // Update password if provided
      if (userData.password && userData.password.trim()) {
        updateData.password_hash = bcrypt.hashSync(userData.password, 10);
        updateData.password_changed_at = new Date().toISOString();

        // Update password in Supabase Auth
        const { error: authError } = await supabaseAdmin!.auth.admin.updateUserById(userId, {
          password: userData.password
        });

        if (authError) {
          return {
            success: false,
            message: authError.message
          };
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

      if (error || !data) {
        return {
          success: false,
          message: error?.message || 'Failed to update user'
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
          updatedAt: new Date(data.role.updated_at),
          menuAccess: data.role.menu_access
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
      console.error('Failed to update user:', error);
      return {
        success: false,
        message: 'Failed to update user'
      };
    }
  },

  async deleteUser(userId: string): Promise<ApiResponse<void>> {
    try {
      if (isDemoMode) {
        return {
          success: false,
          message: 'User deletion not available in demo mode'
        };
      }

      // Delete from custom users table first
      const { error: profileError } = await supabase!
        .from('users')
        .delete()
        .eq('id', userId);

      if (profileError) {
        return {
          success: false,
          message: profileError.message
        };
      }

      // Delete from Supabase Auth
      const { error: authError } = await supabaseAdmin!.auth.admin.deleteUser(userId);

      if (authError) {
        console.error('Failed to delete auth user:', authError);
        // Don't return error here as profile is already deleted
      }

      return {
        success: true,
        message: 'User deleted successfully'
      };
    } catch (error) {
      console.error('Failed to delete user:', error);
      return {
        success: false,
        message: 'Failed to delete user'
      };
    }
  }
};

// Role API
export const roleApi = {
  async getRoles(): Promise<ApiResponse<Role[]>> {
    try {
      if (isDemoMode) {
        return {
          success: true,
          message: 'Roles fetched (Demo Mode)',
          data: demoUsers.map(u => u.role)
        };
      }

      const { data, error } = await supabase!
        .from('roles')
        .select('*')
        .order('level', { ascending: true });

      if (error) {
        return {
          success: false,
          message: error.message
        };
      }

      const roles: Role[] = (data || []).map(roleData => ({
        id: roleData.id,
        name: roleData.name,
        description: roleData.description,
        level: roleData.level,
        isActive: roleData.is_active,
        menuAccess: roleData.menu_access,
        createdAt: new Date(roleData.created_at),
        updatedAt: new Date(roleData.updated_at)
      }));

      return {
        success: true,
        message: 'Roles fetched successfully',
        data: roles
      };
    } catch (error) {
      console.error('Failed to fetch roles:', error);
      return {
        success: false,
        message: 'Failed to fetch roles'
      };
    }
  },

  async createRole(roleData: any): Promise<ApiResponse<Role>> {
    try {
      if (isDemoMode) {
        return {
          success: false,
          message: 'Role creation not available in demo mode'
        };
      }

      const { data, error } = await supabase!
        .from('roles')
        .insert({
          name: roleData.name,
          description: roleData.description,
          level: 5, // Default level
          is_active: true
        })
        .select()
        .single();

      if (error || !data) {
        return {
          success: false,
          message: error?.message || 'Failed to create role'
        };
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

      return {
        success: true,
        message: 'Role created successfully',
        data: role
      };
    } catch (error) {
      console.error('Failed to create role:', error);
      return {
        success: false,
        message: 'Failed to create role'
      };
    }
  },

  async updateRole(roleId: string, roleData: any): Promise<ApiResponse<Role>> {
    try {
      if (isDemoMode) {
        return {
          success: false,
          message: 'Role updates not available in demo mode'
        };
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

      if (error || !data) {
        return {
          success: false,
          message: error?.message || 'Failed to update role'
        };
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

      return {
        success: true,
        message: 'Role updated successfully',
        data: role
      };
    } catch (error) {
      console.error('Failed to update role:', error);
      return {
        success: false,
        message: 'Failed to update role'
      };
    }
  },

  async deleteRole(roleId: string): Promise<ApiResponse<void>> {
    try {
      if (isDemoMode) {
        return {
          success: false,
          message: 'Role deletion not available in demo mode'
        };
      }

      const { error } = await supabase!
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
      console.error('Failed to delete role:', error);
      return {
        success: false,
        message: 'Failed to delete role'
      };
    }
  },

  async getPermissions(): Promise<ApiResponse<any[]>> {
    return {
      success: true,
      message: 'Permissions fetched',
      data: []
    };
  },

  async updateRoleMenuAccess(roleId: string, menuAccess: string[]): Promise<ApiResponse<void>> {
    try {
      if (isDemoMode) {
        return {
          success: false,
          message: 'Menu access updates not available in demo mode'
        };
      }

      const { error } = await supabase!
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
      console.error('Failed to update menu access:', error);
      return {
        success: false,
        message: 'Failed to update menu access'
      };
    }
  }
};

// Survey API
export const surveyApi = {
  async getSurveys(): Promise<ApiResponse<Survey[]>> {
    try {
      if (isDemoMode) {
        return {
          success: true,
          message: 'Surveys fetched (Demo Mode)',
          data: [
            {
              id: '1',
              title: 'Digital Literacy Assessment',
              description: 'Basic computer and digital skills assessment',
              targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              duration: 35,
              totalQuestions: 30,
              passingScore: 70,
              maxAttempts: 3,
              isActive: true,
              sections: [],
              createdAt: new Date(),
              updatedAt: new Date(),
              createdBy: '1'
            }
          ]
        };
      }

      const { data, error } = await supabase!
        .from('surveys')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        return {
          success: false,
          message: error.message
        };
      }

      const surveys: Survey[] = (data || []).map(surveyData => ({
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

      return {
        success: true,
        message: 'Surveys fetched successfully',
        data: surveys
      };
    } catch (error) {
      console.error('Failed to fetch surveys:', error);
      return {
        success: false,
        message: 'Failed to fetch surveys'
      };
    }
  },

  async createSurvey(surveyData: any): Promise<ApiResponse<Survey>> {
    try {
      if (isDemoMode) {
        return {
          success: false,
          message: 'Survey creation not available in demo mode'
        };
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
          is_active: true,
          created_by: surveyData.createdBy
        })
        .select()
        .single();

      if (error || !data) {
        return {
          success: false,
          message: error?.message || 'Failed to create survey'
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
        sections: [],
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
        createdBy: data.created_by
      };

      return {
        success: true,
        message: 'Survey created successfully',
        data: survey
      };
    } catch (error) {
      console.error('Failed to create survey:', error);
      return {
        success: false,
        message: 'Failed to create survey'
      };
    }
  },

  async updateSurvey(surveyId: string, surveyData: any): Promise<ApiResponse<Survey>> {
    try {
      if (isDemoMode) {
        return {
          success: false,
          message: 'Survey updates not available in demo mode'
        };
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

      if (error || !data) {
        return {
          success: false,
          message: error?.message || 'Failed to update survey'
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
        sections: [],
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
        createdBy: data.created_by
      };

      return {
        success: true,
        message: 'Survey updated successfully',
        data: survey
      };
    } catch (error) {
      console.error('Failed to update survey:', error);
      return {
        success: false,
        message: 'Failed to update survey'
      };
    }
  },

  async deleteSurvey(surveyId: string): Promise<ApiResponse<void>> {
    try {
      if (isDemoMode) {
        return {
          success: false,
          message: 'Survey deletion not available in demo mode'
        };
      }

      const { error } = await supabase!
        .from('surveys')
        .delete()
        .eq('id', surveyId);

      if (error) {
        return {
          success: false,
          message: error.message
        };
      }

      return {
        success: true,
        message: 'Survey deleted successfully'
      };
    } catch (error) {
      console.error('Failed to delete survey:', error);
      return {
        success: false,
        message: 'Failed to delete survey'
      };
    }
  }
};

// Dashboard API
export const dashboardApi = {
  async getDashboardData(): Promise<ApiResponse<Dashboard>> {
    try {
      if (isDemoMode) {
        return {
          success: true,
          message: 'Dashboard data fetched (Demo Mode)',
          data: {
            totalUsers: 125,
            totalSurveys: 8,
            totalAttempts: 342,
            averageScore: 78.5,
            passRate: 82.3,
            recentActivity: [],
            performanceByRole: [
              { name: 'Admin', value: 5, total: 5, percentage: 100 },
              { name: 'Supervisor', value: 15, total: 20, percentage: 75 },
              { name: 'Enumerator', value: 85, total: 100, percentage: 85 }
            ],
            performanceBySurvey: [
              { name: 'Digital Literacy', value: 45, total: 60, percentage: 75 },
              { name: 'Data Collection', value: 30, total: 40, percentage: 75 }
            ],
            monthlyTrends: []
          }
        };
      }

      // Fetch real data from Supabase
      const [usersResult, surveysResult, attemptsResult, resultsResult] = await Promise.all([
        supabase!.from('users').select('id, role_id, roles(name)'),
        supabase!.from('surveys').select('id, is_active'),
        supabase!.from('test_sessions').select('id'),
        supabase!.from('test_results').select('id, score, is_passed')
      ]);

      const totalUsers = usersResult.data?.length || 0;
      const totalSurveys = surveysResult.data?.filter(s => s.is_active).length || 0;
      const totalAttempts = attemptsResult.data?.length || 0;
      const results = resultsResult.data || [];
      const averageScore = results.length > 0 ? results.reduce((sum, r) => sum + r.score, 0) / results.length : 0;
      const passRate = results.length > 0 ? (results.filter(r => r.is_passed).length / results.length) * 100 : 0;

      // Calculate performance by role
      const rolePerformance = usersResult.data?.reduce((acc, user) => {
        const roleName = user.roles?.name || 'Unknown';
        if (!acc[roleName]) {
          acc[roleName] = { count: 0, total: 0 };
        }
        acc[roleName].count++;
        acc[roleName].total++;
        return acc;
      }, {} as Record<string, { count: number; total: number }>) || {};

      const performanceByRole = Object.entries(rolePerformance).map(([name, data]) => ({
        name,
        value: data.count,
        total: data.total,
        percentage: (data.count / data.total) * 100
      }));

      const dashboardData: Dashboard = {
        totalUsers,
        totalSurveys,
        totalAttempts,
        averageScore,
        passRate,
        recentActivity: [],
        performanceByRole,
        performanceBySurvey: [],
        monthlyTrends: []
      };

      return {
        success: true,
        message: 'Dashboard data fetched successfully',
        data: dashboardData
      };
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      return {
        success: false,
        message: 'Failed to fetch dashboard data'
      };
    }
  }
};

// Test API
export const testApi = {
  async createTestSession(surveyId: string): Promise<ApiResponse<TestSession>> {
    try {
      if (isDemoMode) {
        return {
          success: false,
          message: 'Test sessions not available in demo mode'
        };
      }

      const { data: { user } } = await supabase!.auth.getUser();
      if (!user) {
        return {
          success: false,
          message: 'User not authenticated'
        };
      }

      // Get survey details
      const { data: survey, error: surveyError } = await supabase!
        .from('surveys')
        .select('*')
        .eq('id', surveyId)
        .single();

      if (surveyError || !survey) {
        return {
          success: false,
          message: 'Survey not found'
        };
      }

      // Create test session
      const { data, error } = await supabase!
        .from('test_sessions')
        .insert({
          user_id: user.id,
          survey_id: surveyId,
          time_remaining: survey.duration * 60, // Convert minutes to seconds
          session_status: 'in_progress',
          attempt_number: 1
        })
        .select()
        .single();

      if (error || !data) {
        return {
          success: false,
          message: error?.message || 'Failed to create test session'
        };
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
      console.error('Failed to create test session:', error);
      return {
        success: false,
        message: 'Failed to create test session'
      };
    }
  },

  async getSession(sessionId: string): Promise<ApiResponse<TestSession>> {
    try {
      if (isDemoMode) {
        return {
          success: false,
          message: 'Test sessions not available in demo mode'
        };
      }

      const { data, error } = await supabase!
        .from('test_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (error || !data) {
        return {
          success: false,
          message: 'Test session not found'
        };
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
        message: 'Test session fetched successfully',
        data: session
      };
    } catch (error) {
      console.error('Failed to fetch test session:', error);
      return {
        success: false,
        message: 'Failed to fetch test session'
      };
    }
  },

  async getQuestionsForSurvey(surveyId: string): Promise<ApiResponse<Question[]>> {
    try {
      if (isDemoMode) {
        return {
          success: true,
          message: 'Questions fetched (Demo Mode)',
          data: [
            {
              id: '1',
              sectionId: '1',
              text: 'What is the primary function of an operating system?',
              type: 'single_choice',
              complexity: 'easy',
              options: [
                { id: '1', text: 'To manage hardware and software resources', isCorrect: true },
                { id: '2', text: 'To create documents', isCorrect: false },
                { id: '3', text: 'To browse the internet', isCorrect: false },
                { id: '4', text: 'To play games', isCorrect: false }
              ],
              correctAnswers: ['1'],
              points: 1,
              order: 1,
              createdAt: new Date(),
              updatedAt: new Date()
            }
          ]
        };
      }

      const { data, error } = await supabase!
        .from('questions')
        .select(`
          *,
          options:question_options(*),
          section:survey_sections(*)
        `)
        .eq('section.survey_id', surveyId)
        .order('question_order', { ascending: true });

      if (error) {
        return {
          success: false,
          message: error.message
        };
      }

      const questions: Question[] = (data || []).map(questionData => ({
        id: questionData.id,
        sectionId: questionData.section_id,
        text: questionData.text,
        type: questionData.question_type as any,
        complexity: questionData.complexity as any,
        options: (questionData.options || []).map((opt: any) => ({
          id: opt.id,
          text: opt.text,
          isCorrect: opt.is_correct
        })),
        correctAnswers: (questionData.options || [])
          .filter((opt: any) => opt.is_correct)
          .map((opt: any) => opt.id),
        explanation: questionData.explanation,
        points: questionData.points,
        order: questionData.question_order,
        createdAt: new Date(questionData.created_at),
        updatedAt: new Date(questionData.updated_at)
      }));

      return {
        success: true,
        message: 'Questions fetched successfully',
        data: questions
      };
    } catch (error) {
      console.error('Failed to fetch questions:', error);
      return {
        success: false,
        message: 'Failed to fetch questions'
      };
    }
  },

  async saveAnswer(sessionId: string, questionId: string, selectedOptions: string[]): Promise<ApiResponse<void>> {
    try {
      if (isDemoMode) {
        return { success: true, message: 'Answer saved (Demo Mode)' };
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
        return {
          success: false,
          message: error.message
        };
      }

      return {
        success: true,
        message: 'Answer saved successfully'
      };
    } catch (error) {
      console.error('Failed to save answer:', error);
      return {
        success: false,
        message: 'Failed to save answer'
      };
    }
  },

  async updateSession(sessionId: string, sessionData: any): Promise<ApiResponse<void>> {
    try {
      if (isDemoMode) {
        return { success: true, message: 'Session updated (Demo Mode)' };
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
        return {
          success: false,
          message: error.message
        };
      }

      return {
        success: true,
        message: 'Session updated successfully'
      };
    } catch (error) {
      console.error('Failed to update session:', error);
      return {
        success: false,
        message: 'Failed to update session'
      };
    }
  },

  async submitTest(sessionId: string): Promise<ApiResponse<any>> {
    try {
      if (isDemoMode) {
        return {
          success: true,
          message: 'Test submitted (Demo Mode)',
          data: { score: 85, isPassed: true }
        };
      }

      // Get session and answers
      const { data: session, error: sessionError } = await supabase!
        .from('test_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (sessionError || !session) {
        return {
          success: false,
          message: 'Test session not found'
        };
      }

      // Get all answers for this session
      const { data: answers, error: answersError } = await supabase!
        .from('test_answers')
        .select('*')
        .eq('session_id', sessionId);

      if (answersError) {
        return {
          success: false,
          message: 'Failed to fetch answers'
        };
      }

      // Calculate score (simplified)
      const totalQuestions = 30; // This should come from survey
      const correctAnswers = answers?.filter(a => a.is_correct).length || 0;
      const score = Math.round((correctAnswers / totalQuestions) * 100);
      const isPassed = score >= 70; // This should come from survey passing score

      // Create test result
      const { data: result, error: resultError } = await supabase!
        .from('test_results')
        .insert({
          user_id: session.user_id,
          survey_id: session.survey_id,
          session_id: sessionId,
          score,
          total_questions: totalQuestions,
          correct_answers: correctAnswers,
          is_passed: isPassed,
          time_spent: (35 * 60) - session.time_remaining, // Calculate time spent
          attempt_number: session.attempt_number
        })
        .select()
        .single();

      if (resultError || !result) {
        return {
          success: false,
          message: 'Failed to save test result'
        };
      }

      // Update session status
      await supabase!
        .from('test_sessions')
        .update({
          session_status: 'completed',
          end_time: new Date().toISOString(),
          score,
          is_passed: isPassed,
          completed_at: new Date().toISOString()
        })
        .eq('id', sessionId);

      return {
        success: true,
        message: 'Test submitted successfully',
        data: { score, isPassed, resultId: result.id }
      };
    } catch (error) {
      console.error('Failed to submit test:', error);
      return {
        success: false,
        message: 'Failed to submit test'
      };
    }
  },

  async syncOfflineData(): Promise<ApiResponse<void>> {
    return { success: true, message: 'Data synced' };
  },

  async logSecurityViolation(sessionId: string, violation: string): Promise<ApiResponse<void>> {
    try {
      if (isDemoMode) {
        return { success: true, message: 'Security violation logged (Demo Mode)' };
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
      console.error('Failed to log security violation:', error);
      return {
        success: false,
        message: 'Failed to log security violation'
      };
    }
  }
};

// Results API
export const resultApi = {
  async getResults(filters?: AnalyticsFilter): Promise<ApiResponse<TestResult[]>> {
    try {
      if (isDemoMode) {
        return {
          success: true,
          message: 'Results fetched (Demo Mode)',
          data: []
        };
      }

      const { data, error } = await supabase!
        .from('test_results')
        .select(`
          *,
          user:users(*,role:roles(*)),
          survey:surveys(*)
        `)
        .order('completed_at', { ascending: false });

      if (error) {
        return {
          success: false,
          message: error.message
        };
      }

      const results: TestResult[] = (data || []).map(resultData => ({
        id: resultData.id,
        userId: resultData.user_id,
        user: {
          id: resultData.user.id,
          email: resultData.user.email,
          name: resultData.user.name,
          roleId: resultData.user.role_id,
          role: {
            id: resultData.user.role.id,
            name: resultData.user.role.name,
            description: resultData.user.role.description,
            level: resultData.user.role.level,
            isActive: resultData.user.role.is_active,
            createdAt: new Date(resultData.user.role.created_at),
            updatedAt: new Date(resultData.user.role.updated_at)
          },
          isActive: resultData.user.is_active,
          jurisdiction: resultData.user.jurisdiction,
          createdAt: new Date(resultData.user.created_at),
          updatedAt: new Date(resultData.user.updated_at)
        },
        surveyId: resultData.survey_id,
        survey: {
          id: resultData.survey.id,
          title: resultData.survey.title,
          description: resultData.survey.description,
          targetDate: new Date(resultData.survey.target_date),
          duration: resultData.survey.duration,
          totalQuestions: resultData.survey.total_questions,
          passingScore: resultData.survey.passing_score,
          maxAttempts: resultData.survey.max_attempts,
          isActive: resultData.survey.is_active,
          sections: [],
          createdAt: new Date(resultData.survey.created_at),
          updatedAt: new Date(resultData.survey.updated_at),
          createdBy: resultData.survey.created_by
        },
        sessionId: resultData.session_id,
        score: resultData.score,
        totalQuestions: resultData.total_questions,
        correctAnswers: resultData.correct_answers,
        isPassed: resultData.is_passed,
        timeSpent: resultData.time_spent,
        attemptNumber: resultData.attempt_number,
        sectionScores: [],
        completedAt: new Date(resultData.completed_at),
        certificateId: resultData.certificate_id,
        grade: resultData.grade
      }));

      return {
        success: true,
        message: 'Results fetched successfully',
        data: results
      };
    } catch (error) {
      console.error('Failed to fetch results:', error);
      return {
        success: false,
        message: 'Failed to fetch results'
      };
    }
  },

  async getAnalytics(filters?: AnalyticsFilter): Promise<ApiResponse<AnalyticsData>> {
    try {
      if (isDemoMode) {
        return {
          success: true,
          message: 'Analytics fetched (Demo Mode)',
          data: {
            overview: {
              totalAttempts: 150,
              passRate: 75.5,
              averageScore: 78.2,
              averageTime: 28
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

      // Fetch analytics data from Supabase
      const { data: results, error } = await supabase!
        .from('test_results')
        .select(`
          *,
          user:users(role:roles(*))
        `);

      if (error) {
        return {
          success: false,
          message: error.message
        };
      }

      const totalAttempts = results?.length || 0;
      const passedAttempts = results?.filter(r => r.is_passed).length || 0;
      const passRate = totalAttempts > 0 ? (passedAttempts / totalAttempts) * 100 : 0;
      const averageScore = totalAttempts > 0 ? results!.reduce((sum, r) => sum + r.score, 0) / totalAttempts : 0;
      const averageTime = totalAttempts > 0 ? results!.reduce((sum, r) => sum + r.time_spent, 0) / totalAttempts / 60 : 0;

      const analyticsData: AnalyticsData = {
        overview: {
          totalAttempts,
          passRate,
          averageScore,
          averageTime
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
        message: 'Analytics fetched successfully',
        data: analyticsData
      };
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
      return {
        success: false,
        message: 'Failed to fetch analytics'
      };
    }
  },

  async exportResults(filters?: AnalyticsFilter): Promise<ApiResponse<string>> {
    return {
      success: true,
      message: 'Results exported',
      data: 'CSV data here'
    };
  }
};

// Certificate API
export const certificateApi = {
  async getCertificates(): Promise<ApiResponse<Certificate[]>> {
    try {
      if (isDemoMode) {
        return {
          success: true,
          message: 'Certificates fetched (Demo Mode)',
          data: []
        };
      }

      const { data, error } = await supabase!
        .from('certificates')
        .select(`
          *,
          user:users(*,role:roles(*)),
          survey:surveys(*)
        `)
        .order('issued_at', { ascending: false });

      if (error) {
        return {
          success: false,
          message: error.message
        };
      }

      const certificates: Certificate[] = (data || []).map(certData => ({
        id: certData.id,
        userId: certData.user_id,
        user: {
          id: certData.user.id,
          email: certData.user.email,
          name: certData.user.name,
          roleId: certData.user.role_id,
          role: {
            id: certData.user.role.id,
            name: certData.user.role.name,
            description: certData.user.role.description,
            level: certData.user.role.level,
            isActive: certData.user.role.is_active,
            createdAt: new Date(certData.user.role.created_at),
            updatedAt: new Date(certData.user.role.updated_at)
          },
          isActive: certData.user.is_active,
          jurisdiction: certData.user.jurisdiction,
          createdAt: new Date(certData.user.created_at),
          updatedAt: new Date(certData.user.updated_at)
        },
        surveyId: certData.survey_id,
        survey: {
          id: certData.survey.id,
          title: certData.survey.title,
          description: certData.survey.description,
          targetDate: new Date(certData.survey.target_date),
          duration: certData.survey.duration,
          totalQuestions: certData.survey.total_questions,
          passingScore: certData.survey.passing_score,
          maxAttempts: certData.survey.max_attempts,
          isActive: certData.survey.is_active,
          sections: [],
          createdAt: new Date(certData.survey.created_at),
          updatedAt: new Date(certData.survey.updated_at),
          createdBy: certData.survey.created_by
        },
        resultId: certData.result_id,
        certificateNumber: certData.certificate_number,
        issuedAt: new Date(certData.issued_at),
        validUntil: certData.valid_until ? new Date(certData.valid_until) : undefined,
        downloadCount: certData.download_count,
        status: certData.certificate_status as any
      }));

      return {
        success: true,
        message: 'Certificates fetched successfully',
        data: certificates
      };
    } catch (error) {
      console.error('Failed to fetch certificates:', error);
      return {
        success: false,
        message: 'Failed to fetch certificates'
      };
    }
  },

  async downloadCertificate(certificateId: string): Promise<ApiResponse<Blob>> {
    try {
      if (isDemoMode) {
        return {
          success: false,
          message: 'Certificate download not available in demo mode'
        };
      }

      // Update download count
      await supabase!
        .from('certificates')
        .update({ download_count: supabase!.sql`download_count + 1` })
        .eq('id', certificateId);

      // Return a dummy PDF blob for now
      const blob = new Blob(['PDF content'], { type: 'application/pdf' });
      
      return {
        success: true,
        message: 'Certificate downloaded',
        data: blob
      };
    } catch (error) {
      console.error('Failed to download certificate:', error);
      return {
        success: false,
        message: 'Failed to download certificate'
      };
    }
  },

  async revokeCertificate(certificateId: string): Promise<ApiResponse<void>> {
    try {
      if (isDemoMode) {
        return {
          success: false,
          message: 'Certificate revocation not available in demo mode'
        };
      }

      const { error } = await supabase!
        .from('certificates')
        .update({ certificate_status: 'revoked' })
        .eq('id', certificateId);

      if (error) {
        return {
          success: false,
          message: error.message
        };
      }

      return {
        success: true,
        message: 'Certificate revoked successfully'
      };
    } catch (error) {
      console.error('Failed to revoke certificate:', error);
      return {
        success: false,
        message: 'Failed to revoke certificate'
      };
    }
  }
};

// Settings API
export const settingsApi = {
  async getSettings(): Promise<ApiResponse<SystemSettings[]>> {
    try {
      if (isDemoMode) {
        return {
          success: true,
          message: 'Settings fetched (Demo Mode)',
          data: [
            {
              id: '1',
              category: 'general',
              key: 'site_name',
              value: 'eSigma Survey Platform',
              description: 'Application name',
              type: 'string',
              isEditable: true,
              updatedAt: new Date(),
              updatedBy: 'admin'
            }
          ]
        };
      }

      const { data, error } = await supabase!
        .from('system_settings')
        .select('*')
        .order('category', { ascending: true });

      if (error) {
        return {
          success: false,
          message: error.message
        };
      }

      const settings: SystemSettings[] = (data || []).map(settingData => ({
        id: settingData.id,
        category: settingData.category,
        key: settingData.setting_key,
        value: settingData.setting_value,
        description: settingData.description,
        type: settingData.setting_type as any,
        isEditable: settingData.is_editable,
        options: settingData.options,
        updatedAt: new Date(settingData.updated_at),
        updatedBy: settingData.updated_by || 'system'
      }));

      return {
        success: true,
        message: 'Settings fetched successfully',
        data: settings
      };
    } catch (error) {
      console.error('Failed to fetch settings:', error);
      return {
        success: false,
        message: 'Failed to fetch settings'
      };
    }
  },

  async updateSetting(settingId: string, value: string): Promise<ApiResponse<void>> {
    try {
      if (isDemoMode) {
        return {
          success: false,
          message: 'Setting updates not available in demo mode'
        };
      }

      const { data: { user } } = await supabase!.auth.getUser();
      
      const { error } = await supabase!
        .from('system_settings')
        .update({
          setting_value: value,
          updated_at: new Date().toISOString(),
          updated_by: user?.id
        })
        .eq('id', settingId);

      if (error) {
        return {
          success: false,
          message: error.message
        };
      }

      return {
        success: true,
        message: 'Setting updated successfully'
      };
    } catch (error) {
      console.error('Failed to update setting:', error);
      return {
        success: false,
        message: 'Failed to update setting'
      };
    }
  }
};

// Enumerator Dashboard API
export const enumeratorDashboardApi = {
  async getDashboardData(): Promise<ApiResponse<EnumeratorDashboard>> {
    try {
      if (isDemoMode) {
        return {
          success: true,
          message: 'Enumerator dashboard data fetched (Demo Mode)',
          data: {
            availableTests: [
              {
                surveyId: '1',
                title: 'Digital Literacy Assessment',
                description: 'Basic computer skills assessment',
                targetDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                duration: 35,
                totalQuestions: 30,
                passingScore: 70,
                attemptsLeft: 3,
                maxAttempts: 3,
                isEligible: true
              }
            ],
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

      const { data: { user } } = await supabase!.auth.getUser();
      if (!user) {
        return {
          success: false,
          message: 'User not authenticated'
        };
      }

      // Fetch available tests
      const { data: surveys, error: surveysError } = await supabase!
        .from('surveys')
        .select('*')
        .eq('is_active', true);

      if (surveysError) {
        return {
          success: false,
          message: surveysError.message
        };
      }

      // Fetch completed tests
      const { data: results, error: resultsError } = await supabase!
        .from('test_results')
        .select(`
          *,
          survey:surveys(*)
        `)
        .eq('user_id', user.id)
        .order('completed_at', { ascending: false });

      if (resultsError) {
        return {
          success: false,
          message: resultsError.message
        };
      }

      // Fetch certificates
      const { data: certificates, error: certificatesError } = await supabase!
        .from('certificates')
        .select(`
          *,
          survey:surveys(*),
          user:users(*,role:roles(*))
        `)
        .eq('user_id', user.id)
        .order('issued_at', { ascending: false });

      if (certificatesError) {
        return {
          success: false,
          message: certificatesError.message
        };
      }

      const availableTests = (surveys || []).map(survey => ({
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

      const completedTests = (results || []).map(result => ({
        resultId: result.id,
        surveyTitle: result.survey.title,
        score: result.score,
        isPassed: result.is_passed,
        completedAt: new Date(result.completed_at),
        attemptNumber: result.attempt_number,
        certificateId: result.certificate_id
      }));

      const userCertificates = (certificates || []).map(cert => ({
        id: cert.id,
        userId: cert.user_id,
        user: {
          id: cert.user.id,
          email: cert.user.email,
          name: cert.user.name,
          roleId: cert.user.role_id,
          role: {
            id: cert.user.role.id,
            name: cert.user.role.name,
            description: cert.user.role.description,
            level: cert.user.role.level,
            isActive: cert.user.role.is_active,
            createdAt: new Date(cert.user.role.created_at),
            updatedAt: new Date(cert.user.role.updated_at)
          },
          isActive: cert.user.is_active,
          jurisdiction: cert.user.jurisdiction,
          createdAt: new Date(cert.user.created_at),
          updatedAt: new Date(cert.user.updated_at)
        },
        surveyId: cert.survey_id,
        survey: {
          id: cert.survey.id,
          title: cert.survey.title,
          description: cert.survey.description,
          targetDate: new Date(cert.survey.target_date),
          duration: cert.survey.duration,
          totalQuestions: cert.survey.total_questions,
          passingScore: cert.survey.passing_score,
          maxAttempts: cert.survey.max_attempts,
          isActive: cert.survey.is_active,
          sections: [],
          createdAt: new Date(cert.survey.created_at),
          updatedAt: new Date(cert.survey.updated_at),
          createdBy: cert.survey.created_by
        },
        resultId: cert.result_id,
        certificateNumber: cert.certificate_number,
        issuedAt: new Date(cert.issued_at),
        validUntil: cert.valid_until ? new Date(cert.valid_until) : undefined,
        downloadCount: cert.download_count,
        status: cert.certificate_status as any
      }));

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
        upcomingTests: [],
        certificates: userCertificates,
        overallProgress,
        averageScore,
        totalAttempts: completedTests.length,
        passedTests
      };

      return {
        success: true,
        message: 'Enumerator dashboard data fetched successfully',
        data: dashboardData
      };
    } catch (error) {
      console.error('Failed to fetch enumerator dashboard data:', error);
      return {
        success: false,
        message: 'Failed to fetch enumerator dashboard data'
      };
    }
  }
};

// ZO Dashboard API
export const zoDashboardApi = {
  async getDashboardData(dateFilter: string): Promise<ApiResponse<ZODashboard>> {
    try {
      if (isDemoMode) {
        return {
          success: true,
          message: 'ZO Dashboard data fetched (Demo Mode)',
          data: {
            totalUsers: 500,
            totalSurveys: 12,
            totalAttempts: 1250,
            averageScore: 76.8,
            passRate: 78.5,
            totalZones: 4,
            totalRegions: 12,
            recentActivity: [],
            performanceByRole: [],
            performanceBySurvey: [],
            monthlyTrends: [],
            zonePerformance: [],
            regionalBreakdown: [],
            topPerformingRegions: [],
            lowPerformingRegions: []
          }
        };
      }

      // Fetch real data from Supabase
      const [usersResult, surveysResult, resultsResult] = await Promise.all([
        supabase!.from('users').select('id, zone, region'),
        supabase!.from('surveys').select('id, is_active'),
        supabase!.from('test_results').select('id, score, is_passed')
      ]);

      const totalUsers = usersResult.data?.length || 0;
      const totalSurveys = surveysResult.data?.filter(s => s.is_active).length || 0;
      const results = resultsResult.data || [];
      const totalAttempts = results.length;
      const averageScore = results.length > 0 ? results.reduce((sum, r) => sum + r.score, 0) / results.length : 0;
      const passRate = results.length > 0 ? (results.filter(r => r.is_passed).length / results.length) * 100 : 0;

      const zones = [...new Set(usersResult.data?.map(u => u.zone).filter(Boolean))];
      const regions = [...new Set(usersResult.data?.map(u => u.region).filter(Boolean))];

      const dashboardData: ZODashboard = {
        totalUsers,
        totalSurveys,
        totalAttempts,
        averageScore,
        passRate,
        totalZones: zones.length,
        totalRegions: regions.length,
        recentActivity: [],
        performanceByRole: [],
        performanceBySurvey: [],
        monthlyTrends: [],
        zonePerformance: [],
        regionalBreakdown: [],
        topPerformingRegions: [],
        lowPerformingRegions: []
      };

      return {
        success: true,
        message: 'ZO Dashboard data fetched successfully',
        data: dashboardData
      };
    } catch (error) {
      console.error('Failed to fetch ZO dashboard data:', error);
      return {
        success: false,
        message: 'Failed to fetch ZO dashboard data'
      };
    }
  }
};

// RO Dashboard API
export const roDashboardApi = {
  async getDashboardData(dateFilter: string): Promise<ApiResponse<RODashboard>> {
    try {
      if (isDemoMode) {
        return {
          success: true,
          message: 'RO Dashboard data fetched (Demo Mode)',
          data: {
            totalUsers: 200,
            totalSurveys: 8,
            totalAttempts: 450,
            averageScore: 74.2,
            passRate: 76.8,
            totalDistricts: 8,
            totalSupervisors: 15,
            recentActivity: [],
            performanceByRole: [],
            performanceBySurvey: [],
            monthlyTrends: [],
            districtPerformance: [],
            supervisorPerformance: [],
            enumeratorDistribution: []
          }
        };
      }

      // Fetch real data from Supabase
      const [usersResult, surveysResult, resultsResult] = await Promise.all([
        supabase!.from('users').select('id, district, role:roles(name)'),
        supabase!.from('surveys').select('id, is_active'),
        supabase!.from('test_results').select('id, score, is_passed')
      ]);

      const totalUsers = usersResult.data?.length || 0;
      const totalSurveys = surveysResult.data?.filter(s => s.is_active).length || 0;
      const results = resultsResult.data || [];
      const totalAttempts = results.length;
      const averageScore = results.length > 0 ? results.reduce((sum, r) => sum + r.score, 0) / results.length : 0;
      const passRate = results.length > 0 ? (results.filter(r => r.is_passed).length / results.length) * 100 : 0;

      const districts = [...new Set(usersResult.data?.map(u => u.district).filter(Boolean))];
      const supervisors = usersResult.data?.filter(u => u.role?.name === 'Supervisor') || [];

      const dashboardData: RODashboard = {
        totalUsers,
        totalSurveys,
        totalAttempts,
        averageScore,
        passRate,
        totalDistricts: districts.length,
        totalSupervisors: supervisors.length,
        recentActivity: [],
        performanceByRole: [],
        performanceBySurvey: [],
        monthlyTrends: [],
        districtPerformance: [],
        supervisorPerformance: [],
        enumeratorDistribution: []
      };

      return {
        success: true,
        message: 'RO Dashboard data fetched successfully',
        data: dashboardData
      };
    } catch (error) {
      console.error('Failed to fetch RO dashboard data:', error);
      return {
        success: false,
        message: 'Failed to fetch RO dashboard data'
      };
    }
  }
};

// Supervisor Dashboard API
export const supervisorDashboardApi = {
  async getDashboardData(dateFilter: string): Promise<ApiResponse<SupervisorDashboard>> {
    try {
      if (isDemoMode) {
        return {
          success: true,
          message: 'Supervisor Dashboard data fetched (Demo Mode)',
          data: {
            totalUsers: 50,
            totalSurveys: 5,
            totalAttempts: 125,
            averageScore: 72.5,
            passRate: 74.0,
            totalEnumerators: 25,
            recentActivity: [],
            performanceByRole: [],
            performanceBySurvey: [],
            monthlyTrends: [],
            teamPerformance: [],
            enumeratorStatus: [],
            upcomingDeadlines: []
          }
        };
      }

      const { data: { user } } = await supabase!.auth.getUser();
      if (!user) {
        return {
          success: false,
          message: 'User not authenticated'
        };
      }

      // Fetch team members (enumerators under this supervisor)
      const { data: teamMembers, error: teamError } = await supabase!
        .from('users')
        .select(`
          *,
          role:roles(*)
        `)
        .eq('parent_id', user.id);

      if (teamError) {
        return {
          success: false,
          message: teamError.message
        };
      }

      const totalEnumerators = teamMembers?.length || 0;

      const dashboardData: SupervisorDashboard = {
        totalUsers: totalEnumerators,
        totalSurveys: 0,
        totalAttempts: 0,
        averageScore: 0,
        passRate: 0,
        totalEnumerators,
        recentActivity: [],
        performanceByRole: [],
        performanceBySurvey: [],
        monthlyTrends: [],
        teamPerformance: [],
        enumeratorStatus: [],
        upcomingDeadlines: []
      };

      return {
        success: true,
        message: 'Supervisor Dashboard data fetched successfully',
        data: dashboardData
      };
    } catch (error) {
      console.error('Failed to fetch supervisor dashboard data:', error);
      return {
        success: false,
        message: 'Failed to fetch supervisor dashboard data'
      };
    }
  }
};

// Enumerator API
export const enumeratorApi = {
  async getEnumeratorStatus(): Promise<ApiResponse<any[]>> {
    try {
      if (isDemoMode) {
        return {
          success: true,
          message: 'Enumerator status fetched (Demo Mode)',
          data: []
        };
      }

      const { data, error } = await supabase!
        .from('users')
        .select(`
          *,
          role:roles(*)
        `)
        .eq('role.name', 'Enumerator');

      if (error) {
        return {
          success: false,
          message: error.message
        };
      }

      return {
        success: true,
        message: 'Enumerator status fetched successfully',
        data: data || []
      };
    } catch (error) {
      console.error('Failed to fetch enumerator status:', error);
      return {
        success: false,
        message: 'Failed to fetch enumerator status'
      };
    }
  }
};