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
        return {
          success: false,
          message: 'Authentication failed - no user data'
        };
      }

      // Get user profile from database
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select(`
          *,
          role:roles(*)
        `)
        .eq('id', authData.user.id)
        .single();

      if (userError || !userData) {
        console.error('User profile fetch error:', userError);
        return {
          success: false,
          message: 'Failed to load user profile'
        };
      }

      // Transform database user to application user format
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

      // Update last login
      await supabase
        .from('users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', user.id);

      // Log activity
      await ActivityLogger.logLogin(user.id, user.email);

      return {
        success: true,
        message: 'Login successful',
        data: {
          user,
          token: authData.session?.access_token || 'demo-token'
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
      console.error('Logout API error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Logout failed'
      };
    }
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<ApiResponse<void>> {
    try {
      if (isDemoMode) {
        await delay(500);
        return { success: true, message: 'Password changed successfully (demo mode)' };
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
      console.error('Change password API error:', error);
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
      if (isDemoMode) {
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
          ],
          performanceBySurvey: [
            { name: 'Digital Literacy', value: 15, total: 20, percentage: 75 },
            { name: 'Data Collection', value: 8, total: 10, percentage: 80 },
            { name: 'Survey Methodology', value: 2, total: 5, percentage: 40 }
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

      // Real implementation would fetch from Supabase
      return {
        success: false,
        message: 'Dashboard data not available'
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
    if (isDemoMode) {
      await delay(300);
      return { success: true, message: 'Demo mode', data: [] };
    }
    return { success: false, message: 'Not implemented' };
  },
  async getAnalytics(filters: AnalyticsFilter): Promise<ApiResponse<AnalyticsData>> {
    if (isDemoMode) {
      await delay(300);
      return { success: false, message: 'Analytics not available in demo mode' };
    }
    return { success: false, message: 'Not implemented' };
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
    if (isDemoMode) {
      await delay(300);
      return { success: true, message: 'Demo mode', data: [] };
    }
    return { success: false, message: 'Not implemented' };
  },
  async downloadCertificate(certificateId: string): Promise<any> {
    if (isDemoMode) {
      await delay(300);
      return { success: false, message: 'Download not available in demo mode' };
    }
    return { success: false, message: 'Not implemented' };
  },
  async revokeCertificate(certificateId: string): Promise<ApiResponse<void>> {
    if (isDemoMode) {
      await delay(300);
      return { success: false, message: 'Certificate revocation not available in demo mode' };
    }
    return { success: false, message: 'Not implemented' };
  }
};

export const settingsApi = {
  async getSettings(): Promise<ApiResponse<SystemSettings[]>> {
    if (isDemoMode) {
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
    return { success: false, message: 'Not implemented' };
  },
  async updateSetting(settingId: string, value: string): Promise<ApiResponse<void>> {
    if (isDemoMode) {
      await delay(300);
      return { success: false, message: 'Settings updates not available in demo mode' };
    }
    return { success: false, message: 'Not implemented' };
  }
};

export const enumeratorDashboardApi = {
  async getDashboardData(): Promise<ApiResponse<EnumeratorDashboard>> {
    if (isDemoMode) {
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
            user: demoUsers[4] as User,
            surveyId: '550e8400-e29b-41d4-a716-446655440020',
            survey: demoSurveys[0] as Survey,
            resultId: '1',
            certificateNumber: 'CERT-2024-001',
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
    return { success: false, message: 'Not implemented' };
  }
};

export const testApi = {
  async createTestSession(surveyId: string): Promise<ApiResponse<TestSession>> {
    if (isDemoMode) {
      await delay(500);
      return { success: false, message: 'Test sessions not available in demo mode' };
    }
    return { success: false, message: 'Not implemented' };
  },
  async getSession(sessionId: string): Promise<ApiResponse<TestSession>> {
    if (isDemoMode) {
      await delay(300);
      return { success: false, message: 'Test sessions not available in demo mode' };
    }
    return { success: false, message: 'Not implemented' };
  },
  async getQuestionsForSurvey(surveyId: string): Promise<ApiResponse<Question[]>> {
    if (isDemoMode) {
      await delay(300);
      return { success: false, message: 'Questions not available in demo mode' };
    }
    return { success: false, message: 'Not implemented' };
  },
  async saveAnswer(sessionId: string, questionId: string, selectedOptions: string[]): Promise<ApiResponse<void>> {
    if (isDemoMode) {
      await delay(100);
      return { success: true, message: 'Answer saved (demo mode)' };
    }
    return { success: false, message: 'Not implemented' };
  },
  async updateSession(sessionId: string, sessionData: any): Promise<ApiResponse<void>> {
    if (isDemoMode) {
      await delay(200);
      return { success: true, message: 'Session updated (demo mode)' };
    }
    return { success: false, message: 'Not implemented' };
  },
  async submitTest(sessionId: string): Promise<ApiResponse<any>> {
    if (isDemoMode) {
      await delay(500);
      return { success: false, message: 'Test submission not available in demo mode' };
    }
    return { success: false, message: 'Not implemented' };
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
    }
    return { success: false, message: 'Not implemented' };
  }
};

// Placeholder APIs for other dashboard types
export const zoDashboardApi = {
  async getDashboardData(dateFilter: string): Promise<ApiResponse<ZODashboard>> {
    if (isDemoMode) {
      await delay(500);
      return { success: false, message: 'ZO Dashboard not available in demo mode' };
    }
    return { success: false, message: 'Not implemented' };
  }
};

export const roDashboardApi = {
  async getDashboardData(dateFilter: string): Promise<ApiResponse<RODashboard>> {
    if (isDemoMode) {
      await delay(500);
      return { success: false, message: 'RO Dashboard not available in demo mode' };
    }
    return { success: false, message: 'Not implemented' };
  }
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

export const questionApi = {
  async getQuestions(): Promise<ApiResponse<Question[]>> {
    if (isDemoMode) {
      await delay(300);
      return { success: true, message: 'Demo mode', data: [] };
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
    if (isDemoMode) {
      await delay(300);
      return { success: false, message: 'Question deletion not available in demo mode' };
    }
    return { success: false, message: 'Not implemented' };
  },
  async uploadQuestions(surveyId: string, questions: any[]): Promise<ApiResponse<void>> {
    if (isDemoMode) {
      await delay(500);
      return { success: false, message: 'Question upload not available in demo mode' };
    }
    return { success: false, message: 'Not implemented' };
  }
};