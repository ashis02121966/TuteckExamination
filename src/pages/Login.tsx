import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/UI/Button';
import { Input } from '../components/UI/Input';
import { DataInitializer } from '../services/dataInitializer';
import { FileText, AlertCircle, Users, Building, UserCheck, User } from 'lucide-react';
import { isDemoMode } from '../lib/supabase';

export function Login() {
  const { login, logout, isAuthenticated } = useAuth();
  const [email, setEmail] = useState('admin@esigma.com');
  const [password, setPassword] = useState('password123');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState('');

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleInitializeDatabase = async () => {
    setIsInitializing(true);
    setError('');
    
    if (isDemoMode) {
      setError('Supabase is not configured. Please set up your Supabase credentials in the .env file and restart the development server. Then click "Initialize Database" on the login page.');
      setIsInitializing(false);
      return;
    }

    try {
      console.log('Starting database initialization...');
      const result = await DataInitializer.initializeDatabase();
      console.log('Database initialization result:', result);
      
      if (result.success) {
        setError(''); // Clear any previous errors
        logout(); // Clear any stale session tokens
        alert(`Database initialized successfully! ${result.message}\n\nYou can now login with the demo credentials:\n- admin@esigma.com / password123\n- enumerator@esigma.com / password123`);
      } else {
        console.error('Database initialization failed:', result);
        setError(`Database initialization failed: ${result.message}`);
        if (result.error) {
          console.error('Detailed error:', result.error);
        }
      }
    } catch (error) {
      console.error('Database initialization exception:', error);
      setError(`Failed to initialize database: ${error instanceof Error ? error.message : 'Unknown error'}. Please check your Supabase configuration.`);
    } finally {
      setIsInitializing(false);
    }
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }
    
    setIsLoading(true);
    setError('');

    try {
      const result = await login(email, password);
      
      if (!result.success) {
        setError(result.message);
      } else {
        // Login successful, navigation will be handled by the auth context
        console.log('Login successful');
      }
    } catch (error) {
      console.error('Login error:', error);
      setError('Login failed. Please try again.');
    }
    
    setIsLoading(false);
  };

  const demoCredentials = [
    { role: 'Admin', email: 'admin@esigma.com', icon: Users, color: 'bg-red-100 text-red-700', password: 'password123', roleId: '550e8400-e29b-41d4-a716-446655440010' },
    { role: 'ZO User', email: 'zo@esigma.com', icon: Building, color: 'bg-purple-100 text-purple-700', password: 'password123', roleId: '550e8400-e29b-41d4-a716-446655440011' },
    { role: 'RO User', email: 'ro@esigma.com', icon: Building, color: 'bg-indigo-100 text-indigo-700', password: 'password123', roleId: '550e8400-e29b-41d4-a716-446655440012' },
    { role: 'Supervisor', email: 'supervisor@esigma.com', icon: UserCheck, color: 'bg-green-100 text-green-700', password: 'password123', roleId: '550e8400-e29b-41d4-a716-446655440013' },
    { role: 'Candidate', email: 'enumerator@esigma.com', icon: User, color: 'bg-blue-100 text-blue-700', password: 'password123', roleId: '550e8400-e29b-41d4-a716-446655440014' }
  ];

  const handleDemoLogin = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('password123');
    setError(''); // Clear any existing errors
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-xl shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="mb-6">
              <img 
                src="/Tuteck-Logo_Darkmode-2.svg" 
                alt="Tuteck Technologies Pvt. Ltd." 
                className="h-20 mx-auto object-contain"
              />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Online Examination Platform</h1>
            <p className="text-gray-600 mt-2">Tuteck Technologies Pvt. Ltd.</p>
            <p className="text-gray-500 text-sm mt-1">Sign in to your account</p>
            {isDemoMode && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-yellow-800 text-sm font-medium">Demo Mode</p>
                <p className="text-yellow-700 text-xs">Configure Supabase to enable full functionality</p>
              </div>
            )}
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email Address"
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email address"
              required
            />

            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full"
              size="lg"
            >
              {isLoading ? 'Signing In...' : 'Sign In'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            {isDemoMode ? (
              <div className="space-y-3">
                <p className="text-sm text-gray-500">
                  Demo mode - Limited functionality without Supabase
                </p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-medium text-blue-900 mb-2">To enable full functionality:</h4>
                  <ol className="text-sm text-blue-800 text-left space-y-1">
                    <li>1. Create a Supabase project at <a href="https://supabase.com" target="_blank" className="underline">supabase.com</a></li>
                    <li>2. Get your project URL and API keys from Settings → API</li>
                    <li>3. Update the .env file with your credentials</li>
                    <li>4. Restart the development server</li>
                    <li>5. Click "Initialize Database" to set up the schema</li>
                  </ol>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-gray-500">
                  Enter your credentials to access the examination platform
                </p>
                <Button
                  onClick={handleInitializeDatabase}
                  loading={isInitializing}
                  variant="secondary"
                  className="w-full flex items-center justify-center space-x-2"
                >
                  <FileText className="w-4 h-4" />
                  <span>{isInitializing ? 'Initializing Database...' : 'Initialize Database'}</span>
                </Button>
              </div>
            )}
          </div>
          
          {!isDemoMode && (
            <div className="mt-6 space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-medium text-green-900 mb-2">Demo Credentials</h4>
                <p className="text-sm text-green-800 mb-3">Click on any user below to auto-fill the login form:</p>
                <div className="grid grid-cols-1 gap-2">
                  {demoCredentials.map((cred) => (
                    <button
                      key={cred.email}
                      onClick={() => handleDemoLogin(cred.email)}
                      className={`flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors ${cred.color}`}
                    >
                      <div className="flex items-center space-x-2">
                        <cred.icon className="w-4 h-4" />
                        <div className="text-left">
                          <div className="text-sm font-medium">{cred.role}</div>
                          <div className="text-xs opacity-75">Level {cred.roleId.slice(-1)}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-mono">{cred.email}</div>
                        <div className="text-xs font-mono opacity-75">password123</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <h5 className="font-medium text-blue-900 mb-2">Login Instructions:</h5>
                <ol className="text-sm text-blue-800 space-y-1">
                  <li>1. Click on any user role above to auto-fill the form</li>
                  <li>2. Or manually enter: <span className="font-mono">email</span> and <span className="font-mono">password123</span></li>
                  <li>3. Click "Sign In" to access the platform</li>
                </ol>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}