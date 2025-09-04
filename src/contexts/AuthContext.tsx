import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useCallback } from 'react';
import { User } from '../types';
import { authApi } from '../services/api';
import { supabase, isDemoMode } from '../lib/supabase';
import { Modal } from '../components/UI/Modal';
import { Button } from '../components/UI/Button';
import { Input } from '../components/UI/Input';
import { AlertCircle, Lock } from 'lucide-react';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; message: string }>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showPasswordChangeModal, setShowPasswordChangeModal] = useState(false);
  const [passwordChangeData, setPasswordChangeData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordChangeError, setPasswordChangeError] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const initializeAuth = useCallback(async () => {
    try {
      // First check if we have a Supabase session
      if (supabase) {
        // Validate the current session by checking if the user is still valid
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (user && !userError) {
          // We have a valid user, now get the session
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();
          
          if (session && !sessionError) {
          // We have a valid Supabase session, fetch user details from database
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select(`
              *,
              role:roles(*)
            `)
            .eq('id', user.id)
            .maybeSingle();
          
          if (userData && !userError) {
            const user = {
              id: userData.id,
              name: userData.name,
              email: userData.email,
              role: userData.role,
              jurisdiction: userData.jurisdiction,
              isActive: userData.is_active,
              createdAt: new Date(userData.created_at),
              updatedAt: new Date(userData.updated_at)
            };
            
            setUser(user);
            setIsLoading(false);
            return;
          } else {
            // User data fetch failed, clear authentication state
            await logout();
            setUser(null);
            setIsLoading(false);
            return;
          }
          } else {
            // Session is invalid, clear authentication state
            await logout();
            setUser(null);
            setIsLoading(false);
            return;
          }
        } else {
          // User validation failed (invalid/expired refresh token), clear authentication state
          await logout();
          setUser(null);
          setIsLoading(false);
          return;
        }
      }
    } catch (error) {
      console.error('Auth initialization error:', error);
      
      // Clear authentication state on error
      try {
        await logout();
      } catch (logoutError) {
        // Ignore logout errors during cleanup
      }
      setUser(null);
    }
    
    setIsLoading(false);
  }, []);

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  useEffect(() => {
    // Listen for auth state changes if Supabase is available
    if (supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          if (event === 'SIGNED_OUT' || !session) {
            setUser(null);
          }
        }
      );
      
      return () => subscription.unsubscribe();
    }
  }, []);

  const login = async (email: string, password: string) => {
    try {
      console.log('Attempting login with:', email);
      console.log('Demo mode status:', isDemoMode);
      const response = await authApi.login(email, password);
      console.log('Login response:', response);
      
      if (response.success && response.data) {
        const { user, token, session } = response.data;
        console.log('Setting user:', user);
        
        // Check if this is first login (password hasn't been changed) - only in production mode
        // Disabled first login password change requirement
        const isFirstLogin = false;
        
        // Re-initialize auth state to get user from Supabase session
        await initializeAuth();
        
        // Show password change modal for first login (only in production mode)
        if (isFirstLogin) {
          setShowPasswordChangeModal(true);
        }
        
        return { success: true, message: response.message };
      }
      
      return { success: false, message: response.message };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, message: 'Login failed. Please try again.' };
    }
  };

  const handlePasswordChange = async () => {
    setPasswordChangeError('');
    
    // Validate inputs
    if (!passwordChangeData.currentPassword) {
      setPasswordChangeError('Current password is required');
      return;
    }
    
    if (!passwordChangeData.newPassword) {
      setPasswordChangeError('New password is required');
      return;
    }
    
    if (passwordChangeData.newPassword.length < 6) {
      setPasswordChangeError('New password must be at least 6 characters long');
      return;
    }
    
    if (passwordChangeData.newPassword !== passwordChangeData.confirmPassword) {
      setPasswordChangeError('New passwords do not match');
      return;
    }
    
    if (passwordChangeData.currentPassword === passwordChangeData.newPassword) {
      setPasswordChangeError('New password must be different from current password');
      return;
    }
    
    try {
      setIsChangingPassword(true);
      
      // Call API to change password
      const response = await authApi.changePassword(
        passwordChangeData.currentPassword,
        passwordChangeData.newPassword
      );
      
      if (response.success) {
        setShowPasswordChangeModal(false);
        setPasswordChangeData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        alert('Password changed successfully! Please remember your new password.');
      } else {
        setPasswordChangeError(response.message);
      }
    } catch (error) {
      console.error('Password change error:', error);
      setPasswordChangeError('Failed to change password. Please try again.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleSkipPasswordChange = () => {
    if (window.confirm('Are you sure you want to skip changing your password? It is recommended to change your default password for security.')) {
      setShowPasswordChangeModal(false);
      setPasswordChangeData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch (error) {
      // Check if the error is related to missing/invalid session
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('Auth session missing!') || 
          errorMessage.includes('session_not_found') ||
          errorMessage.includes('Session from session_id claim in JWT does not exist')) {
        // Session already invalid/missing - this is expected in some cases
        console.info('Logout: Session was already invalid or missing');
      } else {
        // Log other logout errors normally
        console.error('Logout error:', error);
      }
    } finally {
      setUser(null);
    }
  };

  const value = {
    user,
    isLoading,
    login,
    logout,
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
      
      {/* First Login Password Change Modal */}
      <Modal
        isOpen={showPasswordChangeModal}
        onClose={() => {}} // Prevent closing without action
        title="Change Your Password"
        size="md"
      >
        <div className="space-y-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-yellow-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">First Login - Change Password</h3>
            <p className="text-gray-600">
              For security reasons, please change your default password before continuing.
            </p>
          </div>
          
          {passwordChangeError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <p className="text-red-700 text-sm">{passwordChangeError}</p>
            </div>
          )}
          
          <div className="space-y-4">
            <Input
              label="Current Password"
              type="password"
              value={passwordChangeData.currentPassword}
              onChange={(e) => setPasswordChangeData({ 
                ...passwordChangeData, 
                currentPassword: e.target.value 
              })}
              placeholder="Enter your current password"
            />
            
            <Input
              label="New Password"
              type="password"
              value={passwordChangeData.newPassword}
              onChange={(e) => setPasswordChangeData({ 
                ...passwordChangeData, 
                newPassword: e.target.value 
              })}
              placeholder="Enter your new password (min 6 characters)"
            />
            
            <Input
              label="Confirm New Password"
              type="password"
              value={passwordChangeData.confirmPassword}
              onChange={(e) => setPasswordChangeData({ 
                ...passwordChangeData, 
                confirmPassword: e.target.value 
              })}
              placeholder="Confirm your new password"
            />
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">Password Requirements</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• At least 6 characters long</li>
                <li>• Different from your current password</li>
                <li>• Use a combination of letters, numbers, and symbols for better security</li>
              </ul>
            </div>
          </div>
          
          <div className="flex justify-between space-x-3 pt-4 border-t">
            <Button
              variant="secondary"
              onClick={handleSkipPasswordChange}
              disabled={isChangingPassword}
            >
              Skip for Now
            </Button>
            <Button
              onClick={handlePasswordChange}
              loading={isChangingPassword}
              disabled={isChangingPassword}
              className="flex items-center space-x-2"
            >
              <Lock className="w-4 h-4" />
              <span>Change Password</span>
            </Button>
          </div>
        </div>
      </Modal>
    </AuthContext.Provider>
  );
}