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
    email: 'zo@esigma.com',
    password: 'password123',
    name: 'Zonal Officer',
    role: {
      id: '550e8400-e29b-41d4-a716-446655440002',
      name: 'ZO User',
      description: 'Zonal Office User',
      level: 2,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      menuAccess: ['/zo-dashboard', '/results', '/enumerator-status', '/certificates']
    },
    roleId: '550e8400-e29b-41d4-a716-446655440002',
    isActive: true,
    jurisdiction: 'North Zone',
    zone: 'North Zone',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440012',
    email: 'ro@esigma.com',
    password: 'password123',
    name: 'Regional Officer',
    role: {
      id: '550e8400-e29b-41d4-a716-446655440003',
      name: 'RO User',
      description: 'Regional Office User',
      level: 3,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      menuAccess: ['/ro-dashboard', '/results', '/enumerator-status', '/certificates']
    },
    roleId: '550e8400-e29b-41d4-a716-446655440003',
    isActive: true,
    jurisdiction: 'Delhi Region',
    zone: 'North Zone',
    region: 'Delhi Region',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440013',
    email: 'supervisor@esigma.com',
    password: 'password123',
    name: 'Field Supervisor',
    role: {
      id: '550e8400-e29b-41d4-a716-446655440004',
      name: 'Supervisor',
      description: 'Field Supervisor',
      level: 4,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      menuAccess: ['/supervisor-dashboard', '/team-results', '/my-enumerators', '/certificates']
    },
    roleId: '550e8400-e29b-41d4-a716-446655440004',
    isActive: true,
    jurisdiction: 'Central Delhi District',
    zone: 'North Zone',
    region: 'Delhi Region',
    district: 'Central Delhi',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440014',
    email: 'enumerator@esigma.com',
    password: 'password123',
    name: 'Field Enumerator',
    role: {
      id: '550e8400-e29b-41d4-a716-446655440005',
      name: 'Enumerator',
      description: 'Field Enumerator',
      level: 5,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      menuAccess: ['/enumerator-dashboard', '/available-tests', '/my-results', '/my-certificates', '/test-schedule']
    },
    roleId: '550e8400-e29b-41d4-a716-446655440005',
    isActive: true,
    jurisdiction: 'Block A, Central Delhi',
    zone: 'North Zone',
    region: 'Delhi Region',
    district: 'Central Delhi',
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

const demoSurveys = [
  {
    id: '550e8400-e29b-41d4-a716-446655440020',
    title: 'Digital Literacy Assessment',
    description: 'Comprehensive assessment of digital skills and computer literacy for field staff',
    targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    duration: 35,
    totalQuestions: 30,
    passingScore: 70,
    maxAttempts: 3,
    isActive: true,
    sections: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: '550e8400-e29b-41d4-a716-446655440010',
    assignedZones: ['North Zone', 'South Zone'],
    assignedRegions: ['Delhi Region', 'Mumbai Region']
  }
];

// Helper function to simulate API delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Authentication API
export const authApi = {
  async login(email: string, password: string): Promise<ApiResponse<{ user: User; token: string }>> {
    try {
      console.log('API: Login attempt for:', email);
      
      if (isDemoMode) {
        console.log('API: Running in demo mode');
        await delay(500); // Simulate network delay
        
        // Find demo user
        const demoUser = demoUsers.find(u => u.email === email);
        if (!demoUser) {
          return {
            success: false,
            message: 'Invalid email or password'
          };
        }
        
        // Check password
        if (demoUser.password !== password) {
          return {
            success: false,
            message: 'Invalid email or password'
          };
        }
        
        // Return successful login
        const token = 'demo-token-' + Date.now();
        return {
          success: true,
          message: 'Login successful',
          data: {
            user: demoUser as User,
            token
          }
        };
      }

      // Real Supabase authentication
      if (!supabase) {
        throw new Error('Supabase client not available');
      }

      // First, try to sign in with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (authError) {
        console.error('Supabase auth error:', authError);
        return {
          success: false,
          message: authError.message || 'Authentication failed'
        };
      }

      if (!authData.user) {
        return { success: false, message: 'Authentication failed' };
      }

      // Get user profile from custom users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select(`
          *,
          role:roles(*)
        `)
        .eq('id', authData.user.id)
        .single();

      if (userError || !userData) {
        return { success: false, message: 'User profile not found' };
      }

      const user = {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        roleId: userData.role_id,
        role: userData.role,
        jurisdiction: userData.jurisdiction,
        zone: userData.zone,
        region: userData.region,
        district: userData.district,
        employeeId: userData.employee_id,
        phoneNumber: userData.phone_number,
        isActive: userData.is_active,
        createdAt: new Date(userData.created_at),
        updatedAt: new Date(userData.updated_at),
        passwordChangedAt: userData.password_changed_at ? new Date(userData.password_changed_at) : undefined
      };

      return {
        success: true,
        message: 'Login successful',
        data: {
          user,
          token: authData.session?.access_token || ''
        }
      };
    } catch (error) {
      console.error('Login API error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Login failed'
      };
    }
  },

  async logout(): Promise<ApiResponse<void>> {
    try {
      if (isDemoMode) {
        await delay(200);
        return { success: true, message: 'Logged out successfully' };
      }

      if (supabase) {
        const { error } = await supabase.auth.signOut();
        if (error) {
          console.error('Logout error:', error);
          return { success: false, message: error.message };
        }
      }

      return { success: true, message: 'Logged out successfully' };
    } catch (error) {
      console.error('Logout error:', error);
      return { success: false, message: 'Logout failed' };
    }
  },

  async changePassword(newPassword: string): Promise<ApiResponse<void>> {
    try {
      if (isDemoMode) {
        await delay(500);
        return { success: true, message: 'Password changed successfully (demo mode)' };
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
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to change password'
      };
    }
  }
};

// User API
export const userApi = {
  async getUsers(): Promise<ApiResponse<User[]>> {
    try {
      if (isDemoMode) {
        await delay(300);
        return {
          success: true,
          message: 'Users fetched successfully (demo mode)',
          data: demoUsers as User[]
        };
      }

      if (!supabase) {
        throw new Error('Supabase client not available');
      }

      const { data, error } = await supabase
        .from('users')
        .select(`
          *,
          role:roles(*)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Get users error:', error);
        return { success: false, message: error.message };
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
      console.error('Get users API error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch users'
      };
    }
  },

  async createUser(userData: any): Promise<ApiResponse<User>> {
    try {
      if (isDemoMode) {
        await delay(500);
        return {
          success: false,
          message: 'User creation not available in demo mode. Please configure Supabase to enable user management.'
        };
      }

      if (!supabaseAdmin) {
        throw new Error('Supabase admin client not available');
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
        return { success: false, message: authError?.message || 'Failed to create user' };
      }

      // Hash password for custom users table
      const hashedPassword = bcrypt.hashSync(userData.password, 10);

      // Create user profile
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
        return { success: false, message: profileError?.message || 'Failed to create user profile' };
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
        message: `User created successfully! Login credentials:\nEmail: ${userData.email}\nPassword: ${userData.password}`,
        data: user
      };
    } catch (error) {
      console.error('Create user API error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create user'
      };
    }
  },

  async updateUser(userId: string, userData: any): Promise<ApiResponse<User>> {
    try {
      if (isDemoMode) {
        await delay(500);
        return {
          success: false,
          message: 'User updates not available in demo mode. Please configure Supabase to enable user management.'
        };
      }

      if (!supabase) {
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
        updateData.password_changed_at = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', userId)
        .select(`
          *,
          role:roles(*)
        `)
        .single();

      if (error || !data) {
        return { success: false, message: error?.message || 'Failed to update user' };
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
      console.error('Update user API error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update user'
      };
    }
  },

  async deleteUser(userId: string): Promise<ApiResponse<void>> {
    try {
      if (isDemoMode) {
        await delay(300);
        return {
          success: false,
          message: 'User deletion not available in demo mode. Please configure Supabase to enable user management.'
        };
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
        console.error('Auth deletion error:', authError);
        // Don't fail if auth deletion fails, profile is already deleted
      }

      return {
        success: true,
        message: 'User deleted successfully'
      };
    } catch (error) {
      console.error('Delete user API error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to delete user'
      };
    }
  }
};

// Role API
export const roleApi = {
  async getRoles(): Promise<ApiResponse<Role[]>> {
    try {
      if (isDemoMode) {
        await delay(300);
        const demoRoles = demoUsers.map(u => u.role);
        return {
          success: true,
          message: 'Roles fetched successfully (demo mode)',
          data: demoRoles
        };
      }

      if (!supabase) {
        throw new Error('Supabase client not available');
      }

      const { data, error } = await supabase
        .from('roles')
        .select('*')
        .order('level', { ascending: true });

      if (error) {
        return { success: false, message: error.message };
      }

      const roles: Role[] = (data || []).map(roleData => ({
        id: roleData.id,
        name: roleData.name,
        description: roleData.description,
        level: roleData.level,
        isActive: roleData.is_active,
        createdAt: new Date(roleData.created_at),
        updatedAt: new Date(roleData.updated_at),
        menuAccess: roleData.menu_access
      }));

      return {
        success: true,
        message: 'Roles fetched successfully',
        data: roles
      };
    } catch (error) {
      console.error('Get roles API error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch roles'
      };
    }
  },

  async createRole(roleData: any): Promise<ApiResponse<Role>> {
    try {
      if (isDemoMode) {
        await delay(500);
        return {
          success: false,
          message: 'Role creation not available in demo mode'
        };
      }

      if (!supabase) {
        throw new Error('Supabase client not available');
      }

      const { data, error } = await supabase
        .from('roles')
        .insert({
          name: roleData.name,
          description: roleData.description
        })
        .select()
        .single();

      if (error || !data) {
        return { success: false, message: error?.message || 'Failed to create role' };
      }

      const role: Role = {
        id: data.id,
        name: data.name,
        description: data.description,
        level: data.level,
        isActive: data.is_active,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
        menuAccess: data.menu_access
      };

      return {
        success: true,
        message: 'Role created successfully',
        data: role
      };
    } catch (error) {
      console.error('Create role API error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create role'
      };
    }
  },

  async updateRole(roleId: string, roleData: any): Promise<ApiResponse<Role>> {
    try {
      if (isDemoMode) {
        await delay(500);
        return {
          success: false,
          message: 'Role updates not available in demo mode'
        };
      }

      if (!supabase) {
        throw new Error('Supabase client not available');
      }

      const { data, error } = await supabase
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
        return { success: false, message: error?.message || 'Failed to update role' };
      }

      const role: Role = {
        id: data.id,
        name: data.name,
        description: data.description,
        level: data.level,
        isActive: data.is_active,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
        menuAccess: data.menu_access
      };

      return {
        success: true,
        message: 'Role updated successfully',
        data: role
      };
    } catch (error) {
      console.error('Update role API error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update role'
      };
    }
  },

  async deleteRole(roleId: string): Promise<ApiResponse<void>> {
    try {
      if (isDemoMode) {
        await delay(300);
        return {
          success: false,
          message: 'Role deletion not available in demo mode'
        };
      }

      if (!supabase) {
        throw new Error('Supabase client not available');
      }

      const { error } = await supabase
        .from('roles')
        .delete()
        .eq('id', roleId);

      if (error) {
        return { success: false, message: error.message };
      }

      return {
        success: true,
        message: 'Role deleted successfully'
      };
    } catch (error) {
      console.error('Delete role API error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to delete role'
      };
    }
  },

  async getPermissions(): Promise<ApiResponse<any[]>> {
    try {
      if (isDemoMode) {
        await delay(300);
        return {
          success: true,
          message: 'Permissions fetched successfully (demo mode)',
          data: []
        };
      }

      // Return empty permissions for now
      return {
        success: true,
        message: 'Permissions fetched successfully',
        data: []
      };
    } catch (error) {
      console.error('Get permissions API error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch permissions'
      };
    }
  },

  async updateRoleMenuAccess(roleId: string, menuAccess: string[]): Promise<ApiResponse<void>> {
    try {
      if (isDemoMode) {
        await delay(500);
        return {
          success: false,
          message: 'Menu access updates not available in demo mode'
        };
      }

      if (!supabase) {
        throw new Error('Supabase client not available');
      }

      const { error } = await supabase
        .from('roles')
        .update({
          menu_access: menuAccess,
          updated_at: new Date().toISOString()
        })
        .eq('id', roleId);

      if (error) {
        return { success: false, message: error.message };
      }

      return {
        success: true,
        message: 'Menu access updated successfully'
      };
    } catch (error) {
      console.error('Update role menu access API error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update menu access'
      };
    }
  }
};

