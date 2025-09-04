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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState('');

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleInitializeDatabase = async () => {
    setIsInitializing(true);
    setError('');
    
    try {
      const result = await DataInitializer.initializeDatabase();
      
      if (result.success) {
        setError('');
        // Show success message briefly
        alert('Database initialized successfully! You can now login with the demo credentials.');
      } else {
        setError(result.message);
      }
    } catch (error) {
      console.error('Database initialization error:', error);
      setError('Failed to initialize database. Please try again.');
    }
    
    setIsInitializing(false);
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
          </div>

          {/* Database Initialization Section */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="text-sm font-semibold text-blue-800 mb-2">First Time Setup</h3>
            <p className="text-xs text-blue-700 mb-3">
              If this is your first time using the system, please initialize the database with demo data.
            </p>
            <Button
              onClick={handleInitializeDatabase}
              disabled={isInitializing}
              variant="outline"
              size="sm"
              className="w-full text-blue-700 border-blue-300 hover:bg-blue-100"
            >
              {isInitializing ? 'Initializing Database...' : 'Initialize Database'}
            </Button>
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
             autoComplete="off"
             autoFocus={false}
              required
            />

            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
             autoComplete="new-password"
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

          {/* Demo Credentials Info */}
          <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <h3 className="text-sm font-semibold text-gray-800 mb-2">Demo Credentials</h3>
            <div className="text-xs text-gray-600 space-y-1">
              <p><strong>Admin:</strong> admin@esigma.com / password123</p>
              <p><strong>Enumerator:</strong> enumerator@esigma.com / password123</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}