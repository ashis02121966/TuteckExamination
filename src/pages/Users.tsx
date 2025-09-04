import React, { useState, useEffect } from 'react';
import { Layout } from '../components/Layout/Layout';
import { Card } from '../components/UI/Card';
import { Button } from '../components/UI/Button';
import { Input } from '../components/UI/Input';
import { Modal } from '../components/UI/Modal';
import { userApi, roleApi } from '../services/api';
import { User } from '../types';
import { Plus, Search, Edit, Trash2, UserCheck, UserX } from 'lucide-react';
import { formatDateTime } from '../utils';

export function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [error, setError] = useState('');
  const [formErrors, setFormErrors] = useState({
    name: '',
    email: '',
    roleId: '',
    password: ''
  });
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    roleId: '',
    jurisdiction: '',
    zone: '',
    region: '',
    district: '',
    employeeId: '',
    phoneNumber: ''
  });

  useEffect(() => {
    fetchUsers();
    fetchRoles();
  }, []);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      console.log('Users page: Fetching users...');
      const response = await userApi.getUsers();
      console.log('Users page: API response:', response);
      setUsers(response.data || []);
      
      // Show message if no users found
      if (!response.data || response.data.length === 0) {
        console.log('Users page: No users found');
        if (!response.success) {
          setError(response.message);
        }
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
      setError('Failed to load users. Please try again.');
      setUsers([]); // Ensure users is always an array
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const response = await roleApi.getRoles();
      setRoles(response.data || []);
    } catch (error) {
      console.error('Failed to fetch roles:', error);
      setRoles([]);
    }
  };

  const handleCreateUser = async () => {
    setError('');
    
    // Validate required fields
    if (!formData.name.trim()) {
      setError('Name is required');
      return;
    }
    
    if (!formData.email.trim()) {
      setError('Email is required');
      return;
    }
    
    if (!formData.roleId) {
      setError('Role is required');
      return;
    }
    
    if (!formData.password.trim()) {
      setError('Password is required');
      return;
    }
    
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address');
      return;
    }
    
    try {
      setIsCreating(true);
      const response = await userApi.createUser(formData);
      if (response.success && response.data) {
        setUsers([...users, response.data]);
        setIsCreateModalOpen(false);
        resetForm();
        alert(response.message); // Show success message with default password
      } else {
        setError(response.message);
      }
    } catch (error) {
      console.error('Failed to create user:', error);
      setError('Failed to create user. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleEditUser = async () => {
    setError('');
    
    // Validate required fields
    if (!formData.name.trim()) {
      setError('Name is required');
      return;
    }
    
    if (!formData.email.trim()) {
      setError('Email is required');
      return;
    }
    
    if (!formData.roleId) {
      setError('Role is required');
      return;
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address');
      return;
    }
    
    if (!selectedUser) return;
    
    try {
      setIsEditing(true);
      const response = await userApi.updateUser(selectedUser.id, formData);
      if (response.success && response.data) {
        setUsers(users.map(user => user.id === selectedUser.id ? response.data! : user));
        setIsEditModalOpen(false);
        resetForm();
        alert('User updated successfully!');
      } else {
        setError(response.message);
      }
    } catch (error) {
      console.error('Failed to update user:', error);
      setError('Failed to update user. Please try again.');
    } finally {
      setIsEditing(false);
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      try {
        const response = await userApi.deleteUser(id);
        if (response.success) {
          setUsers(users.filter(user => user.id !== id));
        }
      } catch (error) {
        console.error('Failed to delete user:', error);
      }
    }
  };

  const openEditModal = (user: User) => {
    setSelectedUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: '', // Don't pre-fill password for security
      roleId: user.roleId,
      jurisdiction: user.jurisdiction || '',
      zone: user.zone || '',
      region: user.region || '',
      district: user.district || '',
      employeeId: user.employeeId || '',
      phoneNumber: user.phoneNumber || ''
    });
    setIsEditModalOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      roleId: '',
      jurisdiction: '',
      zone: '',
      region: '',
      district: '',
      employeeId: '',
      phoneNumber: ''
    });
    setSelectedUser(null);
  };

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.role.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Layout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
            <p className="text-gray-600 mt-2">Manage system users and their roles</p>
          </div>
          <Button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add User</span>
          </Button>
        </div>

        <Card>
          <div className="mb-6">
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-500 mt-2">Loading users...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Plus className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Users Found</h3>
              <p className="text-gray-500 mb-4">
                {users.length === 0 
                  ? 'No users exist in the system yet. Get started by creating your first user or initializing the database.'
                  : 'No users match your search criteria.'
                }
              </p>
              {users.length === 0 && (
                <div className="space-y-2">
                  <Button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="flex items-center space-x-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create First User</span>
                  </Button>
                  <p className="text-sm text-gray-500">
                    Or go to the <a href="/login" className="text-blue-600 hover:text-blue-700">login page</a> to initialize the database
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">User</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Role</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Jurisdiction</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Status</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Created</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium text-gray-900">{user.name}</p>
                          <p className="text-sm text-gray-500">{user.email}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {user.role.name}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-900">
                        {user.jurisdiction || 'N/A'}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center space-x-1 ${user.isActive ? 'text-green-600' : 'text-red-600'}`}>
                          {user.isActive ? <UserCheck className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
                          <span className="text-sm">{user.isActive ? 'Active' : 'Inactive'}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-500 text-sm">
                        {formatDateTime(user.createdAt)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          <button 
                            onClick={() => openEditModal(user)}
                            className="p-1 text-blue-600 hover:text-blue-700"
                            title="Edit User"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            className="p-1 text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Create User Modal */}
        <Modal
          isOpen={isCreateModalOpen}
          onClose={() => {
            setIsCreateModalOpen(false);
            resetForm();
          }}
          title="Create New User"
          size="lg"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Full Name *"
                value={formData.name}
                onChange={(e) => {
                  setFormData({ ...formData, name: e.target.value });
                  if (formErrors.name) {
                    setFormErrors({ ...formErrors, name: '' });
                  }
                }}
                placeholder="Enter full name"
                error={formErrors.name}
              />
              <Input
                label="Email Address *"
                type="email"
                value={formData.email}
                onChange={(e) => {
                  setFormData({ ...formData, email: e.target.value });
                  if (formErrors.email) {
                    setFormErrors({ ...formErrors, email: '' });
                  }
                }}
                placeholder="Enter email address"
                error={formErrors.email}
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Password *"
                type="password"
                value={formData.password}
                onChange={(e) => {
                  setFormData({ ...formData, password: e.target.value });
                  if (formErrors.password) {
                    setFormErrors({ ...formErrors, password: '' });
                  }
                }}
                placeholder="Enter password (min 6 characters)"
                error={formErrors.password}
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password Strength
                </label>
                <div className="text-sm text-gray-600">
                  {formData.password.length === 0 && <span className="text-gray-400">Enter a password</span>}
                  {formData.password.length > 0 && formData.password.length < 6 && <span className="text-red-600">Too short</span>}
                  {formData.password.length >= 6 && formData.password.length < 8 && <span className="text-yellow-600">Weak</span>}
                  {formData.password.length >= 8 && !/[A-Z]/.test(formData.password) && <span className="text-yellow-600">Add uppercase</span>}
                  {formData.password.length >= 8 && /[A-Z]/.test(formData.password) && !/\d/.test(formData.password) && <span className="text-blue-600">Add number</span>}
                  {formData.password.length >= 8 && /[A-Z]/.test(formData.password) && /\d/.test(formData.password) && <span className="text-green-600">Strong</span>}
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role *
                </label>
                <select
                  value={formData.roleId}
                  onChange={(e) => {
                    setFormData({ ...formData, roleId: e.target.value });
                    if (formErrors.roleId) {
                      setFormErrors({ ...formErrors, roleId: '' });
                    }
                  }}
                  className={`block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    formErrors.roleId ? 'border-red-300' : 'border-gray-300'
                  }`}
                >
                  <option value="">Select role</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name} (Level {role.level})
                    </option>
                  ))}
                </select>
                {formErrors.roleId && (
                  <p className="text-sm text-red-600 mt-1">{formErrors.roleId}</p>
                )}
              </div>
              <Input
                label="Employee ID"
                value={formData.employeeId}
                onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                placeholder="Enter employee ID"
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Phone Number"
                value={formData.phoneNumber}
                onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                placeholder="Enter phone number"
              />
              <Input
                label="Jurisdiction"
                value={formData.jurisdiction}
                onChange={(e) => setFormData({ ...formData, jurisdiction: e.target.value })}
                placeholder="Enter jurisdiction"
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label="Zone"
                value={formData.zone}
                onChange={(e) => setFormData({ ...formData, zone: e.target.value })}
                placeholder="e.g., North Zone, South Zone"
              />
              <Input
                label="Region"
                value={formData.region}
                onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                placeholder="e.g., Delhi Region, Mumbai Region"
              />
              <Input
                label="District"
                value={formData.district}
                onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                placeholder="Enter district"
              />
            </div>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h4 className="font-medium text-yellow-900 mb-2">Survey Assignment</h4>
              <p className="text-sm text-yellow-800 mb-2">
                To ensure the user can access tests, make sure their Zone and Region match the survey assignments:
              </p>
              <div className="text-xs text-yellow-700 space-y-1">
                <p><strong>Available Zones:</strong> North Zone, South Zone, East Zone</p>
                <p><strong>Available Regions:</strong> Delhi Region, Mumbai Region, Kolkata Region</p>
                <p><strong>Note:</strong> Users without zone/region assignments can access all surveys</p>
              </div>
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">Login Credentials</h4>
              <p className="text-sm text-blue-800">
                <strong>Password:</strong> {formData.password || 'Enter password above'} (user should change on first login)
              </p>
              <p className="text-xs text-blue-700 mt-1">
                The user will receive their login credentials and should change the password immediately.
              </p>
            </div>
            
            <div className="flex justify-end space-x-3 pt-4">
              <Button
                variant="secondary"
                onClick={() => {
                  setIsCreateModalOpen(false);
                  resetForm();
                }}
                disabled={isCreating}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleCreateUser}
                loading={isCreating}
                disabled={isCreating}
              >
                {isCreating ? 'Creating User...' : 'Create User'}
              </Button>
            </div>
          </div>
        </Modal>

        {/* Edit User Modal */}
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            resetForm();
          }}
          title="Edit User"
          size="lg"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Full Name *"
                value={formData.name}
                onChange={(e) => {
                  setFormData({ ...formData, name: e.target.value });
                  if (formErrors.name) {
                    setFormErrors({ ...formErrors, name: '' });
                  }
                }}
                placeholder="Enter full name"
                error={formErrors.name}
              />
              <Input
                label="Email Address *"
                type="email"
                value={formData.email}
                onChange={(e) => {
                  setFormData({ ...formData, email: e.target.value });
                  if (formErrors.email) {
                    setFormErrors({ ...formErrors, email: '' });
                  }
                }}
                placeholder="Enter email address"
                error={formErrors.email}
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="New Password (leave empty to keep current)"
                type="password"
                value={formData.password}
                onChange={(e) => {
                  setFormData({ ...formData, password: e.target.value });
                  if (formErrors.password) {
                    setFormErrors({ ...formErrors, password: '' });
                  }
                }}
                placeholder="Enter new password (optional)"
                error={formErrors.password}
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password Strength
                </label>
                <div className="text-sm text-gray-600">
                  {formData.password.length === 0 && <span className="text-gray-400">Password unchanged</span>}
                  {formData.password.length > 0 && formData.password.length < 6 && <span className="text-red-600">Too short</span>}
                  {formData.password.length >= 6 && formData.password.length < 8 && <span className="text-yellow-600">Weak</span>}
                  {formData.password.length >= 8 && !/[A-Z]/.test(formData.password) && <span className="text-yellow-600">Add uppercase</span>}
                  {formData.password.length >= 8 && /[A-Z]/.test(formData.password) && !/\d/.test(formData.password) && <span className="text-blue-600">Add number</span>}
                  {formData.password.length >= 8 && /[A-Z]/.test(formData.password) && /\d/.test(formData.password) && <span className="text-green-600">Strong</span>}
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role *
                </label>
                <select
                  value={formData.roleId}
                  onChange={(e) => {
                    setFormData({ ...formData, roleId: e.target.value });
                    if (formErrors.roleId) {
                      setFormErrors({ ...formErrors, roleId: '' });
                    }
                  }}
                  className={`block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    formErrors.roleId ? 'border-red-300' : 'border-gray-300'
                  }`}
                >
                  <option value="">Select role</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name} (Level {role.level})
                    </option>
                  ))}
                </select>
                {formErrors.roleId && (
                  <p className="text-sm text-red-600 mt-1">{formErrors.roleId}</p>
                )}
              </div>
              <Input
                label="Employee ID"
                value={formData.employeeId}
                onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                placeholder="Enter employee ID"
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Phone Number"
                value={formData.phoneNumber}
                onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                placeholder="Enter phone number"
              />
              <Input
                label="Jurisdiction"
                value={formData.jurisdiction}
                onChange={(e) => setFormData({ ...formData, jurisdiction: e.target.value })}
                placeholder="Enter jurisdiction"
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label="Zone"
                value={formData.zone}
                onChange={(e) => setFormData({ ...formData, zone: e.target.value })}
                placeholder="e.g., North Zone, South Zone"
              />
              <Input
                label="Region"
                value={formData.region}
                onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                placeholder="e.g., Delhi Region, Mumbai Region"
              />
              <Input
                label="District"
                value={formData.district}
                onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                placeholder="Enter district"
              />
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">Edit User Information</h4>
              <p className="text-sm text-blue-800">
                Update user details as needed. Leave password field empty to keep the current password unchanged.
              </p>
            </div>
            
            <div className="flex justify-end space-x-3 pt-4">
              <Button
                variant="secondary"
                onClick={() => {
                  setIsEditModalOpen(false);
                  resetForm();
                }}
                disabled={isEditing}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleEditUser}
                loading={isEditing}
                disabled={isEditing}
              >
                {isEditing ? 'Updating User...' : 'Update User'}
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </Layout>
  );
}