// Survey API
export const surveyApi = {
  async getSurveys(): Promise<ApiResponse<Survey[]>> {
    try {
      if (isDemoMode) {
        await delay(300);
        return {
          success: true,
          message: 'Surveys fetched successfully (demo mode)',
          data: demoSurveys as Survey[]
        };
      }

      if (!supabase) {
        throw new Error('Supabase client not available');
      }

      const { data, error } = await supabase
        .from('surveys')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        return { success: false, message: error.message };
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
        sections: [],
        createdAt: new Date(surveyData.created_at),
        updatedAt: new Date(surveyData.updated_at),
        createdBy: surveyData.created_by,
        assignedZones: surveyData.assigned_zones,
        assignedRegions: surveyData.assigned_regions
      }));

      return {
        success: true,
        message: 'Surveys fetched successfully',
        data: surveys
      };
    } catch (error) {
      console.error('Get surveys API error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch surveys'
      };
    }
  },

  async createSurvey(surveyData: any): Promise<ApiResponse<Survey>> {
    try {
      if (isDemoMode) {
        await delay(500);
        return {
          success: false,
          message: 'Survey creation not available in demo mode'
        };
      }

      if (!supabase) {
        throw new Error('Supabase client not available');
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

      if (error || !data) {
        return { success: false, message: error?.message || 'Failed to create survey' };
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

      return {
        success: true,
        message: 'Survey created successfully',
        data: survey
      };
    } catch (error) {
      console.error('Create survey API error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create survey'
      };
    }
  },

  async updateSurvey(surveyId: string, surveyData: any): Promise<ApiResponse<Survey>> {
    try {
      if (isDemoMode) {
        await delay(500);
        return {
          success: false,
          message: 'Survey updates not available in demo mode'
        };
      }

      if (!supabase) {
        throw new Error('Supabase client not available');
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
        updateData.target_date = surveyData.targetDate.toISOString().split('T')[0];
      }

      if (typeof surveyData.isActive === 'boolean') {
        updateData.is_active = surveyData.isActive;
      }

      const { data, error } = await supabase
        .from('surveys')
        .update(updateData)
        .eq('id', surveyId)
        .select()
        .single();

      if (error || !data) {
        return { success: false, message: error?.message || 'Failed to update survey' };
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

      return {
        success: true,
        message: 'Survey updated successfully',
        data: survey
      };
    } catch (error) {
      console.error('Update survey API error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update survey'
      };
    }
  },

  async deleteSurvey(surveyId: string): Promise<ApiResponse<void>> {
    try {
      if (isDemoMode) {
        await delay(300);
        return {
          success: false,
          message: 'Survey deletion not available in demo mode'
        };
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

      return {
        success: true,
        message: 'Survey deleted successfully'
      };
    } catch (error) {
      console.error('Delete survey API error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to delete survey'
      };
    }
  }
};

// Dashboard API
export const dashboardApi = {
  async getDashboardData(): Promise<ApiResponse<Dashboard>> {
    try {
      if (isDemoMode || !supabase) {
        await delay(500);
        const demoDashboard: Dashboard = {
          totalUsers: 5,
          totalSurveys: 3,
          totalAttempts: 25,
          averageScore: 78.5,
          passRate: 72.0,
          recentActivity: [
            {
              id: '1',
              type: 'test_completed',
              description: 'Field Enumerator completed Digital Literacy Assessment',
              userId: '550e8400-e29b-41d4-a716-446655440014',
              userName: 'Field Enumerator',
              timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000)
            },
            {
              id: '2',
              type: 'user_created',
              description: 'New enumerator account created',
              userId: '550e8400-e29b-41d4-a716-446655440010',
              userName: 'System Administrator',
              timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000)
            }
          ],
          performanceByRole: [
            { name: 'Admin', value: 1, total: 1, percentage: 100 },
            { name: 'Supervisor', value: 1, total: 1, percentage: 85 },
            { name: 'Enumerator', value: 1, total: 1, percentage: 72 }
           ];
        
        // Fetch real data from Supabase
      const [usersResult, surveysResult, attemptsResult, resultsResult] = await Promise.all([
        supabase.from('users').select('id, role_id, roles(name)'),
        supabase.from('surveys').select('id, is_active'),
        supabase.from('test_sessions').select('id'),
        supabase.from('test_results').select('score, is_passed, user_id, users(role_id, roles(name)), survey_id, surveys(title)')
      ]);

      if (usersResult.error || surveysResult.error || attemptsResult.error || resultsResult.error) {
        throw new Error('Failed to fetch dashboard data from database');
      }

      const users = usersResult.data || [];
      const surveys = surveysResult.data || [];
      const attempts = attemptsResult.data || [];
      const results = resultsResult.data || [];

      const totalUsers = users.length;
      const totalSurveys = surveys.filter(s => s.is_active).length;
      const totalAttempts = attempts.length;
      const passedResults = results.filter(r => r.is_passed);
      const passRate = results.length > 0 ? (passedResults.length / results.length) * 100 : 0;
      const averageScore = results.length > 0 ? results.reduce((sum, r) => sum + r.score, 0) / results.length : 0;

      // Performance by role
      const rolePerformance = users.reduce((acc: any, user: any) => {
        const roleName = user.roles?.name || 'Unknown';
        if (!acc[roleName]) {
          acc[roleName] = { total: 0, passed: 0 };
        }
        acc[roleName].total++;
        
        const userResults = results.filter((r: any) => r.user_id === user.id);
        const userPassed = userResults.filter((r: any) => r.is_passed).length;
        if (userPassed > 0) acc[roleName].passed++;
        
        return acc;
      }, {});

      const performanceByRole = Object.entries(rolePerformance).map(([name, data]: [string, any]) => ({
        name,
        value: data.passed,
        total: data.total,
        percentage: data.total > 0 ? (data.passed / data.total) * 100 : 0
      }));

      // Performance by survey
      const surveyPerformance = surveys.reduce((acc: any, survey: any) => {
        const surveyResults = results.filter((r: any) => r.survey_id === survey.id);
        const surveyPassed = surveyResults.filter((r: any) => r.is_passed).length;
        
        if (surveyResults.length > 0) {
          acc.push({
            name: survey.title || 'Unknown Survey',
            value: surveyPassed,
            total: surveyResults.length,
            percentage: (surveyPassed / surveyResults.length) * 100
          });
        }
        
        return acc;
      }, []);

      // Recent activity
      const { data: activityData } = await supabase
        .from('activity_logs')
        .select('id, activity_type, description, user_id, created_at, users(name)')
        .order('created_at', { ascending: false })
        .limit(10);

      const recentActivity = (activityData || []).map((activity: any) => ({
        id: activity.id,
        type: activity.activity_type,
        description: activity.description,
        userId: activity.user_id,
        userName: activity.users?.name || 'Unknown User',
        timestamp: new Date(activity.created_at),
        metadata: {}
      }));

      return {
        success: true,
        data: {
          totalUsers,
          totalSurveys,
          totalAttempts,
          averageScore,
          passRate,
          recentActivity,
          performanceByRole,
          performanceBySurvey: surveyPerformance,
          monthlyTrends: [] // TODO: Implement monthly trends calculation
        },
        message: 'Dashboard data loaded successfully'
      };
          ],
          monthlyTrends: [
            { month: 'Jan', attempts: 10, passed: 7, failed: 3, passRate: 70 },
            { month: 'Feb', attempts: 15, passed: 12, failed: 3, passRate: 80 },
            { month: 'Mar', attempts: 20, passed: 14, failed: 6, passRate: 70 }
          ]
        };
        
        return {
          success: true,
          message: 'Dashboard data fetched successfully (demo mode)',
          data: demoDashboard
        };
      }

      // Fetch real data from Supabase
      const [usersCount, surveysCount, attemptsData, recentActivityData] = await Promise.all([
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('surveys').select('*', { count: 'exact', head: true }),
        supabase.from('test_results').select('score, is_passed'),
        supabase.from('activity_logs').select(`
          id, activity_type, description, user_id, created_at,
          users!inner(name)
        `).order('created_at', { ascending: false }).limit(10)
      ]);

      const totalUsers = usersCount.count || 0;
      const totalSurveys = surveysCount.count || 0;
      const attempts = attemptsData.data || [];
      const totalAttempts = attempts.length;
      const passedAttempts = attempts.filter(a => a.is_passed).length;
      const averageScore = attempts.length > 0 
        ? attempts.reduce((sum, a) => sum + a.score, 0) / attempts.length 
        : 0;
      const passRate = totalAttempts > 0 ? (passedAttempts / totalAttempts) * 100 : 0;

      // Transform recent activity
      const recentActivity: Activity[] = (recentActivityData.data || []).map(activity => ({
        id: activity.id,
        type: activity.activity_type as any,
        description: activity.description,
        userId: activity.user_id,
        userName: activity.users?.name || 'Unknown User',
        timestamp: new Date(activity.created_at)
      }));

      // Get performance by role
      const { data: rolePerformance } = await supabase
        .from('test_results')
        .select(`
          is_passed,
          users!inner(role_id, roles!inner(name))
        `);

      const performanceByRole = (rolePerformance || []).reduce((acc, result) => {
        const roleName = result.users?.roles?.name || 'Unknown';
        if (!acc[roleName]) {
          acc[roleName] = { total: 0, passed: 0 };
        }
        acc[roleName].total++;
        if (result.is_passed) acc[roleName].passed++;
        return acc;
      }, {} as Record<string, { total: number; passed: number }>);

      const performanceByRoleArray: PerformanceData[] = Object.entries(performanceByRole).map(([name, data]) => ({
        name,
        value: data.passed,
        total: data.total,
        percentage: data.total > 0 ? (data.passed / data.total) * 100 : 0
      }));

      // Get performance by survey
      const { data: surveyPerformance } = await supabase
        .from('test_results')
        .select(`
          is_passed,
          surveys!inner(title)
        `);

      const performanceBySurvey = (surveyPerformance || []).reduce((acc, result) => {
        const surveyTitle = result.surveys?.title || 'Unknown';
        if (!acc[surveyTitle]) {
          acc[surveyTitle] = { total: 0, passed: 0 };
        }
        acc[surveyTitle].total++;
        if (result.is_passed) acc[surveyTitle].passed++;
        return acc;
      }, {} as Record<string, { total: number; passed: number }>);

      const performanceBySurveyArray: PerformanceData[] = Object.entries(performanceBySurvey).map(([name, data]) => ({
        name,
        value: data.passed,
        total: data.total,
        percentage: data.total > 0 ? (data.passed / data.total) * 100 : 0
      }));

      // Get monthly trends (last 6 months)
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const { data: monthlyData } = await supabase
        .from('test_results')
        .select('completed_at, is_passed')
        .gte('completed_at', sixMonthsAgo.toISOString());

      const monthlyTrends: MonthlyTrend[] = [];
      for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthName = date.toLocaleDateString('en-US', { month: 'short' });
        
        const monthData = (monthlyData || []).filter(result => {
          const resultDate = new Date(result.completed_at);
          return resultDate.getMonth() === date.getMonth() && 
                 resultDate.getFullYear() === date.getFullYear();
        });
        
        const attempts = monthData.length;
        const passed = monthData.filter(r => r.is_passed).length;
        const failed = attempts - passed;
        const passRate = attempts > 0 ? (passed / attempts) * 100 : 0;
        
        monthlyTrends.push({
          month: monthName,
          attempts,
          passed,
          failed,
          passRate
        });
      }

      const dashboard: Dashboard = {
        totalUsers,
        totalSurveys,
        totalAttempts,
        averageScore,
        passRate,
        recentActivity,
        performanceByRole: performanceByRoleArray,
        performanceBySurvey: performanceBySurveyArray,
        monthlyTrends
      };

      return {
        success: true,
        message: 'Dashboard data fetched successfully',
        data: dashboard
      };
    } catch (error) {
      console.error('Get dashboard data API error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch dashboard data'
      };
    }
  }
};

// Placeholder APIs for other services
export const resultApi = {
  async getResults(filters: AnalyticsFilter): Promise<ApiResponse<TestResult[]>> {
    try {
      if (isDemoMode || !supabase) {
        await delay(300);
        return { success: true, message: 'Demo mode', data: [] };
      }

      const { data, error } = await supabase
        .from('test_results')
        .select(`
          *,
          users!inner(name, email, roles!inner(name)),
          surveys!inner(title)
        `)
        .gte('completed_at', filters.dateRange.start.toISOString())
        .lte('completed_at', filters.dateRange.end.toISOString())
        .order('completed_at', { ascending: false });

      if (error) {
        return { success: false, message: error.message };
      }

      const results: TestResult[] = (data || []).map(result => ({
        id: result.id,
        userId: result.user_id,
        user: {
          id: result.users.id,
          name: result.users.name,
          email: result.users.email,
          role: { name: result.users.roles.name }
        } as User,
        surveyId: result.survey_id,
        survey: {
          id: result.survey_id,
          title: result.surveys.title,
          maxAttempts: 3
        } as Survey,
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
        message: 'Results fetched successfully',
        data: results
      };
    } catch (error) {
      console.error('Get results API error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch results'
      };
    }
  },
  async getAnalytics(filters: AnalyticsFilter): Promise<ApiResponse<AnalyticsData>> {
    try {
      if (isDemoMode || !supabase) {
        await delay(300);
        return { success: false, message: 'Analytics not available in demo mode' };
      }

      // Get basic analytics data
      const { data: resultsData } = await supabase
        .from('test_results')
        .select(`
          score, is_passed, time_spent,
          users!inner(roles!inner(name)),
          surveys!inner(title)
        `)
        .gte('completed_at', filters.dateRange.start.toISOString())
        .lte('completed_at', filters.dateRange.end.toISOString());

      const results = resultsData || [];
      const totalAttempts = results.length;
      const passedAttempts = results.filter(r => r.is_passed).length;
      const passRate = totalAttempts > 0 ? (passedAttempts / totalAttempts) * 100 : 0;
      const averageScore = totalAttempts > 0 
        ? results.reduce((sum, r) => sum + r.score, 0) / totalAttempts 
        : 0;
      const averageTime = totalAttempts > 0 
        ? results.reduce((sum, r) => sum + r.time_spent, 0) / totalAttempts / 60 
        : 0;

      const analytics: AnalyticsData = {
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
        data: analytics
      };
    } catch (error) {
      console.error('Get analytics API error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch analytics'
      };
    }
  },
  async exportResults(filters: AnalyticsFilter): Promise<any> {
    if (isDemoMode) {
      await delay(300);
      return { success: false, message: 'Export not available in demo mode' };
    }
    return { success: false, message: 'Not implemented' };
  }
};

export const certificateApi = {
  async getCertificates(): Promise<ApiResponse<Certificate[]>> {
    try {
      if (isDemoMode || !supabase) {
        await delay(300);
        return { success: true, message: 'Demo mode', data: [] };
      }

      const { data, error } = await supabase
        .from('certificates')
        .select(`
          *,
          users!inner(name, email, roles!inner(name)),
          surveys!inner(title)
        `)
        .order('issued_at', { ascending: false });

      if (error) {
        return { success: false, message: error.message };
      }

      const certificates: Certificate[] = (data || []).map(cert => ({
        id: cert.id,
        userId: cert.user_id,
        user: {
          id: cert.users.id,
          name: cert.users.name,
          email: cert.users.email,
          role: { name: cert.users.roles.name }
        } as User,
        surveyId: cert.survey_id,
        survey: {
          id: cert.survey_id,
          title: cert.surveys.title
        } as Survey,
        resultId: cert.result_id,
        certificateNumber: cert.certificate_number,
        issuedAt: new Date(cert.issued_at),
        validUntil: cert.valid_until ? new Date(cert.valid_until) : undefined,
        downloadCount: cert.download_count,
        status: cert.certificate_status as any
      }));

      return {
        success: true,
        message: 'Certificates fetched successfully',
        data: certificates
      };
    } catch (error) {
      console.error('Get certificates API error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch certificates'
      };
    }
  },
  async downloadCertificate(certificateId: string): Promise<any> {
    if (isDemoMode) {
      await delay(300);
      return { success: false, message: 'Download not available in demo mode' };
      const { data, error } = await supabase
        .from('users')
        .select(`
          id,
          email,
          name,
          role_id,
          is_active,
          jurisdiction,
          zone,
          region,
          district,
          employee_id,
          phone_number,
          profile_image,
          parent_id,
          last_login,
          password_changed_at,
          created_at,
          updated_at,
          roles (
            id,
            name,
            description,
            level,
            is_active,
            created_at,
            updated_at
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const users: User[] = (data || []).map((user: any) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        roleId: user.role_id,
        role: {
          id: user.roles.id,
          name: user.roles.name,
          description: user.roles.description,
          level: user.roles.level,
          isActive: user.roles.is_active,
          createdAt: new Date(user.roles.created_at),
          updatedAt: new Date(user.roles.updated_at)
        },
        isActive: user.is_active,
        jurisdiction: user.jurisdiction,
        zone: user.zone,
        region: user.region,
        district: user.district,
        employeeId: user.employee_id,
        phoneNumber: user.phone_number,
        profileImage: user.profile_image,
        parentId: user.parent_id,
        lastLogin: user.last_login ? new Date(user.last_login) : undefined,
        passwordChangedAt: user.password_changed_at ? new Date(user.password_changed_at) : undefined,
        createdAt: new Date(user.created_at),
        updatedAt: new Date(user.updated_at)
      }));

      return {
        success: true,
        data: users,
        message: 'Users loaded successfully'
      };
      await delay(300);
      return { success: false, message: 'Certificate revocation not available in demo mode' };
    }
    return { success: false, message: 'Not implemented' };
  }
};

export const settingsApi = {
  async getSettings(): Promise<ApiResponse<SystemSettings[]>> {
    try {
      if (isDemoMode || !supabase) {
        await delay(300);
        const demoSettings: SystemSettings[] = [
          {
            id: '1',
            category: 'general',
            key: 'site_name',
            value: 'eSigma Survey Platform',
            description: 'Application name displayed to users',
            type: 'string',
            isEditable: true,
            updatedAt: new Date(),
            updatedBy: 'System'
          },
          {
            id: '2',
            category: 'security',
            key: 'max_login_attempts',
            value: '5',
            description: 'Maximum failed login attempts before lockout',
            type: 'number',
            isEditable: true,
            updatedAt: new Date(),
            updatedBy: 'System'
          }
        ];
        return { success: true, message: 'Demo mode', data: demoSettings };
      }

      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .order('category', { ascending: true });

      if (error) {
        return { success: false, message: error.message };
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
        updatedBy: setting.updated_by || 'System'
      }));

      return {
        success: true,
        message: 'Settings fetched successfully',
        data: settings
      };
    } catch (error) {
      console.error('Get settings API error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch settings'
      };
    }
  },
  async updateSetting(settingId: string, value: string): Promise<ApiResponse<void>> {
    try {
      if (isDemoMode || !supabase) {
        await delay(300);
        return { success: false, message: 'Settings updates not available in demo mode' };
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

      return {
        success: true,
        message: 'Setting updated successfully'
      };
    } catch (error) {
      console.error('Update setting API error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update setting'
      };
    }
  }
};

export const enumeratorDashboardApi = {
  async getDashboardData(): Promise<ApiResponse<EnumeratorDashboard>> {
    try {
      if (isDemoMode || !supabase) {
        await delay(500);
        const demoDashboard: EnumeratorDashboard = {
          availableTests: [
            {
              surveyId: '550e8400-e29b-41d4-a716-446655440020',
              title: 'Digital Literacy Assessment',
              description: 'Comprehensive assessment of digital skills and computer literacy',
              targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              duration: 35,
              totalQuestions: 30,
              passingScore: 70,
              attemptsLeft: 3,
              maxAttempts: 3,
              isEligible: true
            }
          ],
          completedTests: [
            {
              resultId: '1',
              surveyTitle: 'Sample Assessment',
              score: 85,
              isPassed: true,
              completedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
              attemptNumber: 1,
              certificateId: 'cert-1'
            }
          ],
          upcomingTests: [],
          certificates: [
            {
              id: 'cert-1',
              userId: '550e8400-e29b-41d4-a716-446655440014',
      // Create user in Supabase Auth
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: userData.email,
        password: userData.password,
        email_confirm: true,
        user_metadata: {
          name: userData.name
        }
      });

      if (authError) throw authError;

      // Create user profile in custom users table
      const { data: profileData, error: profileError } = await supabaseAdmin
        .from('users')
        .insert({
          id: authData.user.id,
          email: userData.email,
          password_hash: '', // Not needed with Supabase Auth
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
          roles (*)
        `)
        .single();

      if (profileError) throw profileError;

      const user: User = {
        id: profileData.id,
        email: profileData.email,
        name: profileData.name,
        roleId: profileData.role_id,
        role: {
          id: profileData.roles.id,
          name: profileData.roles.name,
          description: profileData.roles.description,
          level: profileData.roles.level,
          isActive: profileData.roles.is_active,
          createdAt: new Date(profileData.roles.created_at),
          updatedAt: new Date(profileData.roles.updated_at)
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
        data: user,
        message: 'User created successfully'
      };
              issuedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
              downloadCount: 2,
              status: 'active' as const,
              createdAt: new Date()
            }
          ],
          overallProgress: 75,
          averageScore: 85,
          totalAttempts: 1,
          passedTests: 1
        };
        
        return {
          success: true,
          message: 'Dashboard data fetched successfully (demo mode)',
          data: demoDashboard
        };
      }

      // Update user profile in database
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
        const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(
          userId,
          { password: userData.password }
        );
        if (passwordError) throw passwordError;
        
        updateData.password_changed_at = new Date().toISOString();
      }

      const { data: profileData, error: profileError } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', userId)
        .select(`
          *,
          roles (*)
        `)
        .single();

      if (profileError) throw profileError;

      const user: User = {
        id: profileData.id,
        email: profileData.email,
        name: profileData.name,
        roleId: profileData.role_id,
        role: {
          id: profileData.roles.id,
          name: profileData.roles.name,
          description: profileData.roles.description,
          level: profileData.roles.level,
          isActive: profileData.roles.is_active,
          createdAt: new Date(profileData.roles.created_at),
          updatedAt: new Date(profileData.roles.updated_at)
        },
        isActive: profileData.is_active,
        jurisdiction: profileData.jurisdiction,
        zone: profileData.zone,
        region: profileData.region,
        district: profileData.district,
        employeeId: profileData.employee_id,
        phoneNumber: profileData.phone_number,
        createdAt: new Date(profileData.created_at),
      const { data, error } = await supabase
        .from('roles')
        .select(`
          id,
          name,
          description,
          level,
          is_active,
          menu_access,
          created_at,
          updated_at
        `)
        .order('level', { ascending: true });

      if (error) throw error;

      // Get user counts for each role
      const { data: userCounts, error: countError } = await supabase
        .from('users')
        .select('role_id')
        .eq('is_active', true);

      if (countError) throw countError;

      const roleCounts = (userCounts || []).reduce((acc: any, user: any) => {
        acc[user.role_id] = (acc[user.role_id] || 0) + 1;
        return acc;
      }, {});

      const roles: Role[] = (data || []).map((role: any) => ({
        id: role.id,
        name: role.name,
        description: role.description,
        level: role.level,
        isActive: role.is_active,
        menuAccess: role.menu_access,
        userCount: roleCounts[role.id] || 0,
        createdAt: new Date(role.created_at),
        updatedAt: new Date(role.updated_at)
      }));

      return {
        success: true,
        data: roles,
        message: 'Roles loaded successfully'
      };
        data: user,
        message: 'User updated successfully'
      };

      // Fetch available tests for the current user
      const { data: surveysData } = await supabase
        .from('surveys')
        .select('*')
        .eq('is_active', true);

      // Get user's test attempts to calculate remaining attempts
      const { data: userAttempts } = await supabase
        .from('test_results')
        .select('survey_id, attempt_number')
        .eq('user_id', authUser.id);

      const availableTests: AvailableTest[] = (surveysData || []).map(survey => {
        const attempts = userAttempts?.filter(a => a.survey_id === survey.id) || [];
        const maxAttemptNumber = attempts.length > 0 ? Math.max(...attempts.map(a => a.attempt_number)) : 0;
        const attemptsLeft = Math.max(0, survey.max_attempts - maxAttemptNumber);
        
        return {
          surveyId: survey.id,
          title: survey.title,
          description: survey.description,
          targetDate: new Date(survey.target_date),
          duration: survey.duration,
      const { data, error } = await supabase
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
        userCount: 0,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at)
      };

      return {
        success: true,
        data: role,
        message: 'Role created successfully'
      };
        };
      });

      // Delete from Supabase Auth
      const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (authError) throw authError;

      // Delete from users table (should cascade due to foreign keys)
      const { error: profileError } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);

      if (profileError) throw profileError;

      return {
        success: true,
        message: 'User deleted successfully'
      };
          surveys!inner(title)
        `)
        .eq('user_id', authUser.id)
        .order('completed_at', { ascending: false });

      const completedTests: CompletedTest[] = (completedTestsData || []).map(result => ({
        resultId: result.id,
        surveyTitle: result.surveys.title,
      const { data, error } = await supabase
        .from('roles')
        .update({
          name: roleData.name,
          description: roleData.description,
          updated_at: new Date().toISOString()
        })
        .eq('id', roleId)
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

      return {
        success: true,
      const { data, error } = await supabase
        .from('surveys')
        .select(`
          id,
          title,
          description,
          target_date,
          duration,
          total_questions,
          passing_score,
          max_attempts,
          is_active,
          assigned_zones,
          assigned_regions,
          created_by,
          created_at,
          updated_at
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

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
        assignedZones: survey.assigned_zones,
        assignedRegions: survey.assigned_regions,
        sections: [], // TODO: Load sections if needed
        createdBy: survey.created_by,
        createdAt: new Date(survey.created_at),
        updatedAt: new Date(survey.updated_at)
      }));

      return {
        success: true,
        data: surveys,
        message: 'Surveys loaded successfully'
      };
      // Fetch upcoming tests (surveys not yet attempted)
      const attemptedSurveyIds = completedTests.map(t => t.resultId);
      const upcomingTests = availableTests.filter(test => 
        !attemptedSurveyIds.includes(test.surveyId) && test.isEligible
      ).map(test => ({
        surveyId: test.surveyId,
        title: test.title,
        targetDate: test.targetDate,
        daysLeft: Math.ceil((test.targetDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)),
        isOverdue: test.targetDate < new Date()
      }));

      // Fetch certificates
      const { data: certificatesData } = await supabase
        .from('certificates')
        .select(`
      // Check if role is in use
      const { data: usersWithRole, error: checkError } = await supabase
        .from('users')
        .select('id')
        .eq('role_id', roleId)
        .limit(1);

      if (checkError) throw checkError;

      if (usersWithRole && usersWithRole.length > 0) {
        return {
          success: false,
          message: 'Cannot delete role that is assigned to users'
        };
      }

      const { error } = await supabase
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
          is_active: true,
          assigned_zones: surveyData.assignedZones || [],
          assigned_regions: surveyData.assignedRegions || [],
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
        createdBy: data.created_by,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at)
      };

      return {
        success: true,
        data: survey,
        message: 'Survey created successfully'
      };

      return {
        success: true,
        message: 'Role deleted successfully'
      };

      const certificates: Certificate[] = (certificatesData || []).map(cert => ({
        id: cert.id,
        userId: cert.user_id,
        user: {
          id: cert.users.id,
          name: cert.users.name,
          email: cert.users.email,
          role: { name: 'Enumerator' } as any
        } as User,
        surveyId: cert.survey_id,
        survey: {
          id: cert.surveys.id,
          title: cert.surveys.title
        } as Survey,
        resultId: cert.result_id,
        certificateNumber: cert.certificate_number,
        issuedAt: new Date(cert.issued_at),
        downloadCount: cert.download_count,
      // For now, return empty array as permissions are handled via menu_access
      return {
        success: true,
        data: [],
        message: 'Permissions loaded successfully'
      };
      const averageScore = totalAttempts > 0 
        ? completedTests.reduce((sum, t) => sum + t.score, 0) / totalAttempts 
        : 0;
      const updateData: any = {
        updated_at: new Date().toISOString()
      };

      if (surveyData.title) updateData.title = surveyData.title;
      if (surveyData.description) updateData.description = surveyData.description;
      if (surveyData.targetDate) updateData.target_date = surveyData.targetDate.toISOString().split('T')[0];
      if (surveyData.duration) updateData.duration = surveyData.duration;
      if (surveyData.totalQuestions) updateData.total_questions = surveyData.totalQuestions;
      if (surveyData.passingScore) updateData.passing_score = surveyData.passingScore;
      if (surveyData.maxAttempts) updateData.max_attempts = surveyData.maxAttempts;
      if (surveyData.isActive !== undefined) updateData.is_active = surveyData.isActive;
      if (surveyData.assignedZones) updateData.assigned_zones = surveyData.assignedZones;
      if (surveyData.assignedRegions) updateData.assigned_regions = surveyData.assignedRegions;

      const { data, error } = await supabase
        .from('surveys')
        .update(updateData)
        .eq('id', surveyId)
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
        createdBy: data.created_by,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at)
      };

      return {
        success: true,
        data: survey,
        message: 'Survey updated successfully'
      };
        availableTests,
        completedTests,
        upcomingTests,
        certificates,
        overallProgress,
        averageScore,
        totalAttempts,
        passedTests
      };

      const { error } = await supabase
        .from('roles')
        .update({
          menu_access: menuAccess,
          updated_at: new Date().toISOString()
        })
        .eq('id', roleId);

      const { error } = await supabase
        .from('surveys')
        .delete()
        .eq('id', surveyId);

      if (error) throw error;

      return {
        success: true,
        message: 'Survey deleted successfully'
      };
      };
    } catch (error) {
      console.error('Get enumerator dashboard data API error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch dashboard data'
      };
    }
  }
};

export const testApi = {
  async createTestSession(surveyId: string): Promise<ApiResponse<TestSession>> {
    try {
      if (isDemoMode || !supabase) {
        await delay(500);
        return { success: false, message: 'Test sessions not available in demo mode' };
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Get survey details
      const { data: survey, error: surveyError } = await supabase
        .from('surveys')
        .select('*')
        .eq('id', surveyId)
        .single();

      if (surveyError || !survey) {
        return { success: false, message: 'Survey not found' };
      }

      // Check user's previous attempts
      const { data: previousAttempts } = await supabase
        .from('test_results')
        .select('attempt_number')
        .eq('user_id', user.id)
        .eq('survey_id', surveyId);

      const attemptNumber = (previousAttempts?.length || 0) + 1;
      
      if (attemptNumber > survey.max_attempts) {
        return { success: false, message: 'Maximum attempts exceeded' };
      }

      // Create test session
      const { data: sessionData, error: sessionError } = await supabase
        .from('test_sessions')
        .insert({
          user_id: user.id,
          survey_id: surveyId,
          time_remaining: survey.duration * 60, // Convert minutes to seconds
          attempt_number: attemptNumber
        })
        .select()
        .single();

      if (sessionError || !sessionData) {
        return { success: false, message: sessionError?.message || 'Failed to create test session' };
      }

      const session: TestSession = {
        id: sessionData.id,
        userId: sessionData.user_id,
        surveyId: sessionData.survey_id,
        startTime: new Date(sessionData.start_time),
        timeRemaining: sessionData.time_remaining,
        currentQuestionIndex: sessionData.current_question_index,
        answers: [],
        status: sessionData.session_status as any,
        attemptNumber: sessionData.attempt_number
      };

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Get survey details
      const { data: survey, error: surveyError } = await supabase
        .from('surveys')
        .select('duration, max_attempts')
        .eq('id', surveyId)
        .single();

      if (surveyError) throw surveyError;

      // Check existing attempts
      const { data: existingAttempts, error: attemptsError } = await supabase
        .from('test_sessions')
        .select('attempt_number')
        .eq('user_id', user.id)
        .eq('survey_id', surveyId)
        .order('attempt_number', { ascending: false })
        .limit(1);

      if (attemptsError) throw attemptsError;

      const nextAttemptNumber = existingAttempts.length > 0 ? existingAttempts[0].attempt_number + 1 : 1;

      if (nextAttemptNumber > survey.max_attempts) {
        return {
          success: false,
          message: 'Maximum attempts exceeded for this survey'
        };
      }

      // Create new test session
      const { data, error } = await supabase
        .from('test_sessions')
        .insert({
          user_id: user.id,
          survey_id: surveyId,
          time_remaining: survey.duration * 60,
          current_question_index: 0,
          session_status: 'in_progress',
          attempt_number: nextAttemptNumber
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

      return {
        success: true,
        data: session,
        message: 'Test session created successfully'
      };
    } catch (error) {
      console.error('Create test session API error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to create test session'
      };
    }
  },
  async getSession(sessionId: string): Promise<ApiResponse<TestSession>> {
    try {
      if (isDemoMode || !supabase) {
        await delay(300);
        return { success: false, message: 'Test sessions not available in demo mode' };
      }

      const { data: sessionData, error } = await supabase
        .from('test_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (error || !sessionData) {
        return { success: false, message: 'Session not found' };
      }

      // Get existing answers
      const { data: answersData } = await supabase
        .from('test_answers')
        .select('*')
        .eq('session_id', sessionId);

      const answers: TestAnswer[] = (answersData || []).map(answer => ({
        questionId: answer.question_id,
        selectedOptions: answer.selected_options || [],
        isCorrect: answer.is_correct,
        timeSpent: answer.time_spent,
        answered: answer.answered
      }));

      const session: TestSession = {
        id: sessionData.id,
        userId: sessionData.user_id,
        surveyId: sessionData.survey_id,
        startTime: new Date(sessionData.start_time),
        endTime: sessionData.end_time ? new Date(sessionData.end_time) : undefined,
        timeRemaining: sessionData.time_remaining,
        currentQuestionIndex: sessionData.current_question_index,
        answers,
        status: sessionData.session_status as any,
        attemptNumber: sessionData.attempt_number,
        score: sessionData.score,
        isPassed: sessionData.is_passed,
        completedAt: sessionData.completed_at ? new Date(sessionData.completed_at) : undefined
      };

      return {
        success: true,
        message: 'Session fetched successfully',
        data: session
      };
    } catch (error) {
      console.error('Get session API error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch session'
      };
    }
  },
  async getQuestionsForSurvey(surveyId: string): Promise<ApiResponse<Question[]>> {
    try {
      if (isDemoMode || !supabase) {
        await delay(300);
        return { success: false, message: 'Questions not available in demo mode' };
      }
      const { data, error } = await supabase
        .from('test_sessions')
        .select(`
          id,
          user_id,
          survey_id,
          start_time,
          end_time,
          time_remaining,
          current_question_index,
          session_status,
          attempt_number,
          score,
          is_passed,
          completed_at
        `)
        .eq('id', sessionId)
        .single();

      if (error) throw error;

      // Get existing answers
      const { data: answersData, error: answersError } = await supabase
        .from('test_answers')
        .select('question_id, selected_options, is_correct, time_spent, answered')
        .eq('session_id', sessionId);

      if (answersError) throw answersError;

      const answers: TestAnswer[] = (answersData || []).map((answer: any) => ({
        questionId: answer.question_id,
        selectedOptions: answer.selected_options || [],
        isCorrect: answer.is_correct,
        timeSpent: answer.time_spent,
        answered: answer.answered
      }));

      const session: TestSession = {
        id: data.id,
        userId: data.user_id,
        surveyId: data.survey_id,
        startTime: new Date(data.start_time),
        endTime: data.end_time ? new Date(data.end_time) : undefined,
        timeRemaining: data.time_remaining,
        currentQuestionIndex: data.current_question_index,
        answers,
        status: data.session_status as any,
        attemptNumber: data.attempt_number,
        score: data.score,
        isPassed: data.is_passed,
        completedAt: data.completed_at ? new Date(data.completed_at) : undefined
      };

      return {
        success: true,
        data: session,
        message: 'Session loaded successfully'
      };
          question_options(*)
        `)
        .eq('section_id', surveyId)
        .order('question_order');

      if (error) {
        return { success: false, message: error.message };
      }

      const questions: Question[] = (questionsData || []).map(q => ({
        id: q.id,
        sectionId: q.section_id,
        text: q.text,
        type: q.question_type as any,
        complexity: q.complexity as any,
        options: q.question_options.map((opt: any) => ({
          id: opt.id,
          text: opt.text,
          isCorrect: opt.is_correct
        })),
        correctAnswers: q.question_options.filter((opt: any) => opt.is_correct).map((opt: any) => opt.id),
        explanation: q.explanation,
        points: q.points,
        order: q.question_order,
        createdAt: new Date(q.created_at),
        updatedAt: new Date(q.updated_at)
      }));

      return {
        success: true,
        message: 'Questions fetched successfully',
        data: questions
      };
    } catch (error) {
      console.error('Get questions API error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to fetch questions'
      const { data, error } = await supabase
        .from('questions')
        .select(`
          id,
          section_id,
          text,
          question_type,
          complexity,
          points,
          explanation,
          question_order,
          created_at,
          updated_at,
          question_options (
            id,
            text,
            is_correct,
            option_order
          )
        `)
        .eq('survey_sections.survey_id', surveyId)
        .order('question_order', { ascending: true });

      if (error) throw error;

      const questions: Question[] = (data || []).map((question: any) => ({
        id: question.id,
        sectionId: question.section_id,
        text: question.text,
        type: question.question_type as any,
        complexity: question.complexity as any,
        options: (question.question_options || [])
          .sort((a: any, b: any) => a.option_order - b.option_order)
          .map((option: any) => ({
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
        data: questions,
        message: 'Questions loaded successfully'
      };
      if (isDemoMode || !supabase) {
        await delay(100);
        return { success: true, message: 'Answer saved (demo mode)' };
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
      // Check if answer already exists
      const { data: existingAnswer, error: checkError } = await supabase
        .from('test_answers')
        .select('id')
        .eq('session_id', sessionId)
        .eq('question_id', questionId)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existingAnswer) {
        // Update existing answer
        const { error: updateError } = await supabase
          .from('test_answers')
          .update({
            selected_options: selectedOptions,
            answered: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingAnswer.id);

        if (updateError) throw updateError;
      } else {
        // Create new answer
        const { error: insertError } = await supabase
          .from('test_answers')
          .insert({
            session_id: sessionId,
            question_id: questionId,
            selected_options: selectedOptions,
            answered: true
          });

        if (insertError) throw insertError;
      }

      return {
        success: true,
        message: 'Answer saved successfully'
      };
    } catch (error) {
      console.error('Save answer API error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to save answer'
      };
    }
  },
  async updateSession(sessionId: string, sessionData: any): Promise<ApiResponse<void>> {
    try {
      if (isDemoMode || !supabase) {
        await delay(200);
        return { success: true, message: 'Session updated (demo mode)' };
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

      return {
        success: true,
        message: 'Session updated successfully'
      };
    } catch (error) {
      let query = supabase
        .from('test_results')
        .select(`
          id,
          user_id,
          survey_id,
          session_id,
          score,
          total_questions,
          correct_answers,
          is_passed,
          time_spent,
          attempt_number,
          grade,
          completed_at,
          certificate_id,
          created_at,
          users (
            id,
            name,
            email,
            roles (
              id,
              name,
              level
            )
          ),
          surveys (
            id,
            title,
            passing_score,
            max_attempts
          )
        `)
        .order('completed_at', { ascending: false });

      // Apply filters if provided
      if (filters?.dateRange) {
        query = query
          .gte('completed_at', filters.dateRange.start.toISOString())
          .lte('completed_at', filters.dateRange.end.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;

      const results: TestResult[] = (data || []).map((result: any) => ({
        id: result.id,
        userId: result.user_id,
        user: {
          id: result.users.id,
          name: result.users.name,
          email: result.users.email,
          role: result.users.roles,
          roleId: result.users.roles.id,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        surveyId: result.survey_id,
        survey: {
          id: result.surveys.id,
          title: result.surveys.title,
          passingScore: result.surveys.passing_score,
          maxAttempts: result.surveys.max_attempts,
          description: '',
          targetDate: new Date(),
          duration: 0,
          totalQuestions: 0,
          isActive: true,
          sections: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: ''
        },
        sessionId: result.session_id,
        score: result.score,
        totalQuestions: result.total_questions,
        correctAnswers: result.correct_answers,
        isPassed: result.is_passed,
        timeSpent: result.time_spent,
        attemptNumber: result.attempt_number,
        sectionScores: [], // TODO: Load section scores
        completedAt: new Date(result.completed_at),
        certificateId: result.certificate_id,
        grade: result.grade
      }));

      return {
        success: true,
        data: results,
        message: 'Results loaded successfully'
      };
    }
  },
  async submitTest(sessionId: string): Promise<ApiResponse<any>> {
    try {
      if (isDemoMode || !supabase) {
        await delay(500);
        return { success: false, message: 'Test submission not available in demo mode' };
      }

      // Get session data
      const { data: session, error: sessionError } = await supabase
        .from('test_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (sessionError || !session) {
        return { success: false, message: 'Session not found' };
      }

      // Get all answers for this session
      const { data: answers } = await supabase
        .from('test_answers')
        .select('*')
        .eq('session_id', sessionId);

      // Get questions to calculate score
      const { data: questions } = await supabase
        .from('questions')
        .select(`
          id,
          question_options(id, is_correct)
      // Get basic analytics from test results
      let query = supabase
        .from('test_results')
        .select(`
          score,
          is_passed,
          time_spent,
          users (
            name,
            roles (name)
          ),
          surveys (title)
        `);

      if (filters?.dateRange) {
        query = query
          .gte('completed_at', filters.dateRange.start.toISOString())
          .lte('completed_at', filters.dateRange.end.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;

      const results = data || [];
      const totalAttempts = results.length;
      const passedResults = results.filter((r: any) => r.is_passed);
      const passRate = totalAttempts > 0 ? (passedResults.length / totalAttempts) * 100 : 0;
      const averageScore = totalAttempts > 0 ? results.reduce((sum: number, r: any) => sum + r.score, 0) / totalAttempts : 0;
      const averageTime = totalAttempts > 0 ? results.reduce((sum: number, r: any) => sum + (r.time_spent / 60), 0) / totalAttempts : 0;

      const analytics: AnalyticsData = {
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
        data: analytics,
        message: 'Analytics loaded successfully'
      };
      const totalQuestions = questions?.length || 0;

      (answers || []).forEach(answer => {
        const question = questions?.find(q => q.id === answer.question_id);
        if (question) {
          const correctOptions = question.question_options.filter(opt => opt.is_correct).map(opt => opt.id);
          const selectedOptions = answer.selected_options || [];
          
          // Check if answer is correct (all correct options selected, no incorrect ones)
          const isCorrect = correctOptions.length === selectedOptions.length &&
                           correctOptions.every(opt => selectedOptions.includes(opt));
          
          if (isCorrect) correctAnswers++;
        }
      });

      const score = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
      const { data: surveyData } = await supabase.from('surveys').select('passing_score').eq('id', session.survey_id).single();
      const passingScore = surveyData?.passing_score || 70;
      // Get results data for export
      const { data, error } = await supabase
        .from('test_results')
        .select(`
          score,
          is_passed,
          completed_at,
          users (name, email),
          surveys (title)
        `)
        .order('completed_at', { ascending: false });

      if (error) throw error;

      // Convert to CSV
      const headers = 'Name,Email,Survey,Score,Status,Completed At\n';
      const rows = (data || []).map((result: any) => 
        `${result.users.name},${result.users.email},${result.surveys.title},${result.score},${result.is_passed ? 'Passed' : 'Failed'},${result.completed_at}`
      ).join('\n');

      return {
        success: true,
        data: headers + rows,
        message: 'Results exported successfully'
      };
        .insert({
          user_id: session.user_id,
          survey_id: session.survey_id,
          session_id: sessionId,
          score,
          total_questions: totalQuestions,
          correct_answers: correctAnswers,
          is_passed: isPassed,
          time_spent: (session.time_remaining || 0),
          attempt_number: session.attempt_number
        })
        .select()
        .single();

      if (resultError) {
        return { success: false, message: resultError.message };
      }

      // Update session status
      await supabase
        .from('test_sessions')
        .update({
      const { data, error } = await supabase
        .from('certificates')
        .select(`
          id,
          user_id,
          survey_id,
          result_id,
          certificate_number,
          issued_at,
          valid_until,
          download_count,
          certificate_status,
          created_at,
          users (
            id,
            name,
            email,
            roles (
              id,
              name
            )
          ),
          surveys (
            id,
            title
          )
        `)
        .order('issued_at', { ascending: false });

      if (error) throw error;

      const certificates: Certificate[] = (data || []).map((cert: any) => ({
        id: cert.id,
        userId: cert.user_id,
        user: {
          id: cert.users.id,
          name: cert.users.name,
          email: cert.users.email,
          role: cert.users.roles,
          roleId: cert.users.roles.id,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        surveyId: cert.survey_id,
        survey: {
          id: cert.surveys.id,
          title: cert.surveys.title,
          description: '',
          targetDate: new Date(),
          duration: 0,
          totalQuestions: 0,
          passingScore: 0,
          maxAttempts: 0,
          isActive: true,
          sections: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: ''
        },
        resultId: cert.result_id,
        certificateNumber: cert.certificate_number,
        issuedAt: new Date(cert.issued_at),
        validUntil: cert.valid_until ? new Date(cert.valid_until) : undefined,
        downloadCount: cert.download_count,
        status: cert.certificate_status as any
      }));

      return {
        success: true,
        data: certificates,
        message: 'Certificates loaded successfully'
      };
        .eq('id', sessionId);

      // Get session details
      const { data: session, error: sessionError } = await supabase
        .from('test_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (sessionError) throw sessionError;

      // Get all answers for this session
      const { data: answers, error: answersError } = await supabase
        .from('test_answers')
        .select(`
          question_id,
          selected_options,
          questions (
            question_options (
              id,
              is_correct
            )
      // Update download count
      const { error: updateError } = await supabase
        .from('certificates')
        .update({
          download_count: supabase.rpc('increment_download_count', { cert_id: certificateId })
        })
        .eq('id', certificateId);

      // For now, return a placeholder PDF blob
      // TODO: Implement actual PDF generation
      const pdfContent = 'Certificate PDF Content - To be implemented';
      const blob = new Blob([pdfContent], { type: 'application/pdf' });

      return {
        success: true,
        data: blob,
        message: 'Certificate downloaded successfully'
      };

      // Calculate score
      let correctAnswers = 0;
      const totalQuestions = answers.length;

      answers.forEach((answer: any) => {
        const correctOptions = answer.questions.question_options
          .filter((opt: any) => opt.is_correct)
          .map((opt: any) => opt.id);
        
        const selectedOptions = answer.selected_options || [];
        
        // Check if answer is correct
        const isCorrect = correctOptions.length === selectedOptions.length &&
          correctOptions.every((opt: string) => selectedOptions.includes(opt));
        
        if (isCorrect) correctAnswers++;
      });
      const { error } = await supabase
        .from('certificates')
        .update({
          certificate_status: 'revoked',
          updated_at: new Date().toISOString()
        })
        .eq('id', certificateId);

      if (error) throw error;

      return {
        success: true,
        message: 'Certificate revoked successfully'
      };
        .from('surveys')
        .select('passing_score')
        .eq('id', session.survey_id)
        .single();

      if (surveyDataError) throw surveyDataError;

      const isPassed = score >= surveyData.passing_score;
      const timeSpent = (session.time_remaining || 0) > 0 ? 
        (35 * 60) - session.time_remaining : 35 * 60; // Calculate time spent

      // Update session as completed
      const { error: updateSessionError } = await supabase
        .from('test_sessions')
        .update({
          session_status: 'completed',
          score,
          is_passed: isPassed,
          completed_at: new Date().toISOString(),
          end_time: new Date().toISOString()
        })
        .eq('id', sessionId);

      if (updateSessionError) throw updateSessionError;

      // Create test result
      const { data: resultData, error: resultError } = await supabase
        .from('test_results')
        .insert({
          user_id: session.user_id,
          survey_id: session.survey_id,
          session_id: sessionId,
          score,
          total_questions: totalQuestions,
      const { data, error } = await supabase
        .from('system_settings')
        .select(`
          id,
          category,
          setting_key,
          setting_value,
          description,
          setting_type,
          is_editable,
          options,
          updated_at,
          updated_by
        `)
        .order('category', { ascending: true });

      if (error) throw error;

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
        data: settings,
        message: 'Settings loaded successfully'
      };
        .select()
        .single();

      if (resultError) throw resultError;

      // Create certificate if passed
      let certificateId = null;
      if (isPassed) {
        const certificateNumber = `CERT-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        
        const { data: certData, error: certError } = await supabase
          .from('certificates')
          .insert({
            user_id: session.user_id,
            survey_id: session.survey_id,
            result_id: resultData.id,
            certificate_number: certificateNumber,
            certificate_status: 'active'
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('system_settings')
        .update({
          setting_value: value,
          updated_at: new Date().toISOString(),
          updated_by: user?.id
        })
        .eq('id', settingId);

      if (error) throw error;

      return {
        success: true,
        message: 'Setting updated successfully'
      };
          certificateId = certData.id;
          
          // Update result with certificate ID
          await supabase
            .from('test_results')
            .update({ certificate_id: certificateId })
            .eq('id', resultData.id);
        }
      }

      const testResult: TestResult = {
        id: resultData.id,
        userId: session.user_id,
        user: {} as User, // Will be populated by calling code if needed
        surveyId: session.survey_id,
        survey: {} as Survey, // Will be populated by calling code if needed
        sessionId,
        score,
        totalQuestions,
        correctAnswers,
        isPassed,
        timeSpent,
        attemptNumber: session.attempt_number,
        sectionScores: [], // TODO: Calculate section scores
        completedAt: new Date(),
        certificateId
      };

      return {
        success: true,
        data: testResult,
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Get user profile to check zone/region assignments
      const { data: userProfile, error: userError } = await supabase
        .from('users')
        .select('zone, region')
        .eq('id', user.id)
        .single();

      if (userError) throw userError;

      // Get available tests (surveys assigned to user's zone/region or unassigned)
      let surveysQuery = supabase
        .from('surveys')
        .select(`
          id,
          title,
          description,
          target_date,
          duration,
          total_questions,
          passing_score,
          max_attempts,
          assigned_zones,
          assigned_regions
        `)
        .eq('is_active', true);

      const { data: surveys, error: surveysError } = await surveysQuery;
      if (surveysError) throw surveysError;

      // Filter surveys based on user's zone/region
      const availableSurveys = (surveys || []).filter((survey: any) => {
        const zones = survey.assigned_zones || [];
        const regions = survey.assigned_regions || [];
        
        // If no zones/regions assigned, survey is available to all
        if (zones.length === 0 && regions.length === 0) return true;
        
        // Check if user's zone/region matches
        const zoneMatch = zones.length === 0 || zones.includes(userProfile.zone);
        const regionMatch = regions.length === 0 || regions.includes(userProfile.region);
        
        return zoneMatch && regionMatch;
      });

      // Get user's test attempts
      const { data: attempts, error: attemptsError } = await supabase
        .from('test_sessions')
        .select('survey_id, attempt_number')
        .eq('user_id', user.id);

      if (attemptsError) throw attemptsError;

      const attemptCounts = (attempts || []).reduce((acc: any, attempt: any) => {
        acc[attempt.survey_id] = Math.max(acc[attempt.survey_id] || 0, attempt.attempt_number);
        return acc;
      }, {});

      // Get completed tests
      const { data: completedResults, error: resultsError } = await supabase
        .from('test_results')
        .select(`
          id,
          score,
          is_passed,
          completed_at,
          attempt_number,
          certificate_id,
          surveys (title)
        `)
        .eq('user_id', user.id)
        .order('completed_at', { ascending: false });

      if (resultsError) throw resultsError;

      // Get certificates
      const { data: certificates, error: certsError } = await supabase
        .from('certificates')
        .select(`
          id,
          certificate_number,
          issued_at,
          certificate_status,
          download_count,
          surveys (
            id,
            title
          ),
          users (
            id,
            name,
            email,
            roles (
              id,
              name
            )
          )
        `)
        .eq('user_id', user.id)
        .order('issued_at', { ascending: false });

      if (certsError) throw certsError;

      // Transform data
      const availableTests: AvailableTest[] = availableSurveys.map((survey: any) => {
        const attemptsUsed = attemptCounts[survey.id] || 0;
        const attemptsLeft = survey.max_attempts - attemptsUsed;
        const daysLeft = Math.ceil((new Date(survey.target_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        
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
          isEligible: attemptsLeft > 0 && daysLeft >= 0
        };
      });

      const completedTests: CompletedTest[] = (completedResults || []).map((result: any) => ({
        resultId: result.id,
        surveyTitle: result.surveys.title,
        score: result.score,
        isPassed: result.is_passed,
        completedAt: new Date(result.completed_at),
        attemptNumber: result.attempt_number,
        certificateId: result.certificate_id
      }));

      const upcomingTests: UpcomingTest[] = availableSurveys
        .filter((survey: any) => {
          const daysLeft = Math.ceil((new Date(survey.target_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
          return daysLeft >= 0 && (attemptCounts[survey.id] || 0) < survey.max_attempts;
        })
        .map((survey: any) => {
          const daysLeft = Math.ceil((new Date(survey.target_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
          return {
            surveyId: survey.id,
            title: survey.title,
            targetDate: new Date(survey.target_date),
            daysLeft,
            isOverdue: daysLeft < 0
          };
        });

      const userCertificates: Certificate[] = (certificates || []).map((cert: any) => ({
        id: cert.id,
        userId: cert.users.id,
        user: {
          id: cert.users.id,
          name: cert.users.name,
          email: cert.users.email,
          role: cert.users.roles,
          roleId: cert.users.roles.id,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        surveyId: cert.surveys.id,
        survey: {
          id: cert.surveys.id,
          title: cert.surveys.title,
          description: '',
          targetDate: new Date(),
          duration: 0,
          totalQuestions: 0,
          passingScore: 0,
          maxAttempts: 0,
          isActive: true,
          sections: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: ''
        },
        resultId: '',
        certificateNumber: cert.certificate_number,
        issuedAt: new Date(cert.issued_at),
        downloadCount: cert.download_count,
        status: cert.certificate_status as any
      }));

      // Calculate statistics
      const totalAttempts = completedTests.length;
      const passedTests = completedTests.filter(t => t.isPassed).length;
      const averageScore = totalAttempts > 0 ? 
        completedTests.reduce((sum, t) => sum + t.score, 0) / totalAttempts : 0;
      const overallProgress = availableTests.length > 0 ? 
        (completedTests.length / availableTests.length) * 100 : 0;

      const dashboardData: EnumeratorDashboard = {
        availableTests,
        completedTests,
        upcomingTests,
        certificates: userCertificates,
        overallProgress,
        averageScore,
        totalAttempts,
        passedTests
      };

      return {
        success: true,
        data: dashboardData,
        message: 'Enumerator dashboard loaded successfully'
      };
        .update({
          current_question_index: updates.currentQuestionIndex,
          time_remaining: updates.timeRemaining,
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId);

      if (error) throw error;

      return {
        success: true,
        message: 'Session updated successfully'
      };
    }
  },
  async syncOfflineData(): Promise<ApiResponse<void>> {
    if (isDemoMode) {
      await delay(200);
      return { success: true, message: 'Sync completed (demo mode)' };
    }
    return { success: false, message: 'Not implemented' };
  },
  async logSecurityViolation(sessionId: string, violation: string): Promise<ApiResponse<void>> {
    if (isDemoMode) {
      await delay(100);
      return { success: true, message: 'Security violation logged (demo mode)' };
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('activity_logs')
        .insert({
          user_id: user?.id,
          activity_type: 'security_violation',
          description: `Security violation during test: ${violation}`,
          metadata: { session_id: sessionId, violation }
        });

      if (error) throw error;
      // Get basic dashboard data first
      const basicDashboard = await dashboardApi.getDashboardData();
      if (!basicDashboard.success || !basicDashboard.data) {
        throw new Error('Failed to load basic dashboard data');
      }

      // Get zone-specific data
      const { data: zones, error: zonesError } = await supabase
        .from('users')
        .select('zone')
        .not('zone', 'is', null)
        .neq('zone', '');

      if (zonesError) throw zonesError;

      const uniqueZones = [...new Set((zones || []).map((u: any) => u.zone))];
      const totalZones = uniqueZones.length;

      const { data: regions, error: regionsError } = await supabase
        .from('users')
        .select('region')
        .not('region', 'is', null)
        .neq('region', '');

      if (regionsError) throw regionsError;

      const uniqueRegions = [...new Set((regions || []).map((u: any) => u.region))];
      const totalRegions = uniqueRegions.length;

      const zoDashboard: ZODashboard = {
        ...basicDashboard.data,
        totalZones,
        totalRegions,
        zonePerformance: [], // TODO: Calculate zone performance
        regionalBreakdown: [], // TODO: Calculate regional breakdown
        topPerformingRegions: [],
        lowPerformingRegions: []
      };

      return {
        success: true,
        data: zoDashboard,
        message: 'ZO dashboard loaded successfully'
      };
// Placeholder APIs for other dashboard types
export const zoDashboardApi = {
  async getDashboardData(dateFilter: string): Promise<ApiResponse<ZODashboard>> {
    if (isDemoMode) {
      await delay(500);
      // Get basic dashboard data first
      const basicDashboard = await dashboardApi.getDashboardData();
      if (!basicDashboard.success || !basicDashboard.data) {
        throw new Error('Failed to load basic dashboard data');
      }

      // Get district-specific data
      const { data: districts, error: districtsError } = await supabase
        .from('users')
        .select('district')
        .not('district', 'is', null)
        .neq('district', '');

      if (districtsError) throw districtsError;

      const uniqueDistricts = [...new Set((districts || []).map((u: any) => u.district))];
      const totalDistricts = uniqueDistricts.length;

      // Get supervisors count
      const { data: supervisors, error: supervisorsError } = await supabase
        .from('users')
        .select('id, roles!inner(name)')
        .eq('roles.name', 'Supervisor');

      if (supervisorsError) throw supervisorsError;

      const totalSupervisors = supervisors?.length || 0;

      const roDashboard: RODashboard = {
        ...basicDashboard.data,
        totalDistricts,
        totalSupervisors,
        districtPerformance: [], // TODO: Calculate district performance
        supervisorPerformance: [], // TODO: Calculate supervisor performance
        enumeratorDistribution: [] // TODO: Calculate enumerator distribution
      };

      return {
        success: true,
        data: roDashboard,
        message: 'RO dashboard loaded successfully'
      };

export const roDashboardApi = {
  async getDashboardData(dateFilter: string): Promise<ApiResponse<RODashboard>> {
    if (isDemoMode) {
      await delay(500);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Get basic dashboard data first
      const basicDashboard = await dashboardApi.getDashboardData();
      if (!basicDashboard.success || !basicDashboard.data) {
        throw new Error('Failed to load basic dashboard data');
      }

      // Get enumerators under this supervisor
      const { data: enumerators, error: enumError } = await supabase
        .from('users')
        .select(`
          id,
          name,
          email,
          jurisdiction,
          roles!inner(name)
        `)
        .eq('roles.name', 'Enumerator')
        .eq('parent_id', user.id);

      if (enumError) throw enumError;
      const { data, error } = await supabase
        .from('questions')
        .select(`
          id,
          section_id,
          text,
          question_type,
          complexity,
          points,
          explanation,
          question_order,
          created_at,
          updated_at,
          question_options (
            id,
            text,
            is_correct,
            option_order
          )
        `)
        .order('question_order', { ascending: true });

      if (error) throw error;

      const questions: Question[] = (data || []).map((question: any) => ({
        id: question.id,
        sectionId: question.section_id,
        text: question.text,
        type: question.question_type as any,
        complexity: question.complexity as any,
        options: (question.question_options || [])
          .sort((a: any, b: any) => a.option_order - b.option_order)
          .map((option: any) => ({
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
        data: questions,
        message: 'Questions loaded successfully'
      };
        totalEnumerators,
        teamPerformance: [], // TODO: Calculate team performance
        enumeratorStatus: [], // TODO: Get enumerator status
        upcomingDeadlines: [] // TODO: Calculate upcoming deadlines
      };

      return {
        success: true,
        data: supervisorDashboard,
        message: 'Supervisor dashboard loaded successfully'
      };

export const supervisorDashboardApi = {
  async getDashboardData(dateFilter: string): Promise<ApiResponse<SupervisorDashboard>> {
    if (isDemoMode) {
      await delay(500);
      return { success: false, message: 'Supervisor Dashboard not available in demo mode' };
    }
    return { success: false, message: 'Not implemented' };
  }
};

export const enumeratorApi = {
  async getEnumeratorStatus(): Promise<ApiResponse<any[]>> {
    if (isDemoMode) {
      await delay(300);
      return { success: true, message: 'Demo mode', data: [] };
    }
    return { success: false, message: 'Not implemented' };
  }
};
      // Create question
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

      if (questionError) throw questionError;

      // Create question options
      const optionsToInsert = questionData.options.map((option: any, index: number) => ({
        question_id: questionResult.id,
        text: option.text,
        is_correct: option.isCorrect,
        option_order: index + 1
      }));

      const { data: optionsResult, error: optionsError } = await supabase
        .from('question_options')
        .insert(optionsToInsert)
        .select();

      if (optionsError) throw optionsError;

      const question: Question = {
        id: questionResult.id,
        sectionId: questionResult.section_id,
        text: questionResult.text,
        type: questionResult.question_type as any,
        complexity: questionResult.complexity as any,
        options: optionsResult.map((option: any) => ({
          id: option.id,
          text: option.text,
          isCorrect: option.is_correct
        })),
        correctAnswers: optionsResult
          .filter((option: any) => option.is_correct)
          .map((option: any) => option.id),
        explanation: questionResult.explanation,
        points: questionResult.points,
        order: questionResult.question_order,
        createdAt: new Date(questionResult.created_at),
        updatedAt: new Date(questionResult.updated_at)
      };

      return {
        success: true,
        data: question,
        message: 'Question created successfully'
      };
          name,
          email,
          jurisdiction,
          last_login,
          roles!inner(name)
        `)
        .eq('roles.name', 'Enumerator')
        .order('name', { ascending: true });

      if (error) throw error;

      // TODO: Get survey status for each enumerator
      const enumeratorStatus: EnumeratorStatus[] = (data || []).map((user: any) => ({
        id: user.id,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          jurisdiction: user.jurisdiction,
          role: { name: 'Enumerator' },
          roleId: '',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        surveys: [], // TODO: Load survey status
        overallProgress: 0,
        totalCertificates: 0,
        lastActivity: user.last_login ? new Date(user.last_login) : new Date()
      }));

      // Update question
      const { data: questionResult, error: questionError } = await supabase
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

      if (questionError) throw questionError;

      // Update options (delete old ones and create new ones)
      const { error: deleteError } = await supabase
        .from('question_options')
        .delete()
        .eq('question_id', questionId);

      if (deleteError) throw deleteError;

      const optionsToInsert = questionData.options.map((option: any, index: number) => ({
        question_id: questionId,
        text: option.text,
        is_correct: option.isCorrect,
        option_order: index + 1
      }));

      const { data: optionsResult, error: optionsError } = await supabase
        .from('question_options')
        .insert(optionsToInsert)
        .select();

      if (optionsError) throw optionsError;

      const question: Question = {
        id: questionResult.id,
        sectionId: questionResult.section_id,
        text: questionResult.text,
        type: questionResult.question_type as any,
        complexity: questionResult.complexity as any,
        options: optionsResult.map((option: any) => ({
          id: option.id,
          text: option.text,
          isCorrect: option.is_correct
        })),
        correctAnswers: optionsResult
          .filter((option: any) => option.is_correct)
          .map((option: any) => option.id),
        explanation: questionResult.explanation,
        points: questionResult.points,
        order: questionResult.question_order,
        createdAt: new Date(questionResult.created_at),
        updatedAt: new Date(questionResult.updated_at)
      };

      return {
        success: true,
        data: question,
        message: 'Question updated successfully'
      };
    }
    return { success: false, message: 'Not implemented' };
  },
  async createQuestion(questionData: any): Promise<ApiResponse<Question>> {
    if (isDemoMode) {
      await delay(500);
      return { success: false, message: 'Question creation not available in demo mode' };
    }
    return { success: false, message: 'Not implemented' };
  },
  async updateQuestion(questionId: string, questionData: any): Promise<ApiResponse<Question>> {
    if (isDemoMode) {
      await delay(500);
      return { success: false, message: 'Question updates not available in demo mode' };
    }
    return { success: false, message: 'Not implemented' };
  },
  async deleteQuestion(questionId: string): Promise<ApiResponse<void>> {
      const { error } = await supabase
        .from('questions')
        .delete()
        .eq('id', questionId);

      if (error) throw error;

      return {
        success: true,
        message: 'Question deleted successfully'
      };
  },
  async uploadQuestions(surveyId: string, questions: any[]): Promise<ApiResponse<void>> {
    if (isDemoMode) {
      await delay(500);
      return { success: false, message: 'Question upload not available in demo mode' };
    }
    return { success: false, message: 'Not implemented' };
  }
